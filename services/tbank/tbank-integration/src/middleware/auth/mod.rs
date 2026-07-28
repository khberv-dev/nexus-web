// T-Bank Authentication Module
// 
// This module provides authentication and authorization functionality for T-Bank integration.
// It has been refactored into submodules for better organization and maintainability.

pub mod types;
pub mod validation;
pub mod permissions;
pub mod middleware;
pub mod config;

#[cfg(test)]
pub mod tests;

// Re-export commonly used types and functions for backward compatibility
pub use types::{TBankAuthState, TBankPermission, TBankRateLimitConfig};
pub use validation::{
    validate_zitadel_token, 
    validate_tbank_api_key, 
    validate_internal_service_token,
    generate_internal_service_token,
    check_rate_limit_placeholder,
};
pub use permissions::{
    extract_tbank_permissions,
    has_tbank_permission,
    map_zitadel_roles_to_tbank_permissions,
};
pub use middleware::{
    auth_middleware,
    rate_limit_middleware,
    require_tbank_permission,
    tbank_auth_middleware,
    tbank_rate_limit_middleware,
};
pub use config::{load_auth_config_from_env, AuthConfig};