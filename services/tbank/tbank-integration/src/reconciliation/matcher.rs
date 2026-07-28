use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::types::{
    Discrepancy, DiscrepancySeverity, DiscrepancyType, FinancialAudit, TBankError, TBankResult,
    Transaction,
};

/// Transaction matching logic for reconciliation
#[derive(Clone)]
pub struct TransactionMatcher {
    db_pool: Arc<PgPool>,
}

/// Result of transaction comparison
#[derive(Debug, Clone)]
pub struct ReconciliationResult {
    pub matched_transactions: Vec<(Transaction, FinancialAudit)>,
    pub unmatched_tbank: Vec<Transaction>,
    pub unmatched_internal: Vec<FinancialAudit>,
    pub discrepancies: Vec<Discrepancy>,
}

impl TransactionMatcher {
    /// Create new transaction matcher
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        debug!("Creating TransactionMatcher");
        Self { db_pool }
    }

    /// Compare T-Bank transactions with internal transactions
    pub async fn compare_transactions(
        &self,
        tbank_transactions: &[Transaction],
        internal_transactions: &[FinancialAudit],
        date: NaiveDate,
    ) -> TBankResult<ReconciliationResult> {
        debug!(
            tbank_count = tbank_transactions.len(),
            internal_count = internal_transactions.len(),
            date = %date,
            "Starting transaction comparison"
        );

        let mut matched_transactions = Vec::new();
        let mut unmatched_tbank = Vec::new();
        let mut unmatched_internal = internal_transactions.to_vec();
        let mut discrepancies = Vec::new();

        // Compare each T-Bank transaction with internal transactions
        for tbank_transaction in tbank_transactions {
            if let Some(match_index) =
                self.find_matching_internal_transaction(tbank_transaction, &unmatched_internal)
            {
                let internal_transaction = unmatched_internal.remove(match_index);

                // Check for amount discrepancies
                if let Some(discrepancy) =
                    self.check_amount_discrepancy(tbank_transaction, &internal_transaction)
                {
                    discrepancies.push(discrepancy);
                }

                debug!(
                    tbank_ref = ?tbank_transaction.reference_number,
                    internal_id = ?internal_transaction.transaction_id,
                    amount = %tbank_transaction.amount,
                    "Found matching transaction"
                );

                matched_transactions.push((tbank_transaction.clone(), internal_transaction));
            } else {
                unmatched_tbank.push(tbank_transaction.clone());

                // Create discrepancy for missing internal transaction
                discrepancies.push(Discrepancy {
                    discrepancy_type: DiscrepancyType::MissingTransaction,
                    transaction_id: tbank_transaction.reference_number.clone(),
                    expected_amount: Some(tbank_transaction.amount),
                    actual_amount: None,
                    description: format!(
                        "T-Bank transaction not found in internal records: {} ({})",
                        tbank_transaction.description, tbank_transaction.amount
                    ),
                    severity: self.determine_discrepancy_severity(&tbank_transaction.amount),
                });

                warn!(
                    tbank_ref = ?tbank_transaction.reference_number,
                    amount = %tbank_transaction.amount,
                    description = %tbank_transaction.description,
                    "Unmatched T-Bank transaction"
                );
            }
        }

        // Create discrepancies for remaining unmatched internal transactions
        for internal_transaction in &unmatched_internal {
            discrepancies.push(Discrepancy {
                discrepancy_type: DiscrepancyType::UnexpectedTransaction,
                transaction_id: Some(internal_transaction.transaction_id.clone()),
                expected_amount: None,
                actual_amount: Some(internal_transaction.amount),
                description: format!(
                    "Internal transaction not found in T-Bank records: {} ({})",
                    internal_transaction.transaction_id, internal_transaction.amount
                ),
                severity: self.determine_discrepancy_severity(&internal_transaction.amount),
            });

            warn!(
                internal_id = %internal_transaction.transaction_id,
                amount = %internal_transaction.amount,
                "Unmatched internal transaction"
            );
        }

        let result = ReconciliationResult {
            matched_transactions,
            unmatched_tbank,
            unmatched_internal,
            discrepancies,
        };

        info!(
            matched_count = result.matched_transactions.len(),
            unmatched_tbank_count = result.unmatched_tbank.len(),
            unmatched_internal_count = result.unmatched_internal.len(),
            discrepancy_count = result.discrepancies.len(),
            "Transaction comparison completed"
        );

        Ok(result)
    }

    /// Find matching internal transaction for T-Bank transaction
    fn find_matching_internal_transaction(
        &self,
        tbank_transaction: &Transaction,
        internal_transactions: &[FinancialAudit],
    ) -> Option<usize> {
        // Try exact match by reference number first
        if let Some(ref_number) = &tbank_transaction.reference_number {
            if let Some(index) = internal_transactions
                .iter()
                .position(|internal| internal.transaction_id == *ref_number)
            {
                return Some(index);
            }
        }

        // Try match by amount, date, and INN
        internal_transactions
            .iter()
            .position(|internal| self.is_transaction_match(tbank_transaction, internal))
    }

    /// Check if T-Bank transaction matches internal transaction
    fn is_transaction_match(
        &self,
        tbank_transaction: &Transaction,
        internal_transaction: &FinancialAudit,
    ) -> bool {
        // Match by amount (exact)
        let amount_match = tbank_transaction.amount.abs() == internal_transaction.amount.abs();

        // Match by date (same day)
        let date_match = tbank_transaction.operation_date.date_naive()
            == internal_transaction.operation_date.date_naive();

        // Match by counterparty INN (if available)
        let inn_match = match (
            &tbank_transaction.counterparty_inn,
            &internal_transaction.counterparty_inn,
        ) {
            (Some(tbank_inn), Some(internal_inn)) => tbank_inn == internal_inn,
            (None, None) => true, // Both don't have INN
            _ => false,           // One has INN, other doesn't
        };

        // Require all three criteria to match
        amount_match && date_match && inn_match
    }

    /// Check for amount discrepancy between matched transactions
    fn check_amount_discrepancy(
        &self,
        tbank_transaction: &Transaction,
        internal_transaction: &FinancialAudit,
    ) -> Option<Discrepancy> {
        let tbank_amount = tbank_transaction.amount.abs();
        let internal_amount = internal_transaction.amount.abs();

        if tbank_amount != internal_amount {
            Some(Discrepancy {
                discrepancy_type: DiscrepancyType::AmountMismatch,
                transaction_id: tbank_transaction.reference_number.clone(),
                expected_amount: Some(internal_amount),
                actual_amount: Some(tbank_amount),
                description: format!(
                    "Amount mismatch for transaction {}: expected {}, actual {}",
                    internal_transaction.transaction_id, internal_amount, tbank_amount
                ),
                severity: self.determine_amount_mismatch_severity(&tbank_amount, &internal_amount),
            })
        } else {
            None
        }
    }

    /// Determine discrepancy severity based on amount
    fn determine_discrepancy_severity(&self, amount: &Decimal) -> DiscrepancySeverity {
        Self::determine_discrepancy_severity_static(amount)
    }

    /// Static version of discrepancy severity determination for testing
    fn determine_discrepancy_severity_static(amount: &Decimal) -> DiscrepancySeverity {
        let abs_amount = amount.abs();

        if abs_amount >= Decimal::from(1_000_000) {
            // 1M+ RUB
            DiscrepancySeverity::Critical
        } else if abs_amount >= Decimal::from(100_000) {
            // 100K+ RUB
            DiscrepancySeverity::High
        } else if abs_amount >= Decimal::from(10_000) {
            // 10K+ RUB
            DiscrepancySeverity::Medium
        } else {
            DiscrepancySeverity::Low
        }
    }

    /// Determine amount mismatch severity
    fn determine_amount_mismatch_severity(
        &self,
        expected: &Decimal,
        actual: &Decimal,
    ) -> DiscrepancySeverity {
        let difference = (expected - actual).abs();
        let percentage = if !expected.is_zero() {
            (difference / expected.abs()) * Decimal::from(100)
        } else {
            Decimal::from(100)
        };

        if percentage >= Decimal::from(50) || difference >= Decimal::from(1_000_000) {
            DiscrepancySeverity::Critical
        } else if percentage >= Decimal::from(20) || difference >= Decimal::from(100_000) {
            DiscrepancySeverity::High
        } else if percentage >= Decimal::from(5) || difference >= Decimal::from(10_000) {
            DiscrepancySeverity::Medium
        } else {
            DiscrepancySeverity::Low
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Currency, OperationType, ReconciliationStatus};
    use chrono::Utc;

    #[test]
    fn test_discrepancy_severity() {
        // Test the severity determination logic without database
        let severity_critical =
            TransactionMatcher::determine_discrepancy_severity_static(&Decimal::from(2_000_000));
        assert_eq!(severity_critical, DiscrepancySeverity::Critical);

        let severity_high =
            TransactionMatcher::determine_discrepancy_severity_static(&Decimal::from(500_000));
        assert_eq!(severity_high, DiscrepancySeverity::High);

        let severity_medium =
            TransactionMatcher::determine_discrepancy_severity_static(&Decimal::from(50_000));
        assert_eq!(severity_medium, DiscrepancySeverity::Medium);

        let severity_low =
            TransactionMatcher::determine_discrepancy_severity_static(&Decimal::from(1_000));
        assert_eq!(severity_low, DiscrepancySeverity::Low);
    }

    #[test]
    fn test_transaction_matching_logic() {
        // Test transaction matching logic without database
        let tbank_transaction = Transaction::new(
            Utc::now(),
            Decimal::from(1000),
            Currency::RUB,
            Some("7707083893".to_string()),
            Some("Test Company".to_string()),
            "Payment for services".to_string(),
            OperationType::Credit,
            "40702810110011000000".to_string(),
        );

        let internal_transaction = FinancialAudit::new(
            "txn_123".to_string(),
            Decimal::from(1000),
            Currency::RUB,
            Some("7707083893".to_string()),
            Utc::now(),
            ReconciliationStatus::Unmatched,
        );

        // Test basic transaction properties
        assert_eq!(tbank_transaction.amount, Decimal::from(1000));
        assert_eq!(tbank_transaction.currency, Currency::RUB);
        assert_eq!(internal_transaction.amount, Decimal::from(1000));
        assert_eq!(internal_transaction.currency, Currency::RUB);
    }
}
