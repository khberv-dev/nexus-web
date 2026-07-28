use anyhow::Result;
use chrono::{DateTime, Utc};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use parking_lot::RwLock;
use reqwest;
use serde_json::Value;
use std::sync::Arc;

use super::cache::ZitadelCacheStats;
use super::claims::ZitadelClaims;
use super::jwks::Jwks;

/// Zitadel JWT Validator
#[derive(Clone)]
pub struct ZitadelValidator {
    pub jwks_uri: String,
    pub issuer: String,
    pub audience: String,
    pub client: reqwest::Client,
    #[allow(clippy::type_complexity)]
    pub jwks_cache: Arc<RwLock<Option<(Jwks, DateTime<Utc>)>>>,
    pub cache_duration_minutes: i64,
}

impl ZitadelValidator {
    /// Create new Zitadel validator
    pub fn new(issuer: String, audience: String) -> Self {
        let jwks_uri = format!("{}/.well-known/openid_configuration/jwks", issuer);

        Self {
            jwks_uri,
            issuer,
            audience,
            client: reqwest::Client::new(),
            jwks_cache: Arc::new(RwLock::new(None)),
            cache_duration_minutes: 60, // Cache JWKS for 1 hour
        }
    }

    /// Create Zitadel validator with custom JWKS URI
    pub fn with_jwks_uri(issuer: String, audience: String, jwks_uri: String) -> Self {
        Self {
            jwks_uri,
            issuer,
            audience,
            client: reqwest::Client::new(),
            jwks_cache: Arc::new(RwLock::new(None)),
            cache_duration_minutes: 60,
        }
    }

    /// Create Zitadel validator with custom cache duration
    pub fn with_cache_duration(
        issuer: String,
        audience: String,
        cache_duration_minutes: i64,
    ) -> Self {
        let jwks_uri = format!("{}/.well-known/openid_configuration/jwks", issuer);

        Self {
            jwks_uri,
            issuer,
            audience,
            client: reqwest::Client::new(),
            jwks_cache: Arc::new(RwLock::new(None)),
            cache_duration_minutes,
        }
    }

    /// Validate Zitadel JWT token
    pub async fn validate_token(&self, token: &str) -> Result<ZitadelClaims> {
        match self.validate_token_internal(token).await {
            Ok(claims) => Ok(claims),
            Err(e) => {
                // Check if error is related to signature/key mismatch
                let error_msg = e.to_string();
                if error_msg.contains("InvalidSignature") || error_msg.contains("No key found") {
                    tracing::warn!("🔄 Signature validation failed, refreshing JWKS and retrying");
                    
                    // Refresh JWKS cache
                    if let Err(refresh_err) = self.refresh_cache().await {
                        tracing::error!("❌ Failed to refresh JWKS cache: {}", refresh_err);
                        return Err(e);
                    }
                    
                    // Retry validation with fresh keys
                    tracing::info!("🔄 Retrying validation with refreshed JWKS");
                    self.validate_token_internal(token).await
                } else {
                    Err(e)
                }
            }
        }
    }

    /// Internal validation method (without retry)
    async fn validate_token_internal(&self, token: &str) -> Result<ZitadelClaims> {
        // 1. Decode header to get kid
        tracing::info!("🔍 Starting JWT validation");
        tracing::debug!("🔍 Token length: {}, issuer: {}, audience: {}", token.len(), self.issuer, self.audience);
        
        let header = jsonwebtoken::decode_header(token)
            .map_err(|e| {
                tracing::error!("❌ Failed to decode JWT header: {}", e);
                anyhow::anyhow!("Failed to decode JWT header: {}", e)
            })?;

        let kid = header
            .kid
            .ok_or_else(|| {
                tracing::error!("❌ JWT header missing 'kid' field");
                anyhow::anyhow!("JWT header missing 'kid' field")
            })?;

        tracing::info!("🔍 JWT header decoded successfully, kid: {}, alg: {:?}", kid, header.alg);

        // 2. Get JWKS (with caching)
        tracing::debug!("🔍 Fetching JWKS from: {}", self.jwks_uri);
        let jwks = self.get_jwks().await.map_err(|e| {
            tracing::error!("❌ Failed to get JWKS: {}", e);
            e
        })?;
        
        tracing::info!("🔍 JWKS fetched successfully, {} keys available", jwks.keys.len());

        // 3. Find the key with matching kid
        let key = jwks
            .keys
            .iter()
            .find(|k| k.kid == kid)
            .ok_or_else(|| {
                tracing::error!("❌ No key found with kid: {}. Available kids: {:?}", 
                    kid, 
                    jwks.keys.iter().map(|k| &k.kid).collect::<Vec<_>>()
                );
                anyhow::anyhow!("No key found with kid: {}", kid)
            })?;

        tracing::info!("🔍 Found matching key with kid: {}", kid);

        // 4. Create decoding key from RSA components
        let decoding_key = DecodingKey::from_rsa_components(&key.n, &key.e)
            .map_err(|e| {
                tracing::error!("❌ Failed to create decoding key: {}", e);
                anyhow::anyhow!("Failed to create decoding key: {}", e)
            })?;

        tracing::debug!("🔍 Decoding key created successfully");

        // 5. Set up validation with flexible audience checking
        let mut validation = Validation::new(Algorithm::RS256);
        
        // Support both formats: project ID and URN
        let project_id = self.audience.clone();
        let urn_audience = format!("urn:zitadel:iam:org:project:id:{}:aud", project_id);
        
        validation.set_audience(&[&project_id, &urn_audience]);
        validation.set_issuer(&[&self.issuer]);
        validation.validate_exp = true;
        validation.validate_nbf = true;

        tracing::debug!("🔍 Validation config: issuer={}, audience=[{}, {}], validate_exp={}, validate_nbf={}", 
            self.issuer, project_id, urn_audience, validation.validate_exp, validation.validate_nbf);

        // 6. Decode and validate token
        let token_data = decode::<ZitadelClaims>(token, &decoding_key, &validation)
            .map_err(|e| {
                tracing::error!("❌ JWT validation failed: {}", e);
                tracing::debug!("❌ Validation error details: {:?}", e);
                anyhow::anyhow!("JWT validation failed: {}", e)
            })?;

        tracing::info!("✅ JWT validation successful for user: {}", token_data.claims.sub);
        tracing::debug!("✅ Claims: iss={}, aud={:?}, exp={}", 
            token_data.claims.iss, 
            token_data.claims.aud, 
            token_data.claims.exp
        );

        Ok(token_data.claims)
    }

    /// Validate token without audience validation (for service-to-service)
    pub async fn validate_token_no_audience(&self, token: &str) -> Result<ZitadelClaims> {
        // 1. Decode header to get kid
        let header = jsonwebtoken::decode_header(token)
            .map_err(|e| anyhow::anyhow!("Failed to decode JWT header: {}", e))?;

        let kid = header
            .kid
            .ok_or_else(|| anyhow::anyhow!("JWT header missing 'kid' field"))?;

        // 2. Get JWKS (with caching)
        let jwks = self.get_jwks().await?;

        // 3. Find the key with matching kid
        let key = jwks
            .keys
            .iter()
            .find(|k| k.kid == kid)
            .ok_or_else(|| anyhow::anyhow!("No key found with kid: {}", kid))?;

        // 4. Create decoding key from RSA components
        let decoding_key = DecodingKey::from_rsa_components(&key.n, &key.e)
            .map_err(|e| anyhow::anyhow!("Failed to create decoding key: {}", e))?;

        // 5. Set up validation without audience check
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&self.issuer]);
        validation.validate_exp = true;
        validation.validate_nbf = true;
        validation.validate_aud = false; // Skip audience validation

        // 6. Decode and validate token
        let token_data = decode::<ZitadelClaims>(token, &decoding_key, &validation)
            .map_err(|e| anyhow::anyhow!("JWT validation failed: {}", e))?;

        Ok(token_data.claims)
    }

    /// Get JWKS with caching
    async fn get_jwks(&self) -> Result<Jwks> {
        // Check cache first
        {
            let cache = self.jwks_cache.read();
            if let Some((jwks, cached_at)) = cache.as_ref() {
                let cache_expiry =
                    *cached_at + chrono::Duration::minutes(self.cache_duration_minutes);
                if Utc::now() < cache_expiry {
                    return Ok(jwks.clone());
                }
            }
        }

        // Fetch fresh JWKS
        let jwks = self.fetch_jwks().await?;

        // Update cache
        {
            let mut cache = self.jwks_cache.write();
            *cache = Some((jwks.clone(), Utc::now()));
        }

        Ok(jwks)
    }

    /// Fetch JWKS from Zitadel
    async fn fetch_jwks(&self) -> Result<Jwks> {
        let response = self
            .client
            .get(&self.jwks_uri)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch JWKS: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "JWKS request failed with status: {}",
                response.status()
            ));
        }

        let jwks: Jwks = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse JWKS JSON: {}", e))?;

        Ok(jwks)
    }

    /// Clear JWKS cache (useful for testing or forced refresh)
    pub fn clear_cache(&self) {
        let mut cache = self.jwks_cache.write();
        *cache = None;
    }

    /// Force refresh JWKS cache
    pub async fn refresh_cache(&self) -> Result<()> {
        self.clear_cache();
        self.get_jwks().await?;
        Ok(())
    }

    /// Get cache statistics
    pub fn get_cache_stats(&self) -> ZitadelCacheStats {
        let cache = self.jwks_cache.read();
        match cache.as_ref() {
            Some((jwks, cached_at)) => ZitadelCacheStats {
                is_cached: true,
                cached_at: Some(*cached_at),
                keys_count: jwks.keys.len(),
                cache_expiry: Some(
                    *cached_at + chrono::Duration::minutes(self.cache_duration_minutes),
                ),
                is_expired: Utc::now()
                    > *cached_at + chrono::Duration::minutes(self.cache_duration_minutes),
            },
            None => ZitadelCacheStats {
                is_cached: false,
                cached_at: None,
                keys_count: 0,
                cache_expiry: None,
                is_expired: false,
            },
        }
    }

    /// Get issuer
    pub fn issuer(&self) -> &str {
        &self.issuer
    }

    /// Get audience
    pub fn audience(&self) -> &str {
        &self.audience
    }

    /// Get JWKS URI
    pub fn jwks_uri(&self) -> &str {
        &self.jwks_uri
    }

    /// Test connection to Zitadel
    pub async fn test_connection(&self) -> Result<bool> {
        match self.fetch_jwks().await {
            Ok(_) => Ok(true),
            Err(e) => {
                tracing::warn!("Zitadel connection test failed: {}", e);
                Ok(false)
            }
        }
    }

    /// Get OpenID Connect configuration
    pub async fn get_openid_config(&self) -> Result<Value> {
        let config_url = format!("{}/.well-known/openid_configuration", self.issuer);

        let response = self
            .client
            .get(&config_url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch OpenID config: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "OpenID config request failed with status: {}",
                response.status()
            ));
        }

        let config: Value = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse OpenID config JSON: {}", e))?;

        Ok(config)
    }
}
