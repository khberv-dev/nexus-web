use anyhow::Result;
use reqwest;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::{DateTime, Utc, Duration};

use super::claims::ZitadelClaims;

/// Zitadel Token Introspection Response
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IntrospectionResponse {
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aud: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iat: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
}

/// PAT Token Cache Entry
#[derive(Debug, Clone)]
struct PatCacheEntry {
    claims: ZitadelClaims,
    cached_at: DateTime<Utc>,
}

/// PAT Token Validator with caching
#[derive(Clone)]
pub struct PatValidator {
    pub issuer: String,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub client: reqwest::Client,
    pub cache: Arc<RwLock<std::collections::HashMap<String, PatCacheEntry>>>,
    pub cache_duration_minutes: i64,
}

impl PatValidator {
    /// Create new PAT validator
    pub fn new(issuer: String) -> Self {
        Self {
            issuer,
            client_id: None,
            client_secret: None,
            client: reqwest::Client::new(),
            cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
            cache_duration_minutes: 5, // Cache PAT validation for 5 minutes
        }
    }

    /// Create PAT validator with client credentials for introspection
    pub fn with_credentials(
        issuer: String,
        client_id: String,
        client_secret: String,
    ) -> Self {
        Self {
            issuer,
            client_id: Some(client_id),
            client_secret: Some(client_secret),
            client: reqwest::Client::new(),
            cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
            cache_duration_minutes: 5,
        }
    }

    /// Validate PAT token through Zitadel introspection API
    pub async fn validate_pat(&self, token: &str) -> Result<ZitadelClaims> {
        // Check cache first
        if let Some(claims) = self.get_from_cache(token) {
            tracing::debug!("PAT validation: cache hit");
            return Ok(claims);
        }

        tracing::info!("PAT validation: cache miss, calling introspection API");

        // Call introspection endpoint
        let introspection_url = format!("{}/oauth/v2/introspect", self.issuer);
        
        // Prepare form data
        let mut form_data = vec![
            ("token", token.to_string()),
            ("token_type_hint", "access_token".to_string()),
        ];
        
        // Add client_id if available
        if let Some(client_id) = &self.client_id {
            form_data.push(("client_id", client_id.clone()));
        }
        
        let mut request = self.client
            .post(&introspection_url)
            .form(&form_data)
            .timeout(std::time::Duration::from_secs(10));

        // Add basic auth if client_secret is provided
        if let (Some(client_id), Some(client_secret)) = (&self.client_id, &self.client_secret) {
            if !client_secret.is_empty() {
                tracing::info!("Using Basic Auth for introspection");
                request = request.basic_auth(client_id, Some(client_secret));
            } else {
                tracing::info!("CLIENT_SECRET not set, using client_id in form data");
            }
        } else {
            tracing::info!("No credentials configured, using token introspection without auth");
        }

        let response = request
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to call introspection API: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::warn!("Introspection failed: status={}, body={}", status, body);
            return Err(anyhow::anyhow!(
                "Introspection request failed with status: {} - {}",
                status,
                body
            ));
        }

        let introspection: IntrospectionResponse = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse introspection response: {}", e))?;

        // Check if token is active
        if !introspection.active {
            return Err(anyhow::anyhow!("PAT token is not active"));
        }

        // Convert introspection response to ZitadelClaims
        let claims = self.introspection_to_claims(introspection)?;

        // Cache the result
        self.add_to_cache(token, claims.clone());

        Ok(claims)
    }

    /// Convert introspection response to ZitadelClaims
    fn introspection_to_claims(&self, introspection: IntrospectionResponse) -> Result<ZitadelClaims> {
        // Extract subject (user ID)
        let sub = introspection.sub
            .ok_or_else(|| anyhow::anyhow!("Introspection response missing 'sub' field"))?;

        // Extract issuer
        let iss = introspection.iss
            .unwrap_or_else(|| self.issuer.clone());

        // Extract audience
        let aud = introspection.aud
            .unwrap_or_else(|| vec![self.issuer.clone()]);

        // Extract expiration
        let exp = introspection.exp
            .ok_or_else(|| anyhow::anyhow!("Introspection response missing 'exp' field"))?;

        // Extract issued at
        let iat = introspection.iat
            .unwrap_or_else(|| Utc::now().timestamp());

        // Parse scope into roles/permissions
        let scope = introspection.scope.clone().unwrap_or_default();
        let scopes: Vec<String> = scope.split_whitespace().map(|s| s.to_string()).collect();

        // Create ZitadelClaims
        Ok(ZitadelClaims {
            sub,
            iss,
            aud,
            exp,
            iat,
            nbf: Some(iat),
            jti: Some(format!("pat_{}", Utc::now().timestamp())),
            azp: introspection.client_id.clone(),
            scope: Some(scope),
            email: introspection.username.clone(),
            email_verified: Some(true), // Assume verified for service accounts
            name: introspection.username.clone(),
            preferred_username: introspection.username,
            // Service account specific fields
            roles: Some(serde_json::to_value(scopes.clone()).unwrap_or(serde_json::Value::Null)),
            permissions: Some(scopes),
            org_id: None,
            organization_id: None, // Will be set from metadata if available
            project_id: None,
            client_id: introspection.client_id,
            metadata: None,
            extra_fields: std::collections::HashMap::new(), // Empty for PAT tokens
        })
    }

    /// Get claims from cache
    fn get_from_cache(&self, token: &str) -> Option<ZitadelClaims> {
        let cache = self.cache.read();
        if let Some(entry) = cache.get(token) {
            let cache_expiry = entry.cached_at + Duration::minutes(self.cache_duration_minutes);
            if Utc::now() < cache_expiry {
                return Some(entry.claims.clone());
            }
        }
        None
    }

    /// Add claims to cache
    fn add_to_cache(&self, token: &str, claims: ZitadelClaims) {
        let mut cache = self.cache.write();
        cache.insert(
            token.to_string(),
            PatCacheEntry {
                claims,
                cached_at: Utc::now(),
            },
        );

        // Clean up expired entries (simple cleanup)
        let now = Utc::now();
        cache.retain(|_, entry| {
            now < entry.cached_at + Duration::minutes(self.cache_duration_minutes)
        });
    }

    /// Clear cache
    pub fn clear_cache(&self) {
        let mut cache = self.cache.write();
        cache.clear();
    }

    /// Get cache size
    pub fn cache_size(&self) -> usize {
        let cache = self.cache.read();
        cache.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pat_validator_creation() {
        let validator = PatValidator::new("https://auth.ad-quest.ru".to_string());
        assert_eq!(validator.issuer, "https://auth.ad-quest.ru");
        assert_eq!(validator.cache_duration_minutes, 5);
    }

    #[test]
    fn test_pat_validator_with_credentials() {
        let validator = PatValidator::with_credentials(
            "https://auth.ad-quest.ru".to_string(),
            "client_id".to_string(),
            "client_secret".to_string(),
        );
        assert_eq!(validator.client_id, Some("client_id".to_string()));
        assert_eq!(validator.client_secret, Some("client_secret".to_string()));
    }
}
