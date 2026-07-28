use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

/// Database model for counterparties (legal entities only)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct CounterpartyModel {
    pub id: Uuid,
    pub inn: String,
    pub kpp: Option<String>,
    pub full_name: String,
    pub short_name: Option<String>,
    pub legal_address: Option<String>,
    pub status: String,
    pub registration_date: Option<DateTime<Utc>>,
    #[ts(type = "any")]
    pub okved_codes: Option<serde_json::Value>,
    pub verified_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Database model for B2B invoices
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct B2BInvoiceModel {
    pub id: Uuid,
    pub invoice_number: String,
    pub tbank_invoice_id: Option<String>,
    pub counterparty_inn: String,
    pub counterparty_kpp: Option<String>,
    pub counterparty_name: String,
    pub due_date: chrono::NaiveDate,
    pub invoice_date: Option<chrono::NaiveDate>,
    pub account_number: Option<String>,
    #[ts(type = "string")]
    pub total_amount: Decimal,
    pub status: String,
    pub pdf_url: Option<String>,
    pub incoming_invoice_url: Option<String>,
    pub comment: Option<String>,
    pub custom_payment_purpose: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Database model for B2B invoice items
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct B2BInvoiceItemModel {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub name: String,
    #[ts(type = "string")]
    pub price: Decimal,
    pub unit: String,
    pub vat_rate: String,
    pub amount: i32,
    #[ts(type = "string")]
    pub total_price: Decimal,
    pub created_at: DateTime<Utc>,
}

/// Database model for B2B invoice contacts
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct B2BInvoiceContactModel {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub email: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Database model for acquiring payments
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct AcquiringPaymentModel {
    pub id: Uuid,
    pub order_id: String,
    pub tbank_payment_id: Option<String>,
    #[ts(type = "string")]
    pub amount: Decimal,
    pub currency: String,
    pub payment_method: String,
    pub status: String,
    pub description: Option<String>,
    pub customer_email: Option<String>,
    pub customer_phone: Option<String>,
    pub payment_url: Option<String>,
    pub qr_code: Option<String>,
    pub expires_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub commission_amount: Option<Decimal>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Database model for financial audit records
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct FinancialAuditModel {
    pub id: Uuid,
    pub transaction_id: String,
    pub transaction_type: String, // 'B2B_INVOICE' | 'ACQUIRING_PAYMENT'
    #[ts(type = "string")]
    pub amount: Decimal,
    pub currency: String,
    pub counterparty_inn: Option<String>,
    pub operation_date: DateTime<Utc>,
    pub status: String,
    pub reconciled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Database model for audit logs
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct AuditLogModel {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
    pub operation_type: String,
    pub entity_type: String, // 'B2B_INVOICE' | 'ACQUIRING_PAYMENT' | 'COUNTERPARTY'
    pub entity_id: String,
    #[ts(type = "any")]
    pub old_values: Option<serde_json::Value>,
    #[ts(type = "any")]
    pub new_values: Option<serde_json::Value>,
    pub changed_fields: Vec<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub hash: String,
    pub created_at: DateTime<Utc>,
}

/// Database model for webhook events with webhook_type field
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/tbank-integration/")]
pub struct WebhookEventModel {
    pub id: Uuid,
    pub event_id: String,
    pub event_type: String,
    pub webhook_type: String, // 'B2B' | 'Acquiring'
    pub entity_id: String,
    pub status: String,
    #[ts(type = "any")]
    pub payload: serde_json::Value,
    pub processing_status: String,
    pub retry_count: i32,
    pub processed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
