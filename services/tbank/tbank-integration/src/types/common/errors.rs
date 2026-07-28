use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use shared::ADQuestError;
use thiserror::Error;

use crate::types::acquiring::payment::AcquiringPaymentStatus;
use crate::types::b2b::invoice::B2BInvoiceStatus;

pub type TBankResult<T> = Result<T, TBankError>;

#[derive(Debug, Error)]
pub enum TBankError {
    // T-Bank specific validation errors
    #[error("Invalid INN format: {0}")]
    InvalidInn(String),

    #[error("Invalid KPP format: {0}")]
    InvalidKpp(String),

    #[error("Invalid account number format: {0}")]
    InvalidAccountNumber(String),

    #[error("Invalid payment method: {0}")]
    InvalidPaymentMethod(String),

    #[error("Invalid currency: {0}")]
    InvalidCurrency(String),

    // T-Bank API specific errors
    #[error("Counterparty not found: {inn}")]
    CounterpartyNotFound { inn: String },

    #[error("T-Bank API error: {status} - {message}")]
    TBankApiError {
        status: u16,
        message: String,
        error_code: Option<String>,
    },

    #[error("Payment initialization failed: {reason}")]
    PaymentInitializationFailed {
        reason: String,
        transaction_id: Option<String>,
    },

    #[error("Payment processing failed: {reason} (Transaction ID: {transaction_id})")]
    PaymentProcessingFailed {
        reason: String,
        transaction_id: String,
        error_code: Option<String>,
    },

    #[error("Invoice creation failed: {reason}")]
    InvoiceCreationFailed {
        reason: String,
        counterparty_inn: Option<String>,
    },

    #[error("Invoice not found: {id}")]
    InvoiceNotFound { id: uuid::Uuid },

    #[error("Invoice item not found: {id}")]
    InvoiceItemNotFound { id: uuid::Uuid },

    #[error("Invoice contact not found: {id}")]
    InvoiceContactNotFound { id: uuid::Uuid },

    #[error("Payment not found: {id}")]
    PaymentNotFound { id: uuid::Uuid },

    #[error("Webhook event not found: {event_id}")]
    WebhookEventNotFound { event_id: String },

    #[error("Audit log not found: {id}")]
    AuditLogNotFound { id: uuid::Uuid },

    #[error("Invalid invoice status transition from {from:?} to {to:?}")]
    InvalidInvoiceStatusTransition {
        from: B2BInvoiceStatus,
        to: B2BInvoiceStatus,
        invoice_id: Option<uuid::Uuid>,
    },

    #[error("Invalid payment status transition from {from:?} to {to:?}")]
    InvalidPaymentStatusTransition {
        from: AcquiringPaymentStatus,
        to: AcquiringPaymentStatus,
        payment_id: Option<uuid::Uuid>,
    },

    // Webhook and signature errors
    #[error("Invalid webhook signature")]
    InvalidWebhookSignature,

    #[error("Webhook processing failed: {reason}")]
    WebhookProcessingFailed {
        reason: String,
        event_id: Option<String>,
    },

    #[error("Duplicate webhook event: {event_id}")]
    DuplicateWebhookEvent { event_id: String },

    // Balance and reconciliation errors
    #[error("Balance query failed: {account_number} - {reason}")]
    BalanceQueryFailed {
        account_number: String,
        reason: String,
    },

    #[error("Statement retrieval failed: {account_number} - {reason}")]
    StatementRetrievalFailed {
        account_number: String,
        reason: String,
    },

    #[error("Reconciliation failed: {reason}")]
    ReconciliationFailed {
        reason: String,
        date: Option<chrono::NaiveDate>,
    },

    #[error("Transaction matching failed: {transaction_id} - {reason}")]
    TransactionMatchingFailed {
        transaction_id: String,
        reason: String,
    },

    // Environment and configuration errors
    #[error("Sandbox operation not supported in production")]
    SandboxOperationInProduction,

    #[error("Production operation not supported in sandbox")]
    ProductionOperationInSandbox,

    #[error("Environment configuration error: {0}")]
    EnvironmentConfigurationError(String),

    // Wrapped shared errors for integration
    #[error("Shared service error: {0}")]
    Shared(#[from] ADQuestError),

    // Legacy error types for backward compatibility
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Cache error: {0}")]
    CacheError(String),

    #[error("Authentication error: {0}")]
    AuthenticationError(String),

    #[error("Security error: {0}")]
    SecurityError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Circuit breaker open")]
    CircuitBreakerOpen,

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Internal error: {0}")]
    InternalError(String),
}

impl TBankError {
    /// Check if the error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            TBankError::TBankApiError { status, .. } => {
                // Retry on server errors (5xx) and rate limits (429)
                *status >= 500 || *status == 429
            }
            TBankError::NetworkError(_) => true,
            TBankError::CircuitBreakerOpen => false, // Circuit breaker should handle retries
            TBankError::RateLimitExceeded => true,
            TBankError::BalanceQueryFailed { .. } => true,
            TBankError::StatementRetrievalFailed { .. } => true,
            TBankError::PaymentProcessingFailed { .. } => false, // Payment errors usually shouldn't be retried
            TBankError::Shared(shared_error) => shared_error.is_retryable(),
            TBankError::DatabaseError(_) => true,
            TBankError::CacheError(_) => true,
            _ => false,
        }
    }

    /// Get HTTP status code for API responses
    pub fn status_code(&self) -> u16 {
        match self {
            TBankError::InvalidInn(_)
            | TBankError::InvalidKpp(_)
            | TBankError::InvalidAccountNumber(_)
            | TBankError::InvalidPaymentMethod(_)
            | TBankError::InvalidCurrency(_)
            | TBankError::ValidationError(_) => 400,

            TBankError::AuthenticationError(_) => 401,
            TBankError::SecurityError(_) => 401,
            TBankError::InvalidWebhookSignature => 401,

            TBankError::CounterpartyNotFound { .. } => 404,
            TBankError::InvoiceNotFound { .. } => 404,
            TBankError::InvoiceItemNotFound { .. } => 404,
            TBankError::InvoiceContactNotFound { .. } => 404,
            TBankError::PaymentNotFound { .. } => 404,
            TBankError::WebhookEventNotFound { .. } => 404,
            TBankError::AuditLogNotFound { .. } => 404,

            TBankError::InvalidInvoiceStatusTransition { .. }
            | TBankError::InvalidPaymentStatusTransition { .. }
            | TBankError::DuplicateWebhookEvent { .. } => 409,

            TBankError::RateLimitExceeded => 429,

            TBankError::SandboxOperationInProduction | TBankError::ProductionOperationInSandbox => {
                422
            }

            TBankError::TBankApiError { status, .. } => *status,

            TBankError::Shared(shared_error) => shared_error.status_code(),

            _ => 500,
        }
    }

    /// Check if error requires audit logging
    pub fn requires_audit(&self) -> bool {
        match self {
            TBankError::PaymentInitializationFailed { .. }
            | TBankError::PaymentProcessingFailed { .. }
            | TBankError::InvoiceCreationFailed { .. }
            | TBankError::InvoiceNotFound { .. }
            | TBankError::InvoiceItemNotFound { .. }
            | TBankError::InvoiceContactNotFound { .. }
            | TBankError::InvalidInvoiceStatusTransition { .. }
            | TBankError::InvalidPaymentStatusTransition { .. }
            | TBankError::ReconciliationFailed { .. }
            | TBankError::TransactionMatchingFailed { .. }
            | TBankError::InvalidWebhookSignature => true,

            TBankError::Shared(shared_error) => shared_error.requires_audit(),

            _ => false,
        }
    }

    /// Get error category for metrics and monitoring
    pub fn category(&self) -> &'static str {
        match self {
            TBankError::InvalidInn(_)
            | TBankError::InvalidKpp(_)
            | TBankError::InvalidAccountNumber(_)
            | TBankError::InvalidPaymentMethod(_)
            | TBankError::InvalidCurrency(_)
            | TBankError::ValidationError(_) => "validation",

            TBankError::TBankApiError { .. } => "api",

            TBankError::PaymentInitializationFailed { .. }
            | TBankError::PaymentProcessingFailed { .. } => "payment",

            TBankError::InvoiceCreationFailed { .. }
            | TBankError::InvoiceNotFound { .. }
            | TBankError::InvoiceItemNotFound { .. }
            | TBankError::InvoiceContactNotFound { .. }
            | TBankError::InvalidInvoiceStatusTransition { .. } => "invoice",

            TBankError::InvalidWebhookSignature
            | TBankError::WebhookProcessingFailed { .. }
            | TBankError::DuplicateWebhookEvent { .. } => "webhook",

            TBankError::BalanceQueryFailed { .. } | TBankError::StatementRetrievalFailed { .. } => {
                "balance"
            }

            TBankError::ReconciliationFailed { .. }
            | TBankError::TransactionMatchingFailed { .. } => "reconciliation",

            TBankError::AuthenticationError(_) => "auth",
            TBankError::SecurityError(_) => "security",

            TBankError::NetworkError(_) => "network",
            TBankError::DatabaseError(_) => "database",
            TBankError::CacheError(_) => "cache",

            TBankError::Shared(_) => "shared",

            _ => "internal",
        }
    }

    /// Convert to ADQuestError for shared error handling
    pub fn to_adquest_error(self) -> ADQuestError {
        match self {
            TBankError::Shared(shared_error) => shared_error,
            TBankError::ValidationError(msg) => ADQuestError::Validation(msg),
            TBankError::AuthenticationError(msg) => ADQuestError::Authentication(msg),
            TBankError::ConfigurationError(msg) => ADQuestError::Config(msg),
            TBankError::DatabaseError(err) => ADQuestError::Database(err),
            TBankError::NetworkError(err) => ADQuestError::ExternalService {
                service: "T-Bank".to_string(),
                message: err.clone(),
            },
            TBankError::SerializationError(err) => ADQuestError::Serialization(err),
            TBankError::RateLimitExceeded => {
                ADQuestError::RateLimit("T-Bank API rate limit exceeded".to_string())
            }
            TBankError::CircuitBreakerOpen => {
                ADQuestError::CircuitBreakerOpen("T-Bank API circuit breaker open".to_string())
            }
            other => ADQuestError::ExternalService {
                service: "T-Bank".to_string(),
                message: other.to_string(),
            },
        }
    }
}

impl Clone for TBankError {
    fn clone(&self) -> Self {
        match self {
            TBankError::InvalidInn(s) => TBankError::InvalidInn(s.clone()),
            TBankError::InvalidKpp(s) => TBankError::InvalidKpp(s.clone()),
            TBankError::InvalidAccountNumber(s) => TBankError::InvalidAccountNumber(s.clone()),
            TBankError::InvalidPaymentMethod(s) => TBankError::InvalidPaymentMethod(s.clone()),
            TBankError::InvalidCurrency(s) => TBankError::InvalidCurrency(s.clone()),
            TBankError::CounterpartyNotFound { inn } => {
                TBankError::CounterpartyNotFound { inn: inn.clone() }
            }
            TBankError::TBankApiError {
                status,
                message,
                error_code,
            } => TBankError::TBankApiError {
                status: *status,
                message: message.clone(),
                error_code: error_code.clone(),
            },
            TBankError::PaymentInitializationFailed {
                reason,
                transaction_id,
            } => TBankError::PaymentInitializationFailed {
                reason: reason.clone(),
                transaction_id: transaction_id.clone(),
            },
            TBankError::PaymentProcessingFailed {
                reason,
                transaction_id,
                error_code,
            } => TBankError::PaymentProcessingFailed {
                reason: reason.clone(),
                transaction_id: transaction_id.clone(),
                error_code: error_code.clone(),
            },
            TBankError::InvoiceCreationFailed {
                reason,
                counterparty_inn,
            } => TBankError::InvoiceCreationFailed {
                reason: reason.clone(),
                counterparty_inn: counterparty_inn.clone(),
            },
            TBankError::InvoiceNotFound { id } => TBankError::InvoiceNotFound { id: *id },
            TBankError::InvoiceItemNotFound { id } => TBankError::InvoiceItemNotFound { id: *id },
            TBankError::InvoiceContactNotFound { id } => {
                TBankError::InvoiceContactNotFound { id: *id }
            }
            TBankError::PaymentNotFound { id } => TBankError::PaymentNotFound { id: *id },
            TBankError::WebhookEventNotFound { event_id } => TBankError::WebhookEventNotFound {
                event_id: event_id.clone(),
            },
            TBankError::AuditLogNotFound { id } => TBankError::AuditLogNotFound { id: *id },
            TBankError::InvalidInvoiceStatusTransition {
                from,
                to,
                invoice_id,
            } => TBankError::InvalidInvoiceStatusTransition {
                from: from.clone(),
                to: to.clone(),
                invoice_id: *invoice_id,
            },
            TBankError::InvalidPaymentStatusTransition {
                from,
                to,
                payment_id,
            } => TBankError::InvalidPaymentStatusTransition {
                from: from.clone(),
                to: to.clone(),
                payment_id: *payment_id,
            },
            TBankError::InvalidWebhookSignature => TBankError::InvalidWebhookSignature,
            TBankError::WebhookProcessingFailed { reason, event_id } => {
                TBankError::WebhookProcessingFailed {
                    reason: reason.clone(),
                    event_id: event_id.clone(),
                }
            }
            TBankError::DuplicateWebhookEvent { event_id } => TBankError::DuplicateWebhookEvent {
                event_id: event_id.clone(),
            },
            TBankError::BalanceQueryFailed {
                account_number,
                reason,
            } => TBankError::BalanceQueryFailed {
                account_number: account_number.clone(),
                reason: reason.clone(),
            },
            TBankError::StatementRetrievalFailed {
                account_number,
                reason,
            } => TBankError::StatementRetrievalFailed {
                account_number: account_number.clone(),
                reason: reason.clone(),
            },
            TBankError::ReconciliationFailed { reason, date } => TBankError::ReconciliationFailed {
                reason: reason.clone(),
                date: *date,
            },
            TBankError::TransactionMatchingFailed {
                transaction_id,
                reason,
            } => TBankError::TransactionMatchingFailed {
                transaction_id: transaction_id.clone(),
                reason: reason.clone(),
            },
            TBankError::SandboxOperationInProduction => TBankError::SandboxOperationInProduction,
            TBankError::ProductionOperationInSandbox => TBankError::ProductionOperationInSandbox,
            TBankError::EnvironmentConfigurationError(s) => {
                TBankError::EnvironmentConfigurationError(s.clone())
            }
            TBankError::Shared(err) => TBankError::InternalError(format!("Shared error: {}", err)),
            TBankError::DatabaseError(_) => {
                TBankError::InternalError("Database error (not cloneable)".to_string())
            }
            TBankError::CacheError(s) => TBankError::CacheError(s.clone()),
            TBankError::AuthenticationError(s) => TBankError::AuthenticationError(s.clone()),
            TBankError::SecurityError(s) => TBankError::SecurityError(s.clone()),
            TBankError::RateLimitExceeded => TBankError::RateLimitExceeded,
            TBankError::CircuitBreakerOpen => TBankError::CircuitBreakerOpen,
            TBankError::ConfigurationError(s) => TBankError::ConfigurationError(s.clone()),
            TBankError::ValidationError(s) => TBankError::ValidationError(s.clone()),
            TBankError::NetworkError(s) => TBankError::NetworkError(s.clone()),
            TBankError::ParseError(s) => TBankError::ParseError(s.clone()),
            TBankError::SerializationError(_) => {
                TBankError::InternalError("Serialization error (not cloneable)".to_string())
            }
            TBankError::InternalError(s) => TBankError::InternalError(s.clone()),
        }
    }
}

/// Helper function to create T-Bank API errors with proper context
pub fn tbank_api_error(status: u16, message: String, error_code: Option<String>) -> TBankError {
    TBankError::TBankApiError {
        status,
        message,
        error_code,
    }
}

/// Helper function to create payment processing errors
pub fn payment_error(
    reason: String,
    transaction_id: String,
    error_code: Option<String>,
) -> TBankError {
    TBankError::PaymentProcessingFailed {
        reason,
        transaction_id,
        error_code,
    }
}

/// Helper function to create validation errors with context
pub fn validation_error(field: &str, message: &str) -> TBankError {
    TBankError::ValidationError(format!("{}: {}", field, message))
}

/// Implementation of IntoResponse for TBankError to work with Axum handlers
impl IntoResponse for TBankError {
    fn into_response(self) -> Response {
        let status_code =
            StatusCode::from_u16(self.status_code()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

        let error_response = json!({
            "error": {
                "type": self.category(),
                "message": self.to_string(),
                "retryable": self.is_retryable(),
                "timestamp": chrono::Utc::now(),
            }
        });

        (status_code, Json(error_response)).into_response()
    }
}
