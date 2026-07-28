use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use jsonwebtoken::{decode, encode, Header};
use uuid::Uuid;

use crate::auth::Claims;
use super::types::JwtAuth;

impl JwtAuth {
    /// Generate refresh token
    pub fn generate_refresh_token(&self, user_id: Uuid) -> Result<String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| anyhow::anyhow!("System time error: {}", e))?
            .as_secs() as i64;

        let claims = Claims {
            sub: user_id.to_string(),
            iss: self.issuer.clone(),
            aud: format!("{}-refresh", self.audience),
            exp: now + 86400,
            iat: now,
            nbf: now,
            jti: Uuid::new_v4().to_string(),
            user_id,
            email: String::new(),
            roles: vec![],
            permissions: vec![],
            organization_id: None,
            session_id: Uuid::new_v4().to_string(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| anyhow::anyhow!("Refresh token generation failed: {}", e))
    }

    /// Validate refresh token
    pub fn validate_refresh_token(&self, token: &str) -> Result<Uuid> {
        let mut validation = self.validation.clone();
        validation.set_audience(&[&format!("{}-refresh", self.audience)]);

        let token_data = decode::<Claims>(token, &self.decoding_key, &validation)
            .map_err(|e| anyhow::anyhow!("Refresh token validation failed: {}", e))?;

        Ok(token_data.claims.user_id)
    }
}
