use crate::types::common::errors::{TBankError, TBankResult};
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use tracing::{debug, error, info, instrument};

use super::types::{PaymentCompletionConfig, PaymentCompletionResult};

/// Legacy payment completion service for backward compatibility
pub struct PaymentCompletionService {
    terminal_key: String,
    password: String,
    base_url: String,
    http_client: reqwest::Client,
}

impl PaymentCompletionService {
    /// Create a new payment completion service
    pub fn new(terminal_key: String, password: String, base_url: String) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            terminal_key,
            password,
            base_url,
            http_client,
        }
    }

    /// Process payment completion
    #[instrument(skip(self, webhook_data), fields(payment_id = %payment_id))]
    pub async fn process_completion(
        &self,
        payment_id: &str,
        webhook_data: Option<serde_json::Value>,
    ) -> TBankResult<PaymentCompletionResult> {
        debug!("Processing payment completion");

        // Validate payment ID
        if payment_id.trim().is_empty() {
            return Err(TBankError::ValidationError(
                "Payment ID cannot be empty".to_string(),
            ));
        }

        // If webhook data is provided, use it directly
        if let Some(data) = webhook_data {
            return self.process_webhook_completion(payment_id, data).await;
        }

        // Otherwise, query payment status
        self.query_payment_status(payment_id).await
    }

    /// Process completion from webhook data
    async fn process_webhook_completion(
        &self,
        payment_id: &str,
        webhook_data: serde_json::Value,
    ) -> TBankResult<PaymentCompletionResult> {
        let status = webhook_data
            .get("Status")
            .and_then(|v| v.as_str())
            .unwrap_or("UNKNOWN")
            .to_string();

        let amount = webhook_data
            .get("Amount")
            .and_then(|v| v.as_u64())
            .map(|a| Decimal::from(a) / Decimal::from(100)); // Convert from kopecks

        let mut transaction_details = HashMap::new();
        if let Some(order_id) = webhook_data.get("OrderId").and_then(|v| v.as_str()) {
            transaction_details.insert("order_id".to_string(), order_id.to_string());
        }

        let result = PaymentCompletionResult {
            payment_id: payment_id.to_string(),
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
            payment_id = %payment_id,
            status = %result.status,
            "Payment completion processed from webhook"
        );

        Ok(result)
    }

    /// Query payment status from T-Bank API
    async fn query_payment_status(&self, payment_id: &str) -> TBankResult<PaymentCompletionResult> {
        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), self.terminal_key.clone());
        params.insert("PaymentId".to_string(), payment_id.to_string());

        let token = self.generate_token(&params);
        params.insert("Token".to_string(), token);

        let url = format!("{}/GetState", self.base_url);
        let response = self
            .http_client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| {
                error!(error = %e, payment_id = %payment_id, "Failed to query payment status");
                TBankError::NetworkError(format!("Payment status query failed: {}", e))
            })?;

        let response_text = response.text().await.map_err(|e| {
            error!(error = %e, payment_id = %payment_id, "Failed to read payment status response");
            TBankError::NetworkError(format!("Failed to read response: {}", e))
        })?;

        let api_response: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| {
                error!(error = %e, response = %response_text, payment_id = %payment_id, "Failed to parse payment status response");
                TBankError::ParseError(format!("Invalid response format: {}", e))
            })?;

        let success = api_response.get("Success").and_then(|v| v.as_bool()).unwrap_or(false);
        if !success {
            let error_msg = api_response
                .get("Message")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error")
                .to_string();
            error!(error_message = %error_msg, payment_id = %payment_id, "Payment status query failed");
            return Err(TBankError::TBankApiError {
                status: 400,
                message: error_msg,
                error_code: api_response.get("ErrorCode").and_then(|v| v.as_str()).map(|s| s.to_string()),
            });
        }

        let status = api_response
            .get("Status")
            .and_then(|v| v.as_str())
            .unwrap_or("UNKNOWN")
            .to_string();

        let amount = api_response
            .get("Amount")
            .and_then(|v| v.as_u64())
            .map(|a| Decimal::from(a) / Decimal::from(100));

        let result = PaymentCompletionResult {
            payment_id: payment_id.to_string(),
            status,
            amount,
            completed_at: Utc::now(),
            transaction_details: None,
        };

        Ok(result)
    }

    /// Check if payment can be retried based on error code
    pub fn can_retry_payment(&self, error_code: Option<&str>) -> bool {
        match error_code {
            Some("1006") => false, // Card declined
            Some("1051") => false, // Insufficient funds
            Some("1054") => false, // Expired card
            Some("1057") => false, // Invalid card
            Some("1091") => false, // Transaction not permitted
            Some("1096") => false, // System malfunction
            _ => true, // Other errors can be retried
        }
    }

    /// Get user-friendly error message
    pub fn handle_error_code(&self, error_code: &str) -> String {
        match error_code {
            "1006" => "Карта отклонена банком".to_string(),
            "1051" => "Недостаточно средств на карте".to_string(),
            "1054" => "Срок действия карты истек".to_string(),
            "1057" => "Неверные данные карты".to_string(),
            "1091" => "Операция не разрешена для данной карты".to_string(),
            "1096" => "Техническая ошибка банка".to_string(),
            _ => "Произошла ошибка при обработке платежа".to_string(),
        }
    }

    /// Generate token for API request signature
    fn generate_token(&self, params: &HashMap<String, String>) -> String {
        use sha2::{Digest, Sha256};

        let mut sorted_params: Vec<_> = params.iter().collect();
        sorted_params.sort_by_key(|&(k, _)| k);

        let mut token_string = String::new();
        for (key, value) in sorted_params {
            if key != "Token" && !value.is_empty() {
                token_string.push_str(&format!("{}={}", key, value));
            }
        }
        token_string.push_str(&self.password);

        let mut hasher = Sha256::new();
        hasher.update(token_string.as_bytes());
        let result = hasher.finalize();
        hex::encode(result)
    }
}