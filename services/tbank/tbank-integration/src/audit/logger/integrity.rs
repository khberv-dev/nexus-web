use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::Row;
use tracing::{debug, error};
use uuid::Uuid;

use super::core::AuditLogger;
use crate::types::{TBankError, TBankResult};

/// Audit integrity verification trait
pub trait AuditIntegrity {
    /// Verify audit log integrity using cryptographic hash
    async fn verify_audit_integrity(&self, audit_log_id: Uuid) -> TBankResult<bool>;
}

impl AuditIntegrity for AuditLogger {
    /// Verify audit log integrity using cryptographic hash
    async fn verify_audit_integrity(&self, audit_log_id: Uuid) -> TBankResult<bool> {
        debug!(audit_log_id = ?audit_log_id, "Verifying audit log integrity");

        let query = r#"
            SELECT timestamp, user_id, operation_type, entity_type, entity_id,
                   old_values, new_values, hash
            FROM audit_logs 
            WHERE id = $1
        "#;

        let row = sqlx::query(query)
            .bind(audit_log_id)
            .fetch_optional(self.db_pool().as_ref())
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    audit_log_id = ?audit_log_id,
                    "Failed to fetch audit log for integrity verification"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let timestamp: DateTime<Utc> = row
                .try_get("timestamp")
                .map_err(|e| TBankError::DatabaseError(e))?;
            let user_id: Option<String> = row
                .try_get("user_id")
                .map_err(|e| TBankError::DatabaseError(e))?;
            let operation_type: String = row
                .try_get("operation_type")
                .map_err(|e| TBankError::DatabaseError(e))?;
            let entity_type: String = row
                .try_get("entity_type")
                .map_err(|e| TBankError::DatabaseError(e))?;
            let entity_id: String = row
                .try_get("entity_id")
                .map_err(|e| TBankError::DatabaseError(e))?;
            let old_values: Option<Value> = row
                .try_get("old_values")
                .map_err(|e| TBankError::DatabaseError(e))?;
            let new_values: Option<Value> = row
                .try_get("new_values")
                .map_err(|e| TBankError::DatabaseError(e))?;
            let stored_hash: String = row
                .try_get("hash")
                .map_err(|e| TBankError::DatabaseError(e))?;

            // Recalculate hash
            let calculated_hash = self.generate_audit_hash(
                &timestamp,
                user_id.as_deref(),
                &operation_type,
                &entity_type,
                &entity_id,
                old_values.as_ref(),
                new_values.as_ref(),
            );

            let is_valid = calculated_hash == stored_hash;

            if !is_valid {
                error!(
                    audit_log_id = ?audit_log_id,
                    calculated_hash = %calculated_hash,
                    stored_hash = %stored_hash,
                    "Audit log integrity verification FAILED - possible tampering detected"
                );
            } else {
                debug!(
                    audit_log_id = ?audit_log_id,
                    "Audit log integrity verification PASSED"
                );
            }

            Ok(is_valid)
        } else {
            error!(
                audit_log_id = ?audit_log_id,
                "Audit log not found for integrity verification"
            );
            Err(TBankError::AuditLogNotFound { id: audit_log_id })
        }
    }
}
