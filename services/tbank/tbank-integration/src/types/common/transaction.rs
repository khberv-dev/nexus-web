use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::currency::Currency;

/// Transaction data from account statements
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Transaction {
    pub id: Option<Uuid>,
    pub operation_date: DateTime<Utc>,
    pub amount: Decimal,
    pub currency: Currency,
    pub counterparty_inn: Option<String>,
    pub counterparty_name: Option<String>,
    pub description: String,
    pub operation_type: OperationType,
    pub account_number: String,
    pub reference_number: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Type of financial operation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub enum OperationType {
    Credit, // Incoming payment
    Debit,  // Outgoing payment
}

/// Account balance information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AccountBalance {
    pub account_number: String,
    pub balance: Decimal,
    pub currency: Currency,
    pub last_updated: DateTime<Utc>,
    pub available_balance: Option<Decimal>,
    pub blocked_amount: Option<Decimal>,
}

/// Account statement with transactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountStatement {
    pub account_number: String,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub opening_balance: Decimal,
    pub closing_balance: Decimal,
    pub currency: Currency,
    pub transactions: Vec<Transaction>,
    pub next_cursor: Option<String>,
}

/// Financial audit record for reconciliation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FinancialAudit {
    pub id: Option<Uuid>,
    pub transaction_id: String,
    pub amount: Decimal,
    pub currency: Currency,
    pub counterparty_inn: Option<String>,
    pub operation_date: DateTime<Utc>,
    pub status: ReconciliationStatus,
    pub reconciled_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Status of transaction reconciliation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ReconciliationStatus {
    Matched,
    Unmatched,
    Disputed,
}

/// Reconciliation report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconciliationReport {
    pub date: chrono::NaiveDate,
    pub matched_count: u32,
    pub unmatched_count: u32,
    pub total_matched_amount: Decimal,
    pub total_unmatched_amount: Decimal,
    pub discrepancies: Vec<Discrepancy>,
    pub generated_at: DateTime<Utc>,
}

/// Discrepancy found during reconciliation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Discrepancy {
    pub discrepancy_type: DiscrepancyType,
    pub transaction_id: Option<String>,
    pub expected_amount: Option<Decimal>,
    pub actual_amount: Option<Decimal>,
    pub description: String,
    pub severity: DiscrepancySeverity,
}

/// Type of discrepancy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiscrepancyType {
    MissingTransaction,
    AmountMismatch,
    DuplicateTransaction,
    UnexpectedTransaction,
    DateMismatch,
}

/// Severity of discrepancy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DiscrepancySeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl Transaction {
    /// Create a new transaction
    pub fn new(
        operation_date: DateTime<Utc>,
        amount: Decimal,
        currency: Currency,
        counterparty_inn: Option<String>,
        counterparty_name: Option<String>,
        description: String,
        operation_type: OperationType,
        account_number: String,
    ) -> Self {
        Self {
            id: None,
            operation_date,
            amount,
            currency,
            counterparty_inn,
            counterparty_name,
            description,
            operation_type,
            account_number,
            reference_number: None,
            created_at: Some(Utc::now()),
        }
    }

    /// Check if transaction is a credit (incoming)
    pub fn is_credit(&self) -> bool {
        matches!(self.operation_type, OperationType::Credit)
    }

    /// Check if transaction is a debit (outgoing)
    pub fn is_debit(&self) -> bool {
        matches!(self.operation_type, OperationType::Debit)
    }

    /// Get absolute amount (always positive)
    pub fn abs_amount(&self) -> Decimal {
        self.amount.abs()
    }
}

impl AccountBalance {
    /// Create a new account balance
    pub fn new(account_number: String, balance: Decimal, currency: Currency) -> Self {
        Self {
            account_number,
            balance,
            currency,
            last_updated: Utc::now(),
            available_balance: None,
            blocked_amount: None,
        }
    }

    /// Validate account number format (40702810XXXXXXXXXX)
    pub fn validate_account_number(account_number: &str) -> bool {
        account_number.len() == 20
            && account_number.starts_with("40702810")
            && account_number.chars().all(|c| c.is_ascii_digit())
    }

    /// Check if balance is below threshold
    pub fn is_below_threshold(&self, threshold: Decimal) -> bool {
        self.balance < threshold
    }
}

impl FinancialAudit {
    /// Create a new financial audit record
    pub fn new(
        transaction_id: String,
        amount: Decimal,
        currency: Currency,
        counterparty_inn: Option<String>,
        operation_date: DateTime<Utc>,
        status: ReconciliationStatus,
    ) -> Self {
        Self {
            id: None,
            transaction_id,
            amount,
            currency,
            counterparty_inn,
            operation_date,
            status,
            reconciled_at: None,
            created_at: Some(Utc::now()),
        }
    }

    /// Mark as reconciled
    pub fn mark_reconciled(&mut self) {
        if matches!(self.status, ReconciliationStatus::Unmatched) {
            self.status = ReconciliationStatus::Matched;
            self.reconciled_at = Some(Utc::now());
        }
    }
}

impl ReconciliationReport {
    /// Create a new reconciliation report
    pub fn new(date: chrono::NaiveDate) -> Self {
        Self {
            date,
            matched_count: 0,
            unmatched_count: 0,
            total_matched_amount: Decimal::ZERO,
            total_unmatched_amount: Decimal::ZERO,
            discrepancies: Vec::new(),
            generated_at: Utc::now(),
        }
    }

    /// Add a discrepancy to the report
    pub fn add_discrepancy(&mut self, discrepancy: Discrepancy) {
        self.discrepancies.push(discrepancy);
        self.unmatched_count += 1;
    }

    /// Check if report has critical discrepancies
    pub fn has_critical_discrepancies(&self) -> bool {
        self.discrepancies
            .iter()
            .any(|d| matches!(d.severity, DiscrepancySeverity::Critical))
    }
}

impl std::fmt::Display for OperationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OperationType::Credit => write!(f, "Credit"),
            OperationType::Debit => write!(f, "Debit"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transaction_creation() {
        let transaction = Transaction::new(
            Utc::now(),
            Decimal::from(1000),
            Currency::RUB,
            Some("7707083893".to_string()),
            Some("Test Company".to_string()),
            "Payment for services".to_string(),
            OperationType::Credit,
            "40702810110011000000".to_string(),
        );

        assert!(transaction.is_credit());
        assert_eq!(transaction.abs_amount(), Decimal::from(1000));
    }

    #[test]
    fn test_account_number_validation() {
        assert!(AccountBalance::validate_account_number(
            "40702810110011000000"
        ));
        assert!(!AccountBalance::validate_account_number("40702810110011"));
        assert!(!AccountBalance::validate_account_number(
            "50702810110011000000"
        ));
        assert!(!AccountBalance::validate_account_number(
            "4070281011001100000a"
        ));
    }

    #[test]
    fn test_financial_audit() {
        let mut audit = FinancialAudit::new(
            "txn_123".to_string(),
            Decimal::from(1000),
            Currency::RUB,
            Some("7707083893".to_string()),
            Utc::now(),
            ReconciliationStatus::Unmatched,
        );

        audit.mark_reconciled();
        assert_eq!(audit.status, ReconciliationStatus::Matched);
        assert!(audit.reconciled_at.is_some());
    }

    #[test]
    fn test_reconciliation_report() {
        let mut report = ReconciliationReport::new(chrono::Utc::now().date_naive());

        let discrepancy = Discrepancy {
            discrepancy_type: DiscrepancyType::AmountMismatch,
            transaction_id: Some("txn_123".to_string()),
            expected_amount: Some(Decimal::from(1000)),
            actual_amount: Some(Decimal::from(900)),
            description: "Amount mismatch".to_string(),
            severity: DiscrepancySeverity::Critical,
        };

        report.add_discrepancy(discrepancy);
        assert!(report.has_critical_discrepancies());
        assert_eq!(report.unmatched_count, 1);
    }
}
