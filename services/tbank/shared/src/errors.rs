use rust_decimal::Decimal;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum ADQuestError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Database connection error: {0}")]
    DatabaseConnection(String),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("HTTP client error: {0}")]
    HttpClient(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Authorization error: {0}")]
    Authorization(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("External service error: {service} - {message}")]
    ExternalService { service: String, message: String },

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Circuit breaker open: {0}")]
    CircuitBreakerOpen(String),

    #[error("Cache error: {0}")]
    Cache(String),

    #[error("Metrics error: {0}")]
    Metrics(String),

    // Financial-specific errors for comprehensive error handling
    #[error("Financial transaction error: {transaction_id} - {reason}")]
    FinancialTransaction {
        transaction_id: Uuid,
        reason: String,
        recovery_action: Option<String>,
    },

    #[error("Insufficient balance: required {required}, available {available}")]
    InsufficientBalance {
        required: Decimal,
        available: Decimal,
        account_id: Uuid,
    },

    #[error("Data integrity violation: {field} - {reason}")]
    DataIntegrity {
        field: String,
        reason: String,
        expected: Option<String>,
        actual: Option<String>,
    },

    #[error("Audit trail error: {operation} - {reason}")]
    AuditTrail {
        operation: String,
        reason: String,
        transaction_id: Option<Uuid>,
    },

    #[error("Transaction deadlock detected: {transaction_id} - retry attempt {retry_count}")]
    TransactionDeadlock {
        transaction_id: Uuid,
        retry_count: u32,
        max_retries: u32,
    },

    #[error("Idempotency violation: duplicate transaction {idempotency_key}")]
    IdempotencyViolation {
        idempotency_key: String,
        original_transaction_id: Uuid,
    },

    #[error("Financial calculation error: {operation} - {reason}")]
    FinancialCalculation {
        operation: String,
        reason: String,
        input_values: serde_json::Value,
    },

    #[error("Account frozen: {account_id} - {reason}")]
    AccountFrozen {
        account_id: Uuid,
        reason: String,
        frozen_at: chrono::DateTime<chrono::Utc>,
    },

    #[error("Compliance violation: {regulation} - {details}")]
    ComplianceViolation {
        regulation: String,
        details: String,
        severity: ComplianceSeverity,
    },
}

#[derive(Debug, Clone)]
pub enum ComplianceSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl ADQuestError {
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ADQuestError::Database(_)
                | ADQuestError::DatabaseConnection(_)
                | ADQuestError::Redis(_)
                | ADQuestError::HttpClient(_)
                | ADQuestError::ExternalService { .. }
                | ADQuestError::Timeout(_)
                | ADQuestError::TransactionDeadlock { .. }
        )
    }

    pub fn status_code(&self) -> u16 {
        match self {
            ADQuestError::Validation(_) => 400,
            ADQuestError::Authentication(_) => 401,
            ADQuestError::Authorization(_) => 403,
            ADQuestError::NotFound(_) => 404,
            ADQuestError::RateLimit(_) => 429,
            ADQuestError::InsufficientBalance { .. } => 402, // Payment Required
            ADQuestError::IdempotencyViolation { .. } => 409, // Conflict
            ADQuestError::AccountFrozen { .. } => 423,       // Locked
            ADQuestError::ComplianceViolation { .. } => 451, // Unavailable For Legal Reasons
            ADQuestError::Database(_)
            | ADQuestError::DatabaseConnection(_)
            | ADQuestError::Redis(_)
            | ADQuestError::HttpClient(_)
            | ADQuestError::ExternalService { .. }
            | ADQuestError::Internal(_)
            | ADQuestError::Timeout(_)
            | ADQuestError::CircuitBreakerOpen(_)
            | ADQuestError::FinancialTransaction { .. }
            | ADQuestError::DataIntegrity { .. }
            | ADQuestError::AuditTrail { .. }
            | ADQuestError::TransactionDeadlock { .. }
            | ADQuestError::FinancialCalculation { .. } => 500,
            ADQuestError::Config(_) | ADQuestError::Serialization(_) => 500,
            ADQuestError::Cache(_) | ADQuestError::Metrics(_) => 500,
        }
    }

    pub fn is_financial_error(&self) -> bool {
        matches!(
            self,
            ADQuestError::FinancialTransaction { .. }
                | ADQuestError::InsufficientBalance { .. }
                | ADQuestError::DataIntegrity { .. }
                | ADQuestError::FinancialCalculation { .. }
                | ADQuestError::AccountFrozen { .. }
                | ADQuestError::ComplianceViolation { .. }
        )
    }

    pub fn requires_audit(&self) -> bool {
        matches!(
            self,
            ADQuestError::FinancialTransaction { .. }
                | ADQuestError::InsufficientBalance { .. }
                | ADQuestError::DataIntegrity { .. }
                | ADQuestError::FinancialCalculation { .. }
                | ADQuestError::AccountFrozen { .. }
                | ADQuestError::ComplianceViolation { .. }
                | ADQuestError::IdempotencyViolation { .. }
        )
    }

    pub fn get_recovery_action(&self) -> Option<String> {
        match self {
            ADQuestError::FinancialTransaction {
                recovery_action, ..
            } => recovery_action.clone(),
            ADQuestError::InsufficientBalance { .. } => Some("Add funds to account".to_string()),
            ADQuestError::TransactionDeadlock { .. } => Some("Retry transaction".to_string()),
            ADQuestError::AccountFrozen { .. } => {
                Some("Contact support to unfreeze account".to_string())
            }
            _ => None,
        }
    }
}
