use serde::{Deserialize, Serialize};
use crate::models::organization::AccountType;

/// Request for creating organization
#[derive(Debug, Deserialize)]
pub struct CreateOrganizationRequest {
    #[serde(rename = "organizationName")]
    pub organization_name: String,
    #[serde(rename = "organizationType")]
    pub organization_type: AccountType,
    #[serde(rename = "ownerEmail")]
    pub owner_email: String,
    #[serde(rename = "ownerFirstName")]
    pub owner_first_name: String,
    #[serde(rename = "ownerLastName")]
    pub owner_last_name: String,
    #[serde(rename = "legalEntity")]
    pub legal_entity: Option<LegalEntity>,
    // Zitadel данные (будут заполнены сервером)
    #[serde(rename = "zitadelOrgId", skip_serializing_if = "Option::is_none")]
    pub zitadel_org_id: Option<String>,
    #[serde(rename = "zitadelProjectId", skip_serializing_if = "Option::is_none")]
    pub zitadel_project_id: Option<String>,
    #[serde(rename = "zitadelClientId", skip_serializing_if = "Option::is_none")]
    pub zitadel_client_id: Option<String>,
    #[serde(rename = "ownerUserId", skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LegalEntity {
    #[serde(rename = "organizationForm")]
    pub organization_form: String, // "ooo", "ip", "ao"
    pub name: String,
    pub inn: String,
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kpp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ogrn: Option<String>,
}

/// Response for create organization
#[derive(Debug, Serialize)]
pub struct CreateOrganizationResponse {
    pub success: bool,
    #[serde(rename = "organizationId")]
    pub organization_id: String,
    #[serde(rename = "zitadelOrgId")]
    pub zitadel_org_id: String,
    #[serde(rename = "zitadelProjectId")]
    pub zitadel_project_id: String,
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "loginUrl")]
    pub login_url: String,
    #[serde(rename = "redirectUrl")]
    pub redirect_url: String,
}

/// Error response for organization creation
#[derive(Debug, Serialize)]
pub struct CreateOrganizationError {
    pub success: bool,
    pub error: String,
    pub message: String,
    #[serde(rename = "suggestedNames", skip_serializing_if = "Option::is_none")]
    pub suggested_names: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<std::collections::HashMap<String, String>>,
    #[serde(rename = "retryAfter", skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
}