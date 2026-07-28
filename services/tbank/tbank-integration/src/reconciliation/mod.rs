pub mod alerts;
pub mod matcher;
pub mod reports;

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use crate::audit::logger::AuditLogger;
use crate::audit::ComplianceAuditEvents;
use crate::balance::BalanceMonitor;
use crate::client::TBankClient;
use crate::database::CommonQueries;
use crate::types::{
    Discrepancy, DiscrepancySeverity, DiscrepancyType, FinancialAudit, ReconciliationReport,
    ReconciliationStatus, TBankError, TBankResult, Transaction,
};

pub use alerts::ReconciliationAlertManager;
pub use matcher::TransactionMatcher;
pub use reports::ReconciliationReportGenerator;

/// Transaction reconciler for daily reconciliation of T-Bank operations
#[derive(Clone)]
pub struct TransactionReconciler {
    tbank_client: Arc<TBankClient>,
    balance_monitor: Arc<BalanceMonitor>,
    db_pool: Arc<PgPool>,
    audit_logger: Arc<AuditLogger>,
    matcher: Arc<TransactionMatcher>,
    report_generator: Arc<ReconciliationReportGenerator>,
    alert_manager: Arc<ReconciliationAlertManager>,
}

impl TransactionReconciler {
    /// Create new transaction reconciler
    pub fn new(
        tbank_client: Arc<TBankClient>,
        balance_monitor: Arc<BalanceMonitor>,
        db_pool: Arc<PgPool>,
        audit_logger: Arc<AuditLogger>,
    ) -> Self {
        debug!("Creating TransactionReconciler");

        let matcher = Arc::new(TransactionMatcher::new(db_pool.clone()));
        let report_generator = Arc::new(ReconciliationReportGenerator::new(db_pool.clone()));
        let alert_manager = Arc::new(ReconciliationAlertManager::new(db_pool.clone()));

        Self {
            tbank_client,
            balance_monitor,
            db_pool,
            audit_logger,
            matcher,
            report_generator,
            alert_manager,
        }
    }

    /// Run daily reconciliation for previous business day
    pub async fn run_daily_reconciliation(
        &self,
        account_number: &str,
    ) -> TBankResult<ReconciliationReport> {
        let reconciliation_date = self.get_previous_business_day();

        info!(
            account_number = account_number,
            reconciliation_date = %reconciliation_date,
            "Starting daily reconciliation"
        );

        self.run_reconciliation_for_date(account_number, reconciliation_date)
            .await
    }

    /// Run reconciliation for specific date
    pub async fn run_reconciliation_for_date(
        &self,
        account_number: &str,
        date: NaiveDate,
    ) -> TBankResult<ReconciliationReport> {
        debug!(
            account_number = account_number,
            date = %date,
            "Running reconciliation for specific date"
        );

        // Validate account number
        crate::balance::BalanceMonitor::validate_account_number(account_number)?;

        // Step 1: Fetch T-Bank statement for the date
        let tbank_transactions = self
            .fetch_tbank_statement_for_date(account_number, date)
            .await?;

        info!(
            account_number = account_number,
            date = %date,
            tbank_transaction_count = tbank_transactions.len(),
            "Fetched T-Bank transactions for reconciliation"
        );

        // Step 2: Fetch internal transactions for the date
        let internal_transactions = self.fetch_internal_transactions_for_date(date).await?;

        info!(
            date = %date,
            internal_transaction_count = internal_transactions.len(),
            "Fetched internal transactions for reconciliation"
        );

        // Step 3: Compare transactions and find matches
        let reconciliation_result = self
            .matcher
            .compare_transactions(&tbank_transactions, &internal_transactions, date)
            .await?;

        // Step 4: Create financial audit records
        self.create_financial_audit_records(
            &reconciliation_result.matched_transactions,
            &reconciliation_result.unmatched_tbank,
            &reconciliation_result.unmatched_internal,
        )
        .await?;

        // Step 5: Generate reconciliation report
        let report = self
            .report_generator
            .generate_report(date, &reconciliation_result)
            .await?;

        // Step 6: Check for critical discrepancies and send alerts
        if report.has_critical_discrepancies() {
            self.alert_manager
                .send_critical_discrepancy_alert(&report)
                .await?;
        }

        // Step 7: Log reconciliation completion
        self.audit_logger
            .log_reconciliation_completed(
                account_number,
                date,
                report.matched_count,
                report.unmatched_count,
                &report.total_matched_amount,
                &report.total_unmatched_amount,
                None,
            )
            .await?;

        info!(
            account_number = account_number,
            date = %date,
            matched_count = report.matched_count,
            unmatched_count = report.unmatched_count,
            total_matched_amount = %report.total_matched_amount,
            "Reconciliation completed successfully"
        );

        Ok(report)
    }

    /// Run manual reconciliation for specific date range
    pub async fn run_manual_reconciliation(
        &self,
        account_number: &str,
        from_date: NaiveDate,
        to_date: NaiveDate,
    ) -> TBankResult<Vec<ReconciliationReport>> {
        info!(
            account_number = account_number,
            from_date = %from_date,
            to_date = %to_date,
            "Starting manual reconciliation for date range"
        );

        if from_date > to_date {
            return Err(TBankError::ValidationError(
                "From date cannot be after to date".to_string(),
            ));
        }

        let mut reports = Vec::new();
        let mut current_date = from_date;

        while current_date <= to_date {
            match self
                .run_reconciliation_for_date(account_number, current_date)
                .await
            {
                Ok(report) => {
                    reports.push(report);
                }
                Err(e) => {
                    error!(
                        error = %e,
                        account_number = account_number,
                        date = %current_date,
                        "Failed to run reconciliation for date, continuing with next date"
                    );
                    // Continue with next date instead of failing completely
                }
            }
            current_date += Duration::days(1);
        }

        info!(
            account_number = account_number,
            from_date = %from_date,
            to_date = %to_date,
            report_count = reports.len(),
            "Manual reconciliation completed"
        );

        Ok(reports)
    }

    /// Fetch T-Bank statement for specific date
    async fn fetch_tbank_statement_for_date(
        &self,
        account_number: &str,
        date: NaiveDate,
    ) -> TBankResult<Vec<Transaction>> {
        debug!(
            account_number = account_number,
            date = %date,
            "Fetching T-Bank statement for date"
        );

        // Get statement for the specific date
        let statement = self
            .balance_monitor
            .get_statement(
                account_number,
                Some(date),
                Some(date),
                None,
                false, // Don't use cache for reconciliation
            )
            .await?;

        debug!(
            account_number = account_number,
            date = %date,
            transaction_count = statement.transactions.len(),
            "T-Bank statement fetched successfully"
        );

        Ok(statement.transactions)
    }

    /// Fetch internal transactions for specific date
    async fn fetch_internal_transactions_for_date(
        &self,
        date: NaiveDate,
    ) -> TBankResult<Vec<FinancialAudit>> {
        debug!(date = %date, "Fetching internal transactions for date");

        let query = r#"
            SELECT fa.id, fa.transaction_id, fa.transaction_type, fa.amount, fa.currency,
                   fa.counterparty_inn, fa.operation_date, fa.status, fa.reconciled_at, fa.created_at
            FROM financial_audit fa
            WHERE DATE(fa.operation_date) = $1
            ORDER BY fa.operation_date ASC
        "#;

        let rows = sqlx::query(query)
            .bind(date)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    date = %date,
                    "Failed to fetch internal transactions"
                );
                TBankError::DatabaseError(e)
            })?;

        let mut transactions = Vec::new();
        for row in rows {
            let financial_audit = FinancialAudit {
                id: Some(row.try_get("id").map_err(TBankError::DatabaseError)?),
                transaction_id: row
                    .try_get("transaction_id")
                    .map_err(TBankError::DatabaseError)?,
                amount: row.try_get("amount").map_err(TBankError::DatabaseError)?,
                currency: row
                    .try_get::<String, _>("currency")
                    .map_err(TBankError::DatabaseError)?
                    .parse()
                    .map_err(TBankError::InvalidCurrency)?,
                counterparty_inn: row
                    .try_get("counterparty_inn")
                    .map_err(TBankError::DatabaseError)?,
                operation_date: row
                    .try_get("operation_date")
                    .map_err(TBankError::DatabaseError)?,
                status: match row
                    .try_get::<String, _>("status")
                    .map_err(TBankError::DatabaseError)?
                    .as_str()
                {
                    "Matched" => ReconciliationStatus::Matched,
                    "Unmatched" => ReconciliationStatus::Unmatched,
                    "Disputed" => ReconciliationStatus::Disputed,
                    _ => ReconciliationStatus::Unmatched,
                },
                reconciled_at: row
                    .try_get("reconciled_at")
                    .map_err(TBankError::DatabaseError)?,
                created_at: Some(
                    row.try_get("created_at")
                        .map_err(TBankError::DatabaseError)?,
                ),
            };
            transactions.push(financial_audit);
        }

        debug!(
            date = %date,
            transaction_count = transactions.len(),
            "Internal transactions fetched successfully"
        );

        Ok(transactions)
    }

    /// Create financial audit records for reconciliation results
    async fn create_financial_audit_records(
        &self,
        matched_transactions: &[(Transaction, FinancialAudit)],
        unmatched_tbank: &[Transaction],
        unmatched_internal: &[FinancialAudit],
    ) -> TBankResult<()> {
        debug!(
            matched_count = matched_transactions.len(),
            unmatched_tbank_count = unmatched_tbank.len(),
            unmatched_internal_count = unmatched_internal.len(),
            "Creating financial audit records"
        );

        // Update matched transactions
        for (tbank_transaction, internal_transaction) in matched_transactions {
            if let Some(internal_id) = internal_transaction.id {
                self.update_financial_audit_status(
                    internal_id,
                    ReconciliationStatus::Matched,
                    Some(Utc::now()),
                )
                .await?;
            }

            // Create audit record for T-Bank transaction if not exists
            self.create_financial_audit_if_not_exists(
                tbank_transaction,
                ReconciliationStatus::Matched,
            )
            .await?;
        }

        // Create audit records for unmatched T-Bank transactions
        for transaction in unmatched_tbank {
            self.create_financial_audit_if_not_exists(transaction, ReconciliationStatus::Unmatched)
                .await?;
        }

        // Update unmatched internal transactions
        for internal_transaction in unmatched_internal {
            if let Some(internal_id) = internal_transaction.id {
                self.update_financial_audit_status(
                    internal_id,
                    ReconciliationStatus::Unmatched,
                    None,
                )
                .await?;
            }
        }

        debug!("Financial audit records created successfully");
        Ok(())
    }

    /// Create financial audit record if it doesn't exist
    async fn create_financial_audit_if_not_exists(
        &self,
        transaction: &Transaction,
        status: ReconciliationStatus,
    ) -> TBankResult<()> {
        let default_id = format!("tbank_{}", transaction.id.unwrap_or_default());
        let transaction_id = transaction.reference_number.as_ref().unwrap_or(&default_id);

        let status_str = match status {
            ReconciliationStatus::Matched => "Matched",
            ReconciliationStatus::Unmatched => "Unmatched",
            ReconciliationStatus::Disputed => "Disputed",
        };

        CommonQueries::insert_financial_audit(
            &self.db_pool,
            transaction_id,
            "TBANK_TRANSACTION",
            transaction.amount,
            &transaction.currency.to_string(),
            transaction.counterparty_inn.as_deref(),
            transaction.operation_date,
            status_str,
        )
        .await
    }

    /// Update financial audit status
    async fn update_financial_audit_status(
        &self,
        audit_id: uuid::Uuid,
        status: ReconciliationStatus,
        reconciled_at: Option<DateTime<Utc>>,
    ) -> TBankResult<()> {
        let status_str = match status {
            ReconciliationStatus::Matched => "Matched",
            ReconciliationStatus::Unmatched => "Unmatched",
            ReconciliationStatus::Disputed => "Disputed",
        };

        let query = r#"
            UPDATE financial_audit 
            SET status = $1, reconciled_at = $2
            WHERE id = $3
        "#;

        sqlx::query(query)
            .bind(status_str)
            .bind(reconciled_at)
            .bind(audit_id)
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    audit_id = ?audit_id,
                    "Failed to update financial audit status"
                );
                TBankError::DatabaseError(e)
            })?;

        Ok(())
    }

    /// Get previous business day (excluding weekends)
    fn get_previous_business_day(&self) -> NaiveDate {
        let today = Utc::now().date_naive();
        let mut previous_day = today - Duration::days(1);

        // Skip weekends
        while previous_day.weekday().number_from_monday() > 5 {
            previous_day -= Duration::days(1);
        }

        previous_day
    }
}
