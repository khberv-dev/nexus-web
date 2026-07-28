use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use super::logger::{AuditContext, AuditLogger, EntityType, RiskLevel};
use crate::audit::ComplianceAuditEvents;
use crate::types::{TBankError, TBankResult};

/// Data retention policy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub entity_type: String,
    pub retention_period_days: u32,
    pub description: String,
    pub regulatory_basis: String,
    pub auto_delete: bool,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self {
            entity_type: "default".to_string(),
            retention_period_days: 2555, // 7 years default
            description: "Default retention policy".to_string(),
            regulatory_basis: "Russian Federal Law 152-FZ".to_string(),
            auto_delete: false,
        }
    }
}

/// Predefined retention policies based on requirements
pub struct RetentionPolicies;

impl RetentionPolicies {
    /// Get financial records retention policy (7 years)
    pub fn financial_records() -> RetentionPolicy {
        RetentionPolicy {
            entity_type: "financial_audit".to_string(),
            retention_period_days: 2555, // 7 years
            description: "Financial records retention for audit and compliance".to_string(),
            regulatory_basis: "Russian Federal Law 152-FZ, PCI DSS, Tax Code".to_string(),
            auto_delete: false, // Financial records should not be auto-deleted
        }
    }

    /// Get security events retention policy (2 years)
    pub fn security_events() -> RetentionPolicy {
        RetentionPolicy {
            entity_type: "audit_logs".to_string(),
            retention_period_days: 730, // 2 years
            description: "Security events and audit logs retention".to_string(),
            regulatory_basis: "Russian Federal Law 152-FZ, PCI DSS".to_string(),
            auto_delete: true,
        }
    }

    /// Get API request logs retention policy (90 days)
    pub fn api_request_logs() -> RetentionPolicy {
        RetentionPolicy {
            entity_type: "webhook_events".to_string(),
            retention_period_days: 90, // 90 days
            description: "API request and webhook events retention".to_string(),
            regulatory_basis: "Operational requirements".to_string(),
            auto_delete: true,
        }
    }

    /// Get all predefined policies
    pub fn all_policies() -> Vec<RetentionPolicy> {
        vec![
            Self::financial_records(),
            Self::security_events(),
            Self::api_request_logs(),
        ]
    }
}

/// Data retention manager
pub struct RetentionManager {
    db_pool: Arc<PgPool>,
    audit_logger: Arc<AuditLogger>,
    policies: Vec<RetentionPolicy>,
}

/// Retention execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionResult {
    pub policy: RetentionPolicy,
    pub records_identified: u32,
    pub records_deleted: u32,
    pub records_archived: u32,
    pub execution_time_ms: u64,
    pub errors: Vec<String>,
}

impl RetentionManager {
    /// Create new retention manager with default policies
    pub fn new(db_pool: Arc<PgPool>, audit_logger: Arc<AuditLogger>) -> Self {
        info!("Initializing RetentionManager with default policies");
        Self {
            db_pool,
            audit_logger,
            policies: RetentionPolicies::all_policies(),
        }
    }

    /// Create retention manager with custom policies
    pub fn with_policies(
        db_pool: Arc<PgPool>,
        audit_logger: Arc<AuditLogger>,
        policies: Vec<RetentionPolicy>,
    ) -> Self {
        info!(
            policy_count = policies.len(),
            "Initializing RetentionManager with custom policies"
        );
        Self {
            db_pool,
            audit_logger,
            policies,
        }
    }

    /// Execute all retention policies
    pub async fn execute_all_policies(&self) -> TBankResult<Vec<RetentionResult>> {
        info!(
            policy_count = self.policies.len(),
            "Executing all retention policies"
        );

        let mut results = Vec::new();

        for policy in &self.policies {
            match self.execute_policy(policy).await {
                Ok(result) => {
                    info!(
                        entity_type = %policy.entity_type,
                        records_identified = result.records_identified,
                        records_deleted = result.records_deleted,
                        "Retention policy executed successfully"
                    );
                    results.push(result);
                }
                Err(e) => {
                    error!(
                        entity_type = %policy.entity_type,
                        error = %e,
                        "Failed to execute retention policy"
                    );

                    // Create error result
                    results.push(RetentionResult {
                        policy: policy.clone(),
                        records_identified: 0,
                        records_deleted: 0,
                        records_archived: 0,
                        execution_time_ms: 0,
                        errors: vec![e.to_string()],
                    });
                }
            }
        }

        // Log overall retention execution
        let total_deleted: u32 = results.iter().map(|r| r.records_deleted).sum();
        self.audit_logger
            .log_data_retention_event(
                "BULK_RETENTION_EXECUTED",
                EntityType::FinancialAudit,
                total_deleted,
                "All policies",
                Some(AuditContext {
                    user_id: Some("system".to_string()),
                    ip_address: None,
                    user_agent: Some("RetentionManager".to_string()),
                    session_id: None,
                    risk_level: RiskLevel::Medium,
                    additional_context: Some(serde_json::json!({
                        "policies_executed": self.policies.len(),
                        "total_records_deleted": total_deleted
                    })),
                }),
            )
            .await?;

        info!(
            policies_executed = self.policies.len(),
            total_records_deleted = total_deleted,
            "All retention policies executed"
        );

        Ok(results)
    }

    /// Execute a specific retention policy
    pub async fn execute_policy(&self, policy: &RetentionPolicy) -> TBankResult<RetentionResult> {
        let start_time = std::time::Instant::now();

        info!(
            entity_type = %policy.entity_type,
            retention_days = policy.retention_period_days,
            auto_delete = policy.auto_delete,
            "Executing retention policy"
        );

        let cutoff_date = Utc::now() - Duration::days(policy.retention_period_days as i64);

        let mut result = RetentionResult {
            policy: policy.clone(),
            records_identified: 0,
            records_deleted: 0,
            records_archived: 0,
            execution_time_ms: 0,
            errors: Vec::new(),
        };

        match policy.entity_type.as_str() {
            "financial_audit" => {
                result = self
                    .execute_financial_audit_retention(policy, cutoff_date)
                    .await?;
            }
            "audit_logs" => {
                result = self
                    .execute_audit_logs_retention(policy, cutoff_date)
                    .await?;
            }
            "webhook_events" => {
                result = self
                    .execute_webhook_events_retention(policy, cutoff_date)
                    .await?;
            }
            _ => {
                let error_msg =
                    format!("Unknown entity type for retention: {}", policy.entity_type);
                error!(error = %error_msg);
                result.errors.push(error_msg);
            }
        }

        result.execution_time_ms = start_time.elapsed().as_millis() as u64;

        // Log retention execution
        if result.records_deleted > 0 || result.records_archived > 0 {
            self.audit_logger
                .log_data_retention_event(
                    "RETENTION_POLICY_EXECUTED",
                    match policy.entity_type.as_str() {
                        "financial_audit" => EntityType::FinancialAudit,
                        "audit_logs" => EntityType::FinancialAudit,
                        "webhook_events" => EntityType::WebhookEvent,
                        _ => EntityType::FinancialAudit,
                    },
                    result.records_deleted + result.records_archived,
                    &policy.entity_type,
                    Some(AuditContext {
                        user_id: Some("system".to_string()),
                        ip_address: None,
                        user_agent: Some("RetentionManager".to_string()),
                        session_id: None,
                        risk_level: RiskLevel::Medium,
                        additional_context: Some(serde_json::json!({
                            "retention_period_days": policy.retention_period_days,
                            "cutoff_date": cutoff_date,
                            "records_identified": result.records_identified,
                            "records_deleted": result.records_deleted,
                            "records_archived": result.records_archived
                        })),
                    }),
                )
                .await?;
        }

        Ok(result)
    }

    /// Execute retention for financial audit records
    async fn execute_financial_audit_retention(
        &self,
        policy: &RetentionPolicy,
        cutoff_date: DateTime<Utc>,
    ) -> TBankResult<RetentionResult> {
        debug!(
            cutoff_date = %cutoff_date,
            "Executing financial audit retention"
        );

        // Count records to be affected
        let count_query = "SELECT COUNT(*) FROM financial_audit WHERE created_at < $1";
        let count_row = sqlx::query(count_query)
            .bind(cutoff_date)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to count financial audit records for retention");
                TBankError::DatabaseError(e)
            })?;

        let records_identified: i64 = count_row
            .try_get(0)
            .map_err(|e| TBankError::DatabaseError(e))?;

        let mut result = RetentionResult {
            policy: policy.clone(),
            records_identified: records_identified as u32,
            records_deleted: 0,
            records_archived: 0,
            execution_time_ms: 0,
            errors: Vec::new(),
        };

        if records_identified == 0 {
            debug!("No financial audit records found for retention");
            return Ok(result);
        }

        // Financial records should be archived, not deleted (regulatory requirement)
        if policy.auto_delete {
            warn!(
                records_count = records_identified,
                "Financial audit records cannot be auto-deleted due to regulatory requirements - archiving instead"
            );
        }

        // For now, we'll mark them as archived (in a real system, you'd move them to archive storage)
        let archive_query = r#"
            UPDATE financial_audit 
            SET status = CASE 
                WHEN status NOT LIKE '%_ARCHIVED' THEN status || '_ARCHIVED'
                ELSE status
            END
            WHERE created_at < $1 AND status NOT LIKE '%_ARCHIVED'
        "#;

        let archive_result = sqlx::query(archive_query)
            .bind(cutoff_date)
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to archive financial audit records");
                TBankError::DatabaseError(e)
            })?;

        result.records_archived = archive_result.rows_affected() as u32;

        info!(
            records_identified = records_identified,
            records_archived = result.records_archived,
            "Financial audit retention completed"
        );

        Ok(result)
    }

    /// Execute retention for audit logs
    async fn execute_audit_logs_retention(
        &self,
        policy: &RetentionPolicy,
        cutoff_date: DateTime<Utc>,
    ) -> TBankResult<RetentionResult> {
        debug!(
            cutoff_date = %cutoff_date,
            auto_delete = policy.auto_delete,
            "Executing audit logs retention"
        );

        // Count records to be affected
        let count_query = "SELECT COUNT(*) FROM audit_logs WHERE created_at < $1";
        let count_row = sqlx::query(count_query)
            .bind(cutoff_date)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to count audit logs for retention");
                TBankError::DatabaseError(e)
            })?;

        let records_identified: i64 = count_row
            .try_get(0)
            .map_err(|e| TBankError::DatabaseError(e))?;

        let mut result = RetentionResult {
            policy: policy.clone(),
            records_identified: records_identified as u32,
            records_deleted: 0,
            records_archived: 0,
            execution_time_ms: 0,
            errors: Vec::new(),
        };

        if records_identified == 0 {
            debug!("No audit logs found for retention");
            return Ok(result);
        }

        if policy.auto_delete {
            // Delete old audit logs
            let delete_query = "DELETE FROM audit_logs WHERE created_at < $1";
            let delete_result = sqlx::query(delete_query)
                .bind(cutoff_date)
                .execute(&*self.db_pool)
                .await
                .map_err(|e| {
                    error!(error = %e, "Failed to delete audit logs");
                    TBankError::DatabaseError(e)
                })?;

            result.records_deleted = delete_result.rows_affected() as u32;

            info!(
                records_identified = records_identified,
                records_deleted = result.records_deleted,
                "Audit logs retention completed with deletion"
            );
        } else {
            // Archive audit logs (mark as archived)
            warn!(
                records_count = records_identified,
                "Audit logs marked for archival but auto_delete is disabled"
            );
            result.records_archived = records_identified as u32;
        }

        Ok(result)
    }

    /// Execute retention for webhook events
    async fn execute_webhook_events_retention(
        &self,
        policy: &RetentionPolicy,
        cutoff_date: DateTime<Utc>,
    ) -> TBankResult<RetentionResult> {
        debug!(
            cutoff_date = %cutoff_date,
            auto_delete = policy.auto_delete,
            "Executing webhook events retention"
        );

        // Count records to be affected
        let count_query = "SELECT COUNT(*) FROM webhook_events WHERE created_at < $1";
        let count_row = sqlx::query(count_query)
            .bind(cutoff_date)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to count webhook events for retention");
                TBankError::DatabaseError(e)
            })?;

        let records_identified: i64 = count_row
            .try_get(0)
            .map_err(|e| TBankError::DatabaseError(e))?;

        let mut result = RetentionResult {
            policy: policy.clone(),
            records_identified: records_identified as u32,
            records_deleted: 0,
            records_archived: 0,
            execution_time_ms: 0,
            errors: Vec::new(),
        };

        if records_identified == 0 {
            debug!("No webhook events found for retention");
            return Ok(result);
        }

        if policy.auto_delete {
            // Delete old webhook events
            let delete_query = "DELETE FROM webhook_events WHERE created_at < $1";
            let delete_result = sqlx::query(delete_query)
                .bind(cutoff_date)
                .execute(&*self.db_pool)
                .await
                .map_err(|e| {
                    error!(error = %e, "Failed to delete webhook events");
                    TBankError::DatabaseError(e)
                })?;

            result.records_deleted = delete_result.rows_affected() as u32;

            info!(
                records_identified = records_identified,
                records_deleted = result.records_deleted,
                "Webhook events retention completed with deletion"
            );
        } else {
            result.records_archived = records_identified as u32;
        }

        Ok(result)
    }

    /// Get retention statistics
    pub async fn get_retention_statistics(&self) -> TBankResult<RetentionStatistics> {
        debug!("Getting retention statistics");

        let stats_query = r#"
            SELECT 
                'financial_audit' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN created_at < NOW() - INTERVAL '7 years' THEN 1 END) as expired_records,
                MIN(created_at) as oldest_record,
                MAX(created_at) as newest_record
            FROM financial_audit
            UNION ALL
            SELECT 
                'audit_logs' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN created_at < NOW() - INTERVAL '2 years' THEN 1 END) as expired_records,
                MIN(created_at) as oldest_record,
                MAX(created_at) as newest_record
            FROM audit_logs
            UNION ALL
            SELECT 
                'webhook_events' as table_name,
                COUNT(*) as total_records,
                COUNT(CASE WHEN created_at < NOW() - INTERVAL '90 days' THEN 1 END) as expired_records,
                MIN(created_at) as oldest_record,
                MAX(created_at) as newest_record
            FROM webhook_events
        "#;

        let rows = sqlx::query(stats_query)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to get retention statistics");
                TBankError::DatabaseError(e)
            })?;

        let mut table_stats = Vec::new();
        for row in rows {
            let table_stat = TableRetentionStats {
                table_name: row.try_get("table_name").unwrap_or_default(),
                total_records: row.try_get::<i64, _>("total_records").unwrap_or(0) as u64,
                expired_records: row.try_get::<i64, _>("expired_records").unwrap_or(0) as u64,
                oldest_record: row.try_get("oldest_record").ok(),
                newest_record: row.try_get("newest_record").ok(),
            };
            table_stats.push(table_stat);
        }

        let stats = RetentionStatistics {
            policies_count: self.policies.len() as u32,
            table_stats,
            last_execution: None, // Would be stored in a separate table in production
        };

        debug!(?stats, "Retention statistics retrieved");
        Ok(stats)
    }

    /// Validate retention policies
    pub fn validate_policies(&self) -> Vec<String> {
        let mut errors = Vec::new();

        for policy in &self.policies {
            if policy.retention_period_days == 0 {
                errors.push(format!(
                    "Policy for {} has zero retention period",
                    policy.entity_type
                ));
            }

            if policy.entity_type == "financial_audit" && policy.auto_delete {
                errors.push("Financial audit records should not be auto-deleted due to regulatory requirements".to_string());
            }

            if policy.retention_period_days < 30 && policy.entity_type == "audit_logs" {
                errors.push("Audit logs retention period should be at least 30 days for security compliance".to_string());
            }
        }

        if !errors.is_empty() {
            warn!(errors = ?errors, "Retention policy validation found issues");
        }

        errors
    }
}

/// Retention statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionStatistics {
    pub policies_count: u32,
    pub table_stats: Vec<TableRetentionStats>,
    pub last_execution: Option<DateTime<Utc>>,
}

/// Table-specific retention statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableRetentionStats {
    pub table_name: String,
    pub total_records: u64,
    pub expired_records: u64,
    pub oldest_record: Option<DateTime<Utc>>,
    pub newest_record: Option<DateTime<Utc>>,
}
