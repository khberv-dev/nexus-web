use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;
use tracing::{error, info, warn};

use crate::middleware::TBankRateLimitConfig;
use crate::types::{TBankError, TBankResult};

/// Configuration items that can be hot-reloaded without service restart
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HotReloadableConfig {
    /// Rate limiting configuration
    pub rate_limit_config: TBankRateLimitConfig,
    /// Log level (trace, debug, info, warn, error)
    pub log_level: String,
    /// Cache TTL settings (in seconds)
    pub cache_ttl_counterparty: u64,
    pub cache_ttl_balance: u64,
    /// API timeout settings (in seconds)
    pub api_timeout_seconds: u64,
    /// Health check interval (in seconds)
    pub health_check_interval: u64,
    /// Reconciliation schedule (cron expression)
    pub reconciliation_schedule: String,
    /// Alert thresholds
    pub low_balance_threshold: f64,
    pub error_rate_threshold: f64,
}

impl Default for HotReloadableConfig {
    fn default() -> Self {
        Self {
            rate_limit_config: TBankRateLimitConfig {
                counterparty_verification: 100,
                b2b_invoices: 200,
                acquiring_payments: 500,
                balance_queries: 300,
                reconciliation: 50,
                audit_queries: 100,
            },
            log_level: "info".to_string(),
            cache_ttl_counterparty: 30 * 24 * 60 * 60, // 30 days
            cache_ttl_balance: 5 * 60,                 // 5 minutes
            api_timeout_seconds: 30,
            health_check_interval: 30,
            reconciliation_schedule: "0 2 * * *".to_string(), // Daily at 2 AM
            low_balance_threshold: 10000.0,
            error_rate_threshold: 0.01, // 1%
        }
    }
}

impl HotReloadableConfig {
    /// Load hot-reloadable configuration from environment variables
    pub fn from_env() -> TBankResult<Self> {
        use std::env;

        // Validate log level first
        let log_level = env::var("TBANK_LOG_LEVEL").unwrap_or_else(|_| "info".to_string());

        // Validate log level immediately
        match log_level.to_lowercase().as_str() {
            "trace" | "debug" | "info" | "warn" | "error" => {}
            _ => {
                return Err(TBankError::ConfigurationError(format!(
                    "Invalid log level: {}",
                    log_level
                )))
            }
        }

        let rate_limit_config = TBankRateLimitConfig {
            counterparty_verification: env::var("TBANK_RATE_LIMIT_COUNTERPARTY")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!(
                        "Invalid TBANK_RATE_LIMIT_COUNTERPARTY: {}",
                        e
                    ))
                })?,
            b2b_invoices: env::var("TBANK_RATE_LIMIT_B2B_INVOICES")
                .unwrap_or_else(|_| "200".to_string())
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!(
                        "Invalid TBANK_RATE_LIMIT_B2B_INVOICES: {}",
                        e
                    ))
                })?,
            acquiring_payments: env::var("TBANK_RATE_LIMIT_ACQUIRING_PAYMENTS")
                .unwrap_or_else(|_| "500".to_string())
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!(
                        "Invalid TBANK_RATE_LIMIT_ACQUIRING_PAYMENTS: {}",
                        e
                    ))
                })?,
            balance_queries: env::var("TBANK_RATE_LIMIT_BALANCE")
                .unwrap_or_else(|_| "300".to_string())
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!(
                        "Invalid TBANK_RATE_LIMIT_BALANCE: {}",
                        e
                    ))
                })?,
            reconciliation: env::var("TBANK_RATE_LIMIT_RECONCILIATION")
                .unwrap_or_else(|_| "50".to_string())
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!(
                        "Invalid TBANK_RATE_LIMIT_RECONCILIATION: {}",
                        e
                    ))
                })?,
            audit_queries: env::var("TBANK_RATE_LIMIT_AUDIT")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!("Invalid TBANK_RATE_LIMIT_AUDIT: {}", e))
                })?,
        };

        // Validate rate limits (must be positive)
        if rate_limit_config.counterparty_verification == 0
            || rate_limit_config.b2b_invoices == 0
            || rate_limit_config.acquiring_payments == 0
            || rate_limit_config.balance_queries == 0
            || rate_limit_config.reconciliation == 0
            || rate_limit_config.audit_queries == 0
        {
            return Err(TBankError::ConfigurationError(
                "Rate limits must be positive".to_string(),
            ));
        }

        let api_timeout_seconds = env::var("TBANK_API_TIMEOUT")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .map_err(|e| {
                TBankError::ConfigurationError(format!("Invalid TBANK_API_TIMEOUT: {}", e))
            })?;

        let health_check_interval = env::var("TBANK_HEALTH_CHECK_INTERVAL")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .map_err(|e| {
                TBankError::ConfigurationError(format!(
                    "Invalid TBANK_HEALTH_CHECK_INTERVAL: {}",
                    e
                ))
            })?;

        // Validate timeouts (must be positive)
        if api_timeout_seconds == 0 || health_check_interval == 0 {
            return Err(TBankError::ConfigurationError(
                "Timeout values must be positive".to_string(),
            ));
        }

        let low_balance_threshold = env::var("TBANK_LOW_BALANCE_THRESHOLD")
            .unwrap_or_else(|_| "10000.0".to_string())
            .parse()
            .map_err(|e| {
                TBankError::ConfigurationError(format!(
                    "Invalid TBANK_LOW_BALANCE_THRESHOLD: {}",
                    e
                ))
            })?;

        let error_rate_threshold = env::var("TBANK_ERROR_RATE_THRESHOLD")
            .unwrap_or_else(|_| "0.01".to_string())
            .parse()
            .map_err(|e| {
                TBankError::ConfigurationError(format!("Invalid TBANK_ERROR_RATE_THRESHOLD: {}", e))
            })?;

        // Validate thresholds
        if low_balance_threshold < 0.0 || error_rate_threshold < 0.0 || error_rate_threshold > 1.0 {
            return Err(TBankError::ConfigurationError(
                "Invalid threshold values".to_string(),
            ));
        }

        Ok(Self {
            rate_limit_config,
            log_level,
            cache_ttl_counterparty: env::var("TBANK_CACHE_TTL_COUNTERPARTY")
                .unwrap_or_else(|_| "2592000".to_string()) // 30 days
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!(
                        "Invalid TBANK_CACHE_TTL_COUNTERPARTY: {}",
                        e
                    ))
                })?,
            cache_ttl_balance: env::var("TBANK_CACHE_TTL_BALANCE")
                .unwrap_or_else(|_| "300".to_string()) // 5 minutes
                .parse()
                .map_err(|e| {
                    TBankError::ConfigurationError(format!(
                        "Invalid TBANK_CACHE_TTL_BALANCE: {}",
                        e
                    ))
                })?,
            api_timeout_seconds,
            health_check_interval,
            reconciliation_schedule: env::var("TBANK_RECONCILIATION_SCHEDULE")
                .unwrap_or_else(|_| "0 2 * * *".to_string()),
            low_balance_threshold,
            error_rate_threshold,
        })
    }

    /// Validate the configuration
    pub fn validate(&self) -> TBankResult<()> {
        // Validate log level
        match self.log_level.to_lowercase().as_str() {
            "trace" | "debug" | "info" | "warn" | "error" => {}
            _ => {
                return Err(TBankError::ConfigurationError(format!(
                    "Invalid log level: {}",
                    self.log_level
                )))
            }
        }

        // Validate rate limits (must be positive)
        if self.rate_limit_config.counterparty_verification == 0
            || self.rate_limit_config.b2b_invoices == 0
            || self.rate_limit_config.acquiring_payments == 0
            || self.rate_limit_config.balance_queries == 0
            || self.rate_limit_config.reconciliation == 0
            || self.rate_limit_config.audit_queries == 0
        {
            return Err(TBankError::ConfigurationError(
                "Rate limits must be positive".to_string(),
            ));
        }

        // Validate timeouts (must be positive)
        if self.api_timeout_seconds == 0 || self.health_check_interval == 0 {
            return Err(TBankError::ConfigurationError(
                "Timeout values must be positive".to_string(),
            ));
        }

        // Validate thresholds
        if self.low_balance_threshold < 0.0
            || self.error_rate_threshold < 0.0
            || self.error_rate_threshold > 1.0
        {
            return Err(TBankError::ConfigurationError(
                "Invalid threshold values".to_string(),
            ));
        }

        Ok(())
    }
}

/// Hot-reload configuration manager
pub struct HotReloadManager {
    current_config: Arc<RwLock<HotReloadableConfig>>,
    environment: crate::config::Environment,
}

impl HotReloadManager {
    /// Create a new hot-reload manager
    pub fn new(environment: crate::config::Environment) -> TBankResult<Self> {
        let initial_config = HotReloadableConfig::from_env()?;
        initial_config.validate()?;

        Ok(Self {
            current_config: Arc::new(RwLock::new(initial_config)),
            environment,
        })
    }

    /// Get the current configuration
    pub async fn get_config(&self) -> HotReloadableConfig {
        self.current_config.read().await.clone()
    }

    /// Start the hot-reload background task
    pub async fn start_hot_reload_task(self: Arc<Self>) {
        let mut reload_interval = interval(Duration::from_secs(60)); // Check every minute

        info!(
            environment = ?self.environment,
            "Starting configuration hot-reload task"
        );

        loop {
            reload_interval.tick().await;

            if let Err(e) = self.reload_config().await {
                warn!(error = %e, "Failed to reload configuration");
            }
        }
    }

    /// Reload configuration from environment variables
    pub async fn reload_config(&self) -> TBankResult<()> {
        match HotReloadableConfig::from_env() {
            Ok(new_config) => {
                if let Err(e) = new_config.validate() {
                    warn!(error = %e, "New configuration is invalid, keeping current config");
                    return Err(e);
                }

                let mut current = self.current_config.write().await;
                let old_config = current.clone();

                if new_config != *current {
                    *current = new_config.clone();

                    info!(
                        environment = ?self.environment,
                        old_log_level = %old_config.log_level,
                        new_log_level = %new_config.log_level,
                        old_api_timeout = old_config.api_timeout_seconds,
                        new_api_timeout = new_config.api_timeout_seconds,
                        "Configuration reloaded successfully"
                    );

                    // Apply log level change immediately
                    if old_config.log_level != new_config.log_level {
                        if let Err(e) = self.apply_log_level_change(&new_config.log_level) {
                            warn!(error = %e, "Failed to apply log level change");
                        }
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, "Failed to load new configuration from environment");
                return Err(e);
            }
        }

        Ok(())
    }

    /// Apply log level change
    fn apply_log_level_change(&self, new_level: &str) -> TBankResult<()> {
        use std::str::FromStr;
        use tracing::Level;

        let level = Level::from_str(&new_level.to_uppercase()).map_err(|e| {
            TBankError::ConfigurationError(format!("Invalid log level '{}': {}", new_level, e))
        })?;

        // Note: In a real implementation, you would need to update the tracing subscriber
        // This is a simplified version that just logs the change
        info!(
            new_level = %level,
            environment = ?self.environment,
            "Log level updated (note: requires tracing subscriber reconfiguration)"
        );

        Ok(())
    }

    /// Get environment indicator for logs and responses
    pub fn get_environment_indicator(&self) -> serde_json::Value {
        serde_json::json!({
            "environment": self.environment,
            "service": "tbank-integration",
            "version": "0.1.0",
            "hot_reload_enabled": true
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_validation() {
        let config = HotReloadableConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_invalid_log_level() {
        let mut config = HotReloadableConfig::default();
        config.log_level = "invalid".to_string();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_zero_rate_limits() {
        let mut config = HotReloadableConfig::default();
        config.rate_limit_config.counterparty_verification = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_invalid_thresholds() {
        let mut config = HotReloadableConfig::default();
        config.error_rate_threshold = 1.5; // > 1.0
        assert!(config.validate().is_err());
    }

    #[tokio::test]
    async fn test_hot_reload_manager_creation() {
        // This test would require environment variables to be set
        // In a real test environment, you would set up test configuration

        std::env::set_var("TBANK_LOG_LEVEL", "debug");
        std::env::set_var("TBANK_API_TIMEOUT", "45");

        let manager = HotReloadManager::new(crate::config::Environment::Sandbox);

        // Should succeed with valid environment variables
        assert!(manager.is_ok());

        if let Ok(manager) = manager {
            let config = manager.get_config().await;
            assert_eq!(config.log_level, "debug");
            assert_eq!(config.api_timeout_seconds, 45);
        }
    }
}
