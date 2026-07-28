use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use crate::database::CommonQueries;
use crate::reconciliation::matcher::ReconciliationResult;
use crate::types::{
    Discrepancy, DiscrepancySeverity, DiscrepancyType, ReconciliationReport, TBankError,
    TBankResult,
};

/// Reconciliation report generator
#[derive(Clone)]
pub struct ReconciliationReportGenerator {
    db_pool: Arc<PgPool>,
}

impl ReconciliationReportGenerator {
    /// Create new reconciliation report generator
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        debug!("Creating ReconciliationReportGenerator");
        Self { db_pool }
    }

    /// Generate reconciliation report from reconciliation result
    pub async fn generate_report(
        &self,
        date: NaiveDate,
        reconciliation_result: &ReconciliationResult,
    ) -> TBankResult<ReconciliationReport> {
        debug!(
            date = %date,
            matched_count = reconciliation_result.matched_transactions.len(),
            unmatched_tbank_count = reconciliation_result.unmatched_tbank.len(),
            unmatched_internal_count = reconciliation_result.unmatched_internal.len(),
            "Generating reconciliation report"
        );

        let mut report = ReconciliationReport::new(date);

        // Calculate matched transactions
        report.matched_count = reconciliation_result.matched_transactions.len() as u32;
        report.total_matched_amount = reconciliation_result
            .matched_transactions
            .iter()
            .map(|(tbank_tx, _)| tbank_tx.amount.abs())
            .sum();

        // Calculate unmatched transactions
        let unmatched_tbank_amount: Decimal = reconciliation_result
            .unmatched_tbank
            .iter()
            .map(|tx| tx.amount.abs())
            .sum();

        let unmatched_internal_amount: Decimal = reconciliation_result
            .unmatched_internal
            .iter()
            .map(|tx| tx.amount.abs())
            .sum();

        report.unmatched_count = (reconciliation_result.unmatched_tbank.len()
            + reconciliation_result.unmatched_internal.len())
            as u32;
        report.total_unmatched_amount = unmatched_tbank_amount + unmatched_internal_amount;

        // Add discrepancies
        report.discrepancies = reconciliation_result.discrepancies.clone();

        // Store report in database
        self.store_reconciliation_report(&report).await?;

        info!(
            date = %date,
            matched_count = report.matched_count,
            unmatched_count = report.unmatched_count,
            total_matched_amount = %report.total_matched_amount,
            total_unmatched_amount = %report.total_unmatched_amount,
            discrepancy_count = report.discrepancies.len(),
            "Reconciliation report generated successfully"
        );

        Ok(report)
    }

    /// Get reconciliation report for specific date
    pub async fn get_report_for_date(
        &self,
        date: NaiveDate,
    ) -> TBankResult<Option<ReconciliationReport>> {
        debug!(date = %date, "Getting reconciliation report for date");

        let query = r#"
            SELECT id, date, matched_count, unmatched_count, total_matched_amount, 
                   total_unmatched_amount, generated_at, created_at
            FROM reconciliation_reports 
            WHERE date = $1
            ORDER BY generated_at DESC
            LIMIT 1
        "#;

        let row = sqlx::query(query)
            .bind(date)
            .fetch_optional(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    date = %date,
                    "Failed to get reconciliation report"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let report_id: uuid::Uuid = row.try_get("id").map_err(TBankError::DatabaseError)?;

            let mut report = ReconciliationReport {
                date: row.try_get("date").map_err(TBankError::DatabaseError)?,
                matched_count: row
                    .try_get::<i32, _>("matched_count")
                    .map_err(TBankError::DatabaseError)? as u32,
                unmatched_count: row
                    .try_get::<i32, _>("unmatched_count")
                    .map_err(TBankError::DatabaseError)? as u32,
                total_matched_amount: row
                    .try_get("total_matched_amount")
                    .map_err(TBankError::DatabaseError)?,
                total_unmatched_amount: row
                    .try_get("total_unmatched_amount")
                    .map_err(TBankError::DatabaseError)?,
                discrepancies: Vec::new(),
                generated_at: row
                    .try_get("generated_at")
                    .map_err(TBankError::DatabaseError)?,
            };

            // Load discrepancies
            report.discrepancies = self.load_discrepancies_for_report(report_id).await?;

            debug!(
                date = %date,
                matched_count = report.matched_count,
                unmatched_count = report.unmatched_count,
                "Reconciliation report loaded successfully"
            );

            Ok(Some(report))
        } else {
            debug!(date = %date, "No reconciliation report found for date");
            Ok(None)
        }
    }

    /// Get reconciliation reports for date range
    pub async fn get_reports_for_range(
        &self,
        from_date: NaiveDate,
        to_date: NaiveDate,
    ) -> TBankResult<Vec<ReconciliationReport>> {
        debug!(
            from_date = %from_date,
            to_date = %to_date,
            "Getting reconciliation reports for date range"
        );

        if from_date > to_date {
            return Err(TBankError::ValidationError(
                "From date cannot be after to date".to_string(),
            ));
        }

        let query = r#"
            SELECT id, date, matched_count, unmatched_count, total_matched_amount, 
                   total_unmatched_amount, generated_at, created_at
            FROM reconciliation_reports 
            WHERE date BETWEEN $1 AND $2
            ORDER BY date ASC, generated_at DESC
        "#;

        let rows = sqlx::query(query)
            .bind(from_date)
            .bind(to_date)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    from_date = %from_date,
                    to_date = %to_date,
                    "Failed to get reconciliation reports for range"
                );
                TBankError::DatabaseError(e)
            })?;

        let mut reports = Vec::new();
        for row in rows {
            let report_id: uuid::Uuid = row.try_get("id").map_err(TBankError::DatabaseError)?;

            let mut report = ReconciliationReport {
                date: row.try_get("date").map_err(TBankError::DatabaseError)?,
                matched_count: row
                    .try_get::<i32, _>("matched_count")
                    .map_err(TBankError::DatabaseError)? as u32,
                unmatched_count: row
                    .try_get::<i32, _>("unmatched_count")
                    .map_err(TBankError::DatabaseError)? as u32,
                total_matched_amount: row
                    .try_get("total_matched_amount")
                    .map_err(TBankError::DatabaseError)?,
                total_unmatched_amount: row
                    .try_get("total_unmatched_amount")
                    .map_err(TBankError::DatabaseError)?,
                discrepancies: Vec::new(),
                generated_at: row
                    .try_get("generated_at")
                    .map_err(TBankError::DatabaseError)?,
            };

            // Load discrepancies
            report.discrepancies = self.load_discrepancies_for_report(report_id).await?;
            reports.push(report);
        }

        info!(
            from_date = %from_date,
            to_date = %to_date,
            report_count = reports.len(),
            "Reconciliation reports loaded successfully"
        );

        Ok(reports)
    }

    /// Generate summary report for multiple dates
    pub async fn generate_summary_report(
        &self,
        from_date: NaiveDate,
        to_date: NaiveDate,
    ) -> TBankResult<ReconciliationSummaryReport> {
        debug!(
            from_date = %from_date,
            to_date = %to_date,
            "Generating summary reconciliation report"
        );

        let reports = self.get_reports_for_range(from_date, to_date).await?;

        let mut summary = ReconciliationSummaryReport {
            from_date,
            to_date,
            total_days: reports.len() as u32,
            total_matched_count: 0,
            total_unmatched_count: 0,
            total_matched_amount: Decimal::ZERO,
            total_unmatched_amount: Decimal::ZERO,
            critical_discrepancies: 0,
            high_discrepancies: 0,
            medium_discrepancies: 0,
            low_discrepancies: 0,
            generated_at: Utc::now(),
        };

        for report in &reports {
            summary.total_matched_count += report.matched_count;
            summary.total_unmatched_count += report.unmatched_count;
            summary.total_matched_amount += report.total_matched_amount;
            summary.total_unmatched_amount += report.total_unmatched_amount;

            for discrepancy in &report.discrepancies {
                match discrepancy.severity {
                    DiscrepancySeverity::Critical => summary.critical_discrepancies += 1,
                    DiscrepancySeverity::High => summary.high_discrepancies += 1,
                    DiscrepancySeverity::Medium => summary.medium_discrepancies += 1,
                    DiscrepancySeverity::Low => summary.low_discrepancies += 1,
                }
            }
        }

        info!(
            from_date = %from_date,
            to_date = %to_date,
            total_days = summary.total_days,
            total_matched_count = summary.total_matched_count,
            total_unmatched_count = summary.total_unmatched_count,
            "Summary reconciliation report generated"
        );

        Ok(summary)
    }

    /// Store reconciliation report in database
    async fn store_reconciliation_report(
        &self,
        report: &ReconciliationReport,
    ) -> TBankResult<uuid::Uuid> {
        debug!(
            date = %report.date,
            "Storing reconciliation report in database"
        );

        let report_id = uuid::Uuid::new_v4();

        // Insert main report record
        let query = r#"
            INSERT INTO reconciliation_reports (
                id, date, matched_count, unmatched_count, total_matched_amount,
                total_unmatched_amount, generated_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#;

        sqlx::query(query)
            .bind(report_id)
            .bind(report.date)
            .bind(report.matched_count as i32)
            .bind(report.unmatched_count as i32)
            .bind(report.total_matched_amount)
            .bind(report.total_unmatched_amount)
            .bind(report.generated_at)
            .bind(Utc::now())
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    date = %report.date,
                    "Failed to store reconciliation report"
                );
                TBankError::DatabaseError(e)
            })?;

        // Insert discrepancies
        for discrepancy in &report.discrepancies {
            self.store_discrepancy(report_id, discrepancy).await?;
        }

        debug!(
            date = %report.date,
            report_id = ?report_id,
            "Reconciliation report stored successfully"
        );

        Ok(report_id)
    }

    /// Store discrepancy in database
    async fn store_discrepancy(
        &self,
        report_id: uuid::Uuid,
        discrepancy: &Discrepancy,
    ) -> TBankResult<()> {
        let query = r#"
            INSERT INTO reconciliation_discrepancies (
                id, report_id, discrepancy_type, transaction_id, expected_amount,
                actual_amount, description, severity, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#;

        let discrepancy_type_str = match discrepancy.discrepancy_type {
            DiscrepancyType::MissingTransaction => "MissingTransaction",
            DiscrepancyType::AmountMismatch => "AmountMismatch",
            DiscrepancyType::DuplicateTransaction => "DuplicateTransaction",
            DiscrepancyType::UnexpectedTransaction => "UnexpectedTransaction",
            DiscrepancyType::DateMismatch => "DateMismatch",
        };

        let severity_str = match discrepancy.severity {
            DiscrepancySeverity::Critical => "Critical",
            DiscrepancySeverity::High => "High",
            DiscrepancySeverity::Medium => "Medium",
            DiscrepancySeverity::Low => "Low",
        };

        sqlx::query(query)
            .bind(uuid::Uuid::new_v4())
            .bind(report_id)
            .bind(discrepancy_type_str)
            .bind(&discrepancy.transaction_id)
            .bind(discrepancy.expected_amount)
            .bind(discrepancy.actual_amount)
            .bind(&discrepancy.description)
            .bind(severity_str)
            .bind(Utc::now())
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    report_id = ?report_id,
                    "Failed to store discrepancy"
                );
                TBankError::DatabaseError(e)
            })?;

        Ok(())
    }

    /// Load discrepancies for report
    async fn load_discrepancies_for_report(
        &self,
        report_id: uuid::Uuid,
    ) -> TBankResult<Vec<Discrepancy>> {
        let query = r#"
            SELECT discrepancy_type, transaction_id, expected_amount, actual_amount,
                   description, severity
            FROM reconciliation_discrepancies
            WHERE report_id = $1
            ORDER BY severity DESC, created_at ASC
        "#;

        let rows = sqlx::query(query)
            .bind(report_id)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    report_id = ?report_id,
                    "Failed to load discrepancies for report"
                );
                TBankError::DatabaseError(e)
            })?;

        let mut discrepancies = Vec::new();
        for row in rows {
            let discrepancy_type_str: String = row
                .try_get("discrepancy_type")
                .map_err(TBankError::DatabaseError)?;
            let severity_str: String =
                row.try_get("severity").map_err(TBankError::DatabaseError)?;

            let discrepancy_type = match discrepancy_type_str.as_str() {
                "MissingTransaction" => DiscrepancyType::MissingTransaction,
                "AmountMismatch" => DiscrepancyType::AmountMismatch,
                "DuplicateTransaction" => DiscrepancyType::DuplicateTransaction,
                "UnexpectedTransaction" => DiscrepancyType::UnexpectedTransaction,
                "DateMismatch" => DiscrepancyType::DateMismatch,
                _ => DiscrepancyType::UnexpectedTransaction,
            };

            let severity = match severity_str.as_str() {
                "Critical" => DiscrepancySeverity::Critical,
                "High" => DiscrepancySeverity::High,
                "Medium" => DiscrepancySeverity::Medium,
                "Low" => DiscrepancySeverity::Low,
                _ => DiscrepancySeverity::Low,
            };

            discrepancies.push(Discrepancy {
                discrepancy_type,
                transaction_id: row
                    .try_get::<Option<String>, _>("transaction_id")
                    .map_err(TBankError::DatabaseError)?,
                expected_amount: row
                    .try_get::<Option<Decimal>, _>("expected_amount")
                    .map_err(TBankError::DatabaseError)?,
                actual_amount: row
                    .try_get::<Option<Decimal>, _>("actual_amount")
                    .map_err(TBankError::DatabaseError)?,
                description: row
                    .try_get::<String, _>("description")
                    .map_err(TBankError::DatabaseError)?,
                severity,
            });
        }

        Ok(discrepancies)
    }
}

/// Summary report for multiple reconciliation reports
#[derive(Debug, Clone)]
pub struct ReconciliationSummaryReport {
    pub from_date: NaiveDate,
    pub to_date: NaiveDate,
    pub total_days: u32,
    pub total_matched_count: u32,
    pub total_unmatched_count: u32,
    pub total_matched_amount: Decimal,
    pub total_unmatched_amount: Decimal,
    pub critical_discrepancies: u32,
    pub high_discrepancies: u32,
    pub medium_discrepancies: u32,
    pub low_discrepancies: u32,
    pub generated_at: DateTime<Utc>,
}
