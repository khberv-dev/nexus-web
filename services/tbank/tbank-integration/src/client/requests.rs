use reqwest::RequestBuilder;
use serde::Deserialize;
use std::sync::Arc;
use tracing::{debug, error, warn};

use super::core::{TBankClient, TBankResponse};
use super::retry::RetryPolicy;
use crate::types::{TBankError, TBankResult};

/// Request execution trait for T-Bank client
pub trait RequestExecutor {
    /// Execute request with retry policy and handle T-Bank API response format
    async fn execute_request_with_retry<T>(
        &self,
        endpoint: &str,
        request_builder: RequestBuilder,
        retry_policy: RetryPolicy,
    ) -> TBankResult<T>
    where
        T: for<'de> Deserialize<'de> + Send + 'static;

    /// Execute request and handle T-Bank API response format
    async fn execute_request<T>(&self, request: RequestBuilder) -> TBankResult<T>
    where
        T: for<'de> Deserialize<'de>;
}

impl RequestExecutor for TBankClient {
    /// Execute request with retry policy and handle T-Bank API response format
    async fn execute_request_with_retry<T>(
        &self,
        endpoint: &str,
        request_builder: RequestBuilder,
        retry_policy: RetryPolicy,
    ) -> TBankResult<T>
    where
        T: for<'de> Deserialize<'de> + Send + 'static,
    {
        let client = self.clone();
        let request_builder = Arc::new(tokio::sync::Mutex::new(Some(request_builder)));

        self.retry_executor
            .execute(endpoint, retry_policy, || {
                let client = client.clone();
                let request_builder = request_builder.clone();
                async move {
                    let mut guard = request_builder.lock().await;
                    let request = guard.take().ok_or_else(|| {
                        TBankError::InternalError("Request builder already consumed".to_string())
                    })?;

                    client.execute_request(request).await
                }
            })
            .await
    }

    /// Execute request and handle T-Bank API response format
    async fn execute_request<T>(&self, request: RequestBuilder) -> TBankResult<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        let response = request.send().await.map_err(|e| {
            error!(error = %e, "Failed to send request to T-Bank API");
            TBankError::NetworkError(e.to_string())
        })?;

        let status = response.status();
        let response_text = response.text().await.map_err(|e| {
            error!(error = %e, "Failed to read response body");
            TBankError::NetworkError(e.to_string())
        })?;

        debug!(
            status = %status,
            response_body = %response_text,
            "Received T-Bank API response"
        );

        // Handle HTTP error status codes
        if !status.is_success() {
            let error_message = if response_text.is_empty() {
                format!("HTTP {}", status)
            } else {
                response_text
            };

            error!(
                status = %status,
                message = %error_message,
                "T-Bank API returned error status"
            );

            return Err(TBankError::TBankApiError {
                status: status.as_u16(),
                message: error_message,
                error_code: None,
            });
        }

        // Try to parse as wrapped T-Bank response first (with Success field)
        if let Ok(tbank_response) = serde_json::from_str::<TBankResponse<T>>(&response_text) {
            debug!("Parsed response as wrapped T-Bank format");
            
            // Check T-Bank success flag
            if !tbank_response.success {
                let error_message = tbank_response
                    .message
                    .or(tbank_response.details)
                    .unwrap_or_else(|| "Unknown T-Bank API error".to_string());

                warn!(
                    error_code = ?tbank_response.error_code,
                    message = %error_message,
                    "T-Bank API returned business logic error"
                );

                return Err(TBankError::TBankApiError {
                    status: status.as_u16(),
                    message: error_message,
                    error_code: tbank_response.error_code,
                });
            }

            // Extract data from successful wrapped response
            return tbank_response.data.ok_or_else(|| {
                error!("T-Bank API response marked as successful but contains no data");
                TBankError::TBankApiError {
                    status: status.as_u16(),
                    message: "Successful response contains no data".to_string(),
                    error_code: Some("NO_DATA".to_string()),
                }
            });
        }

        // If wrapped format fails, try to parse as direct response (actual T-Bank API format)
        match serde_json::from_str::<T>(&response_text) {
            Ok(direct_response) => {
                debug!("Parsed response as direct T-Bank format (no wrapper)");
                Ok(direct_response)
            }
            Err(e) => {
                error!(
                    error = %e,
                    response_body = %response_text,
                    "Failed to parse T-Bank API response in both wrapped and direct formats"
                );
                Err(TBankError::SerializationError(e))
            }
        }
    }
}
