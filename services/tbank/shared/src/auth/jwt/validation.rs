use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use jsonwebtoken::{decode, Algorithm, Validation};

use crate::auth::{Claims, Permission};
use super::types::JwtAuth;

impl JwtAuth {
    /// Check if user has required permission
    pub fn has_permission(&self, claims: &Claims, required_permission: Permission) -> bool {
        let permission_str = required_permission.to_string();
        claims.permissions.contains(&permission_str.to_string())
    }

    /// Check if user has any of the required roles
    pub fn has_role(&self, claims: &Claims, required_roles: &[&str]) -> bool {
        required_roles
            .iter()
            .any(|role| claims.roles.contains(&role.to_string()))
    }

    /// Get token expiration time
    pub fn get_token_expiration(&self, token: &str) -> Result<i64> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_nbf = false;
        validation.validate_aud = false;

        let token_data = decode::<Claims>(token, &self.decoding_key, &validation)
            .map_err(|e| anyhow::anyhow!("Token decode failed: {}", e))?;

        Ok(token_data.claims.exp)
    }

    /// Check if token is expired
    pub fn is_token_expired(&self, token: &str) -> bool {
        match self.get_token_expiration(token) {
            Ok(exp) => {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                exp < now
            }
            Err(_) => true,
        }
    }
}
