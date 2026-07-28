use crate::{
    models::organization::{Organization, UpdateOrganizationRequest},
    repositories::organization::OrganizationRepository,
    validation::organization::OrganizationValidator,
    ADQuestError,
};
use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

/// Service for updating organizations
pub struct OrganizationUpdateService {
    repo: OrganizationRepository,
}

impl OrganizationUpdateService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: OrganizationRepository::new(pool),
        }
    }

    /// Update organization
    pub async fn update(
        &self,
        organization_id: Uuid,
        user_id: &str,
        request: UpdateOrganizationRequest,
    ) -> Result<Organization, ADQuestError> {
        // Check if organization exists
        let org = self
            .repo
            .get_by_id(organization_id)
            .await?
            .ok_or_else(|| ADQuestError::NotFound("Organization not found".to_string()))?;

        // Check if user has permission to update
        self.check_update_permission(organization_id, user_id)
            .await?;

        // Validate name if provided
        if let Some(ref name) = request.name {
            self.validate_name(name)?;
        }

        info!(
            "Updating organization '{}' (ID: {})",
            org.name, organization_id
        );

        // Prepare update data
        let legal_entity = request
            .legal_entity
            .as_ref()
            .map(|le| serde_json::to_value(le).unwrap_or(serde_json::json!({})));

        // Update organization
        let updated_org = self
            .repo
            .update(
                organization_id,
                request.name.as_deref(),
                legal_entity,
                request.metadata,
            )
            .await?;

        info!("Organization updated successfully: {}", organization_id);

        Ok(updated_org)
    }

    /// Check if user has permission to update organization
    async fn check_update_permission(
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
                "Only owners and admins can update organization".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate organization name
    fn validate_name(&self, name: &str) -> Result<(), ADQuestError> {
        OrganizationValidator::validate_name(name)
    }
}

