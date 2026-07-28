use crate::types::acquiring::payment::{
    AcquiringPaymentInitializationRequest as PaymentInitializationRequest,
};
use crate::types::common::errors::{TBankError, TBankResult};
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use tracing::{debug, error, info, instrument};

use super::types::{PaymentCompletionConfig, TBankPaymentInitResponse};
use crate::acquiring::initialization::PaymentInitializationResponse;

/// Payment initialization service
/// Handles payment initialization requests to T-Bank Acquiring API
pub struct PaymentInitializationService {
    config: PaymentCompletionConfig,
    http_client: reqwest::Client,
}

impl PaymentInitializationService {
    /// Create a new payment initialization service
    pub fn new(config: PaymentCompletionConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            http_client,
        }
    }

    /// Initialize a new payment
    #[instrument(skip(self, request), fields(order_id = %request.order_id, amount = %request.amount))]
    pub async fn initialize_payment(
        &self,
        request: &PaymentInitializationRequest,
    ) -> TBankResult<PaymentInitializationResponse> {
        debug!("Initializing payment with T-Bank Acquiring API");

        // Validate request
        self.validate_initialization_request(request)?;

        // Prepare API request
        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), self.config.terminal_key.clone());
        params.insert("Amount".to_string(), (request.amount * Decimal::from(100)).to_string()); // Convert to kopecks
        params.insert("OrderId".to_string(), request.order_id.clone());
        params.insert("Description".to_string(), request.description.clone().unwrap_or_default());

        if let Some(ref customer_email) = request.customer_email {
            params.insert("CustomerKey".to_string(), customer_email.clone());
        }

        // Note: Receipt functionality not implemented in current request structure
        // if let Some(ref receipt) = request.receipt {
        //     params.insert("Receipt", serde_json::to_string(receipt).unwrap_or_default());
        // }

        // Add signature
        let token = self.generate_token(&params);
        params.insert("Token".to_string(), token);

        // Make API request
        let url = format!("{}/Init", self.config.base_url);
        let response = self
            .http_client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to send payment initialization request");
                TBankError::NetworkError(format!("Payment initialization failed: {}", e))
            })?;

        // Parse response
        let response_text = response.text().await.map_err(|e| {
            error!(error = %e, "Failed to read payment initialization response");
            TBankError::NetworkError(format!("Failed to read response: {}", e))
        })?;

        let api_response: TBankPaymentInitResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                error!(error = %e, response = %response_text, "Failed to parse payment initialization response");
                TBankError::ParseError(format!("Invalid response format: {}", e))
            })?;

        if !api_response.success {
            let error_msg = api_response.message.unwrap_or_else(|| "Unknown error".to_string());
            error!(error_code = ?api_response.error_code, message = %error_msg, "Payment initialization failed");
            return Err(TBankError::TBankApiError {
                status: 400,
                message: error_msg,
                error_code: api_response.error_code,
            });
        }

        info!(
            payment_id = ?api_response.payment_id,
            order_id = %request.order_id,
            "Payment initialized successfully"
        );

        // Convert TBankPaymentInitResponse to PaymentInitializationResponse
        let expires_at = Utc::now() + chrono::Duration::hours(1); // Default 1 hour expiration
        
        Ok(PaymentInitializationResponse {
            order_id: request.order_id.clone(),
            payment_id: api_response.payment_id.unwrap_or_default(),
            payment_url: api_response.payment_url,
            qr_code: None, // QR code not available in this response
            expires_at,
            status: "NEW".to_string(),
        })
    }

    /// Validate payment initialization request
    fn validate_initialization_request(
        &self,
        request: &PaymentInitializationRequest,
    ) -> TBankResult<()> {
        if request.amount <= Decimal::ZERO {
            return Err(TBankError::ValidationError(
                "Payment amount must be positive".to_string(),
            ));
        }

        if request.order_id.trim().is_empty() {
            return Err(TBankError::ValidationError(
                "Order ID cannot be empty".to_string(),
            ));
        }

        if request.order_id.len() > 50 {
            return Err(TBankError::ValidationError(
                "Order ID cannot exceed 50 characters".to_string(),
            ));
        }

        // Validate amount limits (T-Bank specific)
        if request.amount > Decimal::from(600000) {
            return Err(TBankError::ValidationError(
                "Payment amount cannot exceed 600,000 RUB".to_string(),
            ));
        }

        Ok(())
    }

    /// Generate token for API request signature
    fn generate_token(&self, params: &HashMap<String, String>) -> String {
        use sha2::{Digest, Sha256};

        // Create sorted parameter string
        let mut sorted_params: Vec<_> = params.iter().collect();
        sorted_params.sort_by_key(|&(k, _)| k);

        let mut token_string = String::new();
        for (key, value) in sorted_params {
            if key != "Token" && !value.is_empty() {
                token_string.push_str(&format!("{}={}", key, value));
            }
        }
        token_string.push_str(&self.config.password);

        // Generate SHA-256 hash
        let mut hasher = Sha256::new();
        hasher.update(token_string.as_bytes());
        let result = hasher.finalize();
        hex::encode(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    fn create_test_config() -> PaymentCompletionConfig {
        PaymentCompletionConfig {
            terminal_key: "test_terminal".to_string(),
            password: "test_password".to_string(),
            base_url: "https://securepay.tinkoff.ru/v2".to_string(),
            timeout_seconds: 30,
            max_retries: 3,
        }
    }

    fn create_test_request() -> PaymentInitializationRequest {
        PaymentInitializationRequest {
            amount: Decimal::from(1000), // 10.00 RUB
            order_id: "test_order_123".to_string(),
            description: Some("Test payment".to_string()),
            customer_key: Some("customer_123".to_string()),
            receipt: None,
            payment_method: crate::types::acquiring::methods::AcquiringPaymentMethod::Card,
            return_url: Some("https://example.com/return".to_string()),
            fail_url: Some("https://example.com/fail".to_string()),
            customer_email: Some("test@example.com".to_string()),
            customer_phone: Some("+79001234567".to_string()),
        }
    }

    #[test]
    fn test_validate_initialization_request() {
        let service = PaymentInitializationService::new(create_test_config());

        // Valid request
        let valid_request = create_test_request();
        assert!(service.validate_initialization_request(&valid_request).is_ok());

        // Invalid amount
        let mut invalid_request = create_test_request();
        invalid_request.amount = Decimal::ZERO;
        assert!(service.validate_initialization_request(&invalid_request).is_err());

        // Empty order ID
        let mut invalid_request = create_test_request();
        invalid_request.order_id = "".to_string();
        assert!(service.validate_initialization_request(&invalid_request).is_err());

        // Too long order ID
        let mut invalid_request = create_test_request();
        invalid_request.order_id = "a".repeat(51);
        assert!(service.validate_initialization_request(&invalid_request).is_err());

        // Amount too large
        let mut invalid_request = create_test_request();
        invalid_request.amount = Decimal::from(700000);
        assert!(service.validate_initialization_request(&invalid_request).is_err());
    }

    #[test]
    fn test_generate_token() {
        let service = PaymentInitializationService::new(create_test_config());

        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), "test_terminal".to_string());
        params.insert("Amount".to_string(), "100000".to_string());
        params.insert("OrderId".to_string(), "test_order".to_string());

        let token = service.generate_token(&params);
        assert!(!token.is_empty());
        assert_eq!(token.len(), 64); // SHA-256 produces 64-character hex string
    }
}