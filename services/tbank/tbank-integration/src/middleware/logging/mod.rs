// T-Bank Logging Module
//
// This module provides comprehensive logging functionality for T-Bank integration.
// It has been refactored into submodules for better organization and maintainability.

pub mod middleware;
pub mod context;
pub mod config;
pub mod formatting;
pub mod utils;
pub mod structured;

#[cfg(test)]
pub mod tests;

// Re-export commonly used functions and types for backward compatibility
pub use middleware::logging_middleware;
pub use context::{
    extract_or_generate_correlation_id,
    extract_client_ip,
    add_tracking_headers,
    add_response_headers,
    CORRELATION_ID_HEADER,
    REQUEST_ID_HEADER,
};
pub use config::LoggingConfig;
pub use formatting::{
    init_structured_logging,
    configure_log_format,
    get_log_level_for_environment,
};
pub use utils::{
    extract_endpoint_pattern,
    get_status_class,
    format_duration,
    StatusClass,
};
pub use structured::LogContext;