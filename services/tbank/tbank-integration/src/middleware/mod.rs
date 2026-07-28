pub mod auth;
pub mod error;
pub mod logging;
pub mod metrics;

// Re-export main middleware functions
pub use auth::{
    auth_middleware, rate_limit_middleware,
};

pub use error::{
    adquest_error_to_tbank_error, security_audit_middleware, tbank_error_middleware,
    tbank_error_to_response,
};

pub use logging::{
    init_structured_logging, logging_middleware, LogContext, LoggingConfig, CORRELATION_ID_HEADER,
    REQUEST_ID_HEADER,
};

pub use metrics::{metrics_middleware, rate_limit_metrics_middleware};

// Legacy exports for backward compatibility
pub use auth::{
    extract_tbank_permissions, has_tbank_permission, map_zitadel_roles_to_tbank_permissions,
    require_tbank_permission, tbank_auth_middleware, tbank_rate_limit_middleware, TBankAuthState,
    TBankPermission, TBankRateLimitConfig,
};
