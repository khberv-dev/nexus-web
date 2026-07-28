// T-Bank Error Handling Module
//
// This module provides comprehensive error handling functionality for T-Bank integration.
// It has been refactored into submodules for better organization and maintainability.

pub mod types;
pub mod responses;
pub mod middleware;
pub mod audit;
pub mod utils;

#[cfg(test)]
pub mod tests;

// Re-export commonly used functions for backward compatibility
pub use types::adquest_error_to_tbank_error;
pub use responses::{tbank_error_to_response, create_status_error_response};
pub use middleware::tbank_error_middleware;
pub use audit::{security_audit_middleware, log_error_for_audit};
pub use utils::generate_request_id;