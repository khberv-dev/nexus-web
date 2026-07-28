use crate::{
    models::organization::{
        AccountType, AdvertiserOnboardingRequest, CreateOrganizationRequest, Organization,
        OrganizationRole,
    },
    repositories::organization::{AdvertiserRepository, OrganizationRepository},
    ADQuestError,
};
use sqlx::PgPool;
use tracing::info;

/// Service for Advertiser onboarding
pub struct AdvertiserOnboardingService {
    org_repo: OrganizationRepository,
    advertiser_repo: AdvertiserRepository,
}

impl AdvertiserOnboardingService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            org_repo: OrganizationRepository::new(pool.clone()),
            advertiser_repo: AdvertiserRepository::new(pool),
        }
    }

    /// Complete Advertiser onboarding
    pub async fn onboard(
        &self,
        user_id: &str,
        request: AdvertiserOnboardingRequest,
    ) -> Result<Organization, ADQuestError> {
        // Validate request
        self.validate_request(&request)?;

        info!(
            "Starting Advertiser onboarding for user '{}', organization '{}'",
            user_id, request.organization_name
        );

        // Create organization
        let org_request = CreateOrganizationRequest {
            name: request.organization_name.clone(),
            organization_type: AccountType::Advertiser,
            legal_entity: Some(request.legal_entity.clone()),
            metadata: Some(serde_json::json!({
                "erir_registration": request.erir_registration,
                "initial_budget": request.initial_budget,
            })),
        };

        let org = self.org_repo.create(&org_request, user_id).await?;

        // Add owner as member
        self.org_repo
            .add_user(org.id, user_id, OrganizationRole::Owner, vec!["*".to_string()])
            .await?;

        // Create Advertiser data
        self.advertiser_repo
            .create(org.id, request.initial_budget)
            .await?;

        info!(
            "Advertiser onboarding completed for organization '{}'",
            org.name
        );

        Ok(org)
    }

    /// Validate onboarding request
    fn validate_request(&self, request: &AdvertiserOnboardingRequest) -> Result<(), ADQuestError> {
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

        // Validate KPP if provided (9 digits)
        if let Some(ref kpp) = legal_entity.kpp {
            if kpp.len() != 9 {
                return Err(ADQuestError::Validation(
                    "KPP must be 9 digits".to_string(),
                ));
            }

            if !kpp.chars().all(|c| c.is_ascii_digit()) {
                return Err(ADQuestError::Validation(
                    "KPP must contain only digits".to_string(),
                ));
            }
        }

        // Validate OGRN if provided (13 or 15 digits)
        if let Some(ref ogrn) = legal_entity.ogrn {
            if ogrn.len() != 13 && ogrn.len() != 15 {
                return Err(ADQuestError::Validation(
                    "OGRN must be 13 or 15 digits".to_string(),
                ));
            }

            if !ogrn.chars().all(|c| c.is_ascii_digit()) {
                return Err(ADQuestError::Validation(
                    "OGRN must contain only digits".to_string(),
                ));
            }
        }

        Ok(())
    }
}

