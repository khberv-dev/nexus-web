use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::{DateTime, Utc};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use std::sync::Arc;

use crate::services::TBankServices;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Acquiring Payment API endpoints for физические лица
/// Handles /api/v1/payments/acquiring/* endpoints

/// T-Bank API request for payment initialization (Init method)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankInitPaymentRequest {
    #[serde(rename = "TerminalKey")]
    pub terminal_key: String,
    #[serde(rename = "Amount")]
    pub amount: u64, // Amount in kopecks
    #[serde(rename = "OrderId")]
    pub order_id: String,
    #[serde(rename = "Token")]
    pub token: String,
    #[serde(rename = "Description")]
    pub description: String,
    #[serde(rename = "CustomerKey", skip_serializing_if = "Option::is_none")]
    pub customer_key: Option<String>,
    #[serde(rename = "Recurrent", skip_serializing_if = "Option::is_none")]
    pub recurrent: Option<String>,
    #[serde(rename = "PayType", skip_serializing_if = "Option::is_none")]
    pub pay_type: Option<String>,
    #[serde(rename = "Language", skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(rename = "NotificationURL", skip_serializing_if = "Option::is_none")]
    pub notification_url: Option<String>,
    #[serde(rename = "SuccessURL", skip_serializing_if = "Option::is_none")]
    pub success_url: Option<String>,
    #[serde(rename = "FailURL", skip_serializing_if = "Option::is_none")]
    pub fail_url: Option<String>,
    #[serde(rename = "RedirectDueDate", skip_serializing_if = "Option::is_none")]
    pub redirect_due_date: Option<DateTime<Utc>>,
    #[serde(rename = "DATA", skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(rename = "Receipt", skip_serializing_if = "Option::is_none")]
    pub receipt: Option<TBankReceipt>,
}

/// T-Bank API response for payment initialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankInitPaymentResponse {
    #[serde(rename = "Success")]
    pub success: bool,
    #[serde(rename = "ErrorCode")]
    pub error_code: String,
    #[serde(rename = "TerminalKey")]
    pub terminal_key: String,
    #[serde(rename = "Status")]
    pub status: String,
    #[serde(rename = "PaymentId")]
    pub payment_id: String,
    #[serde(rename = "OrderId")]
    pub order_id: String,
    #[serde(rename = "Amount")]
    pub amount: u64,
    #[serde(rename = "PaymentURL")]
    pub payment_url: String,
}

/// T-Bank receipt structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankReceipt {
    #[serde(rename = "Email", skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(rename = "Phone", skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(rename = "Taxation")]
    pub taxation: String,
    #[serde(rename = "Items")]
    pub items: Vec<TBankReceiptItem>,
}

/// T-Bank receipt item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankReceiptItem {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Price")]
    pub price: u64, // Price in kopecks
    #[serde(rename = "Quantity")]
    pub quantity: f64,
    #[serde(rename = "Amount")]
    pub amount: u64, // Amount in kopecks
    #[serde(rename = "Tax")]
    pub tax: String,
    #[serde(rename = "PaymentMethod", skip_serializing_if = "Option::is_none")]
    pub payment_method: Option<String>,
    #[serde(rename = "PaymentObject", skip_serializing_if = "Option::is_none")]
    pub payment_object: Option<String>,
    #[serde(rename = "Ean13", skip_serializing_if = "Option::is_none")]
    pub ean13: Option<String>,
}

/// Request to initialize acquiring payment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitAcquiringPaymentRequest {
    pub order_id: String,
    pub amount: Decimal,
    pub currency: String,
    pub payment_method: String,
    pub description: Option<String>,
    pub customer_email: Option<String>,
    pub customer_phone: Option<String>,
    pub success_url: Option<String>,
    pub fail_url: Option<String>,
    pub notification_url: Option<String>,
}

/// Response for acquiring payment operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcquiringPaymentResponse {
    pub id: Uuid,
    pub order_id: String,
    pub tbank_payment_id: Option<String>,
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
    pub commission_amount: Option<Decimal>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Query parameters for listing acquiring payments
#[derive(Debug, Deserialize)]
pub struct ListAcquiringPaymentsQuery {
    pub status: Option<String>,
    pub payment_method: Option<String>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl TBankInitPaymentRequest {
    /// Create new T-Bank payment initialization request
    pub fn new(
        terminal_key: String,
        order_id: String,
        amount: Decimal,
        description: String,
        customer_email: Option<String>,
        customer_phone: Option<String>,
    ) -> Self {
        // Convert amount from rubles to kopecks
        let amount_kopecks = (amount * Decimal::from(100)).to_u64().unwrap_or(0);

        // Generate token (simplified - in real implementation should use proper signing)
        let token = Self::generate_token(&terminal_key, amount_kopecks, &order_id);

        // Create receipt if we have customer contact info
        let receipt = if customer_email.is_some() || customer_phone.is_some() {
            Some(TBankReceipt {
                email: customer_email.clone(),
                phone: customer_phone.clone(),
                taxation: "osn".to_string(), // Default taxation system
                items: vec![TBankReceiptItem {
                    name: description.clone(),
                    price: amount_kopecks,
                    quantity: 1.0,
                    amount: amount_kopecks,
                    tax: "vat20".to_string(), // Default VAT rate
                    payment_method: Some("full_payment".to_string()),
                    payment_object: Some("service".to_string()),
                    ean13: None,
                }],
            })
        } else {
            None
        };

        Self {
            terminal_key,
            amount: amount_kopecks,
            order_id,
            token,
            description,
            customer_key: None,
            recurrent: None,
            pay_type: Some("O".to_string()), // One-stage payment
            language: Some("ru".to_string()),
            notification_url: None,
            success_url: None,
            fail_url: None,
            redirect_due_date: None,
            data: None,
            receipt,
        }
    }

    /// Generate token for request signing (simplified implementation)
    /// In production, this should use proper HMAC-SHA256 signing with secret key
    fn generate_token(terminal_key: &str, amount: u64, order_id: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        terminal_key.hash(&mut hasher);
        amount.hash(&mut hasher);
        order_id.hash(&mut hasher);

        format!("{:x}", hasher.finish())
    }

    /// Validate the request
    pub fn validate(&self) -> Result<(), String> {
        if self.terminal_key.is_empty() {
            return Err("TerminalKey is required".to_string());
        }

        if self.terminal_key.len() > 20 {
            return Err("TerminalKey must be <= 20 characters".to_string());
        }

        if self.amount == 0 {
            return Err("Amount must be positive".to_string());
        }

        if self.order_id.is_empty() {
            return Err("OrderId is required".to_string());
        }

        if self.order_id.len() > 36 {
            return Err("OrderId must be <= 36 characters".to_string());
        }

        if self.description.len() > 140 {
            return Err("Description must be <= 140 characters".to_string());
        }

        Ok(())
    }

    /// Set notification URL
    pub fn with_notification_url(mut self, url: String) -> Self {
        self.notification_url = Some(url);
        self
    }

    /// Set success URL
    pub fn with_success_url(mut self, url: String) -> Self {
        self.success_url = Some(url);
        self
    }

    /// Set fail URL
    pub fn with_fail_url(mut self, url: String) -> Self {
        self.fail_url = Some(url);
        self
    }

    /// Set customer key for recurring payments
    pub fn with_customer_key(mut self, customer_key: String) -> Self {
        self.customer_key = Some(customer_key);
        self
    }
}

impl TBankInitPaymentResponse {
    /// Check if the payment initialization was successful
    pub fn is_success(&self) -> bool {
        self.success && self.error_code == "0"
    }

    /// Get payment status
    pub fn get_status(&self) -> &str {
        &self.status
    }
}

impl InitAcquiringPaymentRequest {
    /// Validate the acquiring payment request
    pub fn validate(&self) -> Result<(), String> {
        if self.amount <= Decimal::ZERO {
            return Err("Amount must be positive".to_string());
        }

        if self.order_id.is_empty() {
            return Err("Order ID is required".to_string());
        }

        if self.order_id.len() > 36 {
            return Err("Order ID must be <= 36 characters".to_string());
        }

        // Validate email format if provided
        if let Some(ref email) = self.customer_email {
            if !email.contains('@') {
                return Err("Invalid email format".to_string());
            }
        }

        // Validate phone format if provided (Russian format)
        if let Some(ref phone) = self.customer_phone {
            if !phone.starts_with("+7") || phone.len() != 12 {
                return Err("Phone must be in format +7XXXXXXXXXX".to_string());
            }
        }

        Ok(())
    }
}

/// Initialize acquiring payment for физическое лицо
/// POST /api/v1/payments/acquiring/init
pub async fn init_acquiring_payment(
    Json(request): Json<InitAcquiringPaymentRequest>,
) -> Result<Json<AcquiringPaymentResponse>, StatusCode> {
    // Validate request
    request.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: Implement actual acquiring payment initialization:
    // 1. Initialize payment via T-Bank Acquiring API using POST /Init
    // 2. Store payment details in acquiring_payments table
    // 3. Return response with payment_url, QR code, and transaction_id

    // Placeholder response
    let response = AcquiringPaymentResponse {
        id: Uuid::new_v4(),
        order_id: request.order_id,
        tbank_payment_id: Some("TBANK_PAY_123".to_string()),
        amount: request.amount,
        currency: request.currency,
        payment_method: request.payment_method,
        status: "Initialized".to_string(),
        description: request.description,
        customer_email: request.customer_email,
        customer_phone: request.customer_phone,
        payment_url: Some("https://pay.tbank.ru/form/123".to_string()),
        qr_code: Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()),
        expires_at: Utc::now() + chrono::Duration::hours(1),
        commission_amount: None,
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Get acquiring payment by ID
/// GET /api/v1/payments/acquiring/{payment_id}
pub async fn get_acquiring_payment(
    Path(payment_id): Path<Uuid>,
) -> Result<Json<AcquiringPaymentResponse>, StatusCode> {
    // TODO: Implement actual payment retrieval from database

    // Placeholder response
    let response = AcquiringPaymentResponse {
        id: payment_id,
        order_id: "ORDER_123".to_string(),
        tbank_payment_id: Some("TBANK_PAY_123".to_string()),
        amount: Decimal::from(1000),
        currency: "RUB".to_string(),
        payment_method: "Card".to_string(),
        status: "Pending".to_string(),
        description: Some("Test payment".to_string()),
        customer_email: Some("test@example.com".to_string()),
        customer_phone: Some("+79001234567".to_string()),
        payment_url: Some("https://pay.tbank.ru/form/123".to_string()),
        qr_code: Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()),
        expires_at: Utc::now() + chrono::Duration::hours(1),
        commission_amount: None,
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Retry acquiring payment
/// POST /api/v1/payments/acquiring/{payment_id}/retry
pub async fn retry_acquiring_payment(
    Path(payment_id): Path<Uuid>,
) -> Result<Json<AcquiringPaymentResponse>, StatusCode> {
    // TODO: Implement payment retry logic:
    // 1. Check if payment can be retried (Failed/Expired/Cancelled status)
    // 2. Create new payment initialization with same parameters
    // 3. Update payment record with new URLs and expiration

    // Placeholder response
    let response = AcquiringPaymentResponse {
        id: payment_id,
        order_id: "ORDER_123".to_string(),
        tbank_payment_id: Some("TBANK_PAY_124".to_string()),
        amount: Decimal::from(1000),
        currency: "RUB".to_string(),
        payment_method: "Card".to_string(),
        status: "Initialized".to_string(),
        description: Some("Test payment (retry)".to_string()),
        customer_email: Some("test@example.com".to_string()),
        customer_phone: Some("+79001234567".to_string()),
        payment_url: Some("https://pay.tbank.ru/form/124".to_string()),
        qr_code: Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()),
        expires_at: Utc::now() + chrono::Duration::hours(1),
        commission_amount: None,
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// List acquiring payments with filtering
/// GET /api/v1/payments/acquiring
pub async fn list_acquiring_payments(
    Query(_query): Query<ListAcquiringPaymentsQuery>,
) -> Result<Json<Vec<AcquiringPaymentResponse>>, StatusCode> {
    // TODO: Implement payment listing with filtering:
    // 1. Apply filters from query parameters
    // 2. Retrieve payments from database with pagination
    // 3. Return filtered results

    // Placeholder response
    let payments = vec![AcquiringPaymentResponse {
        id: Uuid::new_v4(),
        order_id: "ORDER_123".to_string(),
        tbank_payment_id: Some("TBANK_PAY_123".to_string()),
        amount: Decimal::from(1000),
        currency: "RUB".to_string(),
        payment_method: "Card".to_string(),
        status: "Completed".to_string(),
        description: Some("Test payment".to_string()),
        customer_email: Some("test@example.com".to_string()),
        customer_phone: Some("+79001234567".to_string()),
        payment_url: Some("https://pay.tbank.ru/form/123".to_string()),
        qr_code: None,
        expires_at: Utc::now() + chrono::Duration::hours(1),
        commission_amount: Some(Decimal::from(30)),
        completed_at: Some(Utc::now()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }];

    Ok(Json(payments))
}

/// Create acquiring payment router
pub fn create_acquiring_payment_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/init", post(init_acquiring_payment))
        .route("/:payment_id", get(get_acquiring_payment))
        .route("/:payment_id/retry", post(retry_acquiring_payment))
        .route("/", get(list_acquiring_payments))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn test_tbank_payment_request_creation() {
        let request = TBankInitPaymentRequest::new(
            "TestTerminal".to_string(),
            "ORDER123".to_string(),
            Decimal::from(1000), // 1000 rubles
            "Test payment".to_string(),
            Some("test@example.com".to_string()),
            Some("+79001234567".to_string()),
        );

        assert_eq!(request.terminal_key, "TestTerminal");
        assert_eq!(request.order_id, "ORDER123");
        assert_eq!(request.amount, 100000); // 1000 rubles = 100000 kopecks
        assert_eq!(request.description, "Test payment");
        assert!(request.receipt.is_some());
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_init_acquiring_payment_request_validation() {
        let valid_request = InitAcquiringPaymentRequest {
            order_id: "ORDER123".to_string(),
            amount: Decimal::from(1000),
            currency: "RUB".to_string(),
            payment_method: "Card".to_string(),
            description: Some("Test payment".to_string()),
            customer_email: Some("test@example.com".to_string()),
            customer_phone: Some("+79001234567".to_string()),
            success_url: None,
            fail_url: None,
            notification_url: None,
        };

        assert!(valid_request.validate().is_ok());

        // Test negative amount
        let mut invalid_request = valid_request.clone();
        invalid_request.amount = Decimal::from(-100);
        assert!(invalid_request.validate().is_err());

        // Test empty order ID
        let mut invalid_request = valid_request.clone();
        invalid_request.order_id = "".to_string();
        assert!(invalid_request.validate().is_err());

        // Test invalid email
        let mut invalid_request = valid_request.clone();
        invalid_request.customer_email = Some("invalid-email".to_string());
        assert!(invalid_request.validate().is_err());

        // Test invalid phone
        let mut invalid_request = valid_request.clone();
        invalid_request.customer_phone = Some("123456".to_string());
        assert!(invalid_request.validate().is_err());
    }

    #[test]
    fn test_tbank_payment_response_success_check() {
        let response = TBankInitPaymentResponse {
            success: true,
            error_code: "0".to_string(),
            terminal_key: "TestTerminal".to_string(),
            status: "NEW".to_string(),
            payment_id: "123456".to_string(),
            order_id: "ORDER123".to_string(),
            amount: 100000,
            payment_url: "https://pay.tbank.ru/test".to_string(),
        };

        assert!(response.is_success());
        assert_eq!(response.get_status(), "NEW");

        let failed_response = TBankInitPaymentResponse {
            success: false,
            error_code: "1001".to_string(),
            terminal_key: "TestTerminal".to_string(),
            status: "REJECTED".to_string(),
            payment_id: "123456".to_string(),
            order_id: "ORDER123".to_string(),
            amount: 100000,
            payment_url: "".to_string(),
        };

        assert!(!failed_response.is_success());
    }

    #[test]
    fn test_amount_conversion() {
        let request = TBankInitPaymentRequest::new(
            "TestTerminal".to_string(),
            "ORDER123".to_string(),
            Decimal::new(12345, 2), // 123.45 rubles
            "Test payment".to_string(),
            None,
            None,
        );

        assert_eq!(request.amount, 12345); // 123.45 rubles = 12345 kopecks
    }

    #[test]
    fn test_builder_methods() {
        let request = TBankInitPaymentRequest::new(
            "TestTerminal".to_string(),
            "ORDER123".to_string(),
            Decimal::from(1000),
            "Test payment".to_string(),
            None,
            None,
        )
        .with_notification_url("https://example.com/notify".to_string())
        .with_success_url("https://example.com/success".to_string())
        .with_fail_url("https://example.com/fail".to_string())
        .with_customer_key("CUSTOMER123".to_string());

        assert_eq!(
            request.notification_url,
            Some("https://example.com/notify".to_string())
        );
        assert_eq!(
            request.success_url,
            Some("https://example.com/success".to_string())
        );
        assert_eq!(
            request.fail_url,
            Some("https://example.com/fail".to_string())
        );
        assert_eq!(request.customer_key, Some("CUSTOMER123".to_string()));
    }
}
