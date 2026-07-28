use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

use super::OrganizationRole;

/// User-Organization relationship (many-to-many)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct UserOrganization {
    pub id: Uuid,
    pub user_id: String, // Zitadel sub
    pub organization_id: Uuid,
    pub role: OrganizationRole,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub permissions: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl UserOrganization {
    /// Get permissions as Vec<String>
    pub fn get_permissions(&self) -> Vec<String> {
        serde_json::from_value(self.permissions.clone()).unwrap_or_default()
    }

    /// Check if user has specific permission
    pub fn has_permission(&self, permission: &str) -> bool {
        let permissions = self.get_permissions();
        permissions.contains(&permission.to_string()) || permissions.contains(&"*".to_string())
    }

    /// Check if user is owner
    pub fn is_owner(&self) -> bool {
        self.role == OrganizationRole::Owner
    }

    /// Check if user is admin or owner
    pub fn is_admin_or_owner(&self) -> bool {
        matches!(self.role, OrganizationRole::Owner | OrganizationRole::Admin)
    }
}

/// Request to add user to organization
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct AddUserToOrganizationRequest {
    pub user_id: String,
    pub role: OrganizationRole,
    pub permissions: Option<Vec<String>>,
}

/// Request to update user role
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct UpdateUserRoleRequest {
    pub role: OrganizationRole,
    pub permissions: Option<Vec<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_has_permission() {
        let user_org = UserOrganization {
            id: Uuid::new_v4(),
            user_id: "user123".to_string(),
            organization_id: Uuid::new_v4(),
            role: OrganizationRole::Member,
            permissions: serde_json::json!(["sites:view", "sites:create"]),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(user_org.has_permission("sites:view"));
        assert!(user_org.has_permission("sites:create"));
        assert!(!user_org.has_permission("sites:delete"));
    }

    #[test]
    fn test_wildcard_permission() {
        let user_org = UserOrganization {
            id: Uuid::new_v4(),
            user_id: "user123".to_string(),
            organization_id: Uuid::new_v4(),
            role: OrganizationRole::Owner,
            permissions: serde_json::json!(["*"]),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(user_org.has_permission("any:permission"));
    }
}
