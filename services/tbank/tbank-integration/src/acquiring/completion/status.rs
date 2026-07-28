use crate::types::common::errors::{TBankError, TBankResult};
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use tracing::{debug, error, info, instrument, warn};

use super::types::{PaymentCompletionConfig, PaymentStatusResult, TBankPaymentStatusResponse};

/// Payment status service
/// Handles payment status checks and monitoring
pub struct PaymentStatusService {
    config: PaymentCompletionConfig,
    http_client: reqwest::Client,
}

impl PaymentStatusService {
    /// Create a new payment status service
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

    /// Check payment status
    #[instrument(skip(self), fields(payment_id = %payment_id))]
    pub async fn check_payment_status(&self, payment_id: &str) -> TBankResult<PaymentStatusResult> {
        debug!("Checking payment status with T-Bank Acquiring API");

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
        let url = format!("{}/GetState", self.config.base_url);
        let response = self
            .http_client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| {
                error!(error = %e, payment_id = %payment_id, "Failed to send payment status request");
                TBankError::NetworkError(format!("Payment status check failed: {}", e))
            })?;

        // Parse response
        let response_text = response.text().await.map_err(|e| {
            error!(error = %e, payment_id = %payment_id, "Failed to read payment status response");
            TBankError::NetworkError(format!("Failed to read response: {}", e))
        })?;

        let api_response: TBankPaymentStatusResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                error!(error = %e, response = %response_text, payment_id = %payment_id, "Failed to parse payment status response");
                TBankError::ParseError(format!("Invalid response format: {}", e))
            })?;

        if !api_response.success {
            let error_msg = api_response.message.unwrap_or_else(|| "Unknown error".to_string());
            warn!(error_code = ?api_response.error_code, message = %error_msg, payment_id = %payment_id, "Payment status check failed");
            return Err(TBankError::TBankApiError {
                status: 400,
                message: error_msg,
                error_code: api_response.error_code,
            });
        }

        // Convert response to result
        let status = api_response.status.unwrap_or_else(|| "UNKNOWN".to_string());
        let amount = api_response.amount.map(|a| Decimal::from(a) / Decimal::from(100)); // Convert from kopecks

        let result = PaymentStatusResult {
            payment_id: payment_id.to_string(),
            status: status.clone(),
            amount,
            last_updated: Utc::now(),
            error_details: api_response.details,
        };

        info!(
            payment_id = %payment_id,
            status = %status,
            amount = ?amount,
            "Payment status retrieved successfully"
        );

        Ok(result)
    }

    /// Check multiple payment statuses
    #[instrument(skip(self, payment_ids), fields(count = payment_ids.len()))]
    pub async fn check_multiple_payment_statuses(
        &self,
        payment_ids: &[String],
    ) -> TBankResult<Vec<PaymentStatusResult>> {
        debug!("Checking multiple payment statuses");

        if payment_ids.is_empty() {
            return Ok(Vec::new());
        }

        if payment_ids.len() > 100 {
            return Err(TBankError::ValidationError(
                "Cannot check more than 100 payments at once".to_string(),
            ));
        }

        let mut results = Vec::with_capacity(payment_ids.len());
        let mut errors = Vec::new();

        // Check payments in parallel (with concurrency limit)
        use futures::stream::{self, StreamExt};

        let concurrent_limit = 10; // Limit concurrent requests
        let status_futures = payment_ids.iter().map(|payment_id| {
            let payment_id = payment_id.clone();
            async move {
                match self.check_payment_status(&payment_id).await {
                    Ok(result) => Ok(result),
                    Err(e) => {
                        warn!(payment_id = %payment_id, error = %e, "Failed to check payment status");
                        Err((payment_id, e))
                    }
                }
            }
        });

        let mut stream = stream::iter(status_futures).buffer_unordered(concurrent_limit);

        while let Some(result) = stream.next().await {
            match result {
                Ok(status_result) => results.push(status_result),
                Err((payment_id, error)) => errors.push((payment_id, error)),
            }
        }

        if !errors.is_empty() {
            warn!(error_count = errors.len(), total_count = payment_ids.len(), "Some payment status checks failed");
            // Log individual errors but don't fail the entire operation
            for (payment_id, error) in errors {
                error!(payment_id = %payment_id, error = %error, "Payment status check failed");
            }
        }

        info!(
            success_count = results.len(),
            total_count = payment_ids.len(),
            "Multiple payment status check completed"
        );

        Ok(results)
    }

    /// Monitor payment until completion or timeout
    #[instrument(skip(self), fields(payment_id = %payment_id))]
    pub async fn monitor_payment_until_completion(
        &self,
        payment_id: &str,
        timeout_seconds: u64,
        poll_interval_seconds: u64,
    ) -> TBankResult<PaymentStatusResult> {
        debug!("Starting payment monitoring");

        let start_time = std::time::Instant::now();
        let timeout_duration = std::time::Duration::from_secs(timeout_seconds);
        let poll_interval = std::time::Duration::from_secs(poll_interval_seconds);

        loop {
            // Check if timeout exceeded
            if start_time.elapsed() > timeout_duration {
                warn!(payment_id = %payment_id, timeout_seconds = timeout_seconds, "Payment monitoring timeout");
                return Err(TBankError::NetworkError(format!(
                    "Payment monitoring timeout after {} seconds",
                    timeout_seconds
                )));
            }

            // Check payment status
            match self.check_payment_status(payment_id).await {
                Ok(result) => {
                    debug!(payment_id = %payment_id, status = %result.status, "Payment status checked");

                    // Check if payment is in final state
                    if self.is_final_status(&result.status) {
                        info!(
                            payment_id = %payment_id,
                            status = %result.status,
                            elapsed_seconds = start_time.elapsed().as_secs(),
                            "Payment reached final status"
                        );
                        return Ok(result);
                    }
                }
                Err(e) => {
                    warn!(payment_id = %payment_id, error = %e, "Payment status check failed during monitoring");
                    // Continue monitoring unless it's a critical error
                    if matches!(e, TBankError::ValidationError(_)) {
                        return Err(e);
                    }
                }
            }

            // Wait before next poll
            tokio::time::sleep(poll_interval).await;
        }
    }

    /// Check if payment status is final (no more changes expected)
    fn is_final_status(&self, status: &str) -> bool {
        matches!(
            status.to_uppercase().as_str(),
            "CONFIRMED" | "REJECTED" | "REFUNDED" | "PARTIAL_REFUNDED" | "CANCELLED"
        )
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

    #[test]
    fn test_is_final_status() {
        let service = PaymentStatusService::new(create_test_config());

        // Final statuses
        assert!(service.is_final_status("CONFIRMED"));
        assert!(service.is_final_status("REJECTED"));
        assert!(service.is_final_status("REFUNDED"));
        assert!(service.is_final_status("PARTIAL_REFUNDED"));
        assert!(service.is_final_status("CANCELLED"));

        // Case insensitive
        assert!(service.is_final_status("confirmed"));
        assert!(service.is_final_status("Rejected"));

        // Non-final statuses
        assert!(!service.is_final_status("NEW"));
        assert!(!service.is_final_status("FORM_SHOWED"));
        assert!(!service.is_final_status("AUTHORIZING"));
        assert!(!service.is_final_status("3DS_CHECKING"));
        assert!(!service.is_final_status("AUTHORIZED"));
    }

    #[test]
    fn test_generate_token() {
        let service = PaymentStatusService::new(create_test_config());

        let mut params = HashMap::new();
        params.insert("TerminalKey".to_string(), "test_terminal".to_string());
        params.insert("PaymentId".to_string(), "12345".to_string());

        let token = service.generate_token(&params);
        assert!(!token.is_empty());
        assert_eq!(token.len(), 64); // SHA-256 produces 64-character hex string
    }

    #[tokio::test]
    async fn test_check_multiple_payment_statuses_empty() {
        let service = PaymentStatusService::new(create_test_config());
        let result = service.check_multiple_payment_statuses(&[]).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_check_multiple_payment_statuses_too_many() {
        let service = PaymentStatusService::new(create_test_config());
        let payment_ids: Vec<String> = (0..101).map(|i| format!("payment_{}", i)).collect();
        let result = service.check_multiple_payment_statuses(&payment_ids).await;
        assert!(result.is_err());
    }
}