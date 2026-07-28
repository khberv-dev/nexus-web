use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// T-Bank Acquiring API payment status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankPaymentStatusResponse {
    #[serde(rename = "Success")]
    pub success: bool,
    #[serde(rename = "ErrorCode")]
    pub error_code: Option<String>,
    #[serde(rename = "Message")]
    pub message: Option<String>,
    #[serde(rename = "Details")]
    pub details: Option<String>,
    #[serde(rename = "TerminalKey")]
    pub terminal_key: Option<String>,
    #[serde(rename = "Status")]
    pub status: Option<String>,
    #[serde(rename = "PaymentId")]
    pub payment_id: Option<String>,
    #[serde(rename = "OrderId")]
    pub order_id: Option<String>,
    #[serde(rename = "Amount")]
    pub amount: Option<u64>,
    #[serde(rename = "Pan")]
    pub pan: Option<String>,
    #[serde(rename = "ExpDate")]
    pub exp_date: Option<String>,
    #[serde(rename = "CardId")]
    pub card_id: Option<String>,
}

/// T-Bank Acquiring API payment initialization response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankPaymentInitResponse {
    #[serde(rename = "Success")]
    pub success: bool,
    #[serde(rename = "ErrorCode")]
    pub error_code: Option<String>,
    #[serde(rename = "Message")]
    pub message: Option<String>,
    #[serde(rename = "Details")]
    pub details: Option<String>,
    #[serde(rename = "TerminalKey")]
    pub terminal_key: Option<String>,
    #[serde(rename = "Amount")]
    pub amount: Option<u64>,
    #[serde(rename = "OrderId")]
    pub order_id: Option<String>,
    #[serde(rename = "PaymentId")]
    pub payment_id: Option<String>,
    #[serde(rename = "PaymentURL")]
    pub payment_url: Option<String>,
}

/// Payment completion configuration
#[derive(Debug, Clone)]
pub struct PaymentCompletionConfig {
    pub terminal_key: String,
    pub password: String,
    pub base_url: String,
    pub timeout_seconds: u64,
    pub max_retries: u32,
}

impl Default for PaymentCompletionConfig {
    fn default() -> Self {
        Self {
            terminal_key: String::new(),
            password: String::new(),
            base_url: "https://securepay.tinkoff.ru/v2".to_string(),
            timeout_seconds: 30,
            max_retries: 3,
        }
    }
}

/// Payment completion result
#[derive(Debug, Clone)]
pub struct PaymentCompletionResult {
    pub payment_id: String,
    pub status: String,
    pub amount: Option<Decimal>,
    pub completed_at: DateTime<Utc>,
    pub transaction_details: Option<HashMap<String, String>>,
}

/// Payment status check result
#[derive(Debug, Clone)]
pub struct PaymentStatusResult {
    pub payment_id: String,
    pub status: String,
    pub amount: Option<Decimal>,
    pub last_updated: DateTime<Utc>,
    pub error_details: Option<String>,
}