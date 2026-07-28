use crate::{
    models::organization::{
        AccountType, CreateOrganizationRequest, Organization, OrganizationRole, UserOrganization,
    },
    ADQuestError,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Organization repository
pub struct OrganizationRepository {
    pool: PgPool,
}

impl OrganizationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create new organization from request
    pub async fn create(
        &self,
        request: &CreateOrganizationRequest,
        owner_user_id: &str,
    ) -> Result<Organization, ADQuestError> {
        let id = Uuid::new_v4();
        let legal_entity = request
            .legal_entity
            .as_ref()
            .map(|le| serde_json::to_value(le).unwrap_or(serde_json::json!({})))
            .unwrap_or(serde_json::json!({}));
        let metadata = request
            .metadata
            .clone()
            .unwrap_or(serde_json::json!({}));

        let org = sqlx::query_as::<_, Organization>(
            r#"
            INSERT INTO organizations (id, name, type, owner_user_id, legal_entity, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&request.name)
        .bind(request.organization_type)
        .bind(owner_user_id)
        .bind(legal_entity)
        .bind(metadata)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to create organization: {}", e)))?;

        Ok(org)
    }

    /// Create new organization from object
    pub async fn create_organization(&self, organization: Organization) -> Result<Organization, ADQuestError> {
        let org = sqlx::query_as::<_, Organization>(
            r#"
            INSERT INTO organizations (id, name, type, owner_user_id, legal_entity, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(organization.id)
        .bind(&organization.name)
        .bind(organization.organization_type)
        .bind(&organization.owner_user_id)
        .bind(&organization.legal_entity)
        .bind(&organization.metadata)
        .bind(organization.created_at)
        .bind(organization.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to create organization: {}", e)))?;

        Ok(org)
    }

    /// Get organization by ID
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Organization>, ADQuestError> {
        let org = sqlx::query_as::<_, Organization>(
            r#"
            SELECT * FROM organizations
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to get organization: {}", e)))?;

        Ok(org)
    }

    /// Get organization by name
    pub async fn get_by_name(&self, name: &str) -> Result<Option<Organization>, ADQuestError> {
        let org = sqlx::query_as::<_, Organization>(
            r#"
            SELECT * FROM organizations
            WHERE name = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to get organization by name: {}", e)))?;

        Ok(org)
    }

    /// Get organizations by owner user ID
    pub async fn get_by_owner(
        &self,
        owner_user_id: &str,
    ) -> Result<Vec<Organization>, ADQuestError> {
        let orgs = sqlx::query_as::<_, Organization>(
            r#"
            SELECT * FROM organizations
            WHERE owner_user_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            "#,
        )
        .bind(owner_user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to get organizations by owner: {}", e))
        })?;

        Ok(orgs)
    }

    /// Get organizations by type
    pub async fn get_by_type(
        &self,
        org_type: AccountType,
    ) -> Result<Vec<Organization>, ADQuestError> {
        let orgs = sqlx::query_as::<_, Organization>(
            r#"
            SELECT * FROM organizations
            WHERE type = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            "#,
        )
        .bind(org_type)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to get organizations by type: {}", e))
        })?;

        Ok(orgs)
    }

    /// Update organization
    pub async fn update(
        &self,
        id: Uuid,
        name: Option<&str>,
        legal_entity: Option<serde_json::Value>,
        metadata: Option<serde_json::Value>,
    ) -> Result<Organization, ADQuestError> {
        let org = sqlx::query_as::<_, Organization>(
            r#"
            UPDATE organizations
            SET 
                name = COALESCE($2, name),
                legal_entity = COALESCE($3, legal_entity),
                metadata = COALESCE($4, metadata),
                updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(name)
        .bind(legal_entity)
        .bind(metadata)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to update organization: {}", e)))?;

        Ok(org)
    }

    /// Soft delete organization
    pub async fn delete(&self, id: Uuid) -> Result<(), ADQuestError> {
        sqlx::query(
            r#"
            UPDATE organizations
            SET deleted_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to delete organization: {}", e)))?;

        Ok(())
    }

    /// Add user to organization
    pub async fn add_user(
        &self,
        organization_id: Uuid,
        user_id: &str,
        role: OrganizationRole,
        permissions: Vec<String>,
    ) -> Result<UserOrganization, ADQuestError> {
        let id = Uuid::new_v4();
        let permissions_json = serde_json::to_value(permissions)
            .unwrap_or(serde_json::json!([]));

        let user_org = sqlx::query_as::<_, UserOrganization>(
            r#"
            INSERT INTO users_organizations (id, user_id, organization_id, role, permissions)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(user_id)
        .bind(organization_id)
        .bind(role)
        .bind(permissions_json)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to add user to organization: {}", e))
        })?;

        Ok(user_org)
    }

    /// Get user's organizations
    pub async fn get_user_organizations(
        &self,
        user_id: &str,
    ) -> Result<Vec<UserOrganization>, ADQuestError> {
        let user_orgs = sqlx::query_as::<_, UserOrganization>(
            r#"
            SELECT uo.* FROM users_organizations uo
            JOIN organizations o ON uo.organization_id = o.id
            WHERE uo.user_id = $1 AND o.deleted_at IS NULL
            ORDER BY uo.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to get user organizations: {}", e))
        })?;

        Ok(user_orgs)
    }

    /// Get organization members
    pub async fn get_members(
        &self,
        organization_id: Uuid,
    ) -> Result<Vec<UserOrganization>, ADQuestError> {
        let members = sqlx::query_as::<_, UserOrganization>(
            r#"
            SELECT * FROM users_organizations
            WHERE organization_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(organization_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to get organization members: {}", e))
        })?;

        Ok(members)
    }

    /// Update user role
    pub async fn update_user_role(
        &self,
        organization_id: Uuid,
        user_id: &str,
        role: OrganizationRole,
        permissions: Option<Vec<String>>,
    ) -> Result<UserOrganization, ADQuestError> {
        let permissions_json = permissions
            .map(|p| serde_json::to_value(p).unwrap_or(serde_json::json!([])));

        let user_org = sqlx::query_as::<_, UserOrganization>(
            r#"
            UPDATE users_organizations
            SET 
                role = $3,
                permissions = COALESCE($4, permissions),
                updated_at = NOW()
            WHERE organization_id = $1 AND user_id = $2
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(user_id)
        .bind(role)
        .bind(permissions_json)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to update user role: {}", e)))?;

        Ok(user_org)
    }

    /// Remove user from organization
    pub async fn remove_user(
        &self,
        organization_id: Uuid,
        user_id: &str,
    ) -> Result<(), ADQuestError> {
        sqlx::query(
            r#"
            DELETE FROM users_organizations
            WHERE organization_id = $1 AND user_id = $2
            "#,
        )
        .bind(organization_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to remove user from organization: {}", e))
        })?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests would require a test database setup
    // For now, we'll skip the actual test implementation
}
