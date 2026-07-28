use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde_json::Value;
use tracing::info;

use super::core::AuditLogger;
use super::types::{AuditContext, ComplianceType, EntityType, RiskLevel};
use crate::types::TBankResult;

/// Compliance audit events trait for compliance-related operations
pub trait ComplianceAuditEvents {
    /// Log compliance-specific audit event
    async fn log_compliance_event(
        &self,
        compliance_type: ComplianceType,
        operation_type: &str,
        entity_id: &str,
        context: Option<AuditContext>,
        compliance_data: Value,
    ) -> TBankResult<()>;

    /// Log data retention event
    async fn log_data_retention_event(
        &self,
        retention_action: &str,
        entity_type: EntityType,
        affected_count: u32,
        retention_policy: &str,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;

    /// Log reconciliation completion event
    async fn log_reconciliation_completed(
        &self,
        account_number: &str,
        date: NaiveDate,
        matched_count: u32,
        unmatched_count: u32,
        total_matched_amount: &Decimal,
        total_unmatched_amount: &Decimal,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;
}

impl ComplianceAuditEvents for AuditLogger {
    /// Log compliance-specific audit event
    async fn log_compliance_event(
        &self,
        compliance_type: ComplianceType,
        operation_type: &str,
        entity_id: &str,
        context: Option<AuditContext>,
        compliance_data: Value,
    ) -> TBankResult<()> {
        info!(
            compliance_type = %compliance_type.as_str(),
            operation_type = %operation_type,
            entity_id = %entity_id,
            "Logging compliance-specific audit event"
        );

        let new_values = serde_json::json!({
            "compliance_type": compliance_type.as_str(),
            "compliance_data": compliance_data,
            "compliance_timestamp": Utc::now(),
            "regulatory_requirements": {
                "pci_dss": matches!(compliance_type, ComplianceType::PciDss),
                "gdpr": matches!(compliance_type, ComplianceType::Gdpr),
                "russian_152fz": matches!(compliance_type, ComplianceType::Russian152FZ),
            }
        });

        // Force high risk level for compliance events
        let mut compliance_context = context.unwrap_or_else(|| AuditContext {
            user_id: None,
            ip_address: None,
            user_agent: None,
            session_id: None,
            risk_level: RiskLevel::High,
            additional_context: None,
        });
        compliance_context.risk_level = RiskLevel::High;

        self.log_audit_event(
            &format!("COMPLIANCE_{}", operation_type),
            EntityType::FinancialAudit,
            entity_id,
            Some(compliance_context),
            None,
            Some(new_values),
        )
        .await
    }

    /// Log data retention event
    async fn log_data_retention_event(
        &self,
        retention_action: &str,
        entity_type: EntityType,
        affected_count: u32,
        retention_policy: &str,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        info!(
            retention_action = %retention_action,
            entity_type = %entity_type.as_str(),
            affected_count = affected_count,
            retention_policy = %retention_policy,
            "Logging data retention audit event"
        );

        let new_values = serde_json::json!({
            "retention_action": retention_action,
            "entity_type": entity_type.as_str(),
            "affected_count": affected_count,
            "retention_policy": retention_policy,
            "retention_timestamp": Utc::now(),
            "compliance_basis": "Russian Federal Law 152-FZ, PCI DSS, GDPR"
        });

        self.log_audit_event(
            "DATA_RETENTION",
            EntityType::FinancialAudit,
            &format!(
                "retention_{}_{}",
                entity_type.as_str(),
                Utc::now().timestamp()
            ),
            context,
            None,
            Some(new_values),
        )
        .await
    }

    /// Log reconciliation completion event
    async fn log_reconciliation_completed(
        &self,
        account_number: &str,
        date: NaiveDate,
        matched_count: u32,
        unmatched_count: u32,
        total_matched_amount: &Decimal,
        total_unmatched_amount: &Decimal,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        info!(
            account_number = %account_number,
            date = %date,
            matched_count = matched_count,
            unmatched_count = unmatched_count,
            total_matched_amount = %total_matched_amount,
            total_unmatched_amount = %total_unmatched_amount,
            "Logging reconciliation completion audit event"
        );

        let new_values = serde_json::json!({
            "account_number": account_number,
            "reconciliation_date": date,
            "matched_count": matched_count,
            "unmatched_count": unmatched_count,
            "total_matched_amount": total_matched_amount,
            "total_unmatched_amount": total_unmatched_amount,
            "reconciliation_completed_at": Utc::now()
        });

        self.log_audit_event(
            "RECONCILIATION_COMPLETED",
            EntityType::FinancialAudit,
            &format!("reconciliation_{}", date),
            context,
            None,
            Some(new_values),
        )
        .await?;

        info!(
            account_number = %account_number,
            date = %date,
            "Reconciliation completion audit event logged with cryptographic integrity"
        );

        Ok(())
    }
}
