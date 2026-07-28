use crate::types::acquiring::methods::AcquiringPaymentMethod as PaymentMethod;
use crate::types::acquiring::payment::AcquiringPaymentInitializationRequest as PaymentInitializationRequest;
use crate::types::common::errors::TBankError;
use chrono::{DateTime, Utc};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// T-Bank Acquiring API initialization request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankInitRequest {
    #[serde(rename = "TerminalKey")]
    pub terminal_key: String,
    #[serde(rename = "Amount")]
    pub amount: u64, // Amount in kopecks
    #[serde(rename = "OrderId")]
    pub order_id: String,
    #[serde(rename = "Description")]
    pub description: String,
    #[serde(rename = "PayType")]
    pub pay_type: Option<String>,
    #[serde(rename = "CustomerKey")]
    pub customer_key: Option<String>,
    #[serde(rename = "Recurrent")]
    pub recurrent: Option<String>,
    #[serde(rename = "RedirectDueDate")]
    pub redirect_due_date: Option<String>,
    #[serde(rename = "NotificationURL")]
    pub notification_url: Option<String>,
    #[serde(rename = "SuccessURL")]
    pub success_url: Option<String>,
    #[serde(rename = "FailURL")]
    pub fail_url: Option<String>,
    #[serde(rename = "Token")]
    pub token: String,
}

/// T-Bank Acquiring API initialization response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankInitResponse {
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
    #[serde(rename = "PaymentURL")]
    pub payment_url: Option<String>,
    #[serde(rename = "QrCode")]
    pub qr_code: Option<String>,
}

/// Payment initialization service for T-Bank Acquiring API
/// Handles POST /Init endpoint for payment initialization
/// Requirements: 3.2, 3.3
pub struct PaymentInitializationService {
    terminal_key: String,
    password: String,
    base_url: String,
    http_client: reqwest::Client,
}

impl PaymentInitializationService {
    /// Create a new payment initialization service
    pub fn new(terminal_key: String, password: String, base_url: String) -> Self {
        Self {
            terminal_key,
            password,
            base_url,
            http_client: reqwest::Client::new(),
        }
    }

    /// Initialize payment through T-Bank Acquiring API
    /// Creates payment_url, QR codes, transaction_id through POST /Init
    /// Handles expiration time (1 hour by default)
    /// Uses Terminal-Key authentication
    /// Requirements: 3.2, 3.3
    pub async fn initialize_payment(
        &self,
        request: &PaymentInitializationRequest,
        amount: Decimal,
        description: String,
        customer_email: Option<String>,
    ) -> Result<PaymentInitializationResponse, TBankError> {
        // Generate unique order ID if not provided
        let order_id = if request.order_id.is_empty() {
            Uuid::new_v4().to_string()
        } else {
            request.order_id.clone()
        };

        // Convert amount to kopecks (T-Bank API expects kopecks)
        let amount_kopecks = (amount * Decimal::from(100)).to_u64().unwrap_or(0);

        // Calculate expiration time (1 hour by default)
        let expires_at = Utc::now() + chrono::Duration::hours(1);

        // Build T-Bank API request
        let mut tbank_request = TBankInitRequest {
            terminal_key: self.terminal_key.clone(),
            amount: amount_kopecks,
            order_id: order_id.clone(),
            description,
            pay_type: self.get_pay_type(&request.payment_method),
            customer_key: customer_email,
            recurrent: None,
            redirect_due_date: Some(self.format_due_date(expires_at)),
            notification_url: request.notification_url.clone(),
            success_url: request.success_url.clone(),
            fail_url: request.failure_url.clone(),
            token: String::new(), // Will be calculated
        };

        // Calculate token for Terminal-Key authentication
        tbank_request.token = self.calculate_token(&tbank_request)?;

        // Send request to T-Bank API POST /Init endpoint
        let url = format!("{}/Init", self.base_url);
        let response = self
            .http_client
            .post(&url)
            .header("Terminal-Key", &self.terminal_key)
            .json(&tbank_request)
            .send()
            .await
            .map_err(|e| TBankError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(TBankError::TBankApiError {
                status: response.status().as_u16(),
                message: format!("HTTP error: {}", response.status()),
                error_code: None,
            });
        }

        let tbank_response: TBankInitResponse = response
            .json()
            .await
            .map_err(|e| TBankError::ParseError(e.to_string()))?;

        if !tbank_response.success {
            return Err(TBankError::PaymentInitializationFailed {
                reason: tbank_response.message.unwrap_or_else(|| {
                    tbank_response
                        .error_code
                        .unwrap_or("Unknown error".to_string())
                }),
                transaction_id: Some(order_id),
            });
        }

        // Convert T-Bank response to our response format
        Ok(PaymentInitializationResponse {
            order_id,
            payment_id: tbank_response.payment_id.unwrap_or_default(),
            payment_url: tbank_response.payment_url,
            qr_code: tbank_response.qr_code,
            expires_at,
            status: tbank_response.status.unwrap_or("NEW".to_string()),
        })
    }

    /// Initialize payment with custom expiration time
    /// Requirements: 3.2, 3.3
    pub async fn initialize_payment_with_expiration(
        &self,
        request: &PaymentInitializationRequest,
        amount: Decimal,
        description: String,
        customer_email: Option<String>,
        expires_in_hours: u32,
    ) -> Result<PaymentInitializationResponse, TBankError> {
        // Validate expiration time (max 24 hours for security)
        if expires_in_hours == 0 || expires_in_hours > 24 {
            return Err(TBankError::ValidationError(
                "Expiration time must be between 1 and 24 hours".to_string(),
            ));
        }

        // Generate unique order ID if not provided
        let order_id = if request.order_id.is_empty() {
            Uuid::new_v4().to_string()
        } else {
            request.order_id.clone()
        };

        // Convert amount to kopecks (T-Bank API expects kopecks)
        let amount_kopecks = (amount * Decimal::from(100)).to_u64().unwrap_or(0);

        // Calculate custom expiration time
        let expires_at = Utc::now() + chrono::Duration::hours(expires_in_hours as i64);

        // Build T-Bank API request
        let mut tbank_request = TBankInitRequest {
            terminal_key: self.terminal_key.clone(),
            amount: amount_kopecks,
            order_id: order_id.clone(),
            description,
            pay_type: self.get_pay_type(&request.payment_method),
            customer_key: customer_email,
            recurrent: None,
            redirect_due_date: Some(self.format_due_date(expires_at)),
            notification_url: request.notification_url.clone(),
            success_url: request.success_url.clone(),
            fail_url: request.failure_url.clone(),
            token: String::new(), // Will be calculated
        };

        // Calculate token for Terminal-Key authentication
        tbank_request.token = self.calculate_token(&tbank_request)?;

        // Send request to T-Bank API POST /Init endpoint
        let url = format!("{}/Init", self.base_url);
        let response = self
            .http_client
            .post(&url)
            .header("Terminal-Key", &self.terminal_key)
            .json(&tbank_request)
            .send()
            .await
            .map_err(|e| TBankError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(TBankError::TBankApiError {
                status: response.status().as_u16(),
                message: format!("HTTP error: {}", response.status()),
                error_code: None,
            });
        }

        let tbank_response: TBankInitResponse = response
            .json()
            .await
            .map_err(|e| TBankError::ParseError(e.to_string()))?;

        if !tbank_response.success {
            return Err(TBankError::PaymentInitializationFailed {
                reason: tbank_response.message.unwrap_or_else(|| {
                    tbank_response
                        .error_code
                        .unwrap_or("Unknown error".to_string())
                }),
                transaction_id: Some(order_id),
            });
        }

        // Convert T-Bank response to our response format
        Ok(PaymentInitializationResponse {
            order_id,
            payment_id: tbank_response.payment_id.unwrap_or_default(),
            payment_url: tbank_response.payment_url,
            qr_code: tbank_response.qr_code,
            expires_at,
            status: tbank_response.status.unwrap_or("NEW".to_string()),
        })
    }
    /// Get T-Bank PayType parameter for payment method
    /// Maps our payment methods to T-Bank API PayType values
    /// Requirements: 3.7
    fn get_pay_type(&self, method: &PaymentMethod) -> Option<String> {
        match method {
            PaymentMethod::Card => Some("O".to_string()), // One-step payment
            PaymentMethod::SBP => Some("SBP".to_string()),
            PaymentMethod::QR => Some("QR".to_string()),
            PaymentMethod::ApplePay => Some("ApplePay".to_string()),
            PaymentMethod::GooglePay => Some("GooglePay".to_string()),
            PaymentMethod::SamsungPay => Some("SamsungPay".to_string()),
        }
    }

    /// Format due date for T-Bank API
    fn format_due_date(&self, date: DateTime<Utc>) -> String {
        date.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
    }

    /// Calculate token for T-Bank API authentication
    fn calculate_token(&self, request: &TBankInitRequest) -> Result<String, TBankError> {
        let mut params = HashMap::new();

        params.insert("TerminalKey", request.terminal_key.as_str());
        let amount_str = request.amount.to_string();
        params.insert("Amount", &amount_str);
        params.insert("OrderId", request.order_id.as_str());
        params.insert("Description", request.description.as_str());
        params.insert("Password", self.password.as_str());

        if let Some(pay_type) = &request.pay_type {
            params.insert("PayType", pay_type.as_str());
        }
        if let Some(customer_key) = &request.customer_key {
            params.insert("CustomerKey", customer_key.as_str());
        }
        if let Some(notification_url) = &request.notification_url {
            params.insert("NotificationURL", notification_url.as_str());
        }
        if let Some(success_url) = &request.success_url {
            params.insert("SuccessURL", success_url.as_str());
        }
        if let Some(fail_url) = &request.fail_url {
            params.insert("FailURL", fail_url.as_str());
        }
        if let Some(due) = &request.redirect_due_date {
            params.insert("RedirectDueDate", due.as_str());
        }

        // Sort parameters and create concatenated string
        let mut sorted_params: Vec<_> = params.into_iter().collect();
        sorted_params.sort_by_key(|&(key, _)| key);

        let concatenated = sorted_params
            .into_iter()
            .map(|(_, value)| value)
            .collect::<Vec<_>>()
            .join("");

        // Calculate SHA-256 hash
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(concatenated.as_bytes());
        let result = hasher.finalize();

        Ok(format!("{:x}", result))
    }
}

/// Response from payment initialization
/// Contains all necessary data for payment processing
/// Requirements: 3.3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentInitializationResponse {
    pub order_id: String,
    pub payment_id: String,
    pub payment_url: Option<String>,
    pub qr_code: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub status: String,
}

impl PaymentInitializationResponse {
    /// Check if initialization was successful
    /// Payment is successful if we have either payment_url or qr_code
    pub fn is_successful(&self) -> bool {
        !self.payment_id.is_empty() && (self.payment_url.is_some() || self.qr_code.is_some())
    }

    /// Check if payment has expired
    pub fn is_expired(&self) -> bool {
        self.expires_at < Utc::now()
    }

    /// Get time remaining until expiration in minutes
    pub fn minutes_until_expiration(&self) -> i64 {
        let now = Utc::now();
        if self.expires_at <= now {
            0
        } else {
            (self.expires_at - now).num_minutes()
        }
    }

    /// Check if payment method supports QR codes
    pub fn has_qr_code(&self) -> bool {
        self.qr_code.is_some()
    }

    /// Get payment method type from status or URL
    pub fn get_payment_method_hint(&self) -> Option<String> {
        if self.has_qr_code() {
            Some("QR".to_string())
        } else if self.payment_url.is_some() {
            Some("Card".to_string())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::acquiring::methods::AcquiringPaymentMethod as PaymentMethod;

    #[test]
    fn test_tbank_init_request_serialization() {
        let request = TBankInitRequest {
            terminal_key: "test_terminal".to_string(),
            amount: 100000, // 1000.00 RUB in kopecks
            order_id: "order_123".to_string(),
            description: "Test payment".to_string(),
            pay_type: Some("O".to_string()),
            customer_key: None,
            recurrent: None,
            redirect_due_date: None,
            notification_url: None,
            success_url: None,
            fail_url: None,
            token: "test_token".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("TerminalKey"));
        assert!(json.contains("Amount"));
        assert!(json.contains("OrderId"));
    }

    #[test]
    fn test_payment_initialization_service_creation() {
        let service = PaymentInitializationService::new(
            "test_terminal".to_string(),
            "test_password".to_string(),
            "https://securepay.tinkoff.ru/v2".to_string(),
        );

        assert_eq!(service.terminal_key, "test_terminal");
        assert_eq!(service.password, "test_password");
    }

    #[test]
    fn test_get_pay_type() {
        let service = PaymentInitializationService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        assert_eq!(
            service.get_pay_type(&PaymentMethod::Card),
            Some("O".to_string())
        );
        assert_eq!(
            service.get_pay_type(&PaymentMethod::SBP),
            Some("SBP".to_string())
        );
        assert_eq!(
            service.get_pay_type(&PaymentMethod::ApplePay),
            Some("ApplePay".to_string())
        );
        assert_eq!(
            service.get_pay_type(&PaymentMethod::GooglePay),
            Some("GooglePay".to_string())
        );
        assert_eq!(
            service.get_pay_type(&PaymentMethod::SamsungPay),
            Some("SamsungPay".to_string())
        );
    }

    #[test]
    fn test_payment_initialization_response() {
        let response = PaymentInitializationResponse {
            order_id: "order_123".to_string(),
            payment_id: "payment_456".to_string(),
            payment_url: Some("https://payment.url".to_string()),
            qr_code: None,
            expires_at: Utc::now() + chrono::Duration::hours(1),
            status: "NEW".to_string(),
        };

        assert!(response.is_successful());
        assert!(!response.is_expired());
        assert!(response.minutes_until_expiration() > 50); // Should be close to 60 minutes
        assert!(!response.has_qr_code());
        assert_eq!(response.get_payment_method_hint(), Some("Card".to_string()));
    }

    #[test]
    fn test_payment_initialization_response_with_qr() {
        let response = PaymentInitializationResponse {
            order_id: "order_123".to_string(),
            payment_id: "payment_456".to_string(),
            payment_url: None,
            qr_code: Some("data:image/png;base64,iVBORw0KGgoAAAANS...".to_string()),
            expires_at: Utc::now() + chrono::Duration::minutes(30),
            status: "NEW".to_string(),
        };

        assert!(response.is_successful());
        assert!(!response.is_expired());
        assert!(response.has_qr_code());
        assert_eq!(response.get_payment_method_hint(), Some("QR".to_string()));
    }

    #[test]
    fn test_payment_initialization_response_expired() {
        let response = PaymentInitializationResponse {
            order_id: "order_123".to_string(),
            payment_id: "payment_456".to_string(),
            payment_url: Some("https://payment.url".to_string()),
            qr_code: None,
            expires_at: Utc::now() - chrono::Duration::hours(1), // Expired
            status: "NEW".to_string(),
        };

        assert!(response.is_successful()); // Still successful initialization
        assert!(response.is_expired()); // But expired
        assert_eq!(response.minutes_until_expiration(), 0);
    }
}
