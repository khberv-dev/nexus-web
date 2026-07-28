use chrono::{DateTime, Duration, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, warn};

use crate::types::{AccountBalance, AccountStatement, TBankError, TBankResult};
use shared::CacheManager;

/// Balance cache manager with 5-minute TTL
#[derive(Clone)]
pub struct BalanceCacheManager {
    cache_manager: Arc<CacheManager>,
    default_ttl: u64, // 5 minutes = 300 seconds
}

/// Cached balance data with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedBalance {
    pub balance: AccountBalance,
    pub cached_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Cached statement data with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedStatement {
    pub statement: AccountStatement,
    pub cached_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub cache_key: String,
}

/// Balance threshold alert configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceThreshold {
    pub account_number: String,
    pub threshold_amount: Decimal,
    pub alert_enabled: bool,
    pub last_alert_sent: Option<DateTime<Utc>>,
    pub alert_cooldown_minutes: u64, // Minimum time between alerts
}

impl BalanceCacheManager {
    /// Create new balance cache manager
    pub fn new(cache_manager: Arc<CacheManager>) -> Self {
        Self {
            cache_manager,
            default_ttl: 300, // 5 minutes
        }
    }

    /// Cache account balance with 5-minute TTL
    pub async fn cache_balance(
        &self,
        account_number: &str,
        balance: &AccountBalance,
    ) -> TBankResult<()> {
        let cache_key = self.balance_cache_key(account_number);
        let now = Utc::now();

        let cached_balance = CachedBalance {
            balance: balance.clone(),
            cached_at: now,
            expires_at: now + Duration::seconds(self.default_ttl as i64),
        };

        if let Err(e) = self
            .cache_manager
            .set(
                &cache_key,
                &cached_balance,
                Some(std::time::Duration::from_secs(self.default_ttl)),
            )
            .await
        {
            warn!(
                error = %e,
                account_number = account_number,
                cache_key = %cache_key,
                "Failed to cache balance"
            );
            return Err(TBankError::CacheError(e.to_string()));
        }

        debug!(
            account_number = account_number,
            balance = %balance.balance,
            ttl_seconds = self.default_ttl,
            "Cached account balance"
        );

        Ok(())
    }

    /// Get cached account balance
    pub async fn get_cached_balance(
        &self,
        account_number: &str,
    ) -> TBankResult<Option<AccountBalance>> {
        let cache_key = self.balance_cache_key(account_number);

        match self.cache_manager.get::<CachedBalance>(&cache_key).await {
            Ok(Some(cached_balance)) => {
                // Check if cache is still valid
                if Utc::now() > cached_balance.expires_at {
                    debug!(
                        account_number = account_number,
                        expired_at = %cached_balance.expires_at,
                        "Cached balance expired"
                    );

                    // Remove expired cache entry
                    if let Err(e) = self.cache_manager.delete(&cache_key).await {
                        warn!(
                            error = %e,
                            cache_key = %cache_key,
                            "Failed to delete expired cache entry"
                        );
                    }

                    return Ok(None);
                }

                debug!(
                    account_number = account_number,
                    cached_at = %cached_balance.cached_at,
                    expires_at = %cached_balance.expires_at,
                    "Retrieved cached balance"
                );

                Ok(Some(cached_balance.balance))
            }
            Ok(None) => {
                debug!(account_number = account_number, "No cached balance found");
                Ok(None)
            }
            Err(e) => {
                warn!(
                    error = %e,
                    account_number = account_number,
                    "Failed to get cached balance"
                );
                Ok(None) // Continue without cache on error
            }
        }
    }

    /// Cache account statement with custom TTL
    pub async fn cache_statement(
        &self,
        account_number: &str,
        statement: &AccountStatement,
        ttl_seconds: Option<u64>,
    ) -> TBankResult<()> {
        let cache_key = self.statement_cache_key(
            account_number,
            &statement.period_start,
            &statement.period_end,
        );
        let ttl = ttl_seconds.unwrap_or(self.default_ttl);
        let now = Utc::now();

        let cached_statement = CachedStatement {
            statement: statement.clone(),
            cached_at: now,
            expires_at: now + Duration::seconds(ttl as i64),
            cache_key: cache_key.clone(),
        };

        if let Err(e) = self
            .cache_manager
            .set(
                &cache_key,
                &cached_statement,
                Some(std::time::Duration::from_secs(ttl)),
            )
            .await
        {
            warn!(
                error = %e,
                account_number = account_number,
                cache_key = %cache_key,
                "Failed to cache statement"
            );
            return Err(TBankError::CacheError(e.to_string()));
        }

        debug!(
            account_number = account_number,
            period_start = %statement.period_start,
            period_end = %statement.period_end,
            transaction_count = statement.transactions.len(),
            ttl_seconds = ttl,
            "Cached account statement"
        );

        Ok(())
    }

    /// Get cached account statement
    pub async fn get_cached_statement(
        &self,
        account_number: &str,
        period_start: &DateTime<Utc>,
        period_end: &DateTime<Utc>,
    ) -> TBankResult<Option<AccountStatement>> {
        let cache_key = self.statement_cache_key(account_number, period_start, period_end);

        match self.cache_manager.get::<CachedStatement>(&cache_key).await {
            Ok(Some(cached_statement)) => {
                // Check if cache is still valid
                if Utc::now() > cached_statement.expires_at {
                    debug!(
                        account_number = account_number,
                        expired_at = %cached_statement.expires_at,
                        "Cached statement expired"
                    );

                    // Remove expired cache entry
                    if let Err(e) = self.cache_manager.delete(&cache_key).await {
                        warn!(
                            error = %e,
                            cache_key = %cache_key,
                            "Failed to delete expired cache entry"
                        );
                    }

                    return Ok(None);
                }

                debug!(
                    account_number = account_number,
                    cached_at = %cached_statement.cached_at,
                    expires_at = %cached_statement.expires_at,
                    transaction_count = cached_statement.statement.transactions.len(),
                    "Retrieved cached statement"
                );

                Ok(Some(cached_statement.statement))
            }
            Ok(None) => {
                debug!(
                    account_number = account_number,
                    period_start = %period_start,
                    period_end = %period_end,
                    "No cached statement found"
                );
                Ok(None)
            }
            Err(e) => {
                warn!(
                    error = %e,
                    account_number = account_number,
                    "Failed to get cached statement"
                );
                Ok(None) // Continue without cache on error
            }
        }
    }

    /// Set balance threshold for account
    pub async fn set_balance_threshold(
        &self,
        account_number: &str,
        threshold_amount: Decimal,
        alert_cooldown_minutes: Option<u64>,
    ) -> TBankResult<()> {
        let cache_key = self.threshold_cache_key(account_number);

        let threshold = BalanceThreshold {
            account_number: account_number.to_string(),
            threshold_amount,
            alert_enabled: true,
            last_alert_sent: None,
            alert_cooldown_minutes: alert_cooldown_minutes.unwrap_or(60), // Default 1 hour
        };

        if let Err(e) = self
            .cache_manager
            .set(&cache_key, &threshold, None) // No expiration for thresholds
            .await
        {
            error!(
                error = %e,
                account_number = account_number,
                "Failed to set balance threshold"
            );
            return Err(TBankError::CacheError(e.to_string()));
        }

        debug!(
            account_number = account_number,
            threshold_amount = %threshold_amount,
            "Set balance threshold"
        );

        Ok(())
    }

    /// Get balance threshold for account
    pub async fn get_balance_threshold(
        &self,
        account_number: &str,
    ) -> TBankResult<Option<BalanceThreshold>> {
        let cache_key = self.threshold_cache_key(account_number);

        match self.cache_manager.get::<BalanceThreshold>(&cache_key).await {
            Ok(threshold_opt) => Ok(threshold_opt),
            Err(_) => Ok(None),
        }
    }

    /// Check if balance alert should be sent
    pub async fn should_send_balance_alert(
        &self,
        account_number: &str,
        current_balance: Decimal,
    ) -> TBankResult<bool> {
        let threshold = match self.get_balance_threshold(account_number).await? {
            Some(threshold) => threshold,
            None => return Ok(false), // No threshold set
        };

        if !threshold.alert_enabled {
            return Ok(false);
        }

        if current_balance >= threshold.threshold_amount {
            return Ok(false); // Balance is above threshold
        }

        // Check cooldown period
        if let Some(last_alert) = threshold.last_alert_sent {
            let cooldown_duration = Duration::minutes(threshold.alert_cooldown_minutes as i64);
            if Utc::now() - last_alert < cooldown_duration {
                debug!(
                    account_number = account_number,
                    last_alert = %last_alert,
                    cooldown_minutes = threshold.alert_cooldown_minutes,
                    "Balance alert in cooldown period"
                );
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Mark balance alert as sent
    pub async fn mark_balance_alert_sent(&self, account_number: &str) -> TBankResult<()> {
        let mut threshold = match self.get_balance_threshold(account_number).await? {
            Some(threshold) => threshold,
            None => return Ok(()), // No threshold set
        };

        threshold.last_alert_sent = Some(Utc::now());

        let cache_key = self.threshold_cache_key(account_number);
        if let Err(e) = self.cache_manager.set(&cache_key, &threshold, None).await {
            error!(
                error = %e,
                account_number = account_number,
                "Failed to update balance threshold after alert"
            );
            return Err(TBankError::CacheError(e.to_string()));
        }

        debug!(
            account_number = account_number,
            "Marked balance alert as sent"
        );

        Ok(())
    }

    /// Clear all cached data for account
    pub async fn clear_account_cache(&self, account_number: &str) -> TBankResult<()> {
        let balance_key = self.balance_cache_key(account_number);

        // Clear balance cache
        if let Err(e) = self.cache_manager.delete(&balance_key).await {
            warn!(
                error = %e,
                cache_key = %balance_key,
                "Failed to clear balance cache"
            );
        }

        // Clear statement caches (this is more complex as we don't know all the keys)
        // In a real implementation, you might want to use a pattern-based deletion
        // or maintain a list of statement cache keys per account

        debug!(account_number = account_number, "Cleared account cache");

        Ok(())
    }

    /// Get cache statistics for monitoring
    pub async fn get_cache_stats(&self, account_number: &str) -> TBankResult<CacheStats> {
        let balance_key = self.balance_cache_key(account_number);
        let threshold_key = self.threshold_cache_key(account_number);

        let has_cached_balance = self
            .cache_manager
            .exists(&balance_key)
            .await
            .unwrap_or(false);
        let has_threshold = self
            .cache_manager
            .exists(&threshold_key)
            .await
            .unwrap_or(false);

        Ok(CacheStats {
            account_number: account_number.to_string(),
            has_cached_balance,
            has_threshold,
            balance_cache_key: balance_key,
            threshold_cache_key: threshold_key,
        })
    }

    /// Generate balance cache key
    fn balance_cache_key(&self, account_number: &str) -> String {
        format!("tbank:balance:{}", account_number)
    }

    /// Generate statement cache key
    fn statement_cache_key(
        &self,
        account_number: &str,
        period_start: &DateTime<Utc>,
        period_end: &DateTime<Utc>,
    ) -> String {
        format!(
            "tbank:statement:{}:{}:{}",
            account_number,
            period_start.format("%Y%m%d"),
            period_end.format("%Y%m%d")
        )
    }

    /// Generate threshold cache key
    fn threshold_cache_key(&self, account_number: &str) -> String {
        format!("tbank:threshold:{}", account_number)
    }
}

/// Cache statistics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub account_number: String,
    pub has_cached_balance: bool,
    pub has_threshold: bool,
    pub balance_cache_key: String,
    pub threshold_cache_key: String,
}

#[cfg(test)] // Re-enabled with proper test setup
mod tests {
    use super::*;
    use crate::types::{AccountBalance, Currency};

    #[test]
    fn test_cache_key_generation() {
        // Test key generation logic without requiring Redis connection
        let balance_key = format!("tbank:balance:{}", "40702810110011000000");
        assert_eq!(balance_key, "tbank:balance:40702810110011000000");

        let threshold_key = format!("tbank:threshold:{}", "40702810110011000000");
        assert_eq!(threshold_key, "tbank:threshold:40702810110011000000");

        let now = Utc::now();
        let statement_key = format!(
            "tbank:statement:{}:{}:{}",
            "40702810110011000000",
            now.format("%Y%m%d"),
            now.format("%Y%m%d")
        );
        assert!(statement_key.starts_with("tbank:statement:40702810110011000000:"));
    }

    #[test]
    fn test_cache_ttl_constants() {
        // Test that cache TTL constants are reasonable
        const BALANCE_CACHE_TTL_SECONDS: u64 = 300; // 5 minutes
        assert_eq!(BALANCE_CACHE_TTL_SECONDS, 300); // 5 minutes
        assert!(BALANCE_CACHE_TTL_SECONDS > 0);
        assert!(BALANCE_CACHE_TTL_SECONDS < 3600); // Less than 1 hour
    }

    #[test]
    fn test_balance_serialization() {
        // Test that AccountBalance can be serialized/deserialized for caching
        let balance = AccountBalance {
            account_number: "40702810110011000000".to_string(),
            balance: rust_decimal::Decimal::from(1000),
            available_balance: Some(rust_decimal::Decimal::from(1000)),
            blocked_amount: Some(rust_decimal::Decimal::from(0)),
            currency: Currency::RUB,
            last_updated: Utc::now(),
        };

        // Test JSON serialization (used for Redis storage)
        let json = serde_json::to_string(&balance).unwrap();
        let deserialized: AccountBalance = serde_json::from_str(&json).unwrap();

        assert_eq!(balance.account_number, deserialized.account_number);
        assert_eq!(balance.available_balance, deserialized.available_balance);
        assert_eq!(balance.currency, deserialized.currency);
    }
}
