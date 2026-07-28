use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use tracing::{error, warn};

use crate::types::TBankError;
use super::utils::generate_request_id;

/// Convert TBankError to HTTP response
pub fn tbank_error_to_response(error: TBankError) -> Response {
    let (status, error_code, message, details) = match &error {
        TBankError::ValidationError(msg) => (
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "Request validation failed",
            msg.clone(),
        ),
        TBankError::AuthenticationError(msg) => (
            StatusCode::UNAUTHORIZED,
            "AUTHENTICATION_ERROR",
            "Authentication failed",
            msg.clone(),
        ),
        TBankError::SecurityError(msg) => (
            StatusCode::FORBIDDEN,
            "SECURITY_ERROR",
            "Security validation failed",
            msg.clone(),
        ),
        TBankError::CounterpartyNotFound { inn } => (
            StatusCode::NOT_FOUND,
            "COUNTERPARTY_NOT_FOUND",
            "Counterparty not found",
            format!("Counterparty with INN {} not found", inn),
        ),
        TBankError::InvoiceNotFound { id } => (
            StatusCode::NOT_FOUND,
            "INVOICE_NOT_FOUND",
            "Invoice not found",
            format!("Invoice with ID {} not found", id),
        ),
        TBankError::PaymentNotFound { id } => (
            StatusCode::NOT_FOUND,
            "PAYMENT_NOT_FOUND",
            "Payment not found",
            format!("Payment with ID {} not found", id),
        ),
        TBankError::TBankApiError {
            status, message, ..
        } => (
            StatusCode::from_u16(*status).unwrap_or(StatusCode::BAD_GATEWAY),
            "TBANK_API_ERROR",
            "T-Bank API error",
            message.clone(),
        ),
        TBankError::DatabaseError(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
            "Database error",
            err.to_string(),
        ),
        TBankError::CacheError(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "CACHE_ERROR",
            "Cache error",
            msg.clone(),
        ),
        TBankError::ConfigurationError(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "CONFIGURATION_ERROR",
            "Configuration error",
            msg.clone(),
        ),
        TBankError::NetworkError(msg) => (
            StatusCode::BAD_GATEWAY,
            "NETWORK_ERROR",
            "Network error",
            msg.clone(),
        ),
        TBankError::RateLimitExceeded => (
            StatusCode::TOO_MANY_REQUESTS,
            "RATE_LIMIT_EXCEEDED",
            "Rate limit exceeded",
            "Too many requests to T-Bank API".to_string(),
        ),
        TBankError::CircuitBreakerOpen => (
            StatusCode::SERVICE_UNAVAILABLE,
            "CIRCUIT_BREAKER_OPEN",
            "Service temporarily unavailable",
            "T-Bank API circuit breaker is open".to_string(),
        ),
        TBankError::InternalError(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Internal server error",
            msg.clone(),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "UNKNOWN_ERROR",
            "Unknown error occurred",
            error.to_string(),
        ),
    };

    // Log error for monitoring
    match status {
        StatusCode::INTERNAL_SERVER_ERROR
        | StatusCode::BAD_GATEWAY
        | StatusCode::SERVICE_UNAVAILABLE => {
            error!("T-Bank service error: {} - {}", error_code, details);
        }
        StatusCode::BAD_REQUEST | StatusCode::NOT_FOUND => {
            warn!("T-Bank client error: {} - {}", error_code, details);
        }
        _ => {
            warn!("T-Bank error: {} - {}", error_code, details);
        }
    }

    let error_response = json!({
        "error": {
            "code": error_code,
            "message": message,
            "details": details
        },
        "request_id": generate_request_id(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    (status, Json(error_response)).into_response()
}

/// Create standardized error response for HTTP status codes
pub fn create_status_error_response(status: StatusCode) -> serde_json::Value {
    match status {
        StatusCode::UNAUTHORIZED => {
            json!({
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Authentication required",
                    "details": "Valid JWT token required for T-Bank API access"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        StatusCode::FORBIDDEN => {
            json!({
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Insufficient permissions",
                    "details": "User does not have required T-Bank permissions for this operation"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        StatusCode::TOO_MANY_REQUESTS => {
            json!({
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Rate limit exceeded",
                    "details": "Too many requests to T-Bank API endpoint"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        StatusCode::BAD_REQUEST => {
            json!({
                "error": {
                    "code": "BAD_REQUEST",
                    "message": "Invalid request",
                    "details": "Request validation failed"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        StatusCode::NOT_FOUND => {
            json!({
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Resource not found",
                    "details": "Requested T-Bank resource does not exist"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        StatusCode::INTERNAL_SERVER_ERROR => {
            json!({
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Internal server error",
                    "details": "An unexpected error occurred in T-Bank service"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        StatusCode::BAD_GATEWAY => {
            json!({
                "error": {
                    "code": "UPSTREAM_ERROR",
                    "message": "T-Bank API unavailable",
                    "details": "T-Bank API is currently unavailable or returned an error"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        StatusCode::SERVICE_UNAVAILABLE => {
            json!({
                "error": {
                    "code": "SERVICE_UNAVAILABLE",
                    "message": "Service temporarily unavailable",
                    "details": "T-Bank integration service is temporarily unavailable"
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
        _ => {
            json!({
                "error": {
                    "code": "UNKNOWN_ERROR",
                    "message": "Unknown error occurred",
                    "details": format!("HTTP status: {}", status)
                },
                "request_id": generate_request_id(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            })
        }
    }
}