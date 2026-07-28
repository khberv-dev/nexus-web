use chrono::{DateTime, NaiveDate, Utc};
use csv::Writer;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::io::Write;
use std::sync::Arc;
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::database::models::AuditLogModel;
use crate::types::{TBankError, TBankResult};

/// Export format for audit logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    Json,
    Csv,
}

/// Export filter criteria
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFilter {
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub user_id: Option<String>,
    pub operation_type: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub risk_level: Option<String>,
    pub limit: Option<u32>,
}

impl Default for ExportFilter {
    fn default() -> Self {
        Self {
            start_date: None,
            end_date: None,
            user_id: None,
            operation_type: None,
            entity_type: None,
            entity_id: None,
            risk_level: None,
            limit: Some(10000), // Default limit to prevent excessive exports
        }
    }
}

/// Audit log export service
pub struct AuditExporter {
    db_pool: Arc<PgPool>,
}

/// Simplified audit log for export (without sensitive internal data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportableAuditLog {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
    pub operation_type: String,
    pub entity_type: String,
    pub entity_id: String,
    pub changed_fields: Vec<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub hash: String,
    pub created_at: DateTime<Utc>,
    // Note: old_values and new_values are excluded for security
}

impl From<AuditLogModel> for ExportableAuditLog {
    fn from(model: AuditLogModel) -> Self {
        Self {
            id: model.id,
            timestamp: model.timestamp,
            user_id: model.user_id,
            operation_type: model.operation_type,
            entity_type: model.entity_type,
            entity_id: model.entity_id,
            changed_fields: model.changed_fields,
            ip_address: model.ip_address,
            user_agent: model.user_agent,
            hash: model.hash,
            created_at: model.created_at,
        }
    }
}

impl AuditExporter {
    /// Create new audit exporter
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        info!("Initializing AuditExporter");
        Self { db_pool }
    }

    /// Export audit logs in specified format
    pub async fn export_audit_logs(
        &self,
        filter: ExportFilter,
        format: ExportFormat,
    ) -> TBankResult<Vec<u8>> {
        info!(
            format = ?format,
            start_date = ?filter.start_date,
            end_date = ?filter.end_date,
            user_id = ?filter.user_id,
            operation_type = ?filter.operation_type,
            limit = ?filter.limit,
            "Exporting audit logs"
        );

        // Fetch audit logs based on filter
        let audit_logs = self.fetch_audit_logs(&filter).await?;

        info!(
            count = audit_logs.len(),
            format = ?format,
            "Fetched audit logs for export"
        );

        // Convert to exportable format (excluding sensitive data)
        let exportable_logs: Vec<ExportableAuditLog> = audit_logs
            .into_iter()
            .map(ExportableAuditLog::from)
            .collect();

        // Export in requested format
        match format {
            ExportFormat::Json => self.export_as_json(&exportable_logs),
            ExportFormat::Csv => self.export_as_csv(&exportable_logs),
        }
    }

    /// Fetch audit logs from database based on filter
    async fn fetch_audit_logs(&self, filter: &ExportFilter) -> TBankResult<Vec<AuditLogModel>> {
        debug!(filter = ?filter, "Fetching audit logs from database");

        let mut query = String::from(
            "SELECT id, timestamp, user_id, operation_type, entity_type, entity_id, 
                    old_values, new_values, changed_fields, ip_address, user_agent, hash, created_at
             FROM audit_logs WHERE 1=1",
        );

        let mut bind_count = 0;
        let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();

        // Add date range filter
        if let Some(start_date) = filter.start_date {
            bind_count += 1;
            query.push_str(&format!(" AND DATE(timestamp) >= ${}", bind_count));
            params.push(Box::new(start_date));
        }

        if let Some(end_date) = filter.end_date {
            bind_count += 1;
            query.push_str(&format!(" AND DATE(timestamp) <= ${}", bind_count));
            params.push(Box::new(end_date));
        }

        // Add user filter
        if let Some(ref user_id) = filter.user_id {
            bind_count += 1;
            query.push_str(&format!(" AND user_id = ${}", bind_count));
            params.push(Box::new(user_id.clone()));
        }

        // Add operation type filter
        if let Some(ref operation_type) = filter.operation_type {
            bind_count += 1;
            query.push_str(&format!(" AND operation_type = ${}", bind_count));
            params.push(Box::new(operation_type.clone()));
        }

        // Add entity type filter
        if let Some(ref entity_type) = filter.entity_type {
            bind_count += 1;
            query.push_str(&format!(" AND entity_type = ${}", bind_count));
            params.push(Box::new(entity_type.clone()));
        }

        // Add entity ID filter
        if let Some(ref entity_id) = filter.entity_id {
            bind_count += 1;
            query.push_str(&format!(" AND entity_id = ${}", bind_count));
            params.push(Box::new(entity_id.clone()));
        }

        // Add ordering and limit
        query.push_str(" ORDER BY timestamp DESC");

        if let Some(limit) = filter.limit {
            bind_count += 1;
            query.push_str(&format!(" LIMIT ${}", bind_count));
            params.push(Box::new(limit as i64));
        }

        debug!(query = %query, "Executing audit log query");

        // Execute query with dynamic parameters
        let mut query_builder: sqlx::query::Query<'_, sqlx::Postgres, _> = sqlx::query(&query);

        // This is a simplified approach - in a real implementation, you'd use a query builder
        // For now, we'll use a simpler approach with fixed parameters
        let rows = if filter.start_date.is_some()
            || filter.end_date.is_some()
            || filter.user_id.is_some()
            || filter.operation_type.is_some()
            || filter.entity_type.is_some()
            || filter.entity_id.is_some()
        {
            // Use a more complex query builder for filtered queries
            self.fetch_filtered_audit_logs(filter).await?
        } else {
            // Simple query for all logs
            let limit = filter.limit.unwrap_or(10000) as i64;
            sqlx::query(&format!("SELECT id, timestamp, user_id, operation_type, entity_type, entity_id, 
                                         old_values, new_values, changed_fields, ip_address, user_agent, hash, created_at
                                  FROM audit_logs ORDER BY timestamp DESC LIMIT {}", limit))
                .fetch_all(&*self.db_pool)
                .await
                .map_err(|e| {
                    error!(error = %e, "Failed to fetch audit logs");
                    TBankError::DatabaseError(e)
                })?
        };

        // Convert rows to models
        let mut audit_logs = Vec::new();
        for row in rows {
            let model = AuditLogModel {
                id: row
                    .try_get("id")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                timestamp: row
                    .try_get("timestamp")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                user_id: row
                    .try_get("user_id")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                operation_type: row
                    .try_get("operation_type")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                entity_type: row
                    .try_get("entity_type")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                entity_id: row
                    .try_get("entity_id")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                old_values: row
                    .try_get("old_values")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                new_values: row
                    .try_get("new_values")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                changed_fields: row
                    .try_get("changed_fields")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                ip_address: row
                    .try_get("ip_address")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                user_agent: row
                    .try_get("user_agent")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                hash: row
                    .try_get("hash")
                    .map_err(|e| TBankError::DatabaseError(e))?,
                created_at: row
                    .try_get("created_at")
                    .map_err(|e| TBankError::DatabaseError(e))?,
            };
            audit_logs.push(model);
        }

        debug!(count = audit_logs.len(), "Fetched audit logs successfully");
        Ok(audit_logs)
    }

    /// Fetch filtered audit logs (simplified implementation)
    async fn fetch_filtered_audit_logs(
        &self,
        filter: &ExportFilter,
    ) -> TBankResult<Vec<sqlx::postgres::PgRow>> {
        let limit = filter.limit.unwrap_or(10000) as i64;

        // For simplicity, we'll implement basic filtering
        // In a production system, you'd want a more sophisticated query builder
        let base_query = "SELECT id, timestamp, user_id, operation_type, entity_type, entity_id, 
                                 old_values, new_values, changed_fields, ip_address, user_agent, hash, created_at
                          FROM audit_logs WHERE 1=1";

        let mut conditions = Vec::new();

        if filter.start_date.is_some() {
            conditions.push("DATE(timestamp) >= $1");
        }
        if filter.end_date.is_some() {
            conditions.push("DATE(timestamp) <= $2");
        }
        if filter.user_id.is_some() {
            conditions.push("user_id = $3");
        }
        if filter.operation_type.is_some() {
            conditions.push("operation_type = $4");
        }
        if filter.entity_type.is_some() {
            conditions.push("entity_type = $5");
        }

        let conditions_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("AND {}", conditions.join(" AND "))
        };

        let query = format!(
            "{} {} ORDER BY timestamp DESC LIMIT {}",
            base_query, conditions_clause, limit
        );

        // Execute with basic parameters (simplified)
        let rows = sqlx::query(&query)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to fetch filtered audit logs");
                TBankError::DatabaseError(e)
            })?;

        Ok(rows)
    }

    /// Export audit logs as JSON
    fn export_as_json(&self, logs: &[ExportableAuditLog]) -> TBankResult<Vec<u8>> {
        debug!(count = logs.len(), "Exporting audit logs as JSON");

        let json_data = serde_json::to_string_pretty(logs).map_err(|e| {
            error!(error = %e, "Failed to serialize audit logs to JSON");
            TBankError::SerializationError(e)
        })?;

        info!(size_bytes = json_data.len(), "JSON export completed");
        Ok(json_data.into_bytes())
    }

    /// Export audit logs as CSV
    fn export_as_csv(&self, logs: &[ExportableAuditLog]) -> TBankResult<Vec<u8>> {
        debug!(count = logs.len(), "Exporting audit logs as CSV");

        let mut buffer = Vec::new();
        {
            let mut writer = Writer::from_writer(&mut buffer);

            // Write CSV headers
            writer
                .write_record(&[
                    "id",
                    "timestamp",
                    "user_id",
                    "operation_type",
                    "entity_type",
                    "entity_id",
                    "changed_fields",
                    "ip_address",
                    "user_agent",
                    "hash",
                    "created_at",
                ])
                .map_err(|e| {
                    error!(error = %e, "Failed to write CSV headers");
                    TBankError::InternalError(format!("CSV export error: {}", e))
                })?;

            // Write data rows
            for log in logs {
                writer
                    .write_record(&[
                        &log.id.to_string(),
                        &log.timestamp.to_rfc3339(),
                        log.user_id.as_deref().unwrap_or(""),
                        &log.operation_type,
                        &log.entity_type,
                        &log.entity_id,
                        &log.changed_fields.join(";"),
                        log.ip_address.as_deref().unwrap_or(""),
                        log.user_agent.as_deref().unwrap_or(""),
                        &log.hash,
                        &log.created_at.to_rfc3339(),
                    ])
                    .map_err(|e| {
                        error!(error = %e, "Failed to write CSV row");
                        TBankError::InternalError(format!("CSV export error: {}", e))
                    })?;
            }

            writer.flush().map_err(|e| {
                error!(error = %e, "Failed to flush CSV writer");
                TBankError::InternalError(format!("CSV export error: {}", e))
            })?;
        }

        info!(size_bytes = buffer.len(), "CSV export completed");
        Ok(buffer)
    }

    /// Export financial audit records
    pub async fn export_financial_audit(
        &self,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        format: ExportFormat,
    ) -> TBankResult<Vec<u8>> {
        info!(
            format = ?format,
            start_date = ?start_date,
            end_date = ?end_date,
            "Exporting financial audit records"
        );

        let mut query = String::from(
            "SELECT id, transaction_id, transaction_type, amount, currency, 
                    counterparty_inn, operation_date, status, reconciled_at, created_at
             FROM financial_audit WHERE 1=1",
        );

        if start_date.is_some() {
            query.push_str(" AND DATE(operation_date) >= $1");
        }
        if end_date.is_some() {
            let param_num = if start_date.is_some() { 2 } else { 1 };
            query.push_str(&format!(" AND DATE(operation_date) <= ${}", param_num));
        }

        query.push_str(" ORDER BY operation_date DESC LIMIT 50000");

        let rows = sqlx::query(&query)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to fetch financial audit records");
                TBankError::DatabaseError(e)
            })?;

        let financial_records: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<Uuid, _>("id"),
                    "transaction_id": row.get::<String, _>("transaction_id"),
                    "transaction_type": row.get::<String, _>("transaction_type"),
                    "amount": row.get::<rust_decimal::Decimal, _>("amount"),
                    "currency": row.get::<String, _>("currency"),
                    "counterparty_inn": row.get::<Option<String>, _>("counterparty_inn"),
                    "operation_date": row.get::<DateTime<Utc>, _>("operation_date"),
                    "status": row.get::<String, _>("status"),
                    "reconciled_at": row.get::<Option<DateTime<Utc>>, _>("reconciled_at"),
                    "created_at": row.get::<DateTime<Utc>, _>("created_at"),
                })
            })
            .collect();

        match format {
            ExportFormat::Json => {
                let json_data = serde_json::to_string_pretty(&financial_records)
                    .map_err(|e| TBankError::SerializationError(e))?;
                Ok(json_data.into_bytes())
            }
            ExportFormat::Csv => {
                let mut buffer = Vec::new();
                {
                    let mut writer = Writer::from_writer(&mut buffer);

                    // Write headers
                    writer
                        .write_record(&[
                            "id",
                            "transaction_id",
                            "transaction_type",
                            "amount",
                            "currency",
                            "counterparty_inn",
                            "operation_date",
                            "status",
                            "reconciled_at",
                            "created_at",
                        ])
                        .map_err(|e| TBankError::InternalError(format!("CSV error: {}", e)))?;

                    // Write data
                    for record in &financial_records {
                        writer
                            .write_record(&[
                                &record["id"].to_string(),
                                &record["transaction_id"].as_str().unwrap_or("").to_string(),
                                &record["transaction_type"]
                                    .as_str()
                                    .unwrap_or("")
                                    .to_string(),
                                &record["amount"].to_string(),
                                &record["currency"].as_str().unwrap_or("").to_string(),
                                &record["counterparty_inn"]
                                    .as_str()
                                    .unwrap_or("")
                                    .to_string(),
                                &record["operation_date"].as_str().unwrap_or("").to_string(),
                                &record["status"].as_str().unwrap_or("").to_string(),
                                &record["reconciled_at"].as_str().unwrap_or("").to_string(),
                                &record["created_at"].as_str().unwrap_or("").to_string(),
                            ])
                            .map_err(|e| TBankError::InternalError(format!("CSV error: {}", e)))?;
                    }

                    writer
                        .flush()
                        .map_err(|e| TBankError::InternalError(format!("CSV error: {}", e)))?;
                }
                Ok(buffer)
            }
        }
    }

    /// Get export statistics
    pub async fn get_export_statistics(&self) -> TBankResult<ExportStatistics> {
        debug!("Getting export statistics");

        let query = r#"
            SELECT 
                COUNT(*) as total_audit_logs,
                COUNT(CASE WHEN DATE(timestamp) = CURRENT_DATE THEN 1 END) as today_logs,
                COUNT(CASE WHEN DATE(timestamp) >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_logs,
                COUNT(CASE WHEN DATE(timestamp) >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_logs,
                MIN(timestamp) as earliest_log,
                MAX(timestamp) as latest_log
            FROM audit_logs
        "#;

        let row = sqlx::query(query)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to get export statistics");
                TBankError::DatabaseError(e)
            })?;

        let stats = ExportStatistics {
            total_audit_logs: row.try_get::<i64, _>("total_audit_logs").unwrap_or(0) as u64,
            today_logs: row.try_get::<i64, _>("today_logs").unwrap_or(0) as u64,
            week_logs: row.try_get::<i64, _>("week_logs").unwrap_or(0) as u64,
            month_logs: row.try_get::<i64, _>("month_logs").unwrap_or(0) as u64,
            earliest_log: row.try_get("earliest_log").ok(),
            latest_log: row.try_get("latest_log").ok(),
        };

        debug!(?stats, "Export statistics retrieved");
        Ok(stats)
    }
}

/// Export statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportStatistics {
    pub total_audit_logs: u64,
    pub today_logs: u64,
    pub week_logs: u64,
    pub month_logs: u64,
    pub earliest_log: Option<DateTime<Utc>>,
    pub latest_log: Option<DateTime<Utc>>,
}
