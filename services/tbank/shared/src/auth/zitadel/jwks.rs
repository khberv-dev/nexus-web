use serde::{Deserialize, Serialize};

/// JWKS (JSON Web Key Set) structures for Zitadel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwk {
    pub kty: String,
    pub kid: String,
    pub r#use: Option<String>,
    pub alg: Option<String>,
    pub n: String,
    pub e: String,
}
