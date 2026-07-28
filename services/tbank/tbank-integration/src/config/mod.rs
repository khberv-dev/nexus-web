pub mod environment;
pub mod hot_reload;
pub mod validation;

pub use hot_reload::{HotReloadManager, HotReloadableConfig};

use crate::middleware::TBankRateLimitConfig;
use crate::types::TBankResult;
use crate::email::EmailConfig;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankConfig {
    pub environment: Environment,
    pub server_port: u16,
    pub business_api_base_url: String,
    pub acquiring_api_base_url: String,
    pub api_token: String,
    pub terminal_key: String,
    /// Пароль терминала (секретный ключ) для подписи запросов эквайринга (`TBANK_SECRET_KEY`)
    pub terminal_secret: String,
    pub webhook_secret: String,
    pub database_url: String,
    pub redis_url: String,
    pub zitadel_issuer: String,
    pub zitadel_audience: String,
    pub encryption_key: String,
    pub rate_limit_config: TBankRateLimitConfig,
    pub email_config: EmailConfig,
    pub use_zitadel: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Environment {
    Sandbox,
    Production,
}

impl TBankConfig {
    pub fn from_env() -> TBankResult<Self> {
        let environment = match env::var("TBANK_ENVIRONMENT")
            .unwrap_or_else(|_| "sandbox".to_string())
            .to_lowercase()
            .as_str()
        {
            "production" | "prod" => Environment::Production,
            _ => Environment::Sandbox,
        };

        // Rate limiting configuration from environment variables
        let rate_limit_config = TBankRateLimitConfig {
            counterparty_verification: env::var("TBANK_RATE_LIMIT_COUNTERPARTY")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            b2b_invoices: env::var("TBANK_RATE_LIMIT_B2B_INVOICES")
                .unwrap_or_else(|_| "200".to_string())
                .parse()
                .unwrap_or(200),
            acquiring_payments: env::var("TBANK_RATE_LIMIT_ACQUIRING_PAYMENTS")
                .unwrap_or_else(|_| "500".to_string())
                .parse()
                .unwrap_or(500),
            balance_queries: env::var("TBANK_RATE_LIMIT_BALANCE")
                .unwrap_or_else(|_| "300".to_string())
                .parse()
                .unwrap_or(300),
            reconciliation: env::var("TBANK_RATE_LIMIT_RECONCILIATION")
                .unwrap_or_else(|_| "50".to_string())
                .parse()
                .unwrap_or(50),
            audit_queries: env::var("TBANK_RATE_LIMIT_AUDIT")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
        };

        // Load email configuration
        let email_config = EmailConfig::from_env()?;

        let config = Self {
            environment: environment.clone(),
            server_port: env::var("TBANK_SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            business_api_base_url: env::var("TBANK_BUSINESS_API_BASE_URL")
                .unwrap_or_else(|_| match environment {
                    Environment::Sandbox => {
                        "https://business.tbank.ru/openapi/sandbox/api/v1".to_string()
                    }
                    Environment::Production => "https://business.tbank.ru/openapi/api/v1".to_string(),
                }),
            acquiring_api_base_url: env::var("TBANK_ACQUIRING_API_BASE_URL")
                .unwrap_or_else(|_| "https://securepay.tbank.ru/v2".to_string()),
            api_token: env::var("TBANK_API_TOKEN").map_err(|_| {
                crate::types::TBankError::ConfigurationError(
                    "TBANK_API_TOKEN is required".to_string(),
                )
            })?,
            terminal_key: env::var("TBANK_TERMINAL_KEY").map_err(|_| {
                crate::types::TBankError::ConfigurationError(
                    "TBANK_TERMINAL_KEY is required".to_string(),
                )
            })?,
            terminal_secret: env::var("TBANK_SECRET_KEY").unwrap_or_default(),
            webhook_secret: env::var("TBANK_WEBHOOK_SECRET")
                .unwrap_or_else(|_| "default_secret".to_string()),
            database_url: env::var("DATABASE_URL").map_err(|_| {
                crate::types::TBankError::ConfigurationError("DATABASE_URL is required".to_string())
            })?,
            redis_url: env::var("REDIS_URL").map_err(|_| {
                crate::types::TBankError::ConfigurationError("REDIS_URL is required".to_string())
            })?,
            zitadel_issuer: env::var("ZITADEL_ISSUER")
                .unwrap_or_else(|_| "https://auth.ad-quest.ru".to_string()),
            zitadel_audience: env::var("ZITADEL_AUDIENCE")
                .unwrap_or_else(|_| "352242948684972035".to_string()),
            encryption_key: env::var("TBANK_ENCRYPTION_KEY")
                .or_else(|_| env::var("ENCRYPTION_KEY"))
                .map_err(|_| {
                    crate::types::TBankError::ConfigurationError(
                        "TBANK_ENCRYPTION_KEY or ENCRYPTION_KEY is required for data encryption".to_string(),
                    )
                })?,
            rate_limit_config,
            email_config,
            use_zitadel: env::var("TBANK_USE_ZITADEL")
                .or_else(|_| env::var("USE_ZITADEL"))
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        };

        validation::validate_config(&config)?;
        Ok(config)
    }

    /// Get encryption key as bytes for AES-256-GCM
    pub fn encryption_key_bytes(&self) -> TBankResult<Vec<u8>> {
        use base64::{engine::general_purpose, Engine as _};

        general_purpose::STANDARD
            .decode(&self.encryption_key)
            .map_err(|e| {
                crate::types::TBankError::ConfigurationError(format!(
                    "Invalid base64 encryption key: {}",
                    e
                ))
            })
    }

    /// Check if webhook signature validation should be enforced
    pub fn enforce_webhook_signature(&self) -> bool {
        match self.environment {
            Environment::Production => true,
            Environment::Sandbox => false,
        }
    }

    /// Get T-Bank API timeout settings
    pub fn api_timeout_seconds(&self) -> u64 {
        match self.environment {
            Environment::Production => 30,
            Environment::Sandbox => 60,
        }
    }
}
