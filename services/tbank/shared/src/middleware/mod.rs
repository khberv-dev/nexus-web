//! Middleware module for ADQuest Rust Performance Engine
//!
//! This module provides comprehensive middleware functionality including:
//! - Authentication and authorization (JWT, Zitadel)
//! - Rate limiting and security
//! - Russian legal compliance (152-ФЗ, ЕРИР)
//! - CORS and HTTP headers
//! - Input validation and security headers

pub mod auth;
pub mod compliance;
pub mod cors;
pub mod security;

// Re-export all middleware functions for convenience
pub use auth::{
    auth_middleware, extract_auth_context, rate_limit_middleware, require_permission, require_role,
    zitadel_auth_middleware, AuthMiddlewareState,
    jwt_only_auth_middleware, jwt_only_rate_limit_middleware, JwtOnlyAuthState,
};
pub use compliance::{compliance_audit_middleware, erir_compliance_middleware};
pub use cors::{cors_middleware, health_check_middleware};
pub use security::{input_validation_middleware, security_headers_middleware};