use std::env;
use super::types::TBankRateLimitConfig;

/// Load T-Bank authentication configuration from environment variables
pub fn load_auth_config_from_env() -> Result<AuthConfig, String> {
    let encryption_key = env::var("TBANK_ENCRYPTION_KEY")
        .unwrap_or_else(|_| "dGVzdF9lbmNyeXB0aW9uX2tleV8zMl9ieXRlc19sb24=".to_string());
    
    let api_token = env::var("TBANK_API_TOKEN")
        .unwrap_or_else(|_| "test_token".to_string());
    
    let zitadel_issuer = env::var("ZITADEL_ISSUER")
        .or_else(|_| env::var("ZITADEL_URL"))
        .unwrap_or_else(|_| "https://auth.ad-quest.ru".to_string());
    
    let zitadel_audience = env::var("ZITADEL_AUDIENCE")
        .unwrap_or_else(|_| "test_audience".to_string());
    
    let use_zitadel = env::var("USE_ZITADEL")
        .unwrap_or_else(|_| "true".to_string())
        .parse::<bool>()
        .unwrap_or(true);

    // Rate limiting configuration
    let rate_limit_config = TBankRateLimitConfig {
        counterparty_verification: env::var("RATE_LIMIT_COUNTERPARTY")
            .unwrap_or_else(|_| "100".to_string())
            .parse()
            .unwrap_or(100),
        b2b_invoices: env::var("RATE_LIMIT_B2B_INVOICES")
            .unwrap_or_else(|_| "200".to_string())
            .parse()
            .unwrap_or(200),
        acquiring_payments: env::var("RATE_LIMIT_ACQUIRING")
            .unwrap_or_else(|_| "500".to_string())
            .parse()
            .unwrap_or(500),
        balance_queries: env::var("RATE_LIMIT_BALANCE")
            .unwrap_or_else(|_| "300".to_string())
            .parse()
            .unwrap_or(300),
        reconciliation: env::var("RATE_LIMIT_RECONCILIATION")
            .unwrap_or_else(|_| "50".to_string())
            .parse()
            .unwrap_or(50),
        audit_queries: env::var("RATE_LIMIT_AUDIT")
            .unwrap_or_else(|_| "100".to_string())
            .parse()
            .unwrap_or(100),
    };

    Ok(AuthConfig {
        encryption_key,
        api_token,
        zitadel_issuer,
        zitadel_audience,
        use_zitadel,
        rate_limit_config,
    })
}

/// Authentication configuration loaded from environment
#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub encryption_key: String,
    pub api_token: String,
    pub zitadel_issuer: String,
    pub zitadel_audience: String,
    pub use_zitadel: bool,
    pub rate_limit_config: TBankRateLimitConfig,
}

impl AuthConfig {
    /// Get encryption key as bytes for cryptographic operations
    pub fn encryption_key_bytes(&self) -> Result<Vec<u8>, String> {
        use base64::{Engine as _, engine::general_purpose};
        general_purpose::STANDARD.decode(&self.encryption_key)
            .map_err(|e| format!("Failed to decode encryption key: {}", e))
    }
}