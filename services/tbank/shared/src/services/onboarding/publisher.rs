use crate::{
    models::organization::{
        AccountType, CreateOrganizationRequest, Organization, OrganizationRole,
        PublisherOnboardingRequest,
    },
    repositories::organization::{OrganizationRepository, PublisherRepository},
    ADQuestError,
};
use sqlx::PgPool;
use tracing::info;

/// Service for Publisher onboarding
pub struct PublisherOnboardingService {
    org_repo: OrganizationRepository,
    publisher_repo: PublisherRepository,
}

impl PublisherOnboardingService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            org_repo: OrganizationRepository::new(pool.clone()),
            publisher_repo: PublisherRepository::new(pool),
        }
    }

    /// Complete Publisher onboarding
    pub async fn onboard(
        &self,
        user_id: &str,
        request: PublisherOnboardingRequest,
    ) -> Result<Organization, ADQuestError> {
        // Validate request
        self.validate_request(&request)?;

        info!(
            "Starting Publisher onboarding for user '{}', organization '{}'",
            user_id, request.organization_name
        );

        // Create organization
        let org_request = CreateOrganizationRequest {
            name: request.organization_name.clone(),
            organization_type: AccountType::Publisher,
            legal_entity: None,
            metadata: Some(serde_json::json!({
                "site_url": request.site_url,
                "site_category": request.site_category,
                "monthly_visitors": request.monthly_visitors,
            })),
        };

        let org = self.org_repo.create(&org_request, user_id).await?;

        // Add owner as member
        self.org_repo
            .add_user(org.id, user_id, OrganizationRole::Owner, vec!["*".to_string()])
            .await?;

        // Create Publisher data
        let payment_info = serde_json::to_value(&request.payment_info)
            .unwrap_or(serde_json::json!({}));

        self.publisher_repo.create(org.id, payment_info).await?;

        info!(
            "Publisher onboarding completed for organization '{}'",
            org.name
        );

        Ok(org)
    }

    /// Validate onboarding request
    fn validate_request(&self, request: &PublisherOnboardingRequest) -> Result<(), ADQuestError> {
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

        // Validate site URL
        if request.site_url.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "Site URL cannot be empty".to_string(),
            ));
        }

        if !request.site_url.starts_with("http://") && !request.site_url.starts_with("https://") {
            return Err(ADQuestError::Validation(
                "Site URL must start with http:// or https://".to_string(),
            ));
        }

        // Validate site category
        if request.site_category.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "Site category cannot be empty".to_string(),
            ));
        }

        // Validate tax ID (INN)
        let tax_id = &request.payment_info.tax_id;
        if tax_id.len() != 10 && tax_id.len() != 12 {
            return Err(ADQuestError::Validation(
                "Tax ID (INN) must be 10 or 12 digits".to_string(),
            ));
        }

        if !tax_id.chars().all(|c| c.is_ascii_digit()) {
            return Err(ADQuestError::Validation(
                "Tax ID (INN) must contain only digits".to_string(),
            ));
        }

        Ok(())
    }
}

