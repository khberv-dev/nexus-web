use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use jsonwebtoken::{decode, encode, Header};
use uuid::Uuid;

use crate::auth::Claims;
use super::types::JwtAuth;

impl JwtAuth {
    /// Generate JWT token for user
    pub fn generate_token(
        &self,
        user_id: Uuid,
        email: String,
        roles: Vec<String>,
        permissions: Vec<String>,
        organization_id: Option<Uuid>,
    ) -> Result<String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| anyhow::anyhow!("System time error: {}", e))?
            .as_secs() as i64;

        let claims = Claims {
            sub: user_id.to_string(),
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
            exp: now + 3600,
            iat: now,
            nbf: now,
            jti: Uuid::new_v4().to_string(),
            user_id,
            email,
            roles,
            permissions,
            organization_id,
            session_id: Uuid::new_v4().to_string(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| anyhow::anyhow!("Token generation failed: {}", e))
    }

    /// Validate JWT token and extract claims
    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        let token_data = decode::<Claims>(token, &self.decoding_key, &self.validation)
            .map_err(|e| anyhow::anyhow!("Token validation failed: {}", e))?;

        Ok(token_data.claims)
    }
}
