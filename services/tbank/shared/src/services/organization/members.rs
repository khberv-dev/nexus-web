use crate::{
    models::organization::{
        AddUserToOrganizationRequest, UpdateUserRoleRequest, UserOrganization,
    },
    repositories::organization::OrganizationRepository,
    ADQuestError,
};
use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

/// Service for managing organization members
pub struct OrganizationMembersService {
    repo: OrganizationRepository,
}

impl OrganizationMembersService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: OrganizationRepository::new(pool),
        }
    }

    /// Add user to organization
    pub async fn add_member(
        &self,
        organization_id: Uuid,
        requester_user_id: &str,
        request: AddUserToOrganizationRequest,
    ) -> Result<UserOrganization, ADQuestError> {
        // Check if requester has permission
        self.check_admin_permission(organization_id, requester_user_id)
            .await?;

        // Check if user is already a member
        let existing_members = self.repo.get_members(organization_id).await?;
        if existing_members
            .iter()
            .any(|m| m.user_id == request.user_id)
        {
            return Err(ADQuestError::Validation(
                "User is already a member of this organization".to_string(),
            ));
        }

        // Check max members limit
        if existing_members.len() >= 50 {
            return Err(ADQuestError::Validation(
                "Organization has reached maximum members limit".to_string(),
            ));
        }

        info!(
            "Adding user '{}' to organization '{}'",
            request.user_id, organization_id
        );

        let permissions = request.permissions.unwrap_or_default();

        let user_org = self
            .repo
            .add_user(organization_id, &request.user_id, request.role, permissions)
            .await?;

        info!("User added successfully to organization");

        Ok(user_org)
    }

    /// Update user role
    pub async fn update_member_role(
        &self,
        organization_id: Uuid,
        target_user_id: &str,
        requester_user_id: &str,
        request: UpdateUserRoleRequest,
    ) -> Result<UserOrganization, ADQuestError> {
        // Check if requester has permission
        self.check_admin_permission(organization_id, requester_user_id)
            .await?;

        // Cannot change owner role
        let org = self
            .repo
            .get_by_id(organization_id)
            .await?
            .ok_or_else(|| ADQuestError::NotFound("Organization not found".to_string()))?;

        if org.owner_user_id == target_user_id {
            return Err(ADQuestError::Validation(
                "Cannot change owner role".to_string(),
            ));
        }

        info!(
            "Updating role for user '{}' in organization '{}'",
            target_user_id, organization_id
        );

        let user_org = self
            .repo
            .update_user_role(
                organization_id,
                target_user_id,
                request.role,
                request.permissions,
            )
            .await?;

        info!("User role updated successfully");

        Ok(user_org)
    }

    /// Remove user from organization
    pub async fn remove_member(
        &self,
        organization_id: Uuid,
        target_user_id: &str,
        requester_user_id: &str,
    ) -> Result<(), ADQuestError> {
        // Check if requester has permission
        self.check_admin_permission(organization_id, requester_user_id)
            .await?;

        // Cannot remove owner
        let org = self
            .repo
            .get_by_id(organization_id)
            .await?
            .ok_or_else(|| ADQuestError::NotFound("Organization not found".to_string()))?;

        if org.owner_user_id == target_user_id {
            return Err(ADQuestError::Validation(
                "Cannot remove owner from organization".to_string(),
            ));
        }

        info!(
            "Removing user '{}' from organization '{}'",
            target_user_id, organization_id
        );

        self.repo
            .remove_user(organization_id, target_user_id)
            .await?;

        info!("User removed successfully from organization");

        Ok(())
    }

    /// Get organization members
    pub async fn get_members(
        &self,
        organization_id: Uuid,
        requester_user_id: &str,
    ) -> Result<Vec<UserOrganization>, ADQuestError> {
        // Check if requester is a member
        let user_orgs = self.repo.get_user_organizations(requester_user_id).await?;

        if !user_orgs
            .iter()
            .any(|uo| uo.organization_id == organization_id)
        {
            return Err(ADQuestError::Authorization(
                "User is not a member of this organization".to_string(),
            ));
        }

        let members = self.repo.get_members(organization_id).await?;

        Ok(members)
    }

    /// Check if user has admin permission
    async fn check_admin_permission(
        &self,
        organization_id: Uuid,
        user_id: &str,
    ) -> Result<(), ADQuestError> {
        let user_orgs = self.repo.get_user_organizations(user_id).await?;

        let user_org = user_orgs
            .iter()
            .find(|uo| uo.organization_id == organization_id)
            .ok_or_else(|| {
                ADQuestError::Authorization("User is not a member of this organization".to_string())
            })?;

        if !user_org.is_admin_or_owner() {
            return Err(ADQuestError::Authorization(
                "Only owners and admins can manage members".to_string(),
            ));
        }

        Ok(())
    }
}

