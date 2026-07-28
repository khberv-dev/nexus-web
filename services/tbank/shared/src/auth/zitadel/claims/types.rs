use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Role value format in Zitadel tokens
/// Supports both old (boolean) and new (map with organizations) formats
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RoleValue {
    /// New format: {"org_id": "org_domain", ...}
    Map(HashMap<String, String>),
    /// Old format: true
    Bool(bool),
}

/// Zitadel JWT Claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZitadelClaims {
    pub sub: String,
    pub iss: String,
    pub aud: Vec<String>,
    pub exp: i64,
    pub iat: i64,
    pub nbf: Option<i64>,
    pub jti: Option<String>,
    pub azp: Option<String>,
    pub scope: Option<String>,
    pub email: Option<String>,
    pub email_verified: Option<bool>,
    pub name: Option<String>,
    pub preferred_username: Option<String>,
    #[serde(rename = "urn:zitadel:iam:org:project:roles")]
    pub roles: Option<Value>,
    pub permissions: Option<Vec<String>>,
    #[serde(rename = "urn:zitadel:iam:org:id")]
    pub org_id: Option<String>,
    pub organization_id: Option<String>,
    pub project_id: Option<String>,
    pub client_id: Option<String>,
    #[serde(rename = "urn:zitadel:iam:user:metadata")]
    pub metadata: Option<Value>,
    #[serde(flatten)]
    pub extra_fields: HashMap<String, Value>,
}

impl ZitadelClaims {
    /// Get user display name
    pub fn display_name(&self) -> String {
        self.name
            .clone()
            .or_else(|| self.preferred_username.clone())
            .or_else(|| self.email.clone())
            .unwrap_or_else(|| self.sub.clone())
    }

    /// Check if this is a service account token
    pub fn is_service_account(&self) -> bool {
        self.client_id
            .as_ref()
            .map(|id| id.contains('@') || id.contains("service"))
            .unwrap_or(false)
    }

    /// Get token type for logging
    pub fn token_type(&self) -> &str {
        if self.is_service_account() {
            "service_account"
        } else {
            "user"
        }
    }
}
