use std::time::Duration;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

use crate::types::{TBankError, TBankResult};

/// Webhook retry executor with exponential backoff
pub struct WebhookRetryExecutor {
    max_retries: u32,
    base_delay_ms: u64,
    max_delay_ms: u64,
}

impl WebhookRetryExecutor {
    /// Create new webhook retry executor
    pub fn new() -> Self {
        Self {
            max_retries: 5,
            base_delay_ms: 100,
            max_delay_ms: 30000, // 30 seconds max delay
        }
    }

    /// Create webhook retry executor with custom settings
    pub fn with_settings(max_retries: u32, base_delay_ms: u64, max_delay_ms: u64) -> Self {
        Self {
            max_retries,
            base_delay_ms,
            max_delay_ms,
        }
    }

    /// Execute operation with exponential backoff retry
    pub async fn execute_with_retry<F, Fut, T>(
        &self,
        operation_name: &str,
        operation: F,
    ) -> TBankResult<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = TBankResult<T>>,
    {
        let mut last_error = None;

        for attempt in 0..=self.max_retries {
            if attempt > 0 {
                let delay = self.calculate_delay(attempt);
                debug!(
                    operation = %operation_name,
                    attempt = attempt,
                    delay_ms = delay.as_millis(),
                    "Retrying webhook operation after delay"
                );
                sleep(delay).await;
            }

            debug!(
                operation = %operation_name,
                attempt = attempt,
                max_retries = self.max_retries,
                "Executing webhook operation"
            );

            match operation().await {
                Ok(result) => {
                    if attempt > 0 {
                        info!(
                            operation = %operation_name,
                            attempt = attempt,
                            "Webhook operation succeeded after retry"
                        );
                    } else {
                        debug!(
                            operation = %operation_name,
                            "Webhook operation succeeded on first attempt"
                        );
                    }
                    return Ok(result);
                }
                Err(e) => {
                    last_error = Some(e.clone());

                    if self.should_retry(&e) && attempt < self.max_retries {
                        warn!(
                            error = %e,
                            operation = %operation_name,
                            attempt = attempt,
                            "Webhook operation failed, will retry"
                        );
                        continue;
                    } else {
                        error!(
                            error = %e,
                            operation = %operation_name,
                            attempt = attempt,
                            max_retries = self.max_retries,
                            "Webhook operation failed permanently"
                        );
                        break;
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            TBankError::InternalError("Retry executor failed without error".to_string())
        }))
    }

    /// Calculate exponential backoff delay
    fn calculate_delay(&self, attempt: u32) -> Duration {
        let delay_ms = self.base_delay_ms * (2_u64.pow(attempt.saturating_sub(1)));
        let delay_ms = delay_ms.min(self.max_delay_ms);

        // Add some jitter to prevent thundering herd
        let jitter = fastrand::u64(0..=delay_ms / 10);
        let final_delay_ms = delay_ms + jitter;

        Duration::from_millis(final_delay_ms)
    }

    /// Determine if error should trigger a retry
    fn should_retry(&self, error: &TBankError) -> bool {
        match error {
            // Retry on network errors
            TBankError::NetworkError(_) => true,

            // Retry on database errors (temporary issues)
            TBankError::DatabaseError(_) => true,

            // Retry on T-Bank API server errors (5xx)
            TBankError::TBankApiError { status, .. } => *status >= 500,

            // Retry on rate limiting
            TBankError::RateLimitExceeded => true,

            // Retry on circuit breaker (it might close)
            TBankError::CircuitBreakerOpen => true,

            // Don't retry on validation errors
            TBankError::ValidationError(_) => false,

            // Don't retry on authentication errors
            TBankError::AuthenticationError(_) => false,
            TBankError::InvalidWebhookSignature => false,

            // Don't retry on business logic errors
            TBankError::InvoiceNotFound { .. } => false,
            TBankError::PaymentNotFound { .. } => false,
            TBankError::DuplicateWebhookEvent { .. } => false,

            // Don't retry on invalid status transitions
            TBankError::InvalidInvoiceStatusTransition { .. } => false,
            TBankError::InvalidPaymentStatusTransition { .. } => false,

            // Retry on webhook processing failures (might be temporary)
            TBankError::WebhookProcessingFailed { .. } => true,

            // Default: don't retry
            _ => false,
        }
    }

    /// Get retry settings
    pub fn get_settings(&self) -> (u32, u64, u64) {
        (self.max_retries, self.base_delay_ms, self.max_delay_ms)
    }

    /// Check if maximum retries exceeded
    pub fn is_max_retries_exceeded(&self, retry_count: u32) -> bool {
        retry_count >= self.max_retries
    }

    /// Calculate next retry delay for given attempt
    pub fn next_retry_delay(&self, attempt: u32) -> Duration {
        self.calculate_delay(attempt + 1)
    }
}

impl Default for WebhookRetryExecutor {
    fn default() -> Self {
        Self::new()
    }
}
