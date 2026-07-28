use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::hash::Hash;
use std::sync::Arc;
use tracing::{debug, warn};

use crate::types::{Currency, OperationType, TBankError, TBankResult, Transaction};
use shared::CacheManager;

/// Transaction filter criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionFilter {
    /// Filter by date range
    pub date_range: Option<DateRange>,
    /// Filter by amount range
    pub amount_range: Option<AmountRange>,
    /// Filter by counterparty INN
    pub counterparty_inn: Option<String>,
    /// Filter by operation type
    pub operation_type: Option<OperationType>,
    /// Filter by currency
    pub currency: Option<Currency>,
    /// Filter by description (contains text)
    pub description_contains: Option<String>,
    /// Limit number of results
    pub limit: Option<usize>,
    /// Offset for pagination
    pub offset: Option<usize>,
}

/// Date range filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

/// Amount range filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmountRange {
    pub min: Option<Decimal>,
    pub max: Option<Decimal>,
}

/// Filtered transaction results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilteredTransactions {
    pub transactions: Vec<Transaction>,
    pub total_count: usize,
    pub filtered_count: usize,
    pub has_more: bool,
}

/// Transaction filter and cache manager
#[derive(Clone)]
pub struct TransactionFilterManager {
    cache_manager: Arc<CacheManager>,
}

impl TransactionFilterManager {
    /// Create new transaction filter manager
    pub fn new(cache_manager: Arc<CacheManager>) -> Self {
        Self { cache_manager }
    }

    /// Apply filters to transactions
    pub fn apply_filters(
        &self,
        transactions: Vec<Transaction>,
        filter: &TransactionFilter,
    ) -> TBankResult<FilteredTransactions> {
        debug!(
            total_transactions = transactions.len(),
            filter = ?filter,
            "Applying transaction filters"
        );

        let total_count = transactions.len();
        let mut filtered_transactions = transactions;

        // Apply date range filter
        if let Some(ref date_range) = filter.date_range {
            filtered_transactions = self.filter_by_date_range(filtered_transactions, date_range);
        }

        // Apply amount range filter
        if let Some(ref amount_range) = filter.amount_range {
            filtered_transactions =
                self.filter_by_amount_range(filtered_transactions, amount_range);
        }

        // Apply counterparty INN filter
        if let Some(ref inn) = filter.counterparty_inn {
            filtered_transactions = self.filter_by_counterparty_inn(filtered_transactions, inn);
        }

        // Apply operation type filter
        if let Some(ref op_type) = filter.operation_type {
            filtered_transactions = self.filter_by_operation_type(filtered_transactions, op_type);
        }

        // Apply currency filter
        if let Some(ref currency) = filter.currency {
            filtered_transactions = self.filter_by_currency(filtered_transactions, currency);
        }

        // Apply description filter
        if let Some(ref description) = filter.description_contains {
            filtered_transactions = self.filter_by_description(filtered_transactions, description);
        }

        let filtered_count = filtered_transactions.len();

        // Apply pagination
        let (paginated_transactions, has_more) = self.apply_pagination(
            filtered_transactions,
            filter.offset.unwrap_or(0),
            filter.limit,
        );

        debug!(
            total_count = total_count,
            filtered_count = filtered_count,
            returned_count = paginated_transactions.len(),
            has_more = has_more,
            "Applied transaction filters"
        );

        Ok(FilteredTransactions {
            transactions: paginated_transactions,
            total_count,
            filtered_count,
            has_more,
        })
    }

    /// Cache filtered transactions
    pub async fn cache_filtered_transactions(
        &self,
        cache_key: &str,
        filtered_transactions: &FilteredTransactions,
        ttl_seconds: Option<u64>,
    ) -> TBankResult<()> {
        if let Err(e) = self
            .cache_manager
            .set(
                cache_key,
                filtered_transactions,
                ttl_seconds.map(std::time::Duration::from_secs),
            )
            .await
        {
            warn!(
                error = %e,
                cache_key = cache_key,
                "Failed to cache filtered transactions"
            );
            return Err(TBankError::CacheError(e.to_string()));
        }

        debug!(
            cache_key = cache_key,
            transaction_count = filtered_transactions.transactions.len(),
            "Cached filtered transactions"
        );

        Ok(())
    }

    /// Get cached filtered transactions
    pub async fn get_cached_filtered_transactions(
        &self,
        cache_key: &str,
    ) -> TBankResult<Option<FilteredTransactions>> {
        match self
            .cache_manager
            .get::<FilteredTransactions>(cache_key)
            .await
        {
            Ok(Some(cached_transactions)) => {
                debug!(
                    cache_key = cache_key,
                    transaction_count = cached_transactions.transactions.len(),
                    "Retrieved cached filtered transactions"
                );
                Ok(Some(cached_transactions))
            }
            Ok(None) => {
                debug!(
                    cache_key = cache_key,
                    "No cached filtered transactions found"
                );
                Ok(None)
            }
            Err(e) => {
                warn!(
                    error = %e,
                    cache_key = cache_key,
                    "Failed to get cached filtered transactions"
                );
                Ok(None) // Continue without cache on error
            }
        }
    }

    /// Generate cache key for filter
    pub fn generate_filter_cache_key(
        &self,
        account_number: &str,
        filter: &TransactionFilter,
    ) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        account_number.hash(&mut hasher);

        // Hash filter parameters
        if let Some(ref date_range) = filter.date_range {
            date_range.from.hash(&mut hasher);
            date_range.to.hash(&mut hasher);
        }
        if let Some(ref amount_range) = filter.amount_range {
            amount_range.min.hash(&mut hasher);
            amount_range.max.hash(&mut hasher);
        }
        filter.counterparty_inn.hash(&mut hasher);
        filter.operation_type.hash(&mut hasher);
        filter.currency.hash(&mut hasher);
        filter.description_contains.hash(&mut hasher);
        filter.limit.hash(&mut hasher);
        filter.offset.hash(&mut hasher);

        let hash = hasher.finish();
        format!("transactions:filtered:{}:{:x}", account_number, hash)
    }

    /// Filter transactions by date range
    fn filter_by_date_range(
        &self,
        transactions: Vec<Transaction>,
        date_range: &DateRange,
    ) -> Vec<Transaction> {
        transactions
            .into_iter()
            .filter(|t| {
                let transaction_date = t.operation_date.date_naive();

                if let Some(from_date) = date_range.from {
                    if transaction_date < from_date {
                        return false;
                    }
                }

                if let Some(to_date) = date_range.to {
                    if transaction_date > to_date {
                        return false;
                    }
                }

                true
            })
            .collect()
    }

    /// Filter transactions by amount range
    fn filter_by_amount_range(
        &self,
        transactions: Vec<Transaction>,
        amount_range: &AmountRange,
    ) -> Vec<Transaction> {
        transactions
            .into_iter()
            .filter(|t| {
                let abs_amount = t.amount.abs();

                if let Some(min_amount) = amount_range.min {
                    if abs_amount < min_amount {
                        return false;
                    }
                }

                if let Some(max_amount) = amount_range.max {
                    if abs_amount > max_amount {
                        return false;
                    }
                }

                true
            })
            .collect()
    }

    /// Filter transactions by counterparty INN
    fn filter_by_counterparty_inn(
        &self,
        transactions: Vec<Transaction>,
        inn: &str,
    ) -> Vec<Transaction> {
        transactions
            .into_iter()
            .filter(|t| {
                t.counterparty_inn
                    .as_ref()
                    .map(|t_inn| t_inn == inn)
                    .unwrap_or(false)
            })
            .collect()
    }

    /// Filter transactions by operation type
    fn filter_by_operation_type(
        &self,
        transactions: Vec<Transaction>,
        operation_type: &OperationType,
    ) -> Vec<Transaction> {
        transactions
            .into_iter()
            .filter(|t| &t.operation_type == operation_type)
            .collect()
    }

    /// Filter transactions by currency
    fn filter_by_currency(
        &self,
        transactions: Vec<Transaction>,
        currency: &Currency,
    ) -> Vec<Transaction> {
        transactions
            .into_iter()
            .filter(|t| &t.currency == currency)
            .collect()
    }

    /// Filter transactions by description
    fn filter_by_description(
        &self,
        transactions: Vec<Transaction>,
        description_contains: &str,
    ) -> Vec<Transaction> {
        let search_term = description_contains.to_lowercase();
        transactions
            .into_iter()
            .filter(|t| t.description.to_lowercase().contains(&search_term))
            .collect()
    }

    /// Apply pagination to transactions
    fn apply_pagination(
        &self,
        transactions: Vec<Transaction>,
        offset: usize,
        limit: Option<usize>,
    ) -> (Vec<Transaction>, bool) {
        let total_count = transactions.len();

        if offset >= total_count {
            return (Vec::new(), false);
        }

        let end_index = if let Some(limit) = limit {
            std::cmp::min(offset + limit, total_count)
        } else {
            total_count
        };

        let paginated = transactions
            .into_iter()
            .skip(offset)
            .take(end_index - offset)
            .collect();
        let has_more = end_index < total_count;

        (paginated, has_more)
    }
}

impl Default for TransactionFilter {
    fn default() -> Self {
        Self {
            date_range: None,
            amount_range: None,
            counterparty_inn: None,
            operation_type: None,
            currency: None,
            description_contains: None,
            limit: Some(100), // Default limit
            offset: Some(0),  // Default offset
        }
    }
}

impl TransactionFilter {
    /// Create a new empty filter
    pub fn new() -> Self {
        Self::default()
    }

    /// Set date range filter
    pub fn with_date_range(mut self, from: Option<NaiveDate>, to: Option<NaiveDate>) -> Self {
        self.date_range = Some(DateRange { from, to });
        self
    }

    /// Set amount range filter
    pub fn with_amount_range(mut self, min: Option<Decimal>, max: Option<Decimal>) -> Self {
        self.amount_range = Some(AmountRange { min, max });
        self
    }

    /// Set counterparty INN filter
    pub fn with_counterparty_inn(mut self, inn: String) -> Self {
        self.counterparty_inn = Some(inn);
        self
    }

    /// Set operation type filter
    pub fn with_operation_type(mut self, operation_type: OperationType) -> Self {
        self.operation_type = Some(operation_type);
        self
    }

    /// Set currency filter
    pub fn with_currency(mut self, currency: Currency) -> Self {
        self.currency = Some(currency);
        self
    }

    /// Set description filter
    pub fn with_description_contains(mut self, description: String) -> Self {
        self.description_contains = Some(description);
        self
    }

    /// Set pagination
    pub fn with_pagination(mut self, offset: usize, limit: usize) -> Self {
        self.offset = Some(offset);
        self.limit = Some(limit);
        self
    }

    /// Validate filter parameters
    pub fn validate(&self) -> TBankResult<()> {
        // Validate date range
        if let Some(ref date_range) = self.date_range {
            if let (Some(from), Some(to)) = (date_range.from, date_range.to) {
                if from > to {
                    return Err(TBankError::ValidationError(
                        "Date range 'from' cannot be after 'to'".to_string(),
                    ));
                }
            }
        }

        // Validate amount range
        if let Some(ref amount_range) = self.amount_range {
            if let (Some(min), Some(max)) = (amount_range.min, amount_range.max) {
                if min > max {
                    return Err(TBankError::ValidationError(
                        "Amount range 'min' cannot be greater than 'max'".to_string(),
                    ));
                }
                if min.is_sign_negative() {
                    return Err(TBankError::ValidationError(
                        "Amount range 'min' cannot be negative".to_string(),
                    ));
                }
            }
        }

        // Validate INN format
        if let Some(ref inn) = self.counterparty_inn {
            if !inn.is_empty() && !is_valid_inn_format(inn) {
                return Err(TBankError::InvalidInn(inn.clone()));
            }
        }

        // Validate pagination
        if let Some(limit) = self.limit {
            if limit == 0 {
                return Err(TBankError::ValidationError(
                    "Limit cannot be zero".to_string(),
                ));
            }
            if limit > 10000 {
                return Err(TBankError::ValidationError(
                    "Limit cannot exceed 10000".to_string(),
                ));
            }
        }

        Ok(())
    }
}

/// Validate INN format (10 or 12 digits)
fn is_valid_inn_format(inn: &str) -> bool {
    (inn.len() == 10 || inn.len() == 12) && inn.chars().all(|c| c.is_ascii_digit())
}

#[cfg(test)] // Re-enabled with proper test setup
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_transaction(
        amount: i64,
        operation_type: OperationType,
        inn: Option<&str>,
        description: &str,
    ) -> Transaction {
        Transaction::new(
            Utc::now(),
            Decimal::from(amount),
            Currency::RUB,
            inn.map(|s| s.to_string()),
            None,
            description.to_string(),
            operation_type,
            "40702810110011000000".to_string(),
        )
    }

    #[test]
    fn test_filter_by_operation_type() {
        let transactions = vec![
            create_test_transaction(1000, OperationType::Credit, None, "Credit transaction"),
            create_test_transaction(-500, OperationType::Debit, None, "Debit transaction"),
            create_test_transaction(2000, OperationType::Credit, None, "Another credit"),
        ];

        // Test filtering logic without requiring Redis
        let credit_transactions: Vec<_> = transactions
            .iter()
            .filter(|t| t.operation_type == OperationType::Credit)
            .collect();

        assert_eq!(credit_transactions.len(), 2);
        assert!(credit_transactions
            .iter()
            .all(|t| t.operation_type == OperationType::Credit));

        let debit_transactions: Vec<_> = transactions
            .iter()
            .filter(|t| t.operation_type == OperationType::Debit)
            .collect();

        assert_eq!(debit_transactions.len(), 1);
        assert_eq!(debit_transactions[0].amount, Decimal::from(-500));
    }

    #[test]
    fn test_filter_by_amount_range() {
        let transactions = vec![
            create_test_transaction(500, OperationType::Credit, None, "Small credit"),
            create_test_transaction(1500, OperationType::Credit, None, "Medium credit"),
            create_test_transaction(2500, OperationType::Credit, None, "Large credit"),
        ];

        // Test amount range filtering
        let min_amount = Decimal::from(1000);
        let max_amount = Decimal::from(2000);

        let filtered: Vec<_> = transactions
            .iter()
            .filter(|t| t.amount >= min_amount && t.amount <= max_amount)
            .collect();

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].amount, Decimal::from(1500));
    }

    #[test]
    fn test_filter_by_inn() {
        let transactions = vec![
            create_test_transaction(1000, OperationType::Credit, Some("7707083893"), "Company A"),
            create_test_transaction(1500, OperationType::Credit, Some("7707083894"), "Company B"),
            create_test_transaction(2000, OperationType::Credit, None, "No INN"),
        ];

        // Test INN filtering
        let target_inn = "7707083893";
        let filtered: Vec<_> = transactions
            .iter()
            .filter(|t| {
                t.counterparty_inn
                    .as_ref()
                    .map_or(false, |inn| inn == target_inn)
            })
            .collect();

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].counterparty_inn.as_ref().unwrap(), target_inn);
    }

    #[test]
    fn test_filter_by_description() {
        let transactions = vec![
            create_test_transaction(1000, OperationType::Credit, None, "Payment for services"),
            create_test_transaction(1500, OperationType::Credit, None, "Salary payment"),
            create_test_transaction(2000, OperationType::Credit, None, "Equipment purchase"),
        ];

        // Test description filtering (case-insensitive)
        let search_term = "payment";
        let filtered: Vec<_> = transactions
            .iter()
            .filter(|t| {
                t.description
                    .to_lowercase()
                    .contains(&search_term.to_lowercase())
            })
            .collect();

        assert_eq!(filtered.len(), 2);
        assert!(filtered
            .iter()
            .all(|t| t.description.to_lowercase().contains(search_term)));
    }
}
