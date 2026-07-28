use chrono::{DateTime, Duration, Utc};
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use crate::types::{
    DiscrepancySeverity, DiscrepancyType, ReconciliationReport, TBankError, TBankResult,
};

/// Alert manager for reconciliation discrepancies
#[derive(Clone)]
pub struct ReconciliationAlertManager {
    db_pool: Arc<PgPool>,
}

/// Alert configuration for reconciliation
#[derive(Debug, Clone)]
pub struct AlertConfig {
    pub critical_amount_threshold: Decimal,
    pub high_amount_threshold: Decimal,
    pub multiple_discrepancy_threshold: u32,
    pub alert_cooldown_minutes: u64,
    pub enable_email_alerts: bool,
    pub enable_slack_alerts: bool,
}

/// Alert record for tracking sent alerts
#[derive(Debug, Clone)]
pub struct AlertRecord {
    pub id: uuid::Uuid,
    pub alert_type: AlertType,
    pub severity: DiscrepancySeverity,
    pub report_date: chrono::NaiveDate,
    pub message: String,
    pub sent_at: DateTime<Utc>,
    pub acknowledged: bool,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by: Option<String>,
}

/// Type of reconciliation alert
#[derive(Debug, Clone)]
pub enum AlertType {
    CriticalDiscrepancy,
    HighValueDiscrepancy,
    MultipleDiscrepancies,
    LargeAmountMismatch,
    MissingTransactions,
}

impl Default for AlertConfig {
    fn default() -> Self {
        Self {
            critical_amount_threshold: Decimal::from(1_000_000), // 1M RUB
            high_amount_threshold: Decimal::from(100_000),       // 100K RUB
            multiple_discrepancy_threshold: 10,
            alert_cooldown_minutes: 60, // 1 hour
            enable_email_alerts: true,
            enable_slack_alerts: true,
        }
    }
}

impl ReconciliationAlertManager {
    /// Create new reconciliation alert manager
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        debug!("Creating ReconciliationAlertManager");
        Self { db_pool }
    }

    /// Send critical discrepancy alert
    pub async fn send_critical_discrepancy_alert(
        &self,
        report: &ReconciliationReport,
    ) -> TBankResult<()> {
        debug!(
            date = %report.date,
            discrepancy_count = report.discrepancies.len(),
            "Checking for critical discrepancies to alert"
        );

        let config = self.get_alert_config().await?;

        // Check if we should send alerts based on cooldown
        if !self
            .should_send_alert(AlertType::CriticalDiscrepancy, report.date, &config)
            .await?
        {
            debug!(
                date = %report.date,
                "Alert is in cooldown period, skipping"
            );
            return Ok(());
        }

        let critical_discrepancies: Vec<_> = report
            .discrepancies
            .iter()
            .filter(|d| matches!(d.severity, DiscrepancySeverity::Critical))
            .collect();

        if !critical_discrepancies.is_empty() {
            let message = self.format_critical_discrepancy_message(report, &critical_discrepancies);

            self.send_alert(
                AlertType::CriticalDiscrepancy,
                DiscrepancySeverity::Critical,
                report.date,
                &message,
                &config,
            )
            .await?;

            warn!(
                date = %report.date,
                critical_count = critical_discrepancies.len(),
                "Critical discrepancy alert sent"
            );
        }

        // Check for high-value discrepancies
        let high_value_discrepancies: Vec<_> = report
            .discrepancies
            .iter()
            .filter(|d| {
                d.actual_amount.unwrap_or(Decimal::ZERO).abs() >= config.high_amount_threshold
                    || d.expected_amount.unwrap_or(Decimal::ZERO).abs()
                        >= config.high_amount_threshold
            })
            .collect();

        if !high_value_discrepancies.is_empty() {
            let message =
                self.format_high_value_discrepancy_message(report, &high_value_discrepancies);

            self.send_alert(
                AlertType::HighValueDiscrepancy,
                DiscrepancySeverity::High,
                report.date,
                &message,
                &config,
            )
            .await?;

            warn!(
                date = %report.date,
                high_value_count = high_value_discrepancies.len(),
                "High-value discrepancy alert sent"
            );
        }

        // Check for multiple discrepancies
        if report.discrepancies.len() as u32 >= config.multiple_discrepancy_threshold {
            let message = self.format_multiple_discrepancies_message(report);

            self.send_alert(
                AlertType::MultipleDiscrepancies,
                DiscrepancySeverity::High,
                report.date,
                &message,
                &config,
            )
            .await?;

            warn!(
                date = %report.date,
                discrepancy_count = report.discrepancies.len(),
                threshold = config.multiple_discrepancy_threshold,
                "Multiple discrepancies alert sent"
            );
        }

        Ok(())
    }

    /// Send large amount mismatch alert
    pub async fn send_large_amount_mismatch_alert(
        &self,
        date: chrono::NaiveDate,
        expected_amount: Decimal,
        actual_amount: Decimal,
        transaction_id: &str,
    ) -> TBankResult<()> {
        debug!(
            date = %date,
            expected_amount = %expected_amount,
            actual_amount = %actual_amount,
            transaction_id = %transaction_id,
            "Sending large amount mismatch alert"
        );

        let config = self.get_alert_config().await?;
        let difference = (expected_amount - actual_amount).abs();

        if difference >= config.critical_amount_threshold {
            let message = format!(
                "Large amount mismatch detected on {}: Transaction {} - Expected: {}, Actual: {}, Difference: {}",
                date, transaction_id, expected_amount, actual_amount, difference
            );

            self.send_alert(
                AlertType::LargeAmountMismatch,
                DiscrepancySeverity::Critical,
                date,
                &message,
                &config,
            )
            .await?;

            warn!(
                date = %date,
                transaction_id = %transaction_id,
                difference = %difference,
                "Large amount mismatch alert sent"
            );
        }

        Ok(())
    }

    /// Get alert records for date range
    pub async fn get_alert_records(
        &self,
        from_date: chrono::NaiveDate,
        to_date: chrono::NaiveDate,
    ) -> TBankResult<Vec<AlertRecord>> {
        debug!(
            from_date = %from_date,
            to_date = %to_date,
            "Getting alert records for date range"
        );

        let query = r#"
            SELECT id, alert_type, severity, report_date, message, sent_at,
                   acknowledged, acknowledged_at, acknowledged_by
            FROM reconciliation_alerts
            WHERE report_date BETWEEN $1 AND $2
            ORDER BY sent_at DESC
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
                    "Failed to get alert records"
                );
                TBankError::DatabaseError(e)
            })?;

        let mut alerts = Vec::new();
        for row in rows {
            let alert_type_str: String = row
                .try_get("alert_type")
                .map_err(TBankError::DatabaseError)?;
            let severity_str: String =
                row.try_get("severity").map_err(TBankError::DatabaseError)?;

            let alert_type = match alert_type_str.as_str() {
                "CriticalDiscrepancy" => AlertType::CriticalDiscrepancy,
                "HighValueDiscrepancy" => AlertType::HighValueDiscrepancy,
                "MultipleDiscrepancies" => AlertType::MultipleDiscrepancies,
                "LargeAmountMismatch" => AlertType::LargeAmountMismatch,
                "MissingTransactions" => AlertType::MissingTransactions,
                _ => AlertType::CriticalDiscrepancy,
            };

            let severity = match severity_str.as_str() {
                "Critical" => DiscrepancySeverity::Critical,
                "High" => DiscrepancySeverity::High,
                "Medium" => DiscrepancySeverity::Medium,
                "Low" => DiscrepancySeverity::Low,
                _ => DiscrepancySeverity::Low,
            };

            alerts.push(AlertRecord {
                id: row.try_get("id").map_err(TBankError::DatabaseError)?,
                alert_type,
                severity,
                report_date: row
                    .try_get("report_date")
                    .map_err(TBankError::DatabaseError)?,
                message: row.try_get("message").map_err(TBankError::DatabaseError)?,
                sent_at: row.try_get("sent_at").map_err(TBankError::DatabaseError)?,
                acknowledged: row
                    .try_get("acknowledged")
                    .map_err(TBankError::DatabaseError)?,
                acknowledged_at: row
                    .try_get("acknowledged_at")
                    .map_err(TBankError::DatabaseError)?,
                acknowledged_by: row
                    .try_get("acknowledged_by")
                    .map_err(TBankError::DatabaseError)?,
            });
        }

        info!(
            from_date = %from_date,
            to_date = %to_date,
            alert_count = alerts.len(),
            "Alert records retrieved successfully"
        );

        Ok(alerts)
    }

    /// Acknowledge alert
    pub async fn acknowledge_alert(
        &self,
        alert_id: uuid::Uuid,
        acknowledged_by: &str,
    ) -> TBankResult<()> {
        debug!(
            alert_id = ?alert_id,
            acknowledged_by = %acknowledged_by,
            "Acknowledging alert"
        );

        let query = r#"
            UPDATE reconciliation_alerts
            SET acknowledged = true, acknowledged_at = $1, acknowledged_by = $2
            WHERE id = $3
        "#;

        let result = sqlx::query(query)
            .bind(Utc::now())
            .bind(acknowledged_by)
            .bind(alert_id)
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    alert_id = ?alert_id,
                    "Failed to acknowledge alert"
                );
                TBankError::DatabaseError(e)
            })?;

        if result.rows_affected() == 0 {
            return Err(TBankError::ValidationError(format!(
                "Alert {} not found",
                alert_id
            )));
        }

        info!(
            alert_id = ?alert_id,
            acknowledged_by = %acknowledged_by,
            "Alert acknowledged successfully"
        );

        Ok(())
    }

    /// Check if alert should be sent based on cooldown
    async fn should_send_alert(
        &self,
        alert_type: AlertType,
        date: chrono::NaiveDate,
        config: &AlertConfig,
    ) -> TBankResult<bool> {
        let alert_type_str = match alert_type {
            AlertType::CriticalDiscrepancy => "CriticalDiscrepancy",
            AlertType::HighValueDiscrepancy => "HighValueDiscrepancy",
            AlertType::MultipleDiscrepancies => "MultipleDiscrepancies",
            AlertType::LargeAmountMismatch => "LargeAmountMismatch",
            AlertType::MissingTransactions => "MissingTransactions",
        };

        let cooldown_threshold =
            Utc::now() - Duration::minutes(config.alert_cooldown_minutes as i64);

        let query = r#"
            SELECT COUNT(*) as count
            FROM reconciliation_alerts
            WHERE alert_type = $1 AND report_date = $2 AND sent_at > $3
        "#;

        let row = sqlx::query(query)
            .bind(alert_type_str)
            .bind(date)
            .bind(cooldown_threshold)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    alert_type = %alert_type_str,
                    date = %date,
                    "Failed to check alert cooldown"
                );
                TBankError::DatabaseError(e)
            })?;

        let count: i64 = row.try_get("count").map_err(TBankError::DatabaseError)?;
        Ok(count == 0)
    }

    /// Send alert
    async fn send_alert(
        &self,
        alert_type: AlertType,
        severity: DiscrepancySeverity,
        date: chrono::NaiveDate,
        message: &str,
        config: &AlertConfig,
    ) -> TBankResult<()> {
        // Store alert record
        self.store_alert_record(alert_type.clone(), severity.clone(), date, message)
            .await?;

        // Send actual alerts based on configuration
        if config.enable_email_alerts {
            self.send_email_alert(message).await?;
        }

        if config.enable_slack_alerts {
            self.send_slack_alert(message).await?;
        }

        Ok(())
    }

    /// Store alert record in database
    async fn store_alert_record(
        &self,
        alert_type: AlertType,
        severity: DiscrepancySeverity,
        date: chrono::NaiveDate,
        message: &str,
    ) -> TBankResult<()> {
        let alert_type_str = match alert_type {
            AlertType::CriticalDiscrepancy => "CriticalDiscrepancy",
            AlertType::HighValueDiscrepancy => "HighValueDiscrepancy",
            AlertType::MultipleDiscrepancies => "MultipleDiscrepancies",
            AlertType::LargeAmountMismatch => "LargeAmountMismatch",
            AlertType::MissingTransactions => "MissingTransactions",
        };

        let severity_str = match severity {
            DiscrepancySeverity::Critical => "Critical",
            DiscrepancySeverity::High => "High",
            DiscrepancySeverity::Medium => "Medium",
            DiscrepancySeverity::Low => "Low",
        };

        let query = r#"
            INSERT INTO reconciliation_alerts (
                id, alert_type, severity, report_date, message, sent_at,
                acknowledged, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#;

        sqlx::query(query)
            .bind(uuid::Uuid::new_v4())
            .bind(alert_type_str)
            .bind(severity_str)
            .bind(date)
            .bind(message)
            .bind(Utc::now())
            .bind(false)
            .bind(Utc::now())
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    alert_type = %alert_type_str,
                    date = %date,
                    "Failed to store alert record"
                );
                TBankError::DatabaseError(e)
            })?;

        Ok(())
    }

    /// Get alert configuration
    async fn get_alert_config(&self) -> TBankResult<AlertConfig> {
        // For now, return default config
        // In a real implementation, this would load from database or configuration
        Ok(AlertConfig::default())
    }

    /// Format critical discrepancy message
    fn format_critical_discrepancy_message(
        &self,
        report: &ReconciliationReport,
        critical_discrepancies: &[&crate::types::Discrepancy],
    ) -> String {
        format!(
            "🚨 CRITICAL RECONCILIATION ALERT 🚨\n\
            Date: {}\n\
            Critical discrepancies found: {}\n\
            Total unmatched amount: {}\n\
            \n\
            Critical issues:\n{}",
            report.date,
            critical_discrepancies.len(),
            report.total_unmatched_amount,
            critical_discrepancies
                .iter()
                .take(5) // Limit to first 5 for readability
                .map(|d| format!(
                    "• {} - {}",
                    d.transaction_id.as_deref().unwrap_or("N/A"),
                    d.description
                ))
                .collect::<Vec<_>>()
                .join("\n")
        )
    }

    /// Format high-value discrepancy message
    fn format_high_value_discrepancy_message(
        &self,
        report: &ReconciliationReport,
        high_value_discrepancies: &[&crate::types::Discrepancy],
    ) -> String {
        format!(
            "⚠️ HIGH-VALUE RECONCILIATION ALERT ⚠️\n\
            Date: {}\n\
            High-value discrepancies found: {}\n\
            \n\
            High-value issues:\n{}",
            report.date,
            high_value_discrepancies.len(),
            high_value_discrepancies
                .iter()
                .take(5)
                .map(|d| format!(
                    "• {} - {} (Amount: {})",
                    d.transaction_id.as_deref().unwrap_or("N/A"),
                    d.description,
                    d.actual_amount
                        .unwrap_or(d.expected_amount.unwrap_or(Decimal::ZERO))
                ))
                .collect::<Vec<_>>()
                .join("\n")
        )
    }

    /// Format multiple discrepancies message
    fn format_multiple_discrepancies_message(&self, report: &ReconciliationReport) -> String {
        format!(
            "📊 MULTIPLE DISCREPANCIES ALERT 📊\n\
            Date: {}\n\
            Total discrepancies: {}\n\
            Matched transactions: {}\n\
            Unmatched transactions: {}\n\
            Total unmatched amount: {}",
            report.date,
            report.discrepancies.len(),
            report.matched_count,
            report.unmatched_count,
            report.total_unmatched_amount
        )
    }

    /// Send email alert (placeholder implementation)
    async fn send_email_alert(&self, message: &str) -> TBankResult<()> {
        // TODO: Implement actual email sending
        // This would integrate with an email service like SendGrid, AWS SES, etc.
        info!(message = %message, "Email alert would be sent");
        Ok(())
    }

    /// Send Slack alert (placeholder implementation)
    async fn send_slack_alert(&self, message: &str) -> TBankResult<()> {
        // TODO: Implement actual Slack webhook integration
        // This would send to a configured Slack webhook URL
        info!(message = %message, "Slack alert would be sent");
        Ok(())
    }
}
