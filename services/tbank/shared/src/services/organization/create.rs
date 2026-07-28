use crate::{
    models::organization::{
        AccountType, CreateOrganizationRequest, Organization, OrganizationRole,
    },
    repositories::organization::OrganizationRepository,
    validation::organization::OrganizationValidator,
    ADQuestError,
};
use sqlx::PgPool;
use tracing::{info, warn};

/// Service for creating organizations
pub struct OrganizationCreateService {
    repo: OrganizationRepository,
}

impl OrganizationCreateService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: OrganizationRepository::new(pool),
        }
    }

    /// Create new organization
    pub async fn create(
        &self,
        request: CreateOrganizationRequest,
        owner_user_id: &str,
    ) -> Result<Organization, ADQuestError> {
        // Validate organization name
        self.validate_name(&request.name)?;

        // Validate legal entity for non-publisher types
        if request.organization_type != AccountType::Publisher {
            if request.legal_entity.is_none() {
                return Err(ADQuestError::Validation(
                    "Legal entity is required for Advertiser and Agency".to_string(),
                ));
            }
        }

        info!(
            "Creating organization '{}' for user '{}'",
            request.name, owner_user_id
        );

        // Create organization
        let org = self.repo.create(&request, owner_user_id).await?;

        // Add owner as member with full permissions
        self.repo
            .add_user(
                org.id,
                owner_user_id,
                OrganizationRole::Owner,
                vec!["*".to_string()],
            )
            .await?;

        info!(
            "Organization '{}' created successfully with ID: {}",
            org.name, org.id
        );

        Ok(org)
    }

    /// Validate organization name
    fn validate_name(&self, name: &str) -> Result<(), ADQuestError> {
        OrganizationValidator::validate_name(name)
    }

    /// Check if user can create more organizations
    pub async fn can_create_organization(
        &self,
        user_id: &str,
        max_organizations: usize,
    ) -> Result<bool, ADQuestError> {
        let user_orgs = self.repo.get_user_organizations(user_id).await?;

        if user_orgs.len() >= max_organizations {
            warn!(
                "User '{}' has reached maximum organizations limit: {}",
                user_id, max_organizations
            );
            return Ok(false);
        }

        Ok(true)
    }
}

