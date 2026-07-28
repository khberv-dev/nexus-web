use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put},
    Router,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize, Serializer};
use std::sync::Arc;
use uuid::Uuid;

use crate::services::TBankServices;

/// Helper function to serialize Decimal as a number (not string) for T-Bank API
fn serialize_decimal_as_number<S>(value: &Decimal, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    // Convert Decimal to f64 for JSON serialization as number
    let float_value = value.to_string().parse::<f64>().unwrap_or(0.0);
    serializer.serialize_f64(float_value)
}

/// B2B Invoice API endpoints for юридические лица
/// Handles /api/v1/invoices/b2b/* endpoints

/// Request to send a B2B invoice (matches official T-Bank API structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendB2BInvoiceRequest {
    #[serde(rename = "invoiceNumber")]
    pub invoice_number: String,
    #[serde(rename = "dueDate")]
    pub due_date: String, // Format: "2020-08-22"
    #[serde(rename = "invoiceDate")]
    pub invoice_date: String, // Format: "2020-07-23"
    #[serde(rename = "accountNumber")]
    pub account_number: String, // Format: "40802123456789012345"
    pub payer: B2BInvoicePayer,
    pub items: Vec<B2BInvoiceItem>,
    pub contacts: Vec<B2BInvoiceContact>,
    #[serde(rename = "contactPhone", skip_serializing_if = "Option::is_none")]
    pub contact_phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(rename = "customPaymentPurpose", skip_serializing_if = "Option::is_none")]
    pub custom_payment_purpose: Option<String>,
}

/// B2B Invoice payer information (matches T-Bank API structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B2BInvoicePayer {
    pub name: String,
    pub inn: String,
    pub kpp: String,
}

/// B2B Invoice item (matches T-Bank API structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B2BInvoiceItem {
    pub name: String,
    #[serde(serialize_with = "serialize_decimal_as_number")]
    pub price: Decimal,
    pub unit: String,
    pub vat: String, // "None", "0", "10", "20", "22"
    pub amount: i32,
}

/// B2B Invoice contact (matches T-Bank API structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B2BInvoiceContact {
    pub email: String,
}

/// Simplified request for creating B2B invoice from CRM
/// This is converted internally to SendB2BInvoiceRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimplifiedInvoiceRequest {
    pub counterparty: SimplifiedCounterparty,
    pub items: Vec<B2BInvoiceItem>,
    #[serde(rename = "dueDate")]
    pub due_date: String,
    pub contacts: Vec<B2BInvoiceContact>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimplifiedCounterparty {
    pub inn: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kpp: Option<String>,
}

/// Response for B2B invoice operations (matches T-Bank API response)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B2BInvoiceResponse {
    pub id: Uuid,
    #[serde(rename = "invoiceNumber")]
    pub invoice_number: String,
    #[serde(rename = "tbankInvoiceId")]
    pub tbank_invoice_id: Option<String>,
    #[serde(rename = "pdfUrl")]
    pub pdf_url: Option<String>,
    #[serde(rename = "incomingInvoiceUrl")]
    pub incoming_invoice_url: Option<String>,
    pub status: String, // "Sent", "Paid", "Cancelled", "Expired"
    #[serde(rename = "dueDate")]
    pub due_date: String,
    #[serde(rename = "invoiceDate")]
    pub invoice_date: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

/// Query parameters for listing B2B invoices
#[derive(Debug, Deserialize)]
pub struct ListB2BInvoicesQuery {
    pub status: Option<String>,
    pub counterparty_inn: Option<String>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Request to update B2B invoice status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateB2BInvoiceStatusRequest {
    pub status: String,
}

impl SendB2BInvoiceRequest {
    /// Validate the B2B invoice request (according to T-Bank API requirements)
    pub fn validate(&self) -> Result<(), String> {
        // Validate invoice number
        if self.invoice_number.trim().is_empty() {
            return Err("Invoice number is required".to_string());
        }

        // Validate date formats (YYYY-MM-DD)
        if !self.is_valid_date(&self.due_date) {
            return Err("Due date must be in format YYYY-MM-DD".to_string());
        }

        if !self.is_valid_date(&self.invoice_date) {
            return Err("Invoice date must be in format YYYY-MM-DD".to_string());
        }

        // Validate account number (20 digits)
        if !self.account_number.chars().all(|c| c.is_ascii_digit()) || self.account_number.len() != 20 {
            return Err("Account number must be 20 digits".to_string());
        }

        // Validate payer
        self.payer.validate()?;

        // Validate items (at least 1, max 100)
        if self.items.is_empty() {
            return Err("At least one invoice item is required".to_string());
        }

        if self.items.len() > 100 {
            return Err("Maximum 100 invoice items allowed".to_string());
        }

        for item in &self.items {
            item.validate()?;
        }

        // Validate contacts (at least 1, max 10)
        if self.contacts.is_empty() {
            return Err("At least one contact is required".to_string());
        }

        if self.contacts.len() > 10 {
            return Err("Maximum 10 contacts allowed".to_string());
        }

        for contact in &self.contacts {
            contact.validate()?;
        }

        // Validate phone format if provided
        if let Some(ref phone) = self.contact_phone {
            if !phone.starts_with("+7") || phone.len() != 12 {
                return Err("Phone must be in format +7XXXXXXXXXX".to_string());
            }
        }

        Ok(())
    }

    fn is_valid_date(&self, date_str: &str) -> bool {
        // Simple date validation for YYYY-MM-DD format
        if date_str.len() != 10 {
            return false;
        }

        let parts: Vec<&str> = date_str.split('-').collect();
        if parts.len() != 3 {
            return false;
        }

        // Check if all parts are numeric
        parts.iter().all(|part| part.chars().all(|c| c.is_ascii_digit()))
    }
}

impl B2BInvoicePayer {
    pub fn validate(&self) -> Result<(), String> {
        // Validate INN format (10 or 12 digits)
        if !self.inn.chars().all(|c| c.is_ascii_digit()) {
            return Err("INN must contain only digits".to_string());
        }

        let inn_len = self.inn.len();
        if inn_len != 10 && inn_len != 12 {
            return Err("INN must be 10 or 12 digits".to_string());
        }

        // Validate KPP format (9 digits)
        if !self.kpp.chars().all(|c| c.is_ascii_digit()) || self.kpp.len() != 9 {
            return Err("KPP must be 9 digits".to_string());
        }

        // Validate name
        if self.name.trim().is_empty() {
            return Err("Payer name is required".to_string());
        }

        Ok(())
    }
}

impl B2BInvoiceItem {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Item name is required".to_string());
        }

        if self.price <= Decimal::ZERO {
            return Err("Item price must be positive".to_string());
        }

        if self.amount <= 0 {
            return Err("Item amount must be positive".to_string());
        }

        if self.unit.trim().is_empty() {
            return Err("Item unit is required".to_string());
        }

        // Validate VAT rate
        let valid_vat_rates = ["None", "0", "10", "20", "22"];
        if !valid_vat_rates.contains(&self.vat.as_str()) {
            return Err("VAT rate must be one of: None, 0, 10, 20, 22".to_string());
        }

        Ok(())
    }
}

impl B2BInvoiceContact {
    pub fn validate(&self) -> Result<(), String> {
        if !self.email.contains('@') || self.email.len() < 5 {
            return Err("Invalid email format".to_string());
        }

        Ok(())
    }
}

/// Send B2B invoice to юридическое лицо
/// POST /api/v1/invoice/send (matches official T-Bank Business API)
pub async fn send_b2b_invoice(
    State(services): State<Arc<TBankServices>>,
    Json(request): Json<SimplifiedInvoiceRequest>,
) -> Result<Json<B2BInvoiceResponse>, StatusCode> {
    // Generate invoice number (only digits, max 15 chars as per T-Bank API requirements)
    let timestamp = Utc::now().timestamp();
    let invoice_number = format!("{}", timestamp % 1_000_000_000_000_000); // Last 15 digits

    // Get current date for invoice_date
    let invoice_date = Utc::now().format("%Y-%m-%d").to_string();

    // Get account number from environment or use placeholder
    let account_number = std::env::var("TBANK_ACCOUNT_NUMBER")
        .unwrap_or_else(|_| "40802810000000000000".to_string());

    // Convert simplified request to full T-Bank format
    let tbank_request = SendB2BInvoiceRequest {
        invoice_number: invoice_number.clone(),
        due_date: request.due_date.clone(),
        invoice_date: invoice_date.clone(),
        account_number,
        payer: B2BInvoicePayer {
            name: request.counterparty.name.clone(),
            inn: request.counterparty.inn.clone(),
            kpp: request.counterparty.kpp.unwrap_or_else(|| "000000000".to_string()),
        },
        items: request.items.clone(),
        contacts: request.contacts.clone(),
        contact_phone: None,
        comment: request.comment.clone(),
        custom_payment_purpose: None,
    };

    tracing::info!(
        "Sending invoice to T-Bank API: invoice_number={}, payer_inn={}, amount={}",
        invoice_number,
        tbank_request.payer.inn,
        tbank_request.items.iter().map(|i| i.price * rust_decimal::Decimal::from(i.amount)).sum::<rust_decimal::Decimal>()
    );

    // Validate request
    if let Err(e) = tbank_request.validate() {
        tracing::error!("Invoice validation failed: {}", e);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Same Business API base URL + token as at process start (avoids drift vs TBANK_BUSINESS_API_BASE_URL typos)
    let tbank_api_url = services.config.business_api_base_url.clone();
    let tbank_api_token = services.config.api_token.clone();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| {
            tracing::error!("Failed to create HTTP client: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::debug!("Calling T-Bank API: {}/invoice/send", tbank_api_url);

    let tbank_response = client
        .post(format!("{}/invoice/send", tbank_api_url))
        .header("Authorization", format!("Bearer {}", tbank_api_token))
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&tbank_request)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to call T-Bank API: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    let status = tbank_response.status();
    let response_text = tbank_response.text().await.unwrap_or_default();

    tracing::info!(
        "T-Bank API response: status={}, body_length={}",
        status,
        response_text.len()
    );

    if !status.is_success() {
        tracing::error!(
            "T-Bank API returned error: status={}, body={}",
            status,
            response_text
        );
        
        // Try to parse error details from T-Bank response
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&response_text) {
            if let Some(error_msg) = error_json["errorMessage"].as_str() {
                tracing::error!("T-Bank error message: {}", error_msg);
            }
            if let Some(error_details) = error_json["errorDetails"]["message"].as_str() {
                tracing::error!("T-Bank error details: {}", error_details);
            }
        }
        
        return Err(StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY));
    }

    // Parse T-Bank response
    let tbank_data: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| {
            tracing::error!("Failed to parse T-Bank response: {} - body: {}", e, response_text);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!("T-Bank invoice created successfully: {:?}", tbank_data);

    // Extract data from T-Bank response
    let tbank_invoice_id = tbank_data["invoiceId"].as_str()
        .or_else(|| tbank_data["id"].as_str())
        .map(|s| s.to_string());
    let pdf_url = tbank_data["pdfUrl"].as_str().map(|s| s.to_string());
    let incoming_invoice_url = tbank_data["incomingInvoiceUrl"].as_str().map(|s| s.to_string());

    let response = B2BInvoiceResponse {
        id: Uuid::new_v4(),
        invoice_number: invoice_number.clone(),
        tbank_invoice_id,
        pdf_url,
        incoming_invoice_url,
        status: "Sent".to_string(),
        due_date: request.due_date,
        invoice_date,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Get B2B invoice by ID
/// GET /api/v1/invoices/b2b/{invoice_id}
pub async fn get_b2b_invoice(
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<B2BInvoiceResponse>, StatusCode> {
    // TODO: Implement actual invoice retrieval from database

    // Placeholder response
    let response = B2BInvoiceResponse {
        id: invoice_id,
        invoice_number: format!("INV-{}-{:03}", Utc::now().format("%Y"), 1),
        tbank_invoice_id: Some("TBANK_INV_123".to_string()),
        pdf_url: Some("https://business.tbank.ru/invoice/123.pdf".to_string()),
        incoming_invoice_url: Some("https://business.tbank.ru/invoice/123".to_string()),
        status: "Sent".to_string(),
        due_date: "2024-02-15".to_string(),
        invoice_date: "2024-01-15".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Get B2B invoice PDF
/// GET /api/v1/invoices/b2b/{invoice_id}/pdf
pub async fn get_b2b_invoice_pdf(
    Path(invoice_id): Path<Uuid>,
) -> Result<axum::response::Response, StatusCode> {
    // TODO: Implement PDF retrieval from T-Bank or local storage

    // Placeholder response
    let pdf_content = b"PDF content placeholder";

    Ok(axum::response::Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/pdf")
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"invoice_{}.pdf\"", invoice_id),
        )
        .body(axum::body::Body::from(pdf_content.to_vec()))
        .unwrap())
}

/// Update B2B invoice status
/// PUT /api/v1/invoices/b2b/{invoice_id}/status
pub async fn update_b2b_invoice_status(
    Path(invoice_id): Path<Uuid>,
    Json(request): Json<UpdateB2BInvoiceStatusRequest>,
) -> Result<Json<B2BInvoiceResponse>, StatusCode> {
    // TODO: Implement status update with validation:
    // 1. Retrieve current invoice from database
    // 2. Validate status transition using Invoice::can_transition_to
    // 3. Update status in database
    // 4. Create audit log entry

    // Placeholder response
    let response = B2BInvoiceResponse {
        id: invoice_id,
        invoice_number: format!("INV-{}-{:03}", Utc::now().format("%Y"), 1),
        tbank_invoice_id: Some("TBANK_INV_123".to_string()),
        pdf_url: Some("https://business.tbank.ru/invoice/123.pdf".to_string()),
        incoming_invoice_url: Some("https://business.tbank.ru/invoice/123".to_string()),
        status: request.status,
        due_date: "2024-02-15".to_string(),
        invoice_date: "2024-01-15".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// List B2B invoices with filtering
/// GET /api/v1/invoices/b2b
pub async fn list_b2b_invoices(
    Query(_query): Query<ListB2BInvoicesQuery>,
) -> Result<Json<Vec<B2BInvoiceResponse>>, StatusCode> {
    // TODO: Implement invoice listing with filtering:
    // 1. Apply filters from query parameters
    // 2. Retrieve invoices from database with pagination
    // 3. Return filtered results

    // Placeholder response
    let invoices = vec![B2BInvoiceResponse {
        id: Uuid::new_v4(),
        invoice_number: format!("INV-{}-{:03}", Utc::now().format("%Y"), 1),
        tbank_invoice_id: Some("TBANK_INV_123".to_string()),
        pdf_url: Some("https://business.tbank.ru/invoice/123.pdf".to_string()),
        incoming_invoice_url: Some("https://business.tbank.ru/invoice/123".to_string()),
        status: "Sent".to_string(),
        due_date: "2024-02-15".to_string(),
        invoice_date: "2024-01-15".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }];

    Ok(Json(invoices))
}

/// Create B2B invoice router
pub fn create_b2b_invoice_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/send", post(send_b2b_invoice))
        .route("/:invoice_id", get(get_b2b_invoice))
        .route("/:invoice_id/pdf", get(get_b2b_invoice_pdf))
        .route("/:invoice_id/status", put(update_b2b_invoice_status))
        .route("/", get(list_b2b_invoices))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn test_send_b2b_invoice_request_validation() {
        let valid_request = SendB2BInvoiceRequest {
            invoice_number: "INV-2024-001".to_string(),
            due_date: "2024-02-15".to_string(),
            invoice_date: "2024-01-15".to_string(),
            account_number: "40802810100000000001".to_string(),
            payer: B2BInvoicePayer {
                name: "ООО Тест".to_string(),
                inn: "7707083893".to_string(),
                kpp: "770701001".to_string(),
            },
            items: vec![B2BInvoiceItem {
                name: "Test item".to_string(),
                price: Decimal::from(10000),
                unit: "шт".to_string(),
                vat: "20".to_string(),
                amount: 1,
            }],
            contacts: vec![B2BInvoiceContact {
                email: "test@example.com".to_string(),
            }],
            contact_phone: Some("+79001234567".to_string()),
            comment: Some("Test comment".to_string()),
            custom_payment_purpose: None,
        };

        assert!(valid_request.validate().is_ok());

        // Test invalid invoice number
        let mut invalid_request = valid_request.clone();
        invalid_request.invoice_number = "".to_string();
        assert!(invalid_request.validate().is_err());

        // Test invalid date format
        let mut invalid_request = valid_request.clone();
        invalid_request.due_date = "2024/02/15".to_string();
        assert!(invalid_request.validate().is_err());

        // Test invalid account number
        let mut invalid_request = valid_request.clone();
        invalid_request.account_number = "123".to_string();
        assert!(invalid_request.validate().is_err());

        // Test invalid INN
        let mut invalid_request = valid_request.clone();
        invalid_request.payer.inn = "123".to_string();
        assert!(invalid_request.validate().is_err());

        // Test invalid KPP
        let mut invalid_request = valid_request.clone();
        invalid_request.payer.kpp = "123".to_string();
        assert!(invalid_request.validate().is_err());

        // Test too many items
        let mut invalid_request = valid_request.clone();
        invalid_request.items = (0..101)
            .map(|i| B2BInvoiceItem {
                name: format!("Item {}", i),
                price: Decimal::from(100),
                unit: "шт".to_string(),
                vat: "20".to_string(),
                amount: 1,
            })
            .collect();
        assert!(invalid_request.validate().is_err());

        // Test too many contacts
        let mut invalid_request = valid_request.clone();
        invalid_request.contacts = (0..11)
            .map(|i| B2BInvoiceContact {
                email: format!("test{}@example.com", i),
            })
            .collect();
        assert!(invalid_request.validate().is_err());
    }

    #[test]
    fn test_b2b_invoice_item_validation() {
        let valid_item = B2BInvoiceItem {
            name: "Test item".to_string(),
            price: Decimal::from(100),
            unit: "шт".to_string(),
            vat: "20".to_string(),
            amount: 1,
        };

        assert!(valid_item.validate().is_ok());

        // Test invalid VAT rate
        let mut invalid_item = valid_item.clone();
        invalid_item.vat = "25".to_string();
        assert!(invalid_item.validate().is_err());

        // Test negative price
        let mut invalid_item = valid_item.clone();
        invalid_item.price = Decimal::from(-100);
        assert!(invalid_item.validate().is_err());

        // Test zero amount
        let mut invalid_item = valid_item.clone();
        invalid_item.amount = 0;
        assert!(invalid_item.validate().is_err());
    }
}
