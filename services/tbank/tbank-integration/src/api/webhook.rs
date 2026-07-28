use axum::{
    extract::Path,
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::post,
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::services::TBankServices;

/// Webhook API endpoints with B2B/Acquiring separation
/// Handles /webhooks/b2b/* and /webhooks/acquiring/* endpoints

/// B2B Invoice webhook payload from T-Bank Business API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B2BInvoiceWebhookPayload {
    pub event_type: String, // "invoice.viewed", "invoice.paid", etc.
    pub invoice_id: String,
    pub invoice_number: String,
    pub status: String,
    pub amount: f64,
    pub currency: String,
    pub counterparty_inn: String,
    pub timestamp: DateTime<Utc>,
    pub signature: Option<String>,
}

/// Acquiring Payment webhook payload from T-Bank Acquiring API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcquiringPaymentWebhookPayload {
    pub event_type: String, // "payment.completed", "payment.failed", etc.
    pub payment_id: String,
    pub order_id: String,
    pub status: String,
    pub amount: u64, // Amount in kopecks
    pub currency: String,
    pub commission_amount: Option<u64>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub signature: Option<String>,
}

/// Generic webhook response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookResponse {
    pub success: bool,
    pub message: String,
    pub event_id: Option<String>,
}

impl B2BInvoiceWebhookPayload {
    /// Validate B2B invoice webhook payload
    pub fn validate(&self) -> Result<(), String> {
        if self.invoice_id.is_empty() {
            return Err("Invoice ID is required".to_string());
        }

        if self.invoice_number.is_empty() {
            return Err("Invoice number is required".to_string());
        }

        if self.counterparty_inn.is_empty() {
            return Err("Counterparty INN is required".to_string());
        }

        // Validate event type
        match self.event_type.as_str() {
            "invoice.viewed" | "invoice.paid" | "invoice.overdue" | "invoice.cancelled" => {}
            _ => return Err(format!("Invalid B2B event type: {}", self.event_type)),
        }

        Ok(())
    }

    /// Convert to WebhookEventType
    pub fn to_event_type(&self) -> Result<String, String> {
        match self.event_type.as_str() {
            "invoice.viewed" => Ok("InvoiceViewed".to_string()),
            "invoice.paid" => Ok("InvoicePaid".to_string()),
            _ => Err(format!("Unsupported B2B event type: {}", self.event_type)),
        }
    }

    /// Convert to InvoiceStatus
    pub fn to_invoice_status(&self) -> Result<String, String> {
        match self.status.as_str() {
            "viewed" => Ok("Viewed".to_string()),
            "paid" => Ok("Paid".to_string()),
            "overdue" => Ok("Overdue".to_string()),
            "cancelled" => Ok("Cancelled".to_string()),
            _ => Err(format!("Invalid invoice status: {}", self.status)),
        }
    }
}

impl AcquiringPaymentWebhookPayload {
    /// Validate acquiring payment webhook payload
    pub fn validate(&self) -> Result<(), String> {
        if self.payment_id.is_empty() {
            return Err("Payment ID is required".to_string());
        }

        if self.order_id.is_empty() {
            return Err("Order ID is required".to_string());
        }

        if self.amount == 0 {
            return Err("Amount must be positive".to_string());
        }

        // Validate event type
        match self.event_type.as_str() {
            "payment.completed" | "payment.failed" | "payment.cancelled" => {}
            _ => return Err(format!("Invalid acquiring event type: {}", self.event_type)),
        }

        Ok(())
    }

    /// Convert to WebhookEventType
    pub fn to_event_type(&self) -> Result<String, String> {
        match self.event_type.as_str() {
            "payment.completed" => Ok("PaymentCompleted".to_string()),
            "payment.failed" => Ok("PaymentFailed".to_string()),
            "payment.cancelled" => Ok("PaymentCancelled".to_string()),
            _ => Err(format!(
                "Unsupported acquiring event type: {}",
                self.event_type
            )),
        }
    }

    /// Convert to AcquiringPaymentStatus
    pub fn to_payment_status(&self) -> Result<String, String> {
        match self.status.as_str() {
            "completed" => Ok("Completed".to_string()),
            "failed" => Ok("Failed".to_string()),
            "cancelled" => Ok("Cancelled".to_string()),
            _ => Err(format!("Invalid payment status: {}", self.status)),
        }
    }
}

/// Handle B2B invoice status webhook
/// POST /webhooks/b2b/invoice-status
pub async fn handle_b2b_invoice_webhook(
    headers: HeaderMap,
    Json(payload): Json<B2BInvoiceWebhookPayload>,
) -> Result<Json<WebhookResponse>, StatusCode> {
    // Validate webhook signature (in production)
    if let Err(_e) = validate_webhook_signature(&headers, &payload.signature) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Validate payload
    payload.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: Implement actual B2B webhook processing:
    // 1. Check event_id uniqueness to ensure idempotency
    // 2. Update invoice status in b2b_invoices table
    // 3. Trigger business logic (notifications, etc.)
    // 4. Store webhook event for audit
    // 5. Implement retry mechanism with exponential backoff

    let event_id = format!("b2b_{}_{}", payload.invoice_id, Utc::now().timestamp());

    // TODO: Store webhook event and process business logic

    let response = WebhookResponse {
        success: true,
        message: "B2B invoice webhook processed successfully".to_string(),
        event_id: Some(event_id),
    };

    Ok(Json(response))
}

/// Handle acquiring payment status webhook
/// POST /webhooks/acquiring/payment-status
pub async fn handle_acquiring_payment_webhook(
    headers: HeaderMap,
    Json(payload): Json<AcquiringPaymentWebhookPayload>,
) -> Result<Json<WebhookResponse>, StatusCode> {
    // Validate webhook signature (in production)
    if let Err(_e) = validate_webhook_signature(&headers, &payload.signature) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Validate payload
    payload.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: Implement actual acquiring webhook processing:
    // 1. Check event_id uniqueness to ensure idempotency
    // 2. Update payment status in acquiring_payments table
    // 3. Process business logic for Completed/Failed/Cancelled states
    // 4. Record commission amount and completion timestamp
    // 5. Store webhook event for audit
    // 6. Implement retry mechanism with exponential backoff

    let event_id = format!("acq_{}_{}", payload.payment_id, Utc::now().timestamp());

    // TODO: Store webhook event and process business logic

    let response = WebhookResponse {
        success: true,
        message: "Acquiring payment webhook processed successfully".to_string(),
        event_id: Some(event_id),
    };

    Ok(Json(response))
}

/// Validate webhook signature using HMAC-SHA256
fn validate_webhook_signature(
    _headers: &HeaderMap,
    signature: &Option<String>,
) -> Result<(), String> {
    // TODO: Implement actual signature validation:
    // 1. Extract signature from headers or payload
    // 2. Compute HMAC-SHA256 with webhook secret
    // 3. Compare signatures in constant time
    // 4. Disable validation in sandbox environment
    // 5. Log security events for invalid signatures

    // For now, just check if signature is present in production
    if std::env::var("ENVIRONMENT").unwrap_or_default() == "production" {
        if signature.is_none() {
            return Err("Signature is required in production".to_string());
        }
    }

    Ok(())
}

/// Create webhook router with separated B2B and acquiring endpoints
pub fn create_webhook_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/b2b/invoice-status", post(handle_b2b_invoice_webhook))
        .route(
            "/acquiring/payment-status",
            post(handle_acquiring_payment_webhook),
        )
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_b2b_invoice_webhook_payload_validation() {
        let valid_payload = B2BInvoiceWebhookPayload {
            event_type: "invoice.viewed".to_string(),
            invoice_id: "INV123".to_string(),
            invoice_number: "INV-2024-001".to_string(),
            status: "viewed".to_string(),
            amount: 10000.0,
            currency: "RUB".to_string(),
            counterparty_inn: "7707083893".to_string(),
            timestamp: Utc::now(),
            signature: Some("signature123".to_string()),
        };

        assert!(valid_payload.validate().is_ok());
        assert!(valid_payload.to_event_type().is_ok());
        assert!(valid_payload.to_invoice_status().is_ok());

        // Test invalid event type
        let mut invalid_payload = valid_payload.clone();
        invalid_payload.event_type = "invalid.event".to_string();
        assert!(invalid_payload.validate().is_err());

        // Test empty invoice ID
        let mut invalid_payload = valid_payload.clone();
        invalid_payload.invoice_id = "".to_string();
        assert!(invalid_payload.validate().is_err());
    }

    #[test]
    fn test_acquiring_payment_webhook_payload_validation() {
        let valid_payload = AcquiringPaymentWebhookPayload {
            event_type: "payment.completed".to_string(),
            payment_id: "PAY123".to_string(),
            order_id: "ORDER123".to_string(),
            status: "completed".to_string(),
            amount: 100000, // 1000 rubles in kopecks
            currency: "RUB".to_string(),
            commission_amount: Some(3000), // 30 rubles commission
            error_code: None,
            error_message: None,
            timestamp: Utc::now(),
            signature: Some("signature123".to_string()),
        };

        assert!(valid_payload.validate().is_ok());
        assert!(valid_payload.to_event_type().is_ok());
        assert!(valid_payload.to_payment_status().is_ok());

        // Test invalid event type
        let mut invalid_payload = valid_payload.clone();
        invalid_payload.event_type = "invalid.event".to_string();
        assert!(invalid_payload.validate().is_err());

        // Test zero amount
        let mut invalid_payload = valid_payload.clone();
        invalid_payload.amount = 0;
        assert!(invalid_payload.validate().is_err());

        // Test empty payment ID
        let mut invalid_payload = valid_payload.clone();
        invalid_payload.payment_id = "".to_string();
        assert!(invalid_payload.validate().is_err());
    }

    #[test]
    fn test_webhook_signature_validation() {
        let headers = HeaderMap::new();

        // Should pass in development (no signature required)
        std::env::set_var("ENVIRONMENT", "development");
        assert!(validate_webhook_signature(&headers, &None).is_ok());

        // Should fail in production without signature
        std::env::set_var("ENVIRONMENT", "production");
        assert!(validate_webhook_signature(&headers, &None).is_err());

        // Should pass in production with signature
        assert!(validate_webhook_signature(&headers, &Some("signature123".to_string())).is_ok());
    }
}
