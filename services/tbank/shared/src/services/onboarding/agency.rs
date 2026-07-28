use crate::{
    models::organization::{
        AccountType, AgencyOnboardingRequest, CreateOrganizationRequest, Organization,
        OrganizationRole,
    },
    repositories::organization::{AgencyRepository, OrganizationRepository},
    ADQuestError,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use tracing::info;

/// Service for Agency onboarding
pub struct AgencyOnboardingService {
    org_repo: OrganizationRepository,
    agency_repo: AgencyRepository,
}

impl AgencyOnboardingService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            org_repo: OrganizationRepository::new(pool.clone()),
            agency_repo: AgencyRepository::new(pool),
        }
    }

    /// Complete Agency onboarding
    pub async fn onboard(
        &self,
        user_id: &str,
        request: AgencyOnboardingRequest,
    ) -> Result<Organization, ADQuestError> {
        // Validate request
        self.validate_request(&request)?;

        info!(
            "Starting Agency onboarding for user '{}', organization '{}'",
            user_id, request.organization_name
        );

        // Create organization
        let org_request = CreateOrganizationRequest {
            name: request.organization_name.clone(),
            organization_type: AccountType::Agency,
            legal_entity: Some(request.legal_entity.clone()),
            metadata: Some(serde_json::json!({
                "commission": request.commission,
                "white_label": request.white_label,
            })),
        };

        let org = self.org_repo.create(&org_request, user_id).await?;

        // Add owner as member
        self.org_repo
            .add_user(org.id, user_id, OrganizationRole::Owner, vec!["*".to_string()])
            .await?;

        // Create Agency data
        let white_label_settings = request
            .white_label_settings
            .as_ref()
            .map(|s| serde_json::to_value(s).unwrap_or(serde_json::json!({})))
            .unwrap_or(serde_json::json!({}));

        self.agency_repo
            .create(
                org.id,
                request.commission,
                request.white_label,
                white_label_settings,
            )
            .await?;

        info!(
            "Agency onboarding completed for organization '{}'",
            org.name
        );

        Ok(org)
    }

    /// Validate onboarding request
    fn validate_request(&self, request: &AgencyOnboardingRequest) -> Result<(), ADQuestError> {
        // Validate organization name
        if request.organization_name.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "Organization name cannot be empty".to_string(),
            ));
        }

        if request.organization_name.len() < 3 || request.organization_name.len() > 100 {
            return Err(ADQuestError::Validation(
                "Organization name must be between 3 and 100 characters".to_string(),
            ));
        }

        // Validate legal entity
        let legal_entity = &request.legal_entity;

        if legal_entity.name.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "Legal entity name cannot be empty".to_string(),
            ));
        }

        // Validate INN (10 or 12 digits)
        if legal_entity.inn.len() != 10 && legal_entity.inn.len() != 12 {
            return Err(ADQuestError::Validation(
                "INN must be 10 or 12 digits".to_string(),
            ));
        }

        if !legal_entity.inn.chars().all(|c| c.is_ascii_digit()) {
            return Err(ADQuestError::Validation(
                "INN must contain only digits".to_string(),
            ));
        }

        // Validate commission (0-50%)
        if request.commission < Decimal::ZERO || request.commission > Decimal::from(50) {
            return Err(ADQuestError::Validation(
                "Commission must be between 0 and 50%".to_string(),
            ));
        }

        // Validate white-label settings if enabled
        if request.white_label && request.white_label_settings.is_none() {
            return Err(ADQuestError::Validation(
                "White-label settings are required when white-label is enabled".to_string(),
            ));
        }

        Ok(())
    }
}

