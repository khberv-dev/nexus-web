use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

/// Account type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, TS)]
#[sqlx(type_name = "organization_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub enum AccountType {
    Publisher,
    Advertiser,
    Agency,
}

impl std::fmt::Display for AccountType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AccountType::Publisher => write!(f, "publisher"),
            AccountType::Advertiser => write!(f, "advertiser"),
            AccountType::Agency => write!(f, "agency"),
        }
    }
}

/// Organization role enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, TS)]
#[sqlx(type_name = "user_organization_role", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub enum OrganizationRole {
    Owner,
    Admin,
    Member,
    Viewer,
}

/// Verification status enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, TS)]
#[sqlx(type_name = "verification_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub enum VerificationStatus {
    Pending,
    InReview,
    Verified,
    Rejected,
}

/// Legal entity information
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct LegalEntity {
    pub name: String,
    pub inn: String,
    pub kpp: Option<String>,
    pub ogrn: Option<String>,
    pub address: Option<String>,
}

/// Base organization model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    #[sqlx(rename = "type")]
    pub organization_type: AccountType,
    pub owner_user_id: String, // Zitadel sub
    #[sqlx(json)]
    #[ts(type = "any")]
    pub legal_entity: Option<serde_json::Value>,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Organization {
    /// Parse legal entity from JSON
    pub fn get_legal_entity(&self) -> Option<LegalEntity> {
        self.legal_entity
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    }

    /// Check if organization is deleted
    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }

    /// Check if organization is active
    pub fn is_active(&self) -> bool {
        !self.is_deleted()
    }
}

/// Request to create organization
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct CreateOrganizationRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub organization_type: AccountType,
    pub legal_entity: Option<LegalEntity>,
    #[ts(type = "any")]
    pub metadata: Option<serde_json::Value>,
}

/// Request to update organization
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct UpdateOrganizationRequest {
    pub name: Option<String>,
    pub legal_entity: Option<LegalEntity>,
    #[ts(type = "any")]
    pub metadata: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_type_display() {
        assert_eq!(AccountType::Publisher.to_string(), "publisher");
        assert_eq!(AccountType::Advertiser.to_string(), "advertiser");
        assert_eq!(AccountType::Agency.to_string(), "agency");
    }

    #[test]
    fn test_organization_is_active() {
        let org = Organization {
            id: Uuid::new_v4(),
            name: "Test Org".to_string(),
            organization_type: AccountType::Publisher,
            owner_user_id: "user123".to_string(),
            legal_entity: None,
            metadata: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        assert!(org.is_active());
        assert!(!org.is_deleted());
    }
}
