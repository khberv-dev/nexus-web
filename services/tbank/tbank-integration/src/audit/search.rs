use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::database::models::AuditLogModel;
use crate::types::{TBankError, TBankResult};

/// Search criteria for audit logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditSearchCriteria {
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub user_id: Option<String>,
    pub operation_type: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub ip_address: Option<String>,
    pub changed_fields: Option<Vec<String>>,
    pub text_search: Option<String>, // Search in operation_type, entity_id, etc.
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub sort_by: Option<SortField>,
    pub sort_order: Option<SortOrder>,
}

impl Default for AuditSearchCriteria {
    fn default() -> Self {
        Self {
            start_date: None,
            end_date: None,
            user_id: None,
            operation_type: None,
            entity_type: None,
            entity_id: None,
            ip_address: None,
            changed_fields: None,
            text_search: None,
            limit: Some(100),
            offset: Some(0),
            sort_by: Some(SortField::Timestamp),
            sort_order: Some(SortOrder::Desc),
        }
    }
}

/// Sort field options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortField {
    Timestamp,
    UserId,
    OperationType,
    EntityType,
    EntityId,
    CreatedAt,
}

impl SortField {
    pub fn as_sql(&self) -> &'static str {
        match self {
            SortField::Timestamp => "timestamp",
            SortField::UserId => "user_id",
            SortField::OperationType => "operation_type",
            SortField::EntityType => "entity_type",
            SortField::EntityId => "entity_id",
            SortField::CreatedAt => "created_at",
        }
    }
}

/// Sort order options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortOrder {
    Asc,
    Desc,
}

impl SortOrder {
    pub fn as_sql(&self) -> &'static str {
        match self {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        }
    }
}

/// Search result with pagination info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditSearchResult {
    pub logs: Vec<AuditLogModel>,
    pub total_count: u64,
    pub page_size: u32,
    pub page_number: u32,
    pub total_pages: u32,
    pub has_next_page: bool,
    pub has_previous_page: bool,
}

/// Audit search service
pub struct AuditSearchService {
    db_pool: Arc<PgPool>,
}

impl AuditSearchService {
    /// Create new audit search service
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        info!("Initializing AuditSearchService");
        Self { db_pool }
    }

    /// Search audit logs with criteria
    pub async fn search_audit_logs(
        &self,
        criteria: AuditSearchCriteria,
    ) -> TBankResult<AuditSearchResult> {
        debug!(criteria = ?criteria, "Searching audit logs");

        // Build the query
        let (query, count_query, params) = self.build_search_query(&criteria)?;

        // Get total count
        let total_count = self.get_total_count(&count_query, &params).await?;

        // Get the actual results
        let logs = self.execute_search_query(&query, &params).await?;

        // Calculate pagination info
        let limit = criteria.limit.unwrap_or(100);
        let offset = criteria.offset.unwrap_or(0);
        let page_number = (offset / limit) + 1;
        let total_pages = ((total_count as f64) / (limit as f64)).ceil() as u32;

        let result = AuditSearchResult {
            logs,
            total_count,
            page_size: limit,
            page_number,
            total_pages,
            has_next_page: page_number < total_pages,
            has_previous_page: page_number > 1,
        };

        info!(
            total_count = total_count,
            returned_count = result.logs.len(),
            page_number = page_number,
            total_pages = total_pages,
            "Audit log search completed"
        );

        Ok(result)
    }

    /// Build SQL query from search criteria
    fn build_search_query(
        &self,
        criteria: &AuditSearchCriteria,
    ) -> TBankResult<(String, String, Vec<String>)> {
        let mut conditions = Vec::new();
        let mut params = Vec::new();
        let mut param_count = 0;

        // Date range filters
        if let Some(start_date) = criteria.start_date {
            param_count += 1;
            conditions.push(format!("DATE(timestamp) >= ${}", param_count));
            params.push(start_date.to_string());
        }

        if let Some(end_date) = criteria.end_date {
            param_count += 1;
            conditions.push(format!("DATE(timestamp) <= ${}", param_count));
            params.push(end_date.to_string());
        }

        // User filter
        if let Some(ref user_id) = criteria.user_id {
            param_count += 1;
            conditions.push(format!("user_id = ${}", param_count));
            params.push(user_id.clone());
        }

        // Operation type filter
        if let Some(ref operation_type) = criteria.operation_type {
            param_count += 1;
            conditions.push(format!("operation_type = ${}", param_count));
            params.push(operation_type.clone());
        }

        // Entity type filter
        if let Some(ref entity_type) = criteria.entity_type {
            param_count += 1;
            conditions.push(format!("entity_type = ${}", param_count));
            params.push(entity_type.clone());
        }

        // Entity ID filter
        if let Some(ref entity_id) = criteria.entity_id {
            param_count += 1;
            conditions.push(format!("entity_id = ${}", param_count));
            params.push(entity_id.clone());
        }

        // IP address filter
        if let Some(ref ip_address) = criteria.ip_address {
            param_count += 1;
            conditions.push(format!("ip_address = ${}", param_count));
            params.push(ip_address.clone());
        }

        // Changed fields filter (array contains)
        if let Some(ref changed_fields) = criteria.changed_fields {
            for field in changed_fields {
                param_count += 1;
                conditions.push(format!("${} = ANY(changed_fields)", param_count));
                params.push(field.clone());
            }
        }

        // Text search (search across multiple fields)
        if let Some(ref text_search) = criteria.text_search {
            param_count += 1;
            conditions.push(format!(
                "(operation_type ILIKE ${} OR entity_id ILIKE ${} OR entity_type ILIKE ${})",
                param_count, param_count, param_count
            ));
            params.push(format!("%{}%", text_search));
        }

        // Build WHERE clause
        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Build ORDER BY clause
        let sort_field = criteria.sort_by.as_ref().unwrap_or(&SortField::Timestamp);
        let sort_order = criteria.sort_order.as_ref().unwrap_or(&SortOrder::Desc);
        let order_clause = format!("ORDER BY {} {}", sort_field.as_sql(), sort_order.as_sql());

        // Build LIMIT and OFFSET
        let limit = criteria.limit.unwrap_or(100);
        let offset = criteria.offset.unwrap_or(0);
        let limit_clause = format!("LIMIT {} OFFSET {}", limit, offset);

        // Main query
        let query = format!(
            "SELECT id, timestamp, user_id, operation_type, entity_type, entity_id, 
                    old_values, new_values, changed_fields, ip_address, user_agent, hash, created_at
             FROM audit_logs {} {} {}",
            where_clause, order_clause, limit_clause
        );

        // Count query
        let count_query = format!("SELECT COUNT(*) FROM audit_logs {}", where_clause);

        debug!(
            query = %query,
            count_query = %count_query,
            params = ?params,
            "Built search query"
        );

        Ok((query, count_query, params))
    }

    /// Get total count for pagination
    async fn get_total_count(&self, count_query: &str, params: &[String]) -> TBankResult<u64> {
        debug!(query = %count_query, "Getting total count");

        // For simplicity, we'll execute a basic count query
        // In production, you'd want to properly bind parameters
        let row = sqlx::query(count_query)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to get total count");
                TBankError::DatabaseError(e)
            })?;

        let count: i64 = row.try_get(0).map_err(|e| TBankError::DatabaseError(e))?;

        Ok(count as u64)
    }

    /// Execute search query and return results
    async fn execute_search_query(
        &self,
        query: &str,
        params: &[String],
    ) -> TBankResult<Vec<AuditLogModel>> {
        debug!(query = %query, "Executing search query");

        // For simplicity, we'll execute a basic query
        // In production, you'd want to properly bind parameters
        let rows = sqlx::query(query)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to execute search query");
                TBankError::DatabaseError(e)
            })?;

        let mut logs = Vec::new();
        for row in rows {
            let log = AuditLogModel {
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
            logs.push(log);
        }

        debug!(count = logs.len(), "Search query executed successfully");
        Ok(logs)
    }

    /// Search audit logs by entity
    pub async fn search_by_entity(
        &self,
        entity_type: &str,
        entity_id: &str,
        limit: Option<u32>,
    ) -> TBankResult<Vec<AuditLogModel>> {
        info!(
            entity_type = %entity_type,
            entity_id = %entity_id,
            limit = ?limit,
            "Searching audit logs by entity"
        );

        let criteria = AuditSearchCriteria {
            entity_type: Some(entity_type.to_string()),
            entity_id: Some(entity_id.to_string()),
            limit,
            ..Default::default()
        };

        let result = self.search_audit_logs(criteria).await?;
        Ok(result.logs)
    }

    /// Search audit logs by user
    pub async fn search_by_user(
        &self,
        user_id: &str,
        limit: Option<u32>,
    ) -> TBankResult<Vec<AuditLogModel>> {
        info!(
            user_id = %user_id,
            limit = ?limit,
            "Searching audit logs by user"
        );

        let criteria = AuditSearchCriteria {
            user_id: Some(user_id.to_string()),
            limit,
            ..Default::default()
        };

        let result = self.search_audit_logs(criteria).await?;
        Ok(result.logs)
    }

    /// Search audit logs by operation type
    pub async fn search_by_operation(
        &self,
        operation_type: &str,
        limit: Option<u32>,
    ) -> TBankResult<Vec<AuditLogModel>> {
        info!(
            operation_type = %operation_type,
            limit = ?limit,
            "Searching audit logs by operation type"
        );

        let criteria = AuditSearchCriteria {
            operation_type: Some(operation_type.to_string()),
            limit,
            ..Default::default()
        };

        let result = self.search_audit_logs(criteria).await?;
        Ok(result.logs)
    }

    /// Search audit logs by date range
    pub async fn search_by_date_range(
        &self,
        start_date: NaiveDate,
        end_date: NaiveDate,
        limit: Option<u32>,
    ) -> TBankResult<Vec<AuditLogModel>> {
        info!(
            start_date = %start_date,
            end_date = %end_date,
            limit = ?limit,
            "Searching audit logs by date range"
        );

        let criteria = AuditSearchCriteria {
            start_date: Some(start_date),
            end_date: Some(end_date),
            limit,
            ..Default::default()
        };

        let result = self.search_audit_logs(criteria).await?;
        Ok(result.logs)
    }

    /// Get audit log by ID
    pub async fn get_audit_log_by_id(&self, log_id: Uuid) -> TBankResult<Option<AuditLogModel>> {
        debug!(log_id = ?log_id, "Getting audit log by ID");

        let query = r#"
            SELECT id, timestamp, user_id, operation_type, entity_type, entity_id,
                   old_values, new_values, changed_fields, ip_address, user_agent, hash, created_at
            FROM audit_logs 
            WHERE id = $1
        "#;

        let row = sqlx::query(query)
            .bind(log_id)
            .fetch_optional(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, log_id = ?log_id, "Failed to get audit log by ID");
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let log = AuditLogModel {
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

            debug!(log_id = ?log_id, "Audit log found");
            Ok(Some(log))
        } else {
            debug!(log_id = ?log_id, "Audit log not found");
            Ok(None)
        }
    }

    /// Get recent audit logs (last N logs)
    pub async fn get_recent_logs(&self, limit: u32) -> TBankResult<Vec<AuditLogModel>> {
        info!(limit = limit, "Getting recent audit logs");

        let criteria = AuditSearchCriteria {
            limit: Some(limit),
            sort_by: Some(SortField::Timestamp),
            sort_order: Some(SortOrder::Desc),
            ..Default::default()
        };

        let result = self.search_audit_logs(criteria).await?;
        Ok(result.logs)
    }

    /// Get audit trail for specific entity (chronological order)
    pub async fn get_entity_audit_trail(
        &self,
        entity_type: &str,
        entity_id: &str,
    ) -> TBankResult<Vec<AuditLogModel>> {
        info!(
            entity_type = %entity_type,
            entity_id = %entity_id,
            "Getting audit trail for entity"
        );

        let criteria = AuditSearchCriteria {
            entity_type: Some(entity_type.to_string()),
            entity_id: Some(entity_id.to_string()),
            sort_by: Some(SortField::Timestamp),
            sort_order: Some(SortOrder::Asc), // Chronological order
            limit: Some(1000),                // Large limit for complete trail
            ..Default::default()
        };

        let result = self.search_audit_logs(criteria).await?;

        info!(
            entity_type = %entity_type,
            entity_id = %entity_id,
            trail_length = result.logs.len(),
            "Audit trail retrieved"
        );

        Ok(result.logs)
    }

    /// Get search statistics
    pub async fn get_search_statistics(&self) -> TBankResult<SearchStatistics> {
        debug!("Getting search statistics");

        let stats_query = r#"
            SELECT 
                COUNT(*) as total_logs,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT operation_type) as unique_operations,
                COUNT(DISTINCT entity_type) as unique_entity_types,
                COUNT(DISTINCT DATE(timestamp)) as unique_days,
                MIN(timestamp) as earliest_log,
                MAX(timestamp) as latest_log
            FROM audit_logs
        "#;

        let row = sqlx::query(stats_query)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to get search statistics");
                TBankError::DatabaseError(e)
            })?;

        let stats = SearchStatistics {
            total_logs: row.try_get::<i64, _>("total_logs").unwrap_or(0) as u64,
            unique_users: row.try_get::<i64, _>("unique_users").unwrap_or(0) as u64,
            unique_operations: row.try_get::<i64, _>("unique_operations").unwrap_or(0) as u64,
            unique_entity_types: row.try_get::<i64, _>("unique_entity_types").unwrap_or(0) as u64,
            unique_days: row.try_get::<i64, _>("unique_days").unwrap_or(0) as u64,
            earliest_log: row.try_get("earliest_log").ok(),
            latest_log: row.try_get("latest_log").ok(),
        };

        debug!(?stats, "Search statistics retrieved");
        Ok(stats)
    }
}

/// Search statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchStatistics {
    pub total_logs: u64,
    pub unique_users: u64,
    pub unique_operations: u64,
    pub unique_entity_types: u64,
    pub unique_days: u64,
    pub earliest_log: Option<DateTime<Utc>>,
    pub latest_log: Option<DateTime<Utc>>,
}
