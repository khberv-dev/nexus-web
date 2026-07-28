//! Authentication and authorization module for ADQuest Rust Performance Engine
//!
//! This module provides comprehensive authentication and authorization functionality
//! including JWT validation, Zitadel integration, RBAC permissions, rate limiting,
//! and Russian legal compliance (152-ФЗ, ЕРИР).

pub mod claims;
pub mod jwt;
pub mod secure_cookies;
pub mod permissions;
pub mod rate_limit;
pub mod zitadel;
pub mod extractor;

// Re-export main types and functions for convenience
pub use claims::{AuthContext, Claims};
pub use jwt::JwtAuth;
pub use permissions::{Permission, PermissionCategory};
pub use rate_limit::{RateLimitConfig, RateLimitStats, InMemoryRateLimiter};
pub use zitadel::{Jwk, Jwks, ZitadelClaims, ZitadelValidator};

// Legacy compatibility - these are now available through the new module structure
