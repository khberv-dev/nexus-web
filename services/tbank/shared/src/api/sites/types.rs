use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Request for creating a new site
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSiteRequest {
    pub domain: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(deserialize_with = "deserialize_uuid_from_string")]
    pub organization_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

/// Custom deserializer for UUID that accepts both UUID strings and other formats
fn deserialize_uuid_from_string<'de, D>(deserializer: D) -> Result<Uuid, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Uuid::parse_str(&s).map_err(|e| serde::de::Error::custom(format!("Invalid UUID '{}': {}", s, e)))
}

/// Response for creating a new site
#[derive(Debug, Serialize)]
pub struct CreateSiteResponse {
    pub success: bool,
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    pub domain: String,
    pub name: String,
    #[serde(rename = "verificationToken")]
    pub verification_token: String,
    pub status: String,
    #[serde(rename = "organizationId")]
    pub organization_id: Uuid,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

/// Error response for site creation
#[derive(Debug, Serialize)]
pub struct CreateSiteError {
    pub success: bool,
    pub error: String,
    pub message: String,
}

/// Request for site verification
#[derive(Debug, Deserialize)]
pub struct VerifySiteRequest {
    #[serde(rename = "verificationToken")]
    pub verification_token: String,
    pub domain: String,
}

/// Response for site verification
/// Returns TWO keys: public_key (for widget) and site_key (for backend)
/// Note: site_key is used for both identification and HMAC signing
#[derive(Debug, Serialize)]
pub struct VerifySiteResponse {
    pub success: bool,
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    #[serde(rename = "publicKey")]
    pub public_key: String,
    #[serde(rename = "siteKey")]
    pub site_key: String,
    #[serde(rename = "secretKey", skip_serializing_if = "Option::is_none")]
    pub secret_key: Option<String>,
    pub domain: String,
    pub name: String,
    pub status: String,
    #[serde(rename = "verifiedAt")]
    pub verified_at: DateTime<Utc>,
    #[serde(rename = "rateLimitPerHour")]
    pub rate_limit_per_hour: i32,
}

/// Error response for site verification
#[derive(Debug, Serialize)]
pub struct VerifySiteError {
    pub success: bool,
    pub error: String,
    pub message: String,
    #[serde(rename = "existingSiteId", skip_serializing_if = "Option::is_none")]
    pub existing_site_id: Option<Uuid>,
}

/// Request for site restoration
#[derive(Debug, Deserialize)]
pub struct RestoreSiteRequest {
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
}

/// Response for site restoration
#[derive(Debug, Serialize)]
pub struct RestoreSiteResponse {
    pub success: bool,
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    #[serde(rename = "siteKey")]
    pub site_key: String,
    pub status: String,
    #[serde(rename = "restoredAt")]
    pub restored_at: DateTime<Utc>,
}

/// Request for key rotation
#[derive(Debug, Deserialize)]
pub struct RotateKeysRequest {
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Response for key rotation
#[derive(Debug, Serialize)]
pub struct RotateKeysResponse {
    pub success: bool,
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    #[serde(rename = "newSiteKey")]
    pub new_site_key: String,
    #[serde(rename = "newSecretKey", skip_serializing_if = "Option::is_none")]
    pub new_secret_key: Option<String>,
    #[serde(rename = "oldSiteKey")]
    pub old_site_key: String,
    #[serde(rename = "gracePeriodEnds")]
    pub grace_period_ends: DateTime<Utc>,
    pub message: String,
}

/// Site information response
#[derive(Debug, Serialize)]
pub struct SiteInfoResponse {
    pub success: bool,
    pub site: SiteInfo,
}

#[derive(Debug, Serialize)]
pub struct SiteInfo {
    pub id: Uuid,
    #[serde(rename = "publicKey", skip_serializing_if = "Option::is_none")]
    pub public_key: Option<String>,
    #[serde(rename = "siteKey")]
    pub site_key: String,
    pub domain: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "organizationId")]
    pub organization_id: Uuid,
    #[serde(rename = "rateLimitPerHour")]
    pub rate_limit_per_hour: i32,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "verifiedAt", skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<DateTime<Utc>>,
}

/// List of sites response
#[derive(Debug, Serialize)]
pub struct SiteListResponse {
    pub success: bool,
    pub sites: Vec<SiteInfo>,
    pub total: usize,
}

/// Response for getting site keys
#[derive(Debug, Serialize)]
pub struct SiteKeysResponse {
    pub success: bool,
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    #[serde(rename = "siteKey")]
    pub site_key: String,
    #[serde(rename = "secretKey", skip_serializing_if = "Option::is_none")]
    pub secret_key: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "rateLimitPerHour")]
    pub rate_limit_per_hour: i32,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

/// Request for updating site
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSiteRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

/// Response for updating site
#[derive(Debug, Serialize)]
pub struct UpdateSiteResponse {
    pub success: bool,
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    pub domain: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

/// Error response for site update
#[derive(Debug, Serialize)]
pub struct UpdateSiteError {
    pub success: bool,
    pub error: String,
    pub message: String,
}

/// Request for regenerating keys
#[derive(Debug, Deserialize)]
pub struct RegenerateKeysRequest {
    #[serde(rename = "gracePeriodDays", skip_serializing_if = "Option::is_none")]
    pub grace_period_days: Option<i32>,
}

/// Response for regenerating keys
#[derive(Debug, Serialize)]
pub struct RegenerateKeysResponse {
    pub success: bool,
    #[serde(rename = "siteId")]
    pub site_id: Uuid,
    #[serde(rename = "newSiteKey")]
    pub new_site_key: String,
    #[serde(rename = "newSecretKey")]
    pub new_secret_key: String,
    #[serde(rename = "oldSiteKey")]
    pub old_site_key: String,
    #[serde(rename = "gracePeriodEnds")]
    pub grace_period_ends: DateTime<Utc>,
    pub message: String,
}
