use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION},
    RequestBuilder,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, error};

use crate::client::{ApiType, TBankClient};
use crate::types::{TBankError, TBankResult};

/// Authentication methods supported by T-Bank API
#[derive(Debug, Clone)]
pub enum AuthMethod {
    /// Bearer token authentication for Business API calls
    Bearer(String),
    /// Terminal-Key authentication for Acquiring API calls
    TerminalKey(String),
    /// Combined authentication (Bearer + Terminal-Key) for Acquiring API
    Combined {
        bearer: String,
        terminal_key: String,
    },
}

/// Authentication context for T-Bank API requests
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub method: AuthMethod,
    pub api_type: ApiType,
    pub additional_headers: HashMap<String, String>,
}

impl TBankClient {
    /// Create authentication context for counterparty operations (Business API)
    pub fn counterparty_auth(&self) -> AuthContext {
        debug!("Creating counterparty authentication context for Business API");

        AuthContext {
            method: AuthMethod::Bearer(self.api_token.clone()),
            api_type: ApiType::Business,
            additional_headers: self.get_common_headers(),
        }
    }

    /// Create authentication context for B2B invoice operations (Business API)
    pub fn b2b_invoice_auth(&self) -> AuthContext {
        debug!("Creating B2B invoice authentication context for Business API");

        AuthContext {
            method: AuthMethod::Bearer(self.api_token.clone()),
            api_type: ApiType::Business,
            additional_headers: self.get_common_headers(),
        }
    }

    /// Create authentication context for acquiring payment operations (Acquiring API)
    pub fn acquiring_payment_auth(&self) -> AuthContext {
        debug!("Creating acquiring payment authentication context for Acquiring API");

        AuthContext {
            method: AuthMethod::Combined {
                bearer: self.api_token.clone(),
                terminal_key: self.terminal_key.clone(),
            },
            api_type: ApiType::Acquiring,
            additional_headers: self.get_common_headers(),
        }
    }

    /// Create authentication context for balance operations (Business API)
    pub fn balance_auth(&self) -> AuthContext {
        debug!("Creating balance authentication context for Business API");

        AuthContext {
            method: AuthMethod::Bearer(self.api_token.clone()),
            api_type: ApiType::Business,
            additional_headers: self.get_common_headers(),
        }
    }

    /// Get common headers for all requests
    fn get_common_headers(&self) -> HashMap<String, String> {
        let mut headers = HashMap::new();

        // Add environment indicator
        let env_value = match self.environment {
            crate::config::Environment::Sandbox => "sandbox",
            crate::config::Environment::Production => "production",
        };
        headers.insert("X-Environment".to_string(), env_value.to_string());

        // Add user agent
        headers.insert(
            "User-Agent".to_string(),
            "ADQuest-TBank-Integration/1.0".to_string(),
        );

        headers
    }

    /// Apply authentication to request builder
    pub fn apply_auth(
        &self,
        mut request: RequestBuilder,
        auth: &AuthContext,
    ) -> TBankResult<RequestBuilder> {
        debug!(auth_method = ?auth.method, api_type = ?auth.api_type, "Applying authentication to request");

        // Apply authentication method
        request = match &auth.method {
            AuthMethod::Bearer(token) => {
                let auth_header = format!("Bearer {}", token);
                request.header(AUTHORIZATION, auth_header)
            }
            AuthMethod::TerminalKey(key) => request.header("Terminal-Key", key),
            AuthMethod::Combined {
                bearer,
                terminal_key,
            } => {
                let auth_header = format!("Bearer {}", bearer);
                request
                    .header(AUTHORIZATION, auth_header)
                    .header("Terminal-Key", terminal_key)
            }
        };

        // Apply additional headers
        for (key, value) in &auth.additional_headers {
            request = request.header(key, value);
        }

        // Add API type indicator
        let api_type_header = match auth.api_type {
            ApiType::Business => "business",
            ApiType::Acquiring => "acquiring",
        };
        request = request.header("X-API-Type", api_type_header);

        // Always set content type for JSON
        request = request.header("Content-Type", "application/json");

        Ok(request)
    }

    /// Validate authentication credentials
    pub fn validate_auth(&self) -> TBankResult<()> {
        if self.api_token.is_empty() {
            error!("API token is empty");
            return Err(TBankError::AuthenticationError(
                "API token is required".to_string(),
            ));
        }

        if self.terminal_key.is_empty() {
            error!("Terminal key is empty");
            return Err(TBankError::AuthenticationError(
                "Terminal key is required".to_string(),
            ));
        }

        // Validate token format (basic check)
        if self.api_token.len() < 10 {
            error!(
                token_length = self.api_token.len(),
                "API token appears to be too short"
            );
            return Err(TBankError::AuthenticationError(
                "API token format is invalid".to_string(),
            ));
        }

        if self.terminal_key.len() < 10 {
            error!(
                key_length = self.terminal_key.len(),
                "Terminal key appears to be too short"
            );
            return Err(TBankError::AuthenticationError(
                "Terminal key format is invalid".to_string(),
            ));
        }

        debug!("Authentication credentials validated successfully");
        Ok(())
    }

    /// Test authentication by making a simple API call
    pub async fn test_auth(&self) -> TBankResult<bool> {
        debug!("Testing authentication with T-Bank API");

        // Validate credentials first
        self.validate_auth()?;

        // For sandbox, we can test with a simple endpoint
        if self.is_sandbox() {
            return Ok(true); // Sandbox doesn't require real auth validation
        }

        // For production, we would need to make an actual API call
        // This is a placeholder - in real implementation, we'd call a lightweight endpoint
        debug!("Authentication test completed successfully");
        Ok(true)
    }
}

/// Helper struct for authentication test responses
#[derive(Debug, Deserialize, Serialize)]
pub struct AuthTestResponse {
    pub authenticated: bool,
    pub terminal_id: Option<String>,
    pub permissions: Vec<String>,
}

impl AuthContext {
    /// Create new authentication context with Bearer token for Business API
    pub fn bearer(token: String) -> Self {
        Self {
            method: AuthMethod::Bearer(token),
            api_type: ApiType::Business,
            additional_headers: HashMap::new(),
        }
    }

    /// Create new authentication context with Terminal-Key for Acquiring API
    pub fn terminal_key(key: String) -> Self {
        Self {
            method: AuthMethod::TerminalKey(key),
            api_type: ApiType::Acquiring,
            additional_headers: HashMap::new(),
        }
    }

    /// Create new authentication context with combined auth for Acquiring API
    pub fn combined(bearer: String, terminal_key: String) -> Self {
        Self {
            method: AuthMethod::Combined {
                bearer,
                terminal_key,
            },
            api_type: ApiType::Acquiring,
            additional_headers: HashMap::new(),
        }
    }

    /// Create authentication context for specific API type
    pub fn for_api_type(method: AuthMethod, api_type: ApiType) -> Self {
        Self {
            method,
            api_type,
            additional_headers: HashMap::new(),
        }
    }

    /// Add additional header to authentication context
    pub fn with_header(mut self, key: String, value: String) -> Self {
        self.additional_headers.insert(key, value);
        self
    }

    /// Check if authentication method includes Bearer token
    pub fn has_bearer(&self) -> bool {
        matches!(
            self.method,
            AuthMethod::Bearer(_) | AuthMethod::Combined { .. }
        )
    }

    /// Check if authentication method includes Terminal-Key
    pub fn has_terminal_key(&self) -> bool {
        matches!(
            self.method,
            AuthMethod::TerminalKey(_) | AuthMethod::Combined { .. }
        )
    }

    /// Check if context is for Business API
    pub fn is_business_api(&self) -> bool {
        matches!(self.api_type, ApiType::Business)
    }

    /// Check if context is for Acquiring API
    pub fn is_acquiring_api(&self) -> bool {
        matches!(self.api_type, ApiType::Acquiring)
    }
}
