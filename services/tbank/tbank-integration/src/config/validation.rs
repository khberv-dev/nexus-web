use super::{Environment, TBankConfig};
use crate::types::{TBankError, TBankResult};
use base64::{engine::general_purpose, Engine as _};
use url::Url;

pub fn validate_config(config: &TBankConfig) -> TBankResult<()> {
    // Validate Business API base URL
    Url::parse(&config.business_api_base_url)
        .map_err(|_| TBankError::ConfigurationError("Invalid Business API base URL".to_string()))?;
    validate_business_api_url_matches_environment(config)?;

    // Validate Acquiring API base URL
    Url::parse(&config.acquiring_api_base_url).map_err(|_| {
        TBankError::ConfigurationError("Invalid Acquiring API base URL".to_string())
    })?;

    // Validate API token is not empty
    if config.api_token.trim().is_empty() {
        return Err(TBankError::ConfigurationError(
            "API token cannot be empty".to_string(),
        ));
    }

    // Validate terminal key is not empty
    if config.terminal_key.trim().is_empty() {
        return Err(TBankError::ConfigurationError(
            "Terminal key cannot be empty".to_string(),
        ));
    }

    // Validate database URL
    if !config.database_url.starts_with("postgresql://")
        && !config.database_url.starts_with("postgres://")
    {
        return Err(TBankError::ConfigurationError(
            "Database URL must be a PostgreSQL connection string".to_string(),
        ));
    }

    // Validate Redis URL
    if !config.redis_url.starts_with("redis://") && !config.redis_url.starts_with("rediss://") {
        return Err(TBankError::ConfigurationError(
            "Redis URL must be a valid Redis connection string".to_string(),
        ));
    }

    // Validate Zitadel issuer URL
    Url::parse(&config.zitadel_issuer)
        .map_err(|_| TBankError::ConfigurationError("Invalid Zitadel issuer URL".to_string()))?;

    // Validate encryption key
    validate_encryption_key(&config.encryption_key)?;

    // Validate rate limit configuration
    validate_rate_limit_config(&config.rate_limit_config)?;

    Ok(())
}

/// Sandbox Business API tokens only work against URLs containing `/openapi/sandbox/`.
fn validate_business_api_url_matches_environment(config: &TBankConfig) -> TBankResult<()> {
    let url = config.business_api_base_url.to_lowercase();
    match &config.environment {
        Environment::Sandbox => {
            if !url.contains("/openapi/sandbox/") {
                return Err(TBankError::ConfigurationError(
                    "TBANK_ENVIRONMENT=sandbox, but TBANK_BUSINESS_API_BASE_URL is not a sandbox host (expected path …/openapi/sandbox/api/v1). A production URL causes 401 «Токен недействителен» for a sandbox token — remove the variable or fix the URL."
                        .to_string(),
                ));
            }
        }
        Environment::Production => {
            if url.contains("/openapi/sandbox/") {
                return Err(TBankError::ConfigurationError(
                    "TBANK_ENVIRONMENT=production, but TBANK_BUSINESS_API_BASE_URL points to sandbox."
                        .to_string(),
                ));
            }
        }
    }
    Ok(())
}

/// Validate encryption key format and strength
fn validate_encryption_key(encryption_key: &str) -> TBankResult<()> {
    // Check if key is base64 encoded
    let key_bytes = general_purpose::STANDARD
        .decode(encryption_key)
        .map_err(|_| {
            TBankError::ConfigurationError("Encryption key must be base64 encoded".to_string())
        })?;

    // Check key length for AES-256-GCM (32 bytes = 256 bits)
    if key_bytes.len() != 32 {
        return Err(TBankError::ConfigurationError(
            "Encryption key must be 32 bytes (256 bits) for AES-256-GCM".to_string(),
        ));
    }

    // Check key entropy (basic check - no all zeros or all same bytes)
    if key_bytes.iter().all(|&b| b == 0) {
        return Err(TBankError::ConfigurationError(
            "Encryption key cannot be all zeros".to_string(),
        ));
    }

    if key_bytes.iter().all(|&b| b == key_bytes[0]) {
        return Err(TBankError::ConfigurationError(
            "Encryption key cannot be all same bytes".to_string(),
        ));
    }

    Ok(())
}

/// Validate rate limit configuration values
fn validate_rate_limit_config(config: &crate::middleware::TBankRateLimitConfig) -> TBankResult<()> {
    // Check that all rate limits are reasonable (not zero, not too high)
    if config.counterparty_verification == 0 {
        return Err(TBankError::ConfigurationError(
            "Counterparty verification rate limit cannot be zero".to_string(),
        ));
    }

    if config.b2b_invoices == 0 {
        return Err(TBankError::ConfigurationError(
            "B2B invoices rate limit cannot be zero".to_string(),
        ));
    }

    if config.acquiring_payments == 0 {
        return Err(TBankError::ConfigurationError(
            "Acquiring payments rate limit cannot be zero".to_string(),
        ));
    }

    if config.balance_queries == 0 {
        return Err(TBankError::ConfigurationError(
            "Balance queries rate limit cannot be zero".to_string(),
        ));
    }

    if config.reconciliation == 0 {
        return Err(TBankError::ConfigurationError(
            "Reconciliation rate limit cannot be zero".to_string(),
        ));
    }

    if config.audit_queries == 0 {
        return Err(TBankError::ConfigurationError(
            "Audit queries rate limit cannot be zero".to_string(),
        ));
    }

    // Check upper bounds (prevent DoS)
    const MAX_RATE_LIMIT: u32 = 10000;

    if config.counterparty_verification > MAX_RATE_LIMIT {
        return Err(TBankError::ConfigurationError(format!(
            "Counterparty verification rate limit too high (max: {})",
            MAX_RATE_LIMIT
        )));
    }

    if config.b2b_invoices > MAX_RATE_LIMIT {
        return Err(TBankError::ConfigurationError(format!(
            "B2B invoices rate limit too high (max: {})",
            MAX_RATE_LIMIT
        )));
    }

    if config.acquiring_payments > MAX_RATE_LIMIT {
        return Err(TBankError::ConfigurationError(format!(
            "Acquiring payments rate limit too high (max: {})",
            MAX_RATE_LIMIT
        )));
    }

    if config.balance_queries > MAX_RATE_LIMIT {
        return Err(TBankError::ConfigurationError(format!(
            "Balance queries rate limit too high (max: {})",
            MAX_RATE_LIMIT
        )));
    }

    if config.reconciliation > MAX_RATE_LIMIT {
        return Err(TBankError::ConfigurationError(format!(
            "Reconciliation rate limit too high (max: {})",
            MAX_RATE_LIMIT
        )));
    }

    if config.audit_queries > MAX_RATE_LIMIT {
        return Err(TBankError::ConfigurationError(format!(
            "Audit queries rate limit too high (max: {})",
            MAX_RATE_LIMIT
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::TBankRateLimitConfig;

    #[test]
    fn test_validate_encryption_key_valid() {
        // Generate a valid 32-byte base64 key
        let key_bytes = vec![1u8; 32];
        let key_base64 = general_purpose::STANDARD.encode(&key_bytes);

        assert!(validate_encryption_key(&key_base64).is_ok());
    }

    #[test]
    fn test_validate_encryption_key_invalid_base64() {
        let invalid_key = "not-base64!@#$";
        assert!(validate_encryption_key(invalid_key).is_err());
    }

    #[test]
    fn test_validate_encryption_key_wrong_length() {
        // 16 bytes instead of 32
        let key_bytes = vec![1u8; 16];
        let key_base64 = general_purpose::STANDARD.encode(&key_bytes);

        assert!(validate_encryption_key(&key_base64).is_err());
    }

    #[test]
    fn test_validate_encryption_key_all_zeros() {
        let key_bytes = vec![0u8; 32];
        let key_base64 = general_purpose::STANDARD.encode(&key_bytes);

        assert!(validate_encryption_key(&key_base64).is_err());
    }

    #[test]
    fn test_validate_encryption_key_all_same() {
        let key_bytes = vec![0xFFu8; 32];
        let key_base64 = general_purpose::STANDARD.encode(&key_bytes);

        assert!(validate_encryption_key(&key_base64).is_err());
    }

    #[test]
    fn test_validate_rate_limit_config_valid() {
        let config = TBankRateLimitConfig::default();
        assert!(validate_rate_limit_config(&config).is_ok());
    }

    #[test]
    fn test_validate_rate_limit_config_zero_values() {
        let config = TBankRateLimitConfig {
            counterparty_verification: 0,
            b2b_invoices: 200,
            acquiring_payments: 500,
            balance_queries: 300,
            reconciliation: 50,
            audit_queries: 100,
        };

        assert!(validate_rate_limit_config(&config).is_err());
    }

    #[test]
    fn test_validate_rate_limit_config_too_high() {
        let config = TBankRateLimitConfig {
            counterparty_verification: 100,
            b2b_invoices: 20000, // Too high
            acquiring_payments: 500,
            balance_queries: 300,
            reconciliation: 50,
            audit_queries: 100,
        };

        assert!(validate_rate_limit_config(&config).is_err());
    }
}
