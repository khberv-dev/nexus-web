use chrono::Utc;
use serde_json::Value;
use tracing::warn;

use super::core::AuditLogger;
use super::types::{AuditContext, EntityType, RiskLevel};
use crate::types::TBankResult;

/// Security audit events trait for security-related operations
pub trait SecurityAuditEvents {
    /// Log security event (failed authentication, suspicious activity, etc.)
    async fn log_security_event(
        &self,
        event_type: &str,
        description: &str,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;

    /// Log enhanced audit event with additional security context for sensitive operations
    async fn log_enhanced_audit_event(
        &self,
        operation_type: &str,
        entity_type: EntityType,
        entity_id: &str,
        context: AuditContext,
        old_values: Option<Value>,
        new_values: Option<Value>,
        additional_security_context: Option<Value>,
    ) -> TBankResult<()>;

    /// Log counterparty verification event
    async fn log_counterparty_verification(
        &self,
        inn: &str,
        kpp: Option<&str>,
        verification_result: bool,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;

    /// Log webhook processing event
    async fn log_webhook_processed(
        &self,
        event_id: &str,
        event_type: &str,
        webhook_type: &str,
        entity_id: &str,
        processing_result: bool,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;
}

impl SecurityAuditEvents for AuditLogger {
    /// Log security event (failed authentication, suspicious activity, etc.)
    async fn log_security_event(
        &self,
        event_type: &str,
        description: &str,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        warn!(
            event_type = %event_type,
            description = %description,
            ip_address = ?context.as_ref().and_then(|c| c.ip_address.as_ref()),
            user_agent = ?context.as_ref().and_then(|c| c.user_agent.as_ref()),
            "Logging security event"
        );

        let new_values = serde_json::json!({
            "event_type": event_type,
            "description": description,
            "timestamp": Utc::now(),
            "severity": "SECURITY_EVENT"
        });

        // Force high risk level for security events
        let mut security_context = context.unwrap_or_else(|| AuditContext {
            user_id: None,
            ip_address: None,
            user_agent: None,
            session_id: None,
            risk_level: RiskLevel::Critical,
            additional_context: None,
        });
        security_context.risk_level = RiskLevel::Critical;

        self.log_audit_event(
            event_type,
            EntityType::WebhookEvent, // Use webhook event as generic security event type
            &format!("security_{}", Utc::now().timestamp()),
            Some(security_context),
            None,
            Some(new_values),
        )
        .await?;

        Ok(())
    }

    /// Log enhanced audit event with additional security context for sensitive operations
    async fn log_enhanced_audit_event(
        &self,
        operation_type: &str,
        entity_type: EntityType,
        entity_id: &str,
        context: AuditContext,
        old_values: Option<Value>,
        new_values: Option<Value>,
        additional_security_context: Option<Value>,
    ) -> TBankResult<()> {
        // Enhanced context for sensitive operations
        let mut enhanced_new_values = new_values.unwrap_or_else(|| serde_json::json!({}));

        // Add security context for high-risk operations
        if matches!(context.risk_level, RiskLevel::High | RiskLevel::Critical) {
            if let Some(mut new_obj) = enhanced_new_values.as_object_mut() {
                new_obj.insert(
                    "security_context".to_string(),
                    serde_json::json!({
                        "risk_level": context.risk_level.as_str(),
                        "session_id": context.session_id,
                        "additional_context": additional_security_context,
                        "enhanced_logging": true,
                        "compliance_flags": {
                            "pci_dss": matches!(entity_type, EntityType::AcquiringPayment),
                            "gdpr": context.user_id.is_some(),
                            "russian_152fz": true
                        }
                    }),
                );
            }
        }

        warn!(
            operation_type = %operation_type,
            entity_type = %entity_type.as_str(),
            entity_id = %entity_id,
            user_id = ?context.user_id,
            ip_address = ?context.ip_address,
            risk_level = %context.risk_level.as_str(),
            session_id = ?context.session_id,
            "Enhanced audit logging for sensitive operation"
        );

        self.log_audit_event(
            operation_type,
            entity_type,
            entity_id,
            Some(context),
            old_values,
            Some(enhanced_new_values),
        )
        .await
    }

    /// Log counterparty verification event
    async fn log_counterparty_verification(
        &self,
        inn: &str,
        kpp: Option<&str>,
        verification_result: bool,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        tracing::info!(
            inn = %inn,
            kpp = ?kpp,
            verification_result = verification_result,
            "Logging counterparty verification audit event"
        );

        let new_values = serde_json::json!({
            "inn": inn,
            "kpp": kpp,
            "verification_result": verification_result,
            "verified_at": Utc::now()
        });

        self.log_audit_event(
            "COUNTERPARTY_VERIFIED",
            EntityType::Counterparty,
            inn,
            context,
            None,
            Some(new_values),
        )
        .await?;

        Ok(())
    }

    /// Log webhook processing event
    async fn log_webhook_processed(
        &self,
        event_id: &str,
        event_type: &str,
        webhook_type: &str,
        entity_id: &str,
        processing_result: bool,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        tracing::info!(
            event_id = %event_id,
            event_type = %event_type,
            webhook_type = %webhook_type,
            entity_id = %entity_id,
            processing_result = processing_result,
            "Logging webhook processing audit event"
        );

        let new_values = serde_json::json!({
            "event_id": event_id,
            "event_type": event_type,
            "webhook_type": webhook_type,
            "entity_id": entity_id,
            "processing_result": processing_result,
            "processed_at": Utc::now()
        });

        let operation_type = if processing_result {
            "WEBHOOK_PROCESSED_SUCCESS"
        } else {
            "WEBHOOK_PROCESSED_FAILED"
        };

        self.log_audit_event(
            operation_type,
            EntityType::WebhookEvent,
            event_id,
            context,
            None,
            Some(new_values),
        )
        .await?;

        Ok(())
    }
}
