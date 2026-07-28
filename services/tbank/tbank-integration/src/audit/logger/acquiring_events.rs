use chrono::Utc;
use tracing::info;

use super::core::AuditLogger;
use super::types::{AuditContext, EntityType};
use crate::database::common_queries::CommonQueries;
use crate::types::acquiring::payment::{AcquiringPayment, AcquiringPaymentStatus};
use crate::types::TBankResult;

/// Acquiring audit events trait for payment-related operations
pub trait AcquiringAuditEvents {
    /// Log acquiring payment creation event
    async fn log_acquiring_payment_creation(
        &self,
        payment: &AcquiringPayment,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;

    /// Log acquiring payment status change event
    async fn log_acquiring_payment_status_change(
        &self,
        payment: &AcquiringPayment,
        old_status: &AcquiringPaymentStatus,
        new_status: &AcquiringPaymentStatus,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;
}

impl AcquiringAuditEvents for AuditLogger {
    /// Log acquiring payment creation event
    async fn log_acquiring_payment_creation(
        &self,
        payment: &AcquiringPayment,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        info!(
            payment_id = ?payment.id,
            order_id = %payment.order_id,
            amount = %payment.amount,
            "Logging acquiring payment creation audit event"
        );

        let new_values = serde_json::json!({
            "id": payment.id,
            "order_id": payment.order_id,
            "amount": payment.amount,
            "currency": payment.currency,
            "payment_method": payment.payment_method,
            "status": payment.status,
            "customer_email": payment.customer_email,
            "created_at": payment.created_at
        });

        self.log_audit_event(
            "ACQUIRING_PAYMENT_CREATED",
            EntityType::AcquiringPayment,
            &payment
                .id
                .expect("Payment ID should be present")
                .to_string(),
            context,
            None,
            Some(new_values),
        )
        .await?;

        // Create financial audit record
        CommonQueries::insert_financial_audit(
            self.db_pool(),
            &payment
                .id
                .expect("Payment ID should be present")
                .to_string(),
            "ACQUIRING_PAYMENT",
            payment.amount,
            &payment.currency.to_string(),
            None, // No counterparty INN for acquiring payments
            payment
                .created_at
                .expect("Payment created_at should be present"),
            "INITIALIZED",
        )
        .await?;

        Ok(())
    }

    /// Log acquiring payment status change event
    async fn log_acquiring_payment_status_change(
        &self,
        payment: &AcquiringPayment,
        old_status: &AcquiringPaymentStatus,
        new_status: &AcquiringPaymentStatus,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        info!(
            payment_id = ?payment.id,
            order_id = %payment.order_id,
            old_status = ?old_status,
            new_status = ?new_status,
            "Logging acquiring payment status change audit event"
        );

        let old_values = serde_json::json!({
            "status": old_status,
            "updated_at": payment.updated_at
        });

        let new_values = serde_json::json!({
            "status": new_status,
            "updated_at": Utc::now(),
            "commission_amount": payment.commission_amount,
            "completed_at": payment.completed_at
        });

        self.log_audit_event(
            "ACQUIRING_PAYMENT_STATUS_CHANGED",
            EntityType::AcquiringPayment,
            &payment
                .id
                .expect("Payment ID should be present")
                .to_string(),
            context,
            Some(old_values),
            Some(new_values),
        )
        .await?;

        // Update financial audit record based on status
        let audit_status = match new_status {
            AcquiringPaymentStatus::Completed => "COMPLETED",
            AcquiringPaymentStatus::Failed => "FAILED",
            AcquiringPaymentStatus::Cancelled => "CANCELLED",
            AcquiringPaymentStatus::Expired => "EXPIRED",
            _ => "PROCESSING",
        };

        CommonQueries::insert_financial_audit(
            self.db_pool(),
            &payment
                .id
                .expect("Payment ID should be present")
                .to_string(),
            "ACQUIRING_PAYMENT",
            payment.amount,
            &payment.currency.to_string(),
            None,
            Utc::now(),
            audit_status,
        )
        .await?;

        Ok(())
    }
}
