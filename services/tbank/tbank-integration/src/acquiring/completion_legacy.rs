use crate::types::acquiring::payment::{
    AcquiringPaymentCompletion as PaymentCompletion, AcquiringPaymentStatus as PaymentStatus,
};
use crate::types::common::errors::TBankError;
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

/// Payment completion service for T-Bank Acquiring API
/// Handles payment status updates and completion processing
/// Requirements: 3.4, 3.6
pub struct PaymentCompletionService {
    terminal_key: String,
    password: String,
    base_url: String,
    http_client: reqwest::Client,
}

impl PaymentCompletionService {
    /// Create a new payment completion service
    pub fn new(terminal_key: String, password: String, base_url: String) -> Self {
        Self {
            terminal_key,
            password,
            base_url,
            http_client: reqwest::Client::new(),
        }
    }

    /// Process payment completion from webhook or status check
    pub async fn process_completion(
        &self,
        payment_id: &str,
        webhook_data: Option<serde_json::Value>,
    ) -> Result<PaymentCompletion, TBankError> {
        // If webhook data is provided, process it directly
        if let Some(data) = webhook_data {
            return self.process_webhook_completion(data).await;
        }

        // Otherwise, fetch payment status from T-Bank API
        self.fetch_payment_status(payment_id).await
    }

    /// Process payment completion from webhook data
    async fn process_webhook_completion(
        &self,
        webhook_data: serde_json::Value,
    ) -> Result<PaymentCompletion, TBankError> {
        let status_str = webhook_data
            .get("Status")
            .and_then(|v| v.as_str())
            .ok_or_else(|| TBankError::ParseError("Missing Status in webhook data".to_string()))?;

        let payment_id = webhook_data
            .get("PaymentId")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let status = self.parse_payment_status(status_str)?;
        let completion_time = Utc::now();

        let (error_code, error_message) = if matches!(status, PaymentStatus::Failed) {
            let error_code = webhook_data
                .get("ErrorCode")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let error_message = webhook_data
                .get("Message")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            (error_code, error_message)
        } else {
            (None, None)
        };

        // Extract commission amount if available
        let commission_amount = webhook_data
            .get("Commission")
            .and_then(|v| v.as_u64())
            .map(|kopecks| Decimal::from(kopecks) / Decimal::from(100));

        Ok(PaymentCompletion {
            transaction_id: payment_id,
            status,
            commission_amount,
            completion_time,
            error_code,
            error_message,
        })
    }

    /// Fetch payment status from T-Bank API
    async fn fetch_payment_status(
        &self,
        payment_id: &str,
    ) -> Result<PaymentCompletion, TBankError> {
        let mut params = HashMap::new();
        params.insert("TerminalKey", self.terminal_key.as_str());
        params.insert("PaymentId", payment_id);
        params.insert("Password", self.password.as_str());

        // Calculate token
        let token = self.calculate_token(&params)?;
        params.insert("Token", &token);

        let url = format!("{}/GetState", self.base_url);
        let response = self
            .http_client
            .post(&url)
            .json(&params)
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

        let tbank_response: TBankPaymentStatusResponse = response
            .json()
            .await
            .map_err(|e| TBankError::ParseError(e.to_string()))?;

        if !tbank_response.success {
            let error_code = tbank_response.error_code.clone();
            return Err(TBankError::TBankApiError {
                status: 400,
                message: tbank_response
                    .message
                    .unwrap_or_else(|| error_code.unwrap_or("Unknown error".to_string())),
                error_code: tbank_response.error_code,
            });
        }

        let status_str = tbank_response.status.as_deref().unwrap_or("UNKNOWN");
        let status = self.parse_payment_status(status_str)?;

        let (error_code, error_message) = if matches!(status, PaymentStatus::Failed) {
            (tbank_response.error_code, tbank_response.message)
        } else {
            (None, None)
        };

        Ok(PaymentCompletion {
            transaction_id: payment_id.to_string(),
            status,
            commission_amount: None, // Commission info not available in GetState response
            completion_time: Utc::now(),
            error_code,
            error_message,
        })
    }

    /// Parse T-Bank payment status to our PaymentStatus enum
    /// Handles all possible T-Bank payment statuses
    /// Requirements: 3.4
    fn parse_payment_status(&self, status: &str) -> Result<PaymentStatus, TBankError> {
        match status {
            // Initial statuses
            "NEW" | "FORM_SHOWED" => Ok(PaymentStatus::Initialized),

            // Processing statuses
            "AUTHORIZING" | "3DS_CHECKING" | "3DS_CHECKED" | "CONFIRMING" => {
                Ok(PaymentStatus::Pending)
            }

            // Success statuses
            "AUTHORIZED" | "CONFIRMED" => Ok(PaymentStatus::Completed),

            // Failure statuses
            "REJECTED" | "DEADLINE_EXPIRED" | "AUTH_FAIL" | "CARD_EXPIRED" => {
                Ok(PaymentStatus::Failed)
            }

            // Cancellation statuses
            "CANCELED" | "REVERSED" => Ok(PaymentStatus::Cancelled),

            // Special cases
            "PARTIAL_REVERSED" => Ok(PaymentStatus::Completed), // Partial refund, still completed
            "REFUNDED" => Ok(PaymentStatus::Cancelled),         // Full refund

            _ => Err(TBankError::ParseError(format!(
                "Unknown payment status: {}",
                status
            ))),
        }
    }

    /// Calculate token for T-Bank API authentication
    fn calculate_token(&self, params: &HashMap<&str, &str>) -> Result<String, TBankError> {
        // Sort parameters and create concatenated string
        let mut sorted_params: Vec<_> = params.into_iter().collect();
        sorted_params.sort_by_key(|&(key, _)| key);

        let concatenated = sorted_params
            .into_iter()
            .map(|(_, value)| *value)
            .collect::<Vec<_>>()
            .join("");

        // Calculate SHA-256 hash
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(concatenated.as_bytes());
        let result = hasher.finalize();

        Ok(format!("{:x}", result))
    }

    /// Handle specific error codes from T-Bank
    /// Provides user-friendly error messages for common error scenarios
    /// Requirements: 3.6
    pub fn handle_error_code(&self, error_code: &str) -> String {
        match error_code {
            // Card-related errors
            "INSUFFICIENT_FUNDS" => "Insufficient funds on the card".to_string(),
            "CARD_DECLINED" => "Card declined by the bank".to_string(),
            "CARD_EXPIRED" => "Card has expired".to_string(),
            "INVALID_CARD" => "Invalid card number".to_string(),
            "CARD_BLOCKED" => "Card is blocked".to_string(),

            // Transaction limits
            "LIMIT_EXCEEDED" => "Transaction limit exceeded".to_string(),
            "DAILY_LIMIT_EXCEEDED" => "Daily transaction limit exceeded".to_string(),
            "MONTHLY_LIMIT_EXCEEDED" => "Monthly transaction limit exceeded".to_string(),

            // Security and fraud
            "FRAUD_SUSPECTED" => "Transaction blocked due to fraud suspicion".to_string(),
            "3DS_FAILED" => "3D Secure authentication failed".to_string(),
            "3DS_NOT_ENROLLED" => "Card is not enrolled in 3D Secure".to_string(),

            // Technical errors
            "TIMEOUT" => "Transaction timeout".to_string(),
            "NETWORK_ERROR" => "Network connection error".to_string(),
            "TEMPORARY_ERROR" => "Temporary system error, please try again".to_string(),

            // SBP specific errors
            "SBP_DECLINED" => "Payment declined by SBP system".to_string(),
            "SBP_TIMEOUT" => "SBP payment timeout".to_string(),
            "SBP_LIMIT_EXCEEDED" => "SBP transaction limit exceeded".to_string(),

            // Mobile wallet errors
            "WALLET_DECLINED" => "Payment declined by mobile wallet".to_string(),
            "WALLET_UNAVAILABLE" => "Mobile wallet service unavailable".to_string(),

            // Generic errors
            "INVALID_REQUEST" => "Invalid payment request".to_string(),
            "PAYMENT_CANCELLED" => "Payment was cancelled by user".to_string(),
            "PAYMENT_EXPIRED" => "Payment session has expired".to_string(),

            _ => format!("Payment failed with error: {}", error_code),
        }
    }

    /// Check if payment can be retried based on error code
    /// Determines which errors are temporary and allow retry
    /// Requirements: 3.6
    pub fn can_retry_payment(&self, error_code: Option<&str>) -> bool {
        match error_code {
            // Retryable errors (temporary issues)
            Some("TIMEOUT") | Some("NETWORK_ERROR") | Some("TEMPORARY_ERROR") => true,
            Some("SBP_TIMEOUT") | Some("WALLET_UNAVAILABLE") => true,

            // Non-retryable errors (permanent issues)
            Some("INSUFFICIENT_FUNDS") | Some("CARD_DECLINED") | Some("CARD_EXPIRED") => false,
            Some("INVALID_CARD") | Some("CARD_BLOCKED") | Some("FRAUD_SUSPECTED") => false,
            Some("3DS_FAILED") | Some("LIMIT_EXCEEDED") | Some("DAILY_LIMIT_EXCEEDED") => false,
            Some("MONTHLY_LIMIT_EXCEEDED") | Some("SBP_DECLINED") | Some("SBP_LIMIT_EXCEEDED") => {
                false
            }
            Some("WALLET_DECLINED") | Some("INVALID_REQUEST") | Some("PAYMENT_CANCELLED") => false,
            Some("PAYMENT_EXPIRED") => false,

            // Allow retry if no specific error code (conservative approach)
            None => true,

            // Conservative approach for unknown errors
            _ => false,
        }
    }

    /// Get error category for monitoring and analytics
    /// Requirements: 3.6
    pub fn get_error_category(&self, error_code: &str) -> &'static str {
        match error_code {
            "INSUFFICIENT_FUNDS" | "CARD_DECLINED" | "CARD_EXPIRED" | "INVALID_CARD"
            | "CARD_BLOCKED" => "card_error",
            "LIMIT_EXCEEDED" | "DAILY_LIMIT_EXCEEDED" | "MONTHLY_LIMIT_EXCEEDED" => "limit_error",
            "FRAUD_SUSPECTED" | "3DS_FAILED" | "3DS_NOT_ENROLLED" => "security_error",
            "TIMEOUT" | "NETWORK_ERROR" | "TEMPORARY_ERROR" => "technical_error",
            "SBP_DECLINED" | "SBP_TIMEOUT" | "SBP_LIMIT_EXCEEDED" => "sbp_error",
            "WALLET_DECLINED" | "WALLET_UNAVAILABLE" => "wallet_error",
            "PAYMENT_CANCELLED" | "PAYMENT_EXPIRED" => "user_error",
            _ => "unknown_error",
        }
    }

    /// Check if error requires immediate notification
    /// Requirements: 3.6
    pub fn requires_immediate_notification(&self, error_code: &str) -> bool {
        matches!(
            error_code,
            "FRAUD_SUSPECTED"
                | "CARD_BLOCKED"
                | "LIMIT_EXCEEDED"
                | "DAILY_LIMIT_EXCEEDED"
                | "MONTHLY_LIMIT_EXCEEDED"
        )
    }
}

/// Payment completion result with additional metadata
/// Provides comprehensive information about payment completion
/// Requirements: 3.4, 3.6
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentCompletionResult {
    pub completion: PaymentCompletion,
    pub can_retry: bool,
    pub user_friendly_message: String,
    pub error_category: Option<String>,
    pub requires_notification: bool,
}

impl PaymentCompletionResult {
    /// Create a new completion result
    /// Requirements: 3.4, 3.6
    pub fn new(
        completion: PaymentCompletion,
        completion_service: &PaymentCompletionService,
    ) -> Self {
        // Completed or cancelled payments should never be retryable
        let can_retry = match completion.status {
            PaymentStatus::Completed | PaymentStatus::Cancelled => false,
            _ => completion_service.can_retry_payment(completion.error_code.as_deref()),
        };

        let user_friendly_message = match &completion.error_code {
            Some(code) => completion_service.handle_error_code(code),
            None => match completion.status {
                PaymentStatus::Completed => "Payment completed successfully".to_string(),
                PaymentStatus::Failed => "Payment failed".to_string(),
                PaymentStatus::Cancelled => "Payment was cancelled".to_string(),
                PaymentStatus::Pending => "Payment is being processed".to_string(),
                _ => "Payment status updated".to_string(),
            },
        };

        let error_category = completion
            .error_code
            .as_ref()
            .map(|code| completion_service.get_error_category(code).to_string());

        let requires_notification = completion
            .error_code
            .as_ref()
            .map(|code| completion_service.requires_immediate_notification(code))
            .unwrap_or(false);

        Self {
            completion,
            can_retry,
            user_friendly_message,
            error_category,
            requires_notification,
        }
    }

    /// Check if the payment was successful
    pub fn is_successful(&self) -> bool {
        matches!(self.completion.status, PaymentStatus::Completed)
    }

    /// Check if the payment failed
    pub fn is_failed(&self) -> bool {
        matches!(self.completion.status, PaymentStatus::Failed)
    }

    /// Check if the payment was cancelled
    pub fn is_cancelled(&self) -> bool {
        matches!(self.completion.status, PaymentStatus::Cancelled)
    }

    /// Get commission amount if available
    pub fn get_commission_amount(&self) -> Option<Decimal> {
        self.completion.commission_amount
    }

    /// Get completion timestamp
    pub fn get_completion_time(&self) -> DateTime<Utc> {
        self.completion.completion_time
    }

    /// Check if this is a technical error that might be resolved by retry
    pub fn is_technical_error(&self) -> bool {
        self.error_category.as_deref() == Some("technical_error")
    }

    /// Check if this is a user-related error
    pub fn is_user_error(&self) -> bool {
        matches!(
            self.error_category.as_deref(),
            Some("user_error") | Some("card_error")
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_payment_completion_service_creation() {
        let service = PaymentCompletionService::new(
            "test_terminal".to_string(),
            "test_password".to_string(),
            "https://securepay.tinkoff.ru/v2".to_string(),
        );

        assert_eq!(service.terminal_key, "test_terminal");
        assert_eq!(service.password, "test_password");
    }

    #[test]
    fn test_parse_payment_status() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        assert_eq!(
            service.parse_payment_status("NEW").unwrap(),
            PaymentStatus::Initialized
        );
        assert_eq!(
            service.parse_payment_status("CONFIRMED").unwrap(),
            PaymentStatus::Completed
        );
        assert_eq!(
            service.parse_payment_status("REJECTED").unwrap(),
            PaymentStatus::Failed
        );
        assert_eq!(
            service.parse_payment_status("CANCELED").unwrap(),
            PaymentStatus::Cancelled
        );
    }

    #[test]
    fn test_handle_error_code() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        assert_eq!(
            service.handle_error_code("INSUFFICIENT_FUNDS"),
            "Insufficient funds on the card"
        );
        assert_eq!(
            service.handle_error_code("CARD_DECLINED"),
            "Card declined by the bank"
        );
        assert_eq!(
            service.handle_error_code("SBP_DECLINED"),
            "Payment declined by SBP system"
        );
        assert_eq!(
            service.handle_error_code("WALLET_UNAVAILABLE"),
            "Mobile wallet service unavailable"
        );
        assert_eq!(
            service.handle_error_code("UNKNOWN_ERROR"),
            "Payment failed with error: UNKNOWN_ERROR"
        );
    }

    #[test]
    fn test_can_retry_payment() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        // Retryable errors
        assert!(service.can_retry_payment(Some("TIMEOUT")));
        assert!(service.can_retry_payment(Some("NETWORK_ERROR")));
        assert!(service.can_retry_payment(Some("TEMPORARY_ERROR")));
        assert!(service.can_retry_payment(Some("SBP_TIMEOUT")));
        assert!(service.can_retry_payment(Some("WALLET_UNAVAILABLE")));

        // Non-retryable errors
        assert!(!service.can_retry_payment(Some("INSUFFICIENT_FUNDS")));
        assert!(!service.can_retry_payment(Some("CARD_DECLINED")));
        assert!(!service.can_retry_payment(Some("FRAUD_SUSPECTED")));
        assert!(!service.can_retry_payment(Some("PAYMENT_CANCELLED")));

        // No error code - allow retry
        assert!(service.can_retry_payment(None));
    }

    #[test]
    fn test_get_error_category() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        assert_eq!(
            service.get_error_category("INSUFFICIENT_FUNDS"),
            "card_error"
        );
        assert_eq!(service.get_error_category("LIMIT_EXCEEDED"), "limit_error");
        assert_eq!(
            service.get_error_category("FRAUD_SUSPECTED"),
            "security_error"
        );
        assert_eq!(service.get_error_category("TIMEOUT"), "technical_error");
        assert_eq!(service.get_error_category("SBP_DECLINED"), "sbp_error");
        assert_eq!(
            service.get_error_category("WALLET_DECLINED"),
            "wallet_error"
        );
        assert_eq!(
            service.get_error_category("PAYMENT_CANCELLED"),
            "user_error"
        );
        assert_eq!(service.get_error_category("UNKNOWN_ERROR"), "unknown_error");
    }

    #[test]
    fn test_requires_immediate_notification() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        assert!(service.requires_immediate_notification("FRAUD_SUSPECTED"));
        assert!(service.requires_immediate_notification("CARD_BLOCKED"));
        assert!(service.requires_immediate_notification("LIMIT_EXCEEDED"));
        assert!(service.requires_immediate_notification("DAILY_LIMIT_EXCEEDED"));
        assert!(service.requires_immediate_notification("MONTHLY_LIMIT_EXCEEDED"));

        assert!(!service.requires_immediate_notification("INSUFFICIENT_FUNDS"));
        assert!(!service.requires_immediate_notification("CARD_DECLINED"));
        assert!(!service.requires_immediate_notification("TIMEOUT"));
    }

    #[test]
    fn test_parse_payment_status_extended() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        assert_eq!(
            service.parse_payment_status("NEW").unwrap(),
            PaymentStatus::Initialized
        );
        assert_eq!(
            service.parse_payment_status("FORM_SHOWED").unwrap(),
            PaymentStatus::Initialized
        );
        assert_eq!(
            service.parse_payment_status("AUTHORIZING").unwrap(),
            PaymentStatus::Pending
        );
        assert_eq!(
            service.parse_payment_status("3DS_CHECKING").unwrap(),
            PaymentStatus::Pending
        );
        assert_eq!(
            service.parse_payment_status("CONFIRMING").unwrap(),
            PaymentStatus::Pending
        );
        assert_eq!(
            service.parse_payment_status("CONFIRMED").unwrap(),
            PaymentStatus::Completed
        );
        assert_eq!(
            service.parse_payment_status("AUTHORIZED").unwrap(),
            PaymentStatus::Completed
        );
        assert_eq!(
            service.parse_payment_status("REJECTED").unwrap(),
            PaymentStatus::Failed
        );
        assert_eq!(
            service.parse_payment_status("AUTH_FAIL").unwrap(),
            PaymentStatus::Failed
        );
        assert_eq!(
            service.parse_payment_status("DEADLINE_EXPIRED").unwrap(),
            PaymentStatus::Failed
        );
        assert_eq!(
            service.parse_payment_status("CANCELED").unwrap(),
            PaymentStatus::Cancelled
        );
        assert_eq!(
            service.parse_payment_status("REVERSED").unwrap(),
            PaymentStatus::Cancelled
        );
        assert_eq!(
            service.parse_payment_status("REFUNDED").unwrap(),
            PaymentStatus::Cancelled
        );
        assert_eq!(
            service.parse_payment_status("PARTIAL_REVERSED").unwrap(),
            PaymentStatus::Completed
        );

        assert!(service.parse_payment_status("UNKNOWN_STATUS").is_err());
    }

    #[test]
    fn test_payment_completion_result() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        // Test completed payment - should not be retryable
        let completion = PaymentCompletion {
            transaction_id: "txn_123".to_string(),
            status: PaymentStatus::Completed,
            commission_amount: Some(Decimal::from(10)),
            completion_time: Utc::now(),
            error_code: None,
            error_message: None,
        };

        let result = PaymentCompletionResult::new(completion, &service);
        assert!(!result.can_retry);
        assert_eq!(
            result.user_friendly_message,
            "Payment completed successfully"
        );
        assert!(result.is_successful());
        assert!(!result.is_failed());
        assert!(!result.is_cancelled());

        // Test failed payment with retryable error - should be retryable
        let completion = PaymentCompletion {
            transaction_id: "txn_124".to_string(),
            status: PaymentStatus::Failed,
            commission_amount: None,
            completion_time: Utc::now(),
            error_code: Some("TIMEOUT".to_string()),
            error_message: Some("Connection timeout".to_string()),
        };

        let result = PaymentCompletionResult::new(completion, &service);
        assert!(result.can_retry);
        assert_eq!(result.user_friendly_message, "Transaction timeout");
        assert!(!result.is_successful());
        assert!(result.is_failed());
        assert!(!result.is_cancelled());
        assert!(result.is_technical_error());

        // Test failed payment with non-retryable error - should not be retryable
        let completion = PaymentCompletion {
            transaction_id: "txn_125".to_string(),
            status: PaymentStatus::Failed,
            commission_amount: None,
            completion_time: Utc::now(),
            error_code: Some("INSUFFICIENT_FUNDS".to_string()),
            error_message: Some("Not enough funds".to_string()),
        };

        let result = PaymentCompletionResult::new(completion, &service);
        assert!(!result.can_retry);
        assert_eq!(
            result.user_friendly_message,
            "Insufficient funds on the card"
        );
        assert!(!result.is_successful());
        assert!(result.is_failed());
        assert!(!result.is_cancelled());
        assert!(result.is_user_error());

        // Test cancelled payment - should not be retryable
        let completion = PaymentCompletion {
            transaction_id: "txn_126".to_string(),
            status: PaymentStatus::Cancelled,
            commission_amount: None,
            completion_time: Utc::now(),
            error_code: None,
            error_message: None,
        };

        let result = PaymentCompletionResult::new(completion, &service);
        assert!(!result.can_retry);
        assert_eq!(result.user_friendly_message, "Payment was cancelled");
        assert!(!result.is_successful());
        assert!(!result.is_failed());
        assert!(result.is_cancelled());
    }

    #[tokio::test]
    async fn test_process_webhook_completion() {
        let service = PaymentCompletionService::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        let webhook_data = json!({
            "Status": "CONFIRMED",
            "PaymentId": "payment_123",
            "Commission": 1000
        });

        let completion = service
            .process_webhook_completion(webhook_data)
            .await
            .unwrap();
        assert_eq!(completion.status, PaymentStatus::Completed);
        assert_eq!(completion.transaction_id, "payment_123");
        assert_eq!(completion.commission_amount, Some(Decimal::from(10)));
    }
}
