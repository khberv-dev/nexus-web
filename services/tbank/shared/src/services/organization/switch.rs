use crate::{
    models::organization::Organization, repositories::organization::OrganizationRepository,
    ADQuestError,
};
use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

/// Service for switching between organizations
pub struct OrganizationSwitchService {
    repo: OrganizationRepository,
}

impl OrganizationSwitchService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: OrganizationRepository::new(pool),
        }
    }

    /// Switch to another organization
    pub async fn switch_organization(
        &self,
        user_id: &str,
        target_organization_id: Uuid,
    ) -> Result<Organization, ADQuestError> {
        // Check if user is a member of target organization
        let user_orgs = self.repo.get_user_organizations(user_id).await?;

        if !user_orgs
            .iter()
            .any(|uo| uo.organization_id == target_organization_id)
        {
            return Err(ADQuestError::Authorization(
                "User is not a member of the target organization".to_string(),
            ));
        }

        // Get target organization
        let org = self
            .repo
            .get_by_id(target_organization_id)
            .await?
            .ok_or_else(|| ADQuestError::NotFound("Organization not found".to_string()))?;

        info!(
            "User '{}' switched to organization '{}' (ID: {})",
            user_id, org.name, org.id
        );

        Ok(org)
    }

    /// Get user's organizations
    pub async fn get_user_organizations(
        &self,
        user_id: &str,
    ) -> Result<Vec<Organization>, ADQuestError> {
        let user_orgs = self.repo.get_user_organizations(user_id).await?;

        let mut organizations = Vec::new();
        for user_org in user_orgs {
            if let Some(org) = self.repo.get_by_id(user_org.organization_id).await? {
                organizations.push(org);
            }
        }

        Ok(organizations)
    }

    /// Get current organization (first one or specified)
    pub async fn get_current_organization(
        &self,
        user_id: &str,
        preferred_org_id: Option<Uuid>,
    ) -> Result<Option<Organization>, ADQuestError> {
        let user_orgs = self.repo.get_user_organizations(user_id).await?;

        if user_orgs.is_empty() {
            return Ok(None);
        }

        // If preferred organization specified, use it
        if let Some(org_id) = preferred_org_id {
            if user_orgs.iter().any(|uo| uo.organization_id == org_id) {
                return self.repo.get_by_id(org_id).await;
            }
        }

        // Otherwise, use the first organization
        let first_org_id = user_orgs[0].organization_id;
        self.repo.get_by_id(first_org_id).await
    }
}

