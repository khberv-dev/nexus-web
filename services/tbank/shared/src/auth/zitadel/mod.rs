//! Zitadel integration module for JWT validation and claims processing

pub mod cache;
pub mod claims;
pub mod jwks;
pub mod pat;
pub mod tests;
pub mod validator;

#[cfg(test)]
pub mod integration_test;

// Re-export main types
pub use cache::ZitadelCacheStats;
pub use claims::ZitadelClaims;
pub use jwks::{Jwk, Jwks};
pub use pat::{IntrospectionResponse, PatValidator};
pub use validator::ZitadelValidator;
