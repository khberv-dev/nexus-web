use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE},
    Client, RequestBuilder,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error};

use super::auth::AuthContext;
use super::retry::{RetryExecutor, RetryPolicy};
use crate::config::{Environment, TBankConfig};
use crate::types::{TBankError, TBankResult};

/// API type for T-Bank operations
#[derive(Debug, Clone, PartialEq)]
pub enum ApiType {
    /// Business API for B2B invoices and counterparty operations
    Business,
    /// Acquiring API for payment processing
    Acquiring,
}

/// T-Bank HTTP client with environment-specific configuration
#[derive(Debug, Clone)]
pub struct TBankClient {
    pub business_base_url: String,
    pub acquiring_base_url: String,
    pub api_token: String,
    pub terminal_key: String,
    pub http_client: Client,
    pub environment: Environment,
    pub retry_executor: Arc<RetryExecutor>,
}

/// Standard T-Bank API response wrapper
#[derive(Debug, Deserialize, Serialize)]
pub struct TBankResponse<T> {
    #[serde(rename = "Success")]
    pub success: bool,
    #[serde(rename = "ErrorCode")]
    pub error_code: Option<String>,
    #[serde(rename = "Message")]
    pub message: Option<String>,
    #[serde(rename = "Details")]
    pub details: Option<String>,
    #[serde(flatten)]
    pub data: Option<T>,
}

impl TBankClient {
    /// Create new T-Bank client with configuration
    pub fn new(config: Arc<TBankConfig>) -> TBankResult<Self> {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .user_agent("ADQuest-TBank-Integration/1.0")
            .build()
            .map_err(|e| TBankError::NetworkError(e.to_string()))?;

        debug!(
            environment = ?config.environment,
            business_base_url = %config.business_api_base_url,
            acquiring_base_url = %config.acquiring_api_base_url,
            "Creating T-Bank client"
        );

        let client = Self {
            business_base_url: config.business_api_base_url.clone(),
            acquiring_base_url: config.acquiring_api_base_url.clone(),
            api_token: config.api_token.clone(),
            terminal_key: config.terminal_key.clone(),
            http_client,
            environment: config.environment.clone(),
            retry_executor: Arc::new(RetryExecutor::new()),
        };

        Ok(client)
    }

    /// Check if client is configured for sandbox environment
    pub fn is_sandbox(&self) -> bool {
        matches!(self.environment, Environment::Sandbox)
    }

    /// Check if client is configured for production environment
    pub fn is_production(&self) -> bool {
        matches!(self.environment, Environment::Production)
    }

    /// Get environment-specific endpoint URL for specific API type
    pub fn endpoint_url(&self, path: &str, api_type: ApiType) -> String {
        let base_url = match api_type {
            ApiType::Business => &self.business_base_url,
            ApiType::Acquiring => &self.acquiring_base_url,
        };
        format!("{}{}", base_url, path)
    }

    /// Get Business API base URL
    pub fn business_base_url(&self) -> &str {
        &self.business_base_url
    }

    /// Get Acquiring API base URL
    pub fn acquiring_base_url(&self) -> &str {
        &self.acquiring_base_url
    }

    /// Validate environment for operation
    pub fn validate_environment_for_operation(
        &self,
        operation: &str,
        requires_production: bool,
    ) -> TBankResult<()> {
        match (requires_production, &self.environment) {
            (true, Environment::Sandbox) => {
                error!(
                    operation = %operation,
                    "Attempted production operation in sandbox environment"
                );
                Err(TBankError::ProductionOperationInSandbox)
            }
            (false, Environment::Production) => {
                tracing::warn!(
                    operation = %operation,
                    "Sandbox operation attempted in production environment"
                );
                Err(TBankError::SandboxOperationInProduction)
            }
            _ => Ok(()),
        }
    }

    /// Get circuit breaker state for endpoint
    pub fn circuit_breaker_state(&self, endpoint: &str) -> super::retry::CircuitBreakerState {
        self.retry_executor.get_circuit_breaker(endpoint).state()
    }

    /// Get failure rate for endpoint
    pub fn failure_rate(&self, endpoint: &str) -> f64 {
        self.retry_executor
            .get_circuit_breaker(endpoint)
            .failure_rate()
    }

    /// Create authenticated request builder with appropriate authentication for API type
    pub fn authenticated_request(
        &self,
        method: reqwest::Method,
        path: &str,
        api_type: ApiType,
    ) -> RequestBuilder {
        let base_url = match api_type {
            ApiType::Business => &self.business_base_url,
            ApiType::Acquiring => &self.acquiring_base_url,
        };
        let url = format!("{}{}", base_url, path);

        debug!(
            method = %method,
            url = %url,
            api_type = ?api_type,
            environment = ?self.environment,
            "Creating authenticated request"
        );

        let mut headers = HeaderMap::new();

        // Apply authentication based on API type
        match api_type {
            ApiType::Business => {
                // Business API uses Bearer token authentication
                let auth_header = format!("Bearer {}", self.api_token);
                headers.insert(
                    AUTHORIZATION,
                    HeaderValue::from_str(&auth_header).expect("Invalid authorization header"),
                );
            }
            ApiType::Acquiring => {
                // Acquiring API uses Terminal-Key authentication
                headers.insert(
                    "Terminal-Key",
                    HeaderValue::from_str(&self.terminal_key).expect("Invalid terminal key header"),
                );

                // Also include Bearer token for Acquiring API
                let auth_header = format!("Bearer {}", self.api_token);
                headers.insert(
                    AUTHORIZATION,
                    HeaderValue::from_str(&auth_header).expect("Invalid authorization header"),
                );
            }
        }

        // Set content type for JSON requests
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        // Add environment indicator for debugging
        let env_header = match self.environment {
            Environment::Sandbox => "sandbox",
            Environment::Production => "production",
        };
        headers.insert(
            "X-Environment",
            HeaderValue::from_str(env_header).expect("Invalid environment header"),
        );

        // Add API type indicator
        let api_type_header = match api_type {
            ApiType::Business => "business",
            ApiType::Acquiring => "acquiring",
        };
        headers.insert(
            "X-API-Type",
            HeaderValue::from_str(api_type_header).expect("Invalid API type header"),
        );

        self.http_client.request(method, &url).headers(headers)
    }

    /// Create request with specific authentication context and API type
    pub fn request_with_auth(
        &self,
        method: reqwest::Method,
        path: &str,
        auth: &AuthContext,
        api_type: ApiType,
    ) -> TBankResult<RequestBuilder> {
        let base_url = match api_type {
            ApiType::Business => &self.business_base_url,
            ApiType::Acquiring => &self.acquiring_base_url,
        };
        let url = format!("{}{}", base_url, path);
        let request = self.http_client.request(method, &url);

        // Use the apply_auth method from auth.rs
        self.apply_auth(request, auth)
    }

    /// Check API connectivity for health checks
    pub async fn check_api_connectivity(&self) -> TBankResult<()> {
        debug!("Checking T-Bank API connectivity");

        // For sandbox, we can make a simple request to check connectivity
        // For production, we need to be careful not to make actual operations
        match self.environment {
            Environment::Sandbox => {
                // In sandbox, try to access a simple endpoint
                let request = self.authenticated_request(
                    reqwest::Method::GET,
                    "/ping", // This might not exist, but will show connectivity
                    ApiType::Business,
                );

                match request.send().await {
                    Ok(response) => {
                        debug!(
                            status = response.status().as_u16(),
                            "T-Bank API connectivity check completed"
                        );
                        // Even 404 means we can connect
                        if response.status().is_client_error() || response.status().is_success() {
                            Ok(())
                        } else {
                            Err(TBankError::TBankApiError {
                                status: response.status().as_u16(),
                                message: format!(
                                    "T-Bank API returned server error: {}",
                                    response.status()
                                ),
                                error_code: None,
                            })
                        }
                    }
                    Err(e) => {
                        error!(error = %e, "T-Bank API connectivity check failed");
                        Err(TBankError::NetworkError(e.to_string()))
                    }
                }
            }
            Environment::Production => {
                // In production, just check if we can resolve the domain and connect
                let url = format!("{}/", self.business_base_url);
                match self.http_client.head(&url).send().await {
                    Ok(response) => {
                        debug!(
                            status = response.status().as_u16(),
                            "T-Bank API connectivity check completed"
                        );
                        // Any response means connectivity is working
                        Ok(())
                    }
                    Err(e) => {
                        error!(error = %e, "T-Bank API connectivity check failed");
                        Err(TBankError::NetworkError(e.to_string()))
                    }
                }
            }
        }
    }
}
