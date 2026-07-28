pub mod billing;
pub mod contacts;
pub mod invoice;
pub mod items;
pub mod state_machine;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use self::billing::{BillingEngineIntegration, BillingIntegrationConfig};
use self::contacts::B2BInvoiceContactService;
use self::invoice::B2BInvoiceService;
use self::items::B2BInvoiceItemService;
use self::state_machine::B2BInvoiceStateMachine;
use crate::audit::logger::AuditLogger;
use crate::audit::B2BAuditEvents;
use crate::client::api_methods::B2BApiMethods;
use crate::client::TBankClient;
use crate::counterparty::CounterpartyVerifier;
use crate::database::b2b_queries::B2BQueries;
use crate::types::b2b::invoice::{B2BInvoice, B2BInvoiceStatus, CreateB2BInvoiceRequest};
use crate::types::{TBankError, TBankResult};

/// B2B Invoice Manager for managing invoices to legal entities
pub struct B2BInvoiceManager {
    invoice_service: Arc<B2BInvoiceService>,
    item_service: Arc<B2BInvoiceItemService>,
    contact_service: Arc<B2BInvoiceContactService>,
    state_machine: B2BInvoiceStateMachine,
    audit_logger: Arc<AuditLogger>,
    billing_integration: Option<Arc<BillingEngineIntegration>>,
}

impl B2BInvoiceManager {
    /// Create new B2B invoice manager
    pub fn new(
        tbank_client: Arc<TBankClient>,
        counterparty_verifier: Arc<CounterpartyVerifier>,
        db_pool: Arc<PgPool>,
        audit_logger: Arc<AuditLogger>,
    ) -> Self {
        info!("Initializing B2BInvoiceManager");

        let invoice_service = Arc::new(B2BInvoiceService::new(
            tbank_client,
            counterparty_verifier,
            db_pool.clone(),
        ));

        let item_service = Arc::new(B2BInvoiceItemService::new(db_pool.clone()));
        let contact_service = Arc::new(B2BInvoiceContactService::new(db_pool.clone()));
        let state_machine = B2BInvoiceStateMachine::new();

        Self {
            invoice_service,
            item_service,
            contact_service,
            state_machine,
            audit_logger,
            billing_integration: None,
        }
    }

    /// Create new B2B invoice manager with billing integration
    pub fn with_billing_integration(
        tbank_client: Arc<TBankClient>,
        counterparty_verifier: Arc<CounterpartyVerifier>,
        db_pool: Arc<PgPool>,
        audit_logger: Arc<AuditLogger>,
        billing_integration: Arc<BillingEngineIntegration>,
    ) -> Self {
        info!("Initializing B2BInvoiceManager with billing integration");

        let invoice_service = Arc::new(B2BInvoiceService::new(
            tbank_client,
            counterparty_verifier,
            db_pool.clone(),
        ));

        let item_service = Arc::new(B2BInvoiceItemService::new(db_pool.clone()));
        let contact_service = Arc::new(B2BInvoiceContactService::new(db_pool.clone()));
        let state_machine = B2BInvoiceStateMachine::new();

        Self {
            invoice_service,
            item_service,
            contact_service,
            state_machine,
            audit_logger,
            billing_integration: Some(billing_integration),
        }
    }

    /// Send B2B invoice via T-Bank API
    pub async fn send_invoice(&self, request: CreateB2BInvoiceRequest) -> TBankResult<B2BInvoice> {
        info!(
            counterparty_inn = %request.counterparty_inn,
            amount = %request.total_amount,
            invoice_number = %request.invoice_number,
            "Sending B2B invoice"
        );

        let invoice = self.invoice_service.send_invoice(request).await?;

        // Log audit event
        self.audit_logger
            .log_b2b_invoice_creation(&invoice, None)
            .await?;

        info!(
            invoice_id = ?invoice.id,
            invoice_number = %invoice.invoice_number,
            "B2B invoice sent successfully"
        );

        Ok(invoice)
    }

    /// Get B2B invoice by ID
    pub async fn get_invoice(&self, invoice_id: Uuid) -> TBankResult<Option<B2BInvoice>> {
        debug!(invoice_id = ?invoice_id, "Getting B2B invoice by ID");
        self.invoice_service.get_invoice(invoice_id).await
    }

    /// Update B2B invoice status with validation
    pub async fn update_invoice_status(
        &self,
        invoice_id: Uuid,
        new_status: B2BInvoiceStatus,
    ) -> TBankResult<B2BInvoice> {
        info!(
            invoice_id = ?invoice_id,
            new_status = ?new_status,
            "Updating B2B invoice status"
        );

        // Get current invoice
        let mut invoice = self
            .get_invoice(invoice_id)
            .await?
            .ok_or_else(|| TBankError::InvoiceNotFound { id: invoice_id })?;

        let old_status = invoice.status.clone();

        // Validate status transition using state machine
        self.state_machine
            .validate_transition(old_status.clone(), new_status.clone())?;

        // Validate business rules
        self.state_machine.validate_business_rules(
            old_status.clone(),
            new_status.clone(),
            invoice.total_amount,
            invoice.due_date,
        )?;

        // Update status via service
        self.invoice_service
            .update_invoice_status(invoice_id, new_status.clone())
            .await?;

        // Update local invoice object
        invoice.status = new_status.clone();
        invoice.updated_at = Some(Utc::now());

        // Log audit event
        self.audit_logger
            .log_b2b_invoice_status_change(&invoice, &old_status, &new_status, None)
            .await?;

        info!(
            invoice_id = ?invoice_id,
            old_status = ?old_status,
            new_status = ?new_status,
            "B2B invoice status updated successfully"
        );

        Ok(invoice)
    }

    /// List B2B invoices with optional filtering
    pub async fn list_invoices(
        &self,
        counterparty_inn: Option<&str>,
        status: Option<B2BInvoiceStatus>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> TBankResult<Vec<B2BInvoice>> {
        debug!(
            counterparty_inn = ?counterparty_inn,
            status = ?status,
            limit = ?limit,
            offset = ?offset,
            "Listing B2B invoices"
        );

        self.invoice_service
            .list_invoices(counterparty_inn, status, limit, offset)
            .await
    }

    /// Get invoice service for direct access
    pub fn invoice_service(&self) -> &B2BInvoiceService {
        &self.invoice_service
    }

    /// Get item service for direct access
    pub fn item_service(&self) -> &B2BInvoiceItemService {
        &self.item_service
    }

    /// Get contact service for direct access
    pub fn contact_service(&self) -> &B2BInvoiceContactService {
        &self.contact_service
    }

    /// Get state machine for direct access
    pub fn state_machine(&self) -> &B2BInvoiceStateMachine {
        &self.state_machine
    }

    /// Get billing integration if available
    pub fn billing_integration(&self) -> Option<&BillingEngineIntegration> {
        self.billing_integration.as_ref().map(|bi| bi.as_ref())
    }

    /// Process billing event from billing-engine
    pub async fn process_billing_event(
        &self,
        event: &billing::CampaignBillingEvent,
        config: &BillingIntegrationConfig,
    ) -> TBankResult<Option<billing::AutoInvoiceResponse>> {
        if let Some(billing_integration) = &self.billing_integration {
            let response = billing_integration
                .process_campaign_billing_event(event, config)
                .await?;
            Ok(Some(response))
        } else {
            warn!("Billing integration not available, cannot process billing event");
            Ok(None)
        }
    }

    /// Get B2B invoice statistics
    pub async fn get_invoice_stats(&self) -> TBankResult<B2BInvoiceStats> {
        debug!("Getting B2B invoice statistics");

        // TODO: Implement database stats when DATABASE_URL is available
        // For now, return empty stats
        let stats = B2BInvoiceStats {
            total_invoices: 0,
            draft_invoices: 0,
            sent_invoices: 0,
            viewed_invoices: 0,
            paid_invoices: 0,
            overdue_invoices: 0,
            cancelled_invoices: 0,
            refunded_invoices: 0,
            total_amount: rust_decimal::Decimal::ZERO,
        };

        debug!(
            ?stats,
            "B2B invoice statistics retrieved (database not available)"
        );
        Ok(stats)
    }
}

/// B2B Invoice statistics
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct B2BInvoiceStats {
    pub total_invoices: u64,
    pub draft_invoices: u64,
    pub sent_invoices: u64,
    pub viewed_invoices: u64,
    pub paid_invoices: u64,
    pub overdue_invoices: u64,
    pub cancelled_invoices: u64,
    pub refunded_invoices: u64,
    pub total_amount: rust_decimal::Decimal,
}
