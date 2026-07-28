use chrono::{DateTime, Utc};
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, info, warn};

use super::types::{AuditContext, EntityType, RiskLevel};
use crate::database::common_queries::CommonQueries;
use crate::types::{TBankError, TBankResult};
use shared::EncryptionService;

/// Audit logger for financial operations with cryptographic integrity protection
pub struct AuditLogger {
    db_pool: Arc<PgPool>,
    encryption_service: Arc<EncryptionService>,
}

impl AuditLogger {
    /// Create new audit logger
    pub fn new(db_pool: Arc<PgPool>, encryption_service: Arc<EncryptionService>) -> Self {
        info!("Initializing AuditLogger with cryptographic integrity protection");
        Self {
            db_pool,
            encryption_service,
        }
    }

    /// Generate cryptographic hash for audit log integrity
    pub(super) fn generate_audit_hash(
        &self,
        timestamp: &DateTime<Utc>,
        user_id: Option<&str>,
        operation_type: &str,
        entity_type: &str,
        entity_id: &str,
        old_values: Option<&Value>,
        new_values: Option<&Value>,
    ) -> String {
        let mut hasher = Sha256::new();

        // Hash all audit data for tamper-proofing
        hasher.update(timestamp.to_rfc3339().as_bytes());
        hasher.update(user_id.unwrap_or("").as_bytes());
        hasher.update(operation_type.as_bytes());
        hasher.update(entity_type.as_bytes());
        hasher.update(entity_id.as_bytes());

        if let Some(old) = old_values {
            hasher.update(old.to_string().as_bytes());
        }

        if let Some(new) = new_values {
            hasher.update(new.to_string().as_bytes());
        }

        // Add a secret salt (in production, this should come from config)
        hasher.update(b"tbank_audit_salt_2024");

        format!("{:x}", hasher.finalize())
    }

    /// Determine risk level based on operation type and values
    pub(super) fn assess_risk_level(
        &self,
        operation_type: &str,
        entity_type: &EntityType,
        old_values: Option<&Value>,
        new_values: Option<&Value>,
    ) -> RiskLevel {
        match operation_type {
            // High-risk financial operations
            "PAYMENT_COMPLETED" | "INVOICE_PAID" | "REFUND_PROCESSED" => RiskLevel::High,

            // Critical operations
            "PAYMENT_FAILED" | "INVOICE_CANCELLED" | "COUNTERPARTY_BLOCKED" => RiskLevel::Critical,

            // Medium-risk operations
            "INVOICE_CREATED" | "PAYMENT_INITIALIZED" | "STATUS_CHANGED" => {
                // Check if large amounts are involved
                if let Some(new_val) = new_values {
                    if let Some(amount) = new_val
                        .get("total_amount")
                        .or_else(|| new_val.get("amount"))
                    {
                        if let Some(amount_num) = amount.as_f64() {
                            if amount_num > 1_000_000.0 {
                                // > 1M RUB
                                return RiskLevel::High;
                            } else if amount_num > 100_000.0 {
                                // > 100K RUB
                                return RiskLevel::Medium;
                            }
                        }
                    }
                }
                RiskLevel::Medium
            }

            // Low-risk operations
            _ => RiskLevel::Low,
        }
    }

    /// Log comprehensive audit event with cryptographic integrity
    pub async fn log_audit_event(
        &self,
        operation_type: &str,
        entity_type: EntityType,
        entity_id: &str,
        context: Option<AuditContext>,
        old_values: Option<Value>,
        new_values: Option<Value>,
    ) -> TBankResult<()> {
        let timestamp = Utc::now();
        let ctx = context.unwrap_or_else(|| AuditContext {
            user_id: None,
            ip_address: None,
            user_agent: None,
            session_id: None,
            risk_level: RiskLevel::Low,
            additional_context: None,
        });

        // Assess risk level if not provided
        let risk_level = if matches!(ctx.risk_level, RiskLevel::Low) {
            self.assess_risk_level(
                operation_type,
                &entity_type,
                old_values.as_ref(),
                new_values.as_ref(),
            )
        } else {
            ctx.risk_level
        };

        debug!(
            operation_type = %operation_type,
            entity_type = %entity_type.as_str(),
            entity_id = %entity_id,
            user_id = ?ctx.user_id,
            risk_level = %risk_level.as_str(),
            "Logging comprehensive audit event"
        );

        // Generate cryptographic hash for integrity
        let hash = self.generate_audit_hash(
            &timestamp,
            ctx.user_id.as_deref(),
            operation_type,
            entity_type.as_str(),
            entity_id,
            old_values.as_ref(),
            new_values.as_ref(),
        );

        // Determine changed fields
        let changed_fields = self.extract_changed_fields(&old_values, &new_values);

        // Store audit log with cryptographic hash
        CommonQueries::insert_audit_log(
            &self.db_pool,
            ctx.user_id.as_deref(),
            operation_type,
            entity_type.as_str(),
            entity_id,
            old_values.as_ref(),
            new_values.as_ref(),
            &changed_fields,
            ctx.ip_address.as_deref(),
            ctx.user_agent.as_deref(),
            &hash,
        )
        .await?;

        // Log additional context for sensitive operations
        if matches!(risk_level, RiskLevel::High | RiskLevel::Critical) {
            warn!(
                operation_type = %operation_type,
                entity_id = %entity_id,
                user_id = ?ctx.user_id,
                ip_address = ?ctx.ip_address,
                risk_level = %risk_level.as_str(),
                hash = %hash,
                "High-risk financial operation logged with enhanced security context"
            );
        }

        info!(
            operation_type = %operation_type,
            entity_type = %entity_type.as_str(),
            entity_id = %entity_id,
            risk_level = %risk_level.as_str(),
            hash = %hash[..16], // Log first 16 chars of hash
            "Audit event logged with cryptographic integrity protection"
        );

        Ok(())
    }

    /// Extract changed fields between old and new values
    pub(super) fn extract_changed_fields(
        &self,
        old_values: &Option<Value>,
        new_values: &Option<Value>,
    ) -> Vec<String> {
        let mut changed_fields = Vec::new();

        match (old_values, new_values) {
            (Some(old), Some(new)) => {
                if let (Some(old_obj), Some(new_obj)) = (old.as_object(), new.as_object()) {
                    // Find changed fields
                    for (key, new_val) in new_obj {
                        if let Some(old_val) = old_obj.get(key) {
                            if old_val != new_val {
                                changed_fields.push(key.clone());
                            }
                        } else {
                            changed_fields.push(key.clone()); // New field
                        }
                    }

                    // Find removed fields
                    for key in old_obj.keys() {
                        if !new_obj.contains_key(key) {
                            changed_fields.push(format!("removed_{}", key));
                        }
                    }
                }
            }
            (None, Some(new)) => {
                if let Some(new_obj) = new.as_object() {
                    changed_fields.extend(new_obj.keys().cloned());
                }
            }
            (Some(_), None) => {
                changed_fields.push("entity_deleted".to_string());
            }
            (None, None) => {
                // No changes to track
            }
        }

        changed_fields
    }

    /// Get database pool reference
    pub fn db_pool(&self) -> &Arc<PgPool> {
        &self.db_pool
    }

    /// Get encryption service reference
    pub fn encryption_service(&self) -> &Arc<EncryptionService> {
        &self.encryption_service
    }

    /// Log billing integration event
    pub async fn log_billing_integration_event(
        &self,
        campaign_id: uuid::Uuid,
        invoice_id: uuid::Uuid,
        event_type: &str,
        trace_id: &str,
    ) -> TBankResult<()> {
        let context = AuditContext {
            user_id: Some("billing-engine".to_string()),
            ip_address: None,
            user_agent: Some("billing-engine-integration".to_string()),
            session_id: Some(trace_id.to_string()),
            risk_level: RiskLevel::Medium,
            additional_context: Some(serde_json::json!({
                "campaign_id": campaign_id,
                "trace_id": trace_id
            })),
        };

        let new_values = serde_json::json!({
            "campaign_id": campaign_id,
            "invoice_id": invoice_id,
            "event_type": event_type,
            "trace_id": trace_id,
            "timestamp": Utc::now()
        });

        self.log_audit_event(
            "BILLING_INTEGRATION_EVENT",
            EntityType::B2BInvoice,
            &invoice_id.to_string(),
            Some(context),
            None,
            Some(new_values),
        )
        .await
    }
}
