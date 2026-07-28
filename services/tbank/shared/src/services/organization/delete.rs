use crate::{repositories::organization::OrganizationRepository, ADQuestError};
use sqlx::PgPool;
use tracing::{info, warn};
use uuid::Uuid;

/// Service for deleting organizations
pub struct OrganizationDeleteService {
    repo: OrganizationRepository,
}

impl OrganizationDeleteService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: OrganizationRepository::new(pool),
        }
    }

    /// Delete organization (soft delete)
    pub async fn delete(
        &self,
        organization_id: Uuid,
        user_id: &str,
    ) -> Result<(), ADQuestError> {
        // Check if organization exists
        let org = self
            .repo
            .get_by_id(organization_id)
            .await?
            .ok_or_else(|| ADQuestError::NotFound("Organization not found".to_string()))?;

        // Check if user is owner
        if org.owner_user_id != user_id {
            return Err(ADQuestError::Authorization(
                "Only the owner can delete the organization".to_string(),
            ));
        }

        // Check if organization has active members (besides owner)
        let members = self.repo.get_members(organization_id).await?;
        if members.len() > 1 {
            warn!(
                "Cannot delete organization '{}' with {} members",
                org.name,
                members.len()
            );
            return Err(ADQuestError::Validation(
                "Cannot delete organization with active members. Remove all members first."
                    .to_string(),
            ));
        }

        info!("Deleting organization '{}' (ID: {})", org.name, organization_id);

        // Soft delete organization
        self.repo.delete(organization_id).await?;

        info!("Organization deleted successfully: {}", organization_id);

        Ok(())
    }

    /// Check if organization can be deleted
    pub async fn can_delete(
        &self,
        organization_id: Uuid,
        user_id: &str,
    ) -> Result<bool, ADQuestError> {
        let org = self
            .repo
            .get_by_id(organization_id)
            .await?
            .ok_or_else(|| ADQuestError::NotFound("Organization not found".to_string()))?;

        // Only owner can delete
        if org.owner_user_id != user_id {
            return Ok(false);
        }

        // Check members count
        let members = self.repo.get_members(organization_id).await?;
        Ok(members.len() <= 1)
    }
}

