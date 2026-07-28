use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Validation};
use anyhow::Result;

/// JWT Authentication service for legacy token support
#[derive(Clone)]
pub struct JwtAuth {
    pub(super) encoding_key: EncodingKey,
    pub(super) decoding_key: DecodingKey,
    pub(super) validation: Validation,
    pub(super) issuer: String,
    pub(super) audience: String,
}

impl JwtAuth {
    /// Create new JWT authentication service
    pub fn new(secret: &str, issuer: String, audience: String) -> Result<Self> {
        let encoding_key = EncodingKey::from_secret(secret.as_bytes());
        let decoding_key = DecodingKey::from_secret(secret.as_bytes());

        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[&issuer]);
        validation.set_audience(&[&audience]);
        validation.validate_exp = true;
        validation.validate_nbf = true;

        Ok(Self {
            encoding_key,
            decoding_key,
            validation,
            issuer,
            audience,
        })
    }

    /// Get issuer
    pub fn issuer(&self) -> &str {
        &self.issuer
    }

    /// Get audience
    pub fn audience(&self) -> &str {
        &self.audience
    }
}
