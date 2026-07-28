use chrono::Utc;
use tracing::info;

use super::core::AuditLogger;
use super::types::{AuditContext, EntityType};
use crate::database::common_queries::CommonQueries;
use crate::types::b2b::invoice::{B2BInvoice as Invoice, B2BInvoiceStatus as InvoiceStatus};
use crate::types::TBankResult;

/// B2B audit events trait for invoice-related operations
pub trait B2BAuditEvents {
    /// Log B2B invoice creation event
    async fn log_b2b_invoice_creation(
        &self,
        invoice: &Invoice,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;

    /// Log B2B invoice status change event
    async fn log_b2b_invoice_status_change(
        &self,
        invoice: &Invoice,
        old_status: &InvoiceStatus,
        new_status: &InvoiceStatus,
        context: Option<AuditContext>,
    ) -> TBankResult<()>;
}

impl B2BAuditEvents for AuditLogger {
    /// Log B2B invoice creation event
    async fn log_b2b_invoice_creation(
        &self,
        invoice: &Invoice,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        info!(
            invoice_id = ?invoice.id,
            invoice_number = %invoice.invoice_number,
            "Logging B2B invoice creation audit event"
        );

        let new_values = serde_json::json!({
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "counterparty_inn": invoice.counterparty_inn,
            "counterparty_name": invoice.counterparty_name,
            "total_amount": invoice.total_amount,
            "status": invoice.status,
            "due_date": invoice.due_date,
            "created_at": invoice.created_at
        });

        self.log_audit_event(
            "B2B_INVOICE_CREATED",
            EntityType::B2BInvoice,
            &invoice
                .id
                .expect("Invoice ID should be present")
                .to_string(),
            context,
            None,
            Some(new_values),
        )
        .await?;

        // Also create financial audit record
        CommonQueries::insert_financial_audit(
            self.db_pool(),
            &invoice
                .id
                .expect("Invoice ID should be present")
                .to_string(),
            "B2B_INVOICE",
            invoice.total_amount,
            "RUB",
            Some(&invoice.counterparty_inn),
            invoice
                .created_at
                .expect("Invoice created_at should be present"),
            "CREATED",
        )
        .await?;

        Ok(())
    }

    /// Log B2B invoice status change event
    async fn log_b2b_invoice_status_change(
        &self,
        invoice: &Invoice,
        old_status: &InvoiceStatus,
        new_status: &InvoiceStatus,
        context: Option<AuditContext>,
    ) -> TBankResult<()> {
        info!(
            invoice_id = ?invoice.id,
            invoice_number = %invoice.invoice_number,
            old_status = ?old_status,
            new_status = ?new_status,
            "Logging B2B invoice status change audit event"
        );

        let old_values = serde_json::json!({
            "status": old_status,
            "updated_at": invoice.updated_at
        });

        let new_values = serde_json::json!({
            "status": new_status,
            "updated_at": Utc::now()
        });

        self.log_audit_event(
            "B2B_INVOICE_STATUS_CHANGED",
            EntityType::B2BInvoice,
            &invoice
                .id
                .expect("Invoice ID should be present")
                .to_string(),
            context,
            Some(old_values),
            Some(new_values),
        )
        .await?;

        // Update financial audit record if paid
        if matches!(new_status, InvoiceStatus::Paid) {
            CommonQueries::insert_financial_audit(
                self.db_pool(),
                &invoice
                    .id
                    .expect("Invoice ID should be present")
                    .to_string(),
                "B2B_INVOICE",
                invoice.total_amount,
                "RUB",
                Some(&invoice.counterparty_inn),
                Utc::now(),
                "PAID",
            )
            .await?;
        }

        Ok(())
    }
}
