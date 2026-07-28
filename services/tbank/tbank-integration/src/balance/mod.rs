pub mod cache;
pub mod filters;
pub mod parser;

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use crate::client::api_methods::{BalanceApiMethods, BankingApiMethods};
use crate::client::{ApiType, TBankClient};
use crate::types::{
    AccountBalance, AccountStatement, Currency, TBankError, TBankResult, Transaction,
};
use shared::CacheManager;

pub use cache::{BalanceCacheManager, BalanceThreshold, CacheStats};
pub use filters::{
    AmountRange, DateRange, FilteredTransactions, TransactionFilter, TransactionFilterManager,
};
pub use parser::{parse_single_transaction, parse_transactions, TransactionSummary};

/// Balance monitor for T-Bank account operations
#[derive(Clone)]
pub struct BalanceMonitor {
    tbank_client: Arc<TBankClient>,
    cache_manager: Arc<BalanceCacheManager>,
    filter_manager: Arc<TransactionFilterManager>,
}

impl BalanceMonitor {
    /// Create new balance monitor
    pub fn new(tbank_client: Arc<TBankClient>, cache_manager: Arc<CacheManager>) -> Self {
        debug!("Creating BalanceMonitor");
        let balance_cache_manager = Arc::new(BalanceCacheManager::new(cache_manager.clone()));
        let filter_manager = Arc::new(TransactionFilterManager::new(cache_manager));

        Self {
            tbank_client,
            cache_manager: balance_cache_manager,
            filter_manager,
        }
    }

    /// Validate account number format (40702810XXXXXXXXXX)
    pub fn validate_account_number(account_number: &str) -> TBankResult<()> {
        if account_number.len() != 20 {
            return Err(TBankError::InvalidAccountNumber(format!(
                "Account number must be exactly 20 digits, got {}",
                account_number.len()
            )));
        }

        if !account_number.starts_with("40702810") {
            return Err(TBankError::InvalidAccountNumber(
                "Account number must start with 40702810".to_string(),
            ));
        }

        if !account_number.chars().all(|c| c.is_ascii_digit()) {
            return Err(TBankError::InvalidAccountNumber(
                "Account number must contain only digits".to_string(),
            ));
        }

        debug!(
            account_number = account_number,
            "Account number validation passed"
        );
        Ok(())
    }

    /// Get account balance with caching (5-minute TTL)
    pub async fn get_balance(&self, account_number: &str) -> TBankResult<AccountBalance> {
        // Validate account number format
        Self::validate_account_number(account_number)?;

        debug!(account_number = account_number, "Getting account balance");

        // Check cache first
        if let Some(cached_balance) = self
            .cache_manager
            .get_cached_balance(account_number)
            .await?
        {
            debug!(account_number = account_number, "Returning cached balance");
            return Ok(cached_balance);
        }

        // Get balance from T-Bank API
        let balance_response = self.tbank_client.get_balance(account_number).await?;

        // Parse response into AccountBalance
        let balance = self.parse_balance_response(account_number, balance_response)?;

        // Cache the result
        if let Err(e) = self
            .cache_manager
            .cache_balance(account_number, &balance)
            .await
        {
            warn!(
                error = %e,
                account_number = account_number,
                "Failed to cache balance, continuing without cache"
            );
        }

        info!(
            account_number = account_number,
            balance = %balance.balance,
            currency = %balance.currency,
            "Retrieved account balance"
        );

        Ok(balance)
    }

    /// Get account statement with pagination support and optional caching
    pub async fn get_statement(
        &self,
        account_number: &str,
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
        cursor: Option<String>,
        use_cache: bool,
    ) -> TBankResult<AccountStatement> {
        // Validate account number format
        Self::validate_account_number(account_number)?;

        debug!(
            account_number = account_number,
            from_date = ?from_date,
            to_date = ?to_date,
            cursor = ?cursor,
            use_cache = use_cache,
            "Getting account statement"
        );

        // Check cache if requested and dates are provided
        if use_cache && from_date.is_some() && to_date.is_some() {
            let period_start = from_date.unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();
            let period_end = to_date.unwrap().and_hms_opt(23, 59, 59).unwrap().and_utc();

            if let Some(cached_statement) = self
                .cache_manager
                .get_cached_statement(account_number, &period_start, &period_end)
                .await?
            {
                debug!(
                    account_number = account_number,
                    "Returning cached statement"
                );
                return Ok(cached_statement);
            }
        }

        // Convert dates to API format - use defaults if not provided
        let from_date_str = from_date
            .unwrap_or_else(|| Utc::now().date_naive() - chrono::Duration::days(30))
            .format("%Y-%m-%d")
            .to_string();
        let to_date_str = to_date
            .unwrap_or_else(|| Utc::now().date_naive())
            .format("%Y-%m-%d")
            .to_string();

        // Get statement from T-Bank API
        let statement_response = self
            .tbank_client
            .get_statement(
                &from_date_str,
                &to_date_str,
                None, // currency - use default
            )
            .await?;

        // Parse response into AccountStatement
        let statement = self.parse_statement_response(account_number, statement_response)?;

        // Cache the result if requested and dates are provided
        if use_cache && from_date.is_some() && to_date.is_some() {
            if let Err(e) = self
                .cache_manager
                .cache_statement(account_number, &statement, None)
                .await
            {
                warn!(
                    error = %e,
                    account_number = account_number,
                    "Failed to cache statement, continuing without cache"
                );
            }
        }

        info!(
            account_number = account_number,
            transaction_count = statement.transactions.len(),
            period_start = %statement.period_start,
            period_end = %statement.period_end,
            "Retrieved account statement"
        );

        Ok(statement)
    }

    /// Get filtered transactions with caching
    pub async fn get_filtered_transactions(
        &self,
        account_number: &str,
        filter: &TransactionFilter,
        use_cache: bool,
    ) -> TBankResult<FilteredTransactions> {
        // Validate filter
        filter.validate()?;

        debug!(
            account_number = account_number,
            filter = ?filter,
            use_cache = use_cache,
            "Getting filtered transactions"
        );

        // Check cache if requested
        if use_cache {
            let cache_key = self
                .filter_manager
                .generate_filter_cache_key(account_number, filter);
            if let Some(cached_result) = self
                .filter_manager
                .get_cached_filtered_transactions(&cache_key)
                .await?
            {
                debug!(
                    account_number = account_number,
                    cache_key = %cache_key,
                    "Returning cached filtered transactions"
                );
                return Ok(cached_result);
            }
        }

        // Get statement data first
        let from_date = filter.date_range.as_ref().and_then(|dr| dr.from);
        let to_date = filter.date_range.as_ref().and_then(|dr| dr.to);

        let statement = self
            .get_statement(account_number, from_date, to_date, None, use_cache)
            .await?;

        // Apply filters
        let filtered_result = self
            .filter_manager
            .apply_filters(statement.transactions, filter)?;

        // Cache the result if requested
        if use_cache {
            let cache_key = self
                .filter_manager
                .generate_filter_cache_key(account_number, filter);
            if let Err(e) = self
                .filter_manager
                .cache_filtered_transactions(&cache_key, &filtered_result, Some(300)) // 5 minutes
                .await
            {
                warn!(
                    error = %e,
                    cache_key = %cache_key,
                    "Failed to cache filtered transactions"
                );
            }
        }

        info!(
            account_number = account_number,
            total_count = filtered_result.total_count,
            filtered_count = filtered_result.filtered_count,
            returned_count = filtered_result.transactions.len(),
            "Retrieved filtered transactions"
        );

        Ok(filtered_result)
    }

    /// Check if balance is below threshold and trigger alert
    pub async fn check_balance_threshold(
        &self,
        account_number: &str,
        threshold: Option<Decimal>,
    ) -> TBankResult<bool> {
        let balance = self.get_balance(account_number).await?;

        // Use provided threshold or get from cache
        let threshold_amount = if let Some(threshold) = threshold {
            threshold
        } else {
            match self
                .cache_manager
                .get_balance_threshold(account_number)
                .await?
            {
                Some(cached_threshold) => cached_threshold.threshold_amount,
                None => {
                    debug!(
                        account_number = account_number,
                        "No threshold configured for account"
                    );
                    return Ok(false);
                }
            }
        };

        if balance.is_below_threshold(threshold_amount) {
            // Check if we should send alert (considering cooldown)
            if self
                .cache_manager
                .should_send_balance_alert(account_number, balance.balance)
                .await?
            {
                warn!(
                    account_number = account_number,
                    current_balance = %balance.balance,
                    threshold = %threshold_amount,
                    "Balance is below threshold, alert should be sent"
                );

                // Mark alert as sent
                if let Err(e) = self
                    .cache_manager
                    .mark_balance_alert_sent(account_number)
                    .await
                {
                    error!(
                        error = %e,
                        account_number = account_number,
                        "Failed to mark balance alert as sent"
                    );
                }

                // TODO: Trigger alert to monitoring systems
                // This would integrate with the monitoring module

                return Ok(true);
            } else {
                debug!(
                    account_number = account_number,
                    current_balance = %balance.balance,
                    threshold = %threshold_amount,
                    "Balance is below threshold but alert is in cooldown"
                );
            }
        } else {
            debug!(
                account_number = account_number,
                current_balance = %balance.balance,
                threshold = %threshold_amount,
                "Balance is above threshold"
            );
        }

        Ok(false)
    }

    /// Set balance threshold for account
    pub async fn set_balance_threshold(
        &self,
        account_number: &str,
        threshold_amount: Decimal,
        alert_cooldown_minutes: Option<u64>,
    ) -> TBankResult<()> {
        Self::validate_account_number(account_number)?;

        self.cache_manager
            .set_balance_threshold(account_number, threshold_amount, alert_cooldown_minutes)
            .await
    }

    /// Get balance threshold for account
    pub async fn get_balance_threshold(
        &self,
        account_number: &str,
    ) -> TBankResult<Option<BalanceThreshold>> {
        Self::validate_account_number(account_number)?;
        self.cache_manager
            .get_balance_threshold(account_number)
            .await
    }

    /// Clear all cached data for account
    pub async fn clear_account_cache(&self, account_number: &str) -> TBankResult<()> {
        Self::validate_account_number(account_number)?;
        self.cache_manager.clear_account_cache(account_number).await
    }

    /// Get cache statistics for monitoring
    pub async fn get_cache_stats(&self, account_number: &str) -> TBankResult<CacheStats> {
        Self::validate_account_number(account_number)?;
        self.cache_manager.get_cache_stats(account_number).await
    }

    /// Parse T-Bank balance response into AccountBalance
    fn parse_balance_response(
        &self,
        account_number: &str,
        response: serde_json::Value,
    ) -> TBankResult<AccountBalance> {
        let balance_str = response
            .get("balance")
            .and_then(|v| v.as_str())
            .ok_or_else(|| TBankError::ParseError("Missing balance field".to_string()))?;

        let balance = balance_str
            .parse::<Decimal>()
            .map_err(|e| TBankError::ParseError(format!("Invalid balance format: {}", e)))?;

        let currency_str = response
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("RUB");

        let currency = currency_str
            .parse::<Currency>()
            .map_err(|e| TBankError::InvalidCurrency(e))?;

        let available_balance = response
            .get("availableBalance")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<Decimal>().ok());

        let blocked_amount = response
            .get("blockedAmount")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<Decimal>().ok());

        Ok(AccountBalance {
            account_number: account_number.to_string(),
            balance,
            currency,
            last_updated: Utc::now(),
            available_balance,
            blocked_amount,
        })
    }

    /// Parse T-Bank statement response into AccountStatement
    fn parse_statement_response(
        &self,
        account_number: &str,
        response: serde_json::Value,
    ) -> TBankResult<AccountStatement> {
        let period_start_str = response
            .get("periodStart")
            .and_then(|v| v.as_str())
            .ok_or_else(|| TBankError::ParseError("Missing periodStart field".to_string()))?;

        let period_end_str = response
            .get("periodEnd")
            .and_then(|v| v.as_str())
            .ok_or_else(|| TBankError::ParseError("Missing periodEnd field".to_string()))?;

        let period_start = DateTime::parse_from_rfc3339(period_start_str)
            .map_err(|e| TBankError::ParseError(format!("Invalid periodStart format: {}", e)))?
            .with_timezone(&Utc);

        let period_end = DateTime::parse_from_rfc3339(period_end_str)
            .map_err(|e| TBankError::ParseError(format!("Invalid periodEnd format: {}", e)))?
            .with_timezone(&Utc);

        let opening_balance_str = response
            .get("openingBalance")
            .and_then(|v| v.as_str())
            .unwrap_or("0");

        let opening_balance = opening_balance_str
            .parse::<Decimal>()
            .map_err(|e| TBankError::ParseError(format!("Invalid openingBalance format: {}", e)))?;

        let closing_balance_str = response
            .get("closingBalance")
            .and_then(|v| v.as_str())
            .unwrap_or("0");

        let closing_balance = closing_balance_str
            .parse::<Decimal>()
            .map_err(|e| TBankError::ParseError(format!("Invalid closingBalance format: {}", e)))?;

        let currency_str = response
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("RUB");

        let currency = currency_str
            .parse::<Currency>()
            .map_err(|e| TBankError::InvalidCurrency(e))?;

        let next_cursor = response
            .get("nextCursor")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Parse transactions using the parser module
        let empty_transactions = vec![];
        let transactions_array = response
            .get("transactions")
            .and_then(|v| v.as_array())
            .unwrap_or(&empty_transactions);

        let transactions = parser::parse_transactions(transactions_array, account_number)?;

        Ok(AccountStatement {
            account_number: account_number.to_string(),
            period_start,
            period_end,
            opening_balance,
            closing_balance,
            currency,
            transactions,
            next_cursor,
        })
    }
}
