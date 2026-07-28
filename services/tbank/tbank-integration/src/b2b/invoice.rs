use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::client::api_methods::B2BApiMethods;
use crate::client::TBankClient;
use crate::counterparty::CounterpartyVerifier;
use crate::database::b2b_queries::B2BQueries;
use crate::types::b2b::invoice::{
    B2BInvoice, B2BInvoiceStatus, CreateB2BInvoiceRequest, CreateInvoiceContactRequest,
    CreateInvoiceItemRequest,
};
use crate::types::{TBankError, TBankResult};

/// B2B Invoice Service for T-Bank POST /invoice/send API integration
pub struct B2BInvoiceService {
    tbank_client: Arc<TBankClient>,
    counterparty_verifier: Arc<CounterpartyVerifier>,
    db_pool: Arc<PgPool>,
}

impl B2BInvoiceService {
    /// Create new B2B invoice service
    pub fn new(
        tbank_client: Arc<TBankClient>,
        counterparty_verifier: Arc<CounterpartyVerifier>,
        db_pool: Arc<PgPool>,
    ) -> Self {
        info!("Initializing B2BInvoiceService");

        Self {
            tbank_client,
            counterparty_verifier,
            db_pool,
        }
    }

    /// Send B2B invoice via T-Bank POST /invoice/send API
    pub async fn send_invoice(&self, request: CreateB2BInvoiceRequest) -> TBankResult<B2BInvoice> {
        info!(
            counterparty_inn = %request.counterparty_inn,
            amount = %request.total_amount,
            invoice_number = %request.invoice_number,
            "Sending B2B invoice via T-Bank API"
        );

        // Validate invoice request
        self.validate_invoice_request(&request)?;

        // Verify counterparty exists or create new one
        let counterparty = self
            .counterparty_verifier
            .verify_counterparty(
                crate::types::counterparty::CounterpartyVerificationRequest {
                    inn: request.counterparty_inn.clone(),
                    kpp: request.counterparty_kpp.clone(),
                },
            )
            .await
            .map_err(|e| {
                error!(
                    inn = %request.counterparty_inn,
                    error = %e,
                    "Failed to verify counterparty for B2B invoice"
                );
                e
            })?;

        info!(
            inn = %counterparty.inn,
            full_name = %counterparty.full_name,
            "Counterparty verified for B2B invoice"
        );

        // Create T-Bank invoice send request
        let tbank_request = self.create_tbank_invoice_request(&request)?;

        // Send invoice via T-Bank Business API
        let tbank_response: TBankInvoiceSendResponse = self
            .tbank_client
            .send_b2b_invoice(tbank_request)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_number = %request.invoice_number,
                    "Failed to send B2B invoice via T-Bank API"
                );
                e
            })?;

        info!(
            tbank_invoice_id = %tbank_response.invoice_id,
            pdf_url = %tbank_response.pdf_url,
            incoming_invoice_url = %tbank_response.incoming_invoice_url,
            "B2B invoice sent successfully via T-Bank API"
        );

        // Create B2B invoice object with T-Bank response data
        let invoice = B2BInvoice {
            id: Some(Uuid::new_v4()),
            invoice_number: request.invoice_number,
            tbank_invoice_id: Some(tbank_response.invoice_id),
            counterparty_inn: request.counterparty_inn,
            counterparty_kpp: request.counterparty_kpp,
            counterparty_name: request.counterparty_name,
            due_date: request.due_date,
            invoice_date: Some(
                request
                    .invoice_date
                    .unwrap_or_else(|| Utc::now().date_naive()),
            ),
            account_number: request.account_number,
            total_amount: request.total_amount,
            status: B2BInvoiceStatus::Sent,
            pdf_url: Some(tbank_response.pdf_url),
            incoming_invoice_url: Some(tbank_response.incoming_invoice_url),
            comment: request.comment,
            custom_payment_purpose: request.custom_payment_purpose,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };

        // Store in database with items and contacts
        B2BQueries::insert_invoice_with_items_and_contacts(
            &self.db_pool,
            &invoice,
            &request.items,
            &request.contacts,
        )
        .await?;

        info!(
            invoice_id = ?invoice.id,
            invoice_number = %invoice.invoice_number,
            tbank_invoice_id = ?invoice.tbank_invoice_id,
            "B2B invoice created and stored successfully"
        );

        Ok(invoice)
    }

    /// Get B2B invoice by ID
    pub async fn get_invoice(&self, invoice_id: Uuid) -> TBankResult<Option<B2BInvoice>> {
        debug!(invoice_id = ?invoice_id, "Getting B2B invoice by ID");
        B2BQueries::get_invoice_by_id(&self.db_pool, invoice_id).await
    }

    /// Update B2B invoice status
    pub async fn update_invoice_status(
        &self,
        invoice_id: Uuid,
        new_status: B2BInvoiceStatus,
    ) -> TBankResult<()> {
        info!(
            invoice_id = ?invoice_id,
            new_status = ?new_status,
            "Updating B2B invoice status"
        );

        // Validate status transition
        self.validate_status_transition(invoice_id, new_status.clone())
            .await?;

        // Update in database
        B2BQueries::update_invoice_status(&self.db_pool, invoice_id, new_status.clone()).await?;

        info!(
            invoice_id = ?invoice_id,
            new_status = ?new_status,
            "B2B invoice status updated successfully"
        );

        Ok(())
    }

    /// List B2B invoices with filtering
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

        B2BQueries::list_invoices(&self.db_pool, counterparty_inn, status, limit, offset).await
    }

    /// Validate B2B invoice request
    fn validate_invoice_request(&self, request: &CreateB2BInvoiceRequest) -> TBankResult<()> {
        debug!("Validating B2B invoice request");

        // Use the request's built-in validation
        request
            .validate()
            .map_err(|msg| TBankError::ValidationError(msg))?;

        // Additional business logic validation
        if request.total_amount.is_sign_negative() || request.total_amount.is_zero() {
            return Err(TBankError::ValidationError(
                "Total amount must be positive".to_string(),
            ));
        }

        // Validate invoice number format (^\d{1,15}$)
        if !request
            .invoice_number
            .chars()
            .all(|c: char| c.is_ascii_digit())
        {
            return Err(TBankError::ValidationError(
                "Invoice number must contain only digits".to_string(),
            ));
        }

        if request.invoice_number.len() > 15 {
            return Err(TBankError::ValidationError(
                "Invoice number cannot exceed 15 digits".to_string(),
            ));
        }

        // Validate INN/KPP format
        crate::counterparty::validator::InnKppValidator::validate_inn(&request.counterparty_inn)
            .map_err(|e| TBankError::ValidationError(format!("Invalid INN: {}", e)))?;

        if let Some(kpp) = &request.counterparty_kpp {
            crate::counterparty::validator::InnKppValidator::validate_kpp(kpp)
                .map_err(|e| TBankError::ValidationError(format!("Invalid KPP: {}", e)))?;
        }

        // Validate due date is reasonable (not more than 1 year in future)
        let max_due_date = Utc::now().date_naive() + chrono::Duration::days(365);
        if request.due_date > max_due_date {
            return Err(TBankError::ValidationError(
                "Due date cannot be more than 1 year in the future".to_string(),
            ));
        }

        // Validate items count (up to 100 items)
        if request.items.len() > 100 {
            return Err(TBankError::ValidationError(
                "Invoice cannot have more than 100 items".to_string(),
            ));
        }

        // Validate contacts count (up to 10 contacts)
        if request.contacts.len() > 10 {
            return Err(TBankError::ValidationError(
                "Invoice cannot have more than 10 contacts".to_string(),
            ));
        }

        debug!("B2B invoice request validation passed");
        Ok(())
    }

    /// Create T-Bank invoice send request from our request
    fn create_tbank_invoice_request(
        &self,
        request: &CreateB2BInvoiceRequest,
    ) -> TBankResult<TBankInvoiceSendRequest> {
        debug!("Creating T-Bank invoice send request");

        // Map our internal request to T-Bank's POST /invoice/send format
        let tbank_request = TBankInvoiceSendRequest {
            invoice_number: request.invoice_number.clone(),
            counterparty: TBankCounterparty {
                inn: request.counterparty_inn.clone(),
                kpp: request.counterparty_kpp.clone(),
                name: request.counterparty_name.clone(),
            },
            due_date: request.due_date.format("%Y-%m-%d").to_string(),
            invoice_date: request
                .invoice_date
                .unwrap_or_else(|| Utc::now().date_naive())
                .format("%Y-%m-%d")
                .to_string(),
            account_number: request.account_number.clone(),
            total_amount: request.total_amount,
            currency: "RUB".to_string(), // Default currency for B2B invoices
            items: request
                .items
                .iter()
                .map(|item| TBankInvoiceItem {
                    name: item.name.clone(),
                    price: item.price,
                    unit: item.unit.clone(),
                    vat_rate: item.vat_rate.clone(),
                    amount: item.amount,
                    total_price: item.price * rust_decimal::Decimal::from(item.amount),
                })
                .collect(),
            contacts: request
                .contacts
                .iter()
                .filter_map(|contact| {
                    contact.email.as_ref().map(|email| TBankInvoiceContact {
                        email: email.to_string(),
                    })
                })
                .collect(),
            comment: request.comment.clone(),
            custom_payment_purpose: request.custom_payment_purpose.clone(),
        };

        debug!(
            invoice_number = %tbank_request.invoice_number,
            counterparty_inn = %tbank_request.counterparty.inn,
            total_amount = %tbank_request.total_amount,
            items_count = tbank_request.items.len(),
            contacts_count = tbank_request.contacts.len(),
            "T-Bank invoice send request created"
        );

        Ok(tbank_request)
    }

    /// Validate status transition for B2B invoices
    async fn validate_status_transition(
        &self,
        invoice_id: Uuid,
        new_status: B2BInvoiceStatus,
    ) -> TBankResult<()> {
        debug!(
            invoice_id = ?invoice_id,
            new_status = ?new_status,
            "Validating B2B invoice status transition"
        );

        // Get current invoice
        let current_invoice = self
            .get_invoice(invoice_id)
            .await?
            .ok_or_else(|| TBankError::InvoiceNotFound { id: invoice_id })?;

        let current_status = current_invoice.status;

        // Validate transition according to state machine: Draft → Sent → Viewed → Paid/Overdue → Cancelled/Refunded
        let valid_transition = match (current_status, new_status) {
            // From Draft
            (B2BInvoiceStatus::Draft, B2BInvoiceStatus::Sent) => true,
            (B2BInvoiceStatus::Draft, B2BInvoiceStatus::Cancelled) => true,

            // From Sent
            (B2BInvoiceStatus::Sent, B2BInvoiceStatus::Viewed) => true,
            (B2BInvoiceStatus::Sent, B2BInvoiceStatus::Paid) => true,
            (B2BInvoiceStatus::Sent, B2BInvoiceStatus::Overdue) => true,
            (B2BInvoiceStatus::Sent, B2BInvoiceStatus::Cancelled) => true,

            // From Viewed
            (B2BInvoiceStatus::Viewed, B2BInvoiceStatus::Paid) => true,
            (B2BInvoiceStatus::Viewed, B2BInvoiceStatus::Overdue) => true,
            (B2BInvoiceStatus::Viewed, B2BInvoiceStatus::Cancelled) => true,

            // From Paid
            (B2BInvoiceStatus::Paid, B2BInvoiceStatus::Refunded) => true,

            // From Overdue
            (B2BInvoiceStatus::Overdue, B2BInvoiceStatus::Paid) => true,
            (B2BInvoiceStatus::Overdue, B2BInvoiceStatus::Cancelled) => true,

            // Same status (no change)
            (current, new) if current == new => true,

            // All other transitions are invalid
            _ => false,
        };

        if !valid_transition {
            return Err(TBankError::ValidationError(format!(
                "Invalid status transition from {:?} to {:?}",
                current_status, new_status
            )));
        }

        debug!(
            current_status = ?current_status,
            new_status = ?new_status,
            "B2B invoice status transition validated"
        );

        Ok(())
    }
}

/// T-Bank invoice send request structure for POST /invoice/send API
#[derive(Debug, Clone, Serialize)]
pub struct TBankInvoiceSendRequest {
    #[serde(rename = "invoiceNumber")]
    pub invoice_number: String,
    pub counterparty: TBankCounterparty,
    #[serde(rename = "dueDate")]
    pub due_date: String, // Format: YYYY-MM-DD
    #[serde(rename = "invoiceDate")]
    pub invoice_date: String, // Format: YYYY-MM-DD
    #[serde(rename = "accountNumber")]
    pub account_number: Option<String>,
    #[serde(rename = "totalAmount")]
    pub total_amount: rust_decimal::Decimal,
    pub currency: String,
    pub items: Vec<TBankInvoiceItem>,
    pub contacts: Vec<TBankInvoiceContact>,
    pub comment: Option<String>,
    #[serde(rename = "customPaymentPurpose")]
    pub custom_payment_purpose: Option<String>,
}

/// T-Bank counterparty structure
#[derive(Debug, Clone, Serialize)]
pub struct TBankCounterparty {
    pub inn: String,
    pub kpp: Option<String>,
    pub name: String,
}

/// T-Bank invoice item structure
#[derive(Debug, Clone, Serialize)]
pub struct TBankInvoiceItem {
    pub name: String,
    pub price: rust_decimal::Decimal,
    pub unit: String,
    #[serde(rename = "vatRate")]
    pub vat_rate: String,
    pub amount: i32,
    #[serde(rename = "totalPrice")]
    pub total_price: rust_decimal::Decimal,
}

/// T-Bank invoice contact structure
#[derive(Debug, Clone, Serialize)]
pub struct TBankInvoiceContact {
    pub email: String,
}

/// T-Bank invoice send response structure
#[derive(Debug, Clone, Deserialize)]
pub struct TBankInvoiceSendResponse {
    #[serde(rename = "invoiceId")]
    pub invoice_id: String,
    #[serde(rename = "pdfUrl")]
    pub pdf_url: String,
    #[serde(rename = "incomingInvoiceUrl")]
    pub incoming_invoice_url: String,
    #[serde(rename = "invoiceNumber")]
    pub invoice_number: String,
    pub status: String,
}
