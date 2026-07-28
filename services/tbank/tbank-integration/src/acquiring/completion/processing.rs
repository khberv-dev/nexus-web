use crate::types::acquiring::payment::AcquiringPaymentCompletion as PaymentCompletion;
use crate::types::common::errors::{TBankError, TBankResult};
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use tracing::{debug, error, info, instrument, warn};

use super::types::{PaymentCompletionConfig, PaymentCompletionResult};

/// Payment processing service
/// Handles payment completion, confirmation, and related operations
pub struct PaymentProcessingService {
    config: PaymentCompletionConfig,
    http_client: reqwest::Client,
}

impl PaymentProcessingService {
    /// Create a new payment processing service
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

    /// Complete payment processing
    #[instrument(skip(self, completion), fields(transaction_id = %completion.transaction_id))]
    pub async fn complete_payment(
        &self,
        completion: &PaymentCompletion,
    ) -> TBankResult<PaymentCompletionResult> {
        debug!("Completing payment processing");

        // Validate completion request
        self.validate_completion_request(completion)?;

        // Prepare API request
        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), self.config.terminal_key.clone());
        params.insert("PaymentId".to_string(), completion.transaction_id.clone());

        if let Some(amount) = completion.commission_amount {
            params.insert("Amount".to_string(), (amount * Decimal::from(100)).to_string()); // Convert to kopecks
        }

        // Note: IP address not available in current completion structure
        // if let Some(ref ip) = completion.ip_address {
        //     params.insert("IP".to_string(), ip.clone());
        // }

        // Add signature
        let token = self.generate_token(&params);
        params.insert("Token".to_string(), token);

        // Make API request
        let url = format!("{}/Confirm", self.config.base_url);
        let response = self
            .http_client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| {
                error!(error = %e, transaction_id = %completion.transaction_id, "Failed to send payment completion request");
                TBankError::NetworkError(format!("Payment completion failed: {}", e))
            })?;

        // Parse response
        let response_text = response.text().await.map_err(|e| {
            error!(error = %e, transaction_id = %completion.transaction_id, "Failed to read payment completion response");
            TBankError::NetworkError(format!("Failed to read response: {}", e))
        })?;

        let api_response: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| {
                error!(error = %e, response = %response_text, transaction_id = %completion.transaction_id, "Failed to parse payment completion response");
                TBankError::ParseError(format!("Invalid response format: {}", e))
            })?;

        // Check if request was successful
        let success = api_response.get("Success").and_then(|v| v.as_bool()).unwrap_or(false);
        if !success {
            let error_msg = api_response
                .get("Message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error")
                .to_string();
            error!(error_message = %error_msg, transaction_id = %completion.transaction_id, "Payment completion failed");
            return Err(TBankError::TBankApiError {
                status: 400,
                message: error_msg,
                error_code: None,
            });
        }

        // Extract completion details
        let status = api_response
            .get("Status")
            .and_then(|v| v.as_str())
            .unwrap_or("UNKNOWN")
            .to_string();

        let amount = api_response
            .get("Amount")
            .and_then(|v| v.as_u64())
            .map(|a| Decimal::from(a) / Decimal::from(100)); // Convert from kopecks

        // Create transaction details
        let mut transaction_details = HashMap::new();
        if let Some(order_id) = api_response.get("OrderId").and_then(|v| v.as_str()) {
            transaction_details.insert("order_id".to_string(), order_id.to_string());
        }
        if let Some(terminal_key) = api_response.get("TerminalKey").and_then(|v| v.as_str()) {
            transaction_details.insert("terminal_key".to_string(), terminal_key.to_string());
        }

        let result = PaymentCompletionResult {
            payment_id: completion.transaction_id.clone(),
            status,
            amount,
            completed_at: Utc::now(),
            transaction_details: if transaction_details.is_empty() {
                None
            } else {
                Some(transaction_details)
            },
        };

        info!(
            transaction_id = %completion.transaction_id,
            status = %result.status,
            amount = ?result.amount,
            "Payment completed successfully"
        );

        Ok(result)
    }

    /// Cancel payment
    #[instrument(skip(self), fields(payment_id = %payment_id))]
    pub async fn cancel_payment(&self, payment_id: &str) -> TBankResult<PaymentCompletionResult> {
        debug!("Cancelling payment");

        // Validate payment ID
        if payment_id.trim().is_empty() {
            return Err(TBankError::ValidationError(
                "Payment ID cannot be empty".to_string(),
            ));
        }

        // Prepare API request
        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), self.config.terminal_key.clone());
        params.insert("PaymentId".to_string(), payment_id.to_string());

        // Add signature
        let token = self.generate_token(&params);
        params.insert("Token".to_string(), token);

        // Make API request
        let url = format!("{}/Cancel", self.config.base_url);
        let response = self
            .http_client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| {
                error!(error = %e, payment_id = %payment_id, "Failed to send payment cancellation request");
                TBankError::NetworkError(format!("Payment cancellation failed: {}", e))
            })?;

        // Parse response
        let response_text = response.text().await.map_err(|e| {
            error!(error = %e, payment_id = %payment_id, "Failed to read payment cancellation response");
            TBankError::NetworkError(format!("Failed to read response: {}", e))
        })?;

        let api_response: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| {
                error!(error = %e, response = %response_text, payment_id = %payment_id, "Failed to parse payment cancellation response");
                TBankError::ParseError(format!("Invalid response format: {}", e))
            })?;

        // Check if request was successful
        let success = api_response.get("Success").and_then(|v| v.as_bool()).unwrap_or(false);
        if !success {
            let error_msg = api_response
                .get("Message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error")
                .to_string();
            error!(error_message = %error_msg, payment_id = %payment_id, "Payment cancellation failed");
            return Err(TBankError::TBankApiError {
                status: 400,
                message: error_msg,
                error_code: None,
            });
        }

        let result = PaymentCompletionResult {
            payment_id: payment_id.to_string(),
            status: "CANCELLED".to_string(),
            amount: None,
            completed_at: Utc::now(),
            transaction_details: None,
        };

        info!(payment_id = %payment_id, "Payment cancelled successfully");

        Ok(result)
    }

    /// Refund payment (full or partial)
    #[instrument(skip(self), fields(payment_id = %payment_id, amount = ?refund_amount))]
    pub async fn refund_payment(
        &self,
        payment_id: &str,
        refund_amount: Option<Decimal>,
    ) -> TBankResult<PaymentCompletionResult> {
        debug!("Processing payment refund");

        // Validate payment ID
        if payment_id.trim().is_empty() {
            return Err(TBankError::ValidationError(
                "Payment ID cannot be empty".to_string(),
            ));
        }

        // Validate refund amount
        if let Some(amount) = refund_amount {
            if amount <= Decimal::ZERO {
                return Err(TBankError::ValidationError(
                    "Refund amount must be positive".to_string(),
                ));
            }
        }

        // Prepare API request
        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), self.config.terminal_key.clone());
        params.insert("PaymentId".to_string(), payment_id.to_string());

        if let Some(amount) = refund_amount {
            params.insert("Amount".to_string(), (amount * Decimal::from(100)).to_string()); // Convert to kopecks
        }

        // Add signature
        let token = self.generate_token(&params);
        params.insert("Token".to_string(), token);

        // Make API request
        let url = format!("{}/Cancel", self.config.base_url); // T-Bank uses Cancel for refunds
        let response = self
            .http_client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| {
                error!(error = %e, payment_id = %payment_id, "Failed to send payment refund request");
                TBankError::NetworkError(format!("Payment refund failed: {}", e))
            })?;

        // Parse response
        let response_text = response.text().await.map_err(|e| {
            error!(error = %e, payment_id = %payment_id, "Failed to read payment refund response");
            TBankError::NetworkError(format!("Failed to read response: {}", e))
        })?;

        let api_response: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| {
                error!(error = %e, response = %response_text, payment_id = %payment_id, "Failed to parse payment refund response");
                TBankError::ParseError(format!("Invalid response format: {}", e))
            })?;

        // Check if request was successful
        let success = api_response.get("Success").and_then(|v| v.as_bool()).unwrap_or(false);
        if !success {
            let error_msg = api_response
                .get("Message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error")
                .to_string();
            error!(error_message = %error_msg, payment_id = %payment_id, "Payment refund failed");
            return Err(TBankError::TBankApiError {
                status: 400,
                message: error_msg,
                error_code: None,
            });
        }

        let status = if refund_amount.is_some() {
            "PARTIAL_REFUNDED".to_string()
        } else {
            "REFUNDED".to_string()
        };

        let result = PaymentCompletionResult {
            payment_id: payment_id.to_string(),
            status,
            amount: refund_amount,
            completed_at: Utc::now(),
            transaction_details: None,
        };

        info!(
            payment_id = %payment_id,
            refund_amount = ?refund_amount,
            "Payment refund processed successfully"
        );

        Ok(result)
    }

    /// Validate payment completion request
    fn validate_completion_request(&self, completion: &PaymentCompletion) -> TBankResult<()> {
        if completion.transaction_id.trim().is_empty() {
            return Err(TBankError::ValidationError(
                "Transaction ID cannot be empty".to_string(),
            ));
        }

        if let Some(amount) = completion.commission_amount {
            if amount <= Decimal::ZERO {
                return Err(TBankError::ValidationError(
                    "Commission amount must be positive".to_string(),
                ));
            }
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

    fn create_test_config() -> PaymentCompletionConfig {
        PaymentCompletionConfig {
            terminal_key: "test_terminal".to_string(),
            password: "test_password".to_string(),
            base_url: "https://securepay.tinkoff.ru/v2".to_string(),
            timeout_seconds: 30,
            max_retries: 3,
        }
    }

    fn create_test_completion() -> PaymentCompletion {
        PaymentCompletion {
            payment_id: "test_payment_123".to_string(),
            amount: Some(Decimal::from(1000)), // 10.00 RUB
            ip_address: Some("192.168.1.1".to_string()),
        }
    }

    #[test]
    fn test_validate_completion_request() {
        let service = PaymentProcessingService::new(create_test_config());

        // Valid completion
        let valid_completion = create_test_completion();
        assert!(service.validate_completion_request(&valid_completion).is_ok());

        // Empty payment ID
        let mut invalid_completion = create_test_completion();
        invalid_completion.payment_id = "".to_string();
        assert!(service.validate_completion_request(&invalid_completion).is_err());

        // Invalid amount
        let mut invalid_completion = create_test_completion();
        invalid_completion.amount = Some(Decimal::ZERO);
        assert!(service.validate_completion_request(&invalid_completion).is_err());
    }

    #[test]
    fn test_generate_token() {
        let service = PaymentProcessingService::new(create_test_config());

        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), "test_terminal".to_string());
        params.insert("PaymentId".to_string(), "12345".to_string());

        let token = service.generate_token(&params);
        assert!(!token.is_empty());
        assert_eq!(token.len(), 64); // SHA-256 produces 64-character hex string
    }
}