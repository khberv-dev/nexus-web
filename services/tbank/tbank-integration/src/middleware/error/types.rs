use shared::errors::ADQuestError;
use crate::types::TBankError;

/// Convert ADQuestError to TBankError
pub fn adquest_error_to_tbank_error(error: ADQuestError) -> TBankError {
    match error {
        ADQuestError::Authentication(msg) => TBankError::AuthenticationError(msg),
        ADQuestError::Validation(msg) => TBankError::ValidationError(msg),
        ADQuestError::Database(err) => TBankError::DatabaseError(err),
        ADQuestError::Config(msg) => TBankError::ConfigurationError(msg),
        ADQuestError::RateLimit(_msg) => TBankError::RateLimitExceeded,
        ADQuestError::CircuitBreakerOpen(_msg) => TBankError::CircuitBreakerOpen,
        ADQuestError::ExternalService {
            service: _,
            message,
        } => TBankError::NetworkError(message),
        ADQuestError::Serialization(err) => TBankError::SerializationError(err),
        _ => TBankError::InternalError(format!("Unmapped ADQuest error: {}", error)),
    }
}