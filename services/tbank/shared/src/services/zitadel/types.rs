use serde::{Deserialize, Serialize};

/// Zitadel organization creation request
#[derive(Debug, Serialize)]
pub struct CreateZitadelOrgRequest {
    pub name: String,
}

/// Zitadel organization response
#[derive(Debug, Deserialize)]
pub struct ZitadelOrgResponse {
    pub id: String,
    pub details: Option<ZitadelDetails>,
}

/// Common Zitadel details structure
#[derive(Debug, Deserialize)]
pub struct ZitadelDetails {
    pub sequence: String,
    #[serde(rename = "creationDate")]
    pub creation_date: String,
    #[serde(rename = "resourceOwner")]
    pub resource_owner: String,
}

/// Zitadel project creation request
#[derive(Debug, Serialize)]
pub struct CreateZitadelProjectRequest {
    pub name: String,
    pub project_role_assertion: bool,
    pub project_role_check: bool,
}

/// Zitadel project response
#[derive(Debug, Deserialize)]
pub struct ZitadelProjectResponse {
    pub id: String,
    pub details: Option<ZitadelDetails>,
}

/// Zitadel OIDC application creation request
#[derive(Debug, Serialize)]
pub struct CreateZitadelAppRequest {
    pub name: String,
    pub redirect_uris: Vec<String>,
    pub post_logout_redirect_uris: Vec<String>,
    pub response_types: Vec<String>,
    pub grant_types: Vec<String>,
    pub app_type: String,
    pub auth_method_type: String,
    pub version: String,
}

/// Zitadel OIDC application response
#[derive(Debug, Deserialize)]
pub struct ZitadelAppResponse {
    #[serde(rename = "appId")]
    pub app_id: String,
    #[serde(rename = "clientId")]
    pub client_id: String,
    pub details: Option<ZitadelDetails>,
}

/// Zitadel user creation request
#[derive(Debug, Serialize)]
pub struct CreateZitadelUserRequest {
    pub user_name: String,
    pub profile: ZitadelUserProfile,
    pub email: ZitadelUserEmail,
    pub initial_password: String,
}

/// Zitadel user profile
#[derive(Debug, Serialize)]
pub struct ZitadelUserProfile {
    pub first_name: String,
    pub last_name: String,
    pub display_name: String,
    pub preferred_language: String,
}

/// Zitadel user email
#[derive(Debug, Serialize)]
pub struct ZitadelUserEmail {
    pub email: String,
    pub is_email_verified: bool,
}

/// Zitadel user creation response
#[derive(Debug, Deserialize)]
pub struct ZitadelUserResponse {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub details: Option<ZitadelDetails>,
}

/// Organization setup request (using Setup API)
#[derive(Debug, Serialize)]
pub struct SetupOrganizationRequest {
    pub org: SetupOrgData,
    pub human: SetupHumanData,
    pub roles: Vec<String>,
}

/// Organization data for setup
#[derive(Debug, Serialize)]
pub struct SetupOrgData {
    pub name: String,
}

/// Human user data for setup
#[derive(Debug, Serialize)]
pub struct SetupHumanData {
    #[serde(rename = "userName")]
    pub user_name: String,
    pub profile: ZitadelUserProfile,
    pub email: ZitadelUserEmail,
    pub password: String,
}

/// Organization setup response
#[derive(Debug, Deserialize)]
pub struct SetupOrganizationResponse {
    #[serde(rename = "orgId")]
    pub org_id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    pub details: Option<ZitadelDetails>,
}

/// Setup result
#[derive(Debug)]
pub struct SetupResult {
    pub org_id: String,
    pub user_id: String,
}

/// User grant creation request
#[derive(Debug, Serialize)]
pub struct CreateUserGrantRequest {
    pub project_id: String,
    pub role_keys: Vec<String>,
}

/// Organization creation result
#[derive(Debug)]
pub struct OrganizationCreationResult {
    pub org_id: String,
    pub project_id: String,
    pub client_id: String,
    pub login_url: String,
}