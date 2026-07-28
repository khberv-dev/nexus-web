use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
    pub correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CounterpartyResponse {
    pub inn: String,
    pub kpp: Option<String>,
    pub full_name: String,
    pub short_name: String,
    pub legal_address: String,
    pub status: String,
    pub registration_date: DateTime<Utc>,
    pub okved_codes: Vec<String>,
    pub verified_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceResponse {
    pub id: Uuid,
    pub invoice_number: String,
    pub counterparty_inn: String,
    pub amount: Decimal,
    pub currency: String,
    pub description: String,
    pub due_date: DateTime<Utc>,
    pub status: String,
    pub payment_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentResponse {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub transaction_id: String,
    pub amount: Decimal,
    pub currency: String,
    pub payment_method: String,
    pub status: String,
    pub payment_url: Option<String>,
    pub qr_code: Option<String>,
    pub expires_at: DateTime<Utc>,
}
