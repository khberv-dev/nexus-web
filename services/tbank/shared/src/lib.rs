pub mod api;
pub mod auth;
pub mod cache;
pub mod config;
pub mod database;
pub mod encryption;
pub mod errors;
pub mod health;
pub mod logging;
pub mod metrics;
pub mod middleware;
pub mod models;
pub mod repositories;
pub mod secrets;
pub mod services;
pub mod validation;

#[cfg(test)]
pub mod test_utils;

pub use api::*;
pub use auth::{AuthContext, Claims, JwtAuth, Permission, ZitadelValidator};
pub use cache::{CacheManager, CircuitBreakerManager, RedisRateLimiter};
pub use config::Config;
pub use database::DatabaseManager;
pub use encryption::{EncryptedData, EncryptionService, InputValidator};
pub use errors::*;
pub use health::{ComponentHealth, HealthCheck, HealthChecker, HealthStatus};
pub use middleware::{
    auth_middleware, compliance_audit_middleware, cors_middleware, erir_compliance_middleware,
    extract_auth_context, health_check_middleware, input_validation_middleware, 
    rate_limit_middleware, require_permission, require_role, security_headers_middleware,
    zitadel_auth_middleware, AuthMiddlewareState,
};
pub use validation::{organization::OrganizationValidator, russian_legal::RussianLegalValidator};
pub mod config_helper;
