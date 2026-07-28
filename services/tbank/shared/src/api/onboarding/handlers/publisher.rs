use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{error, info};

use crate::{
    auth::AuthContext,
    models::organization::{Organization, PublisherOnboardingRequest},
    services::onboarding::PublisherOnboardingService,
    ADQuestError,
};

/// Response for onboarding
#[derive(Debug, Serialize, Deserialize)]
pub struct OnboardingResponse {
    pub success: bool,
    pub organization: Organization,
    pub message: String,
}

/// Handler for Publisher onboarding
pub async fn onboard_publisher_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Json(request): Json<PublisherOnboardingRequest>,
) -> Result<Json<OnboardingResponse>, (StatusCode, String)> {
    info!(
        "Publisher onboarding request from user: {}",
        &auth.claims.sub
    );

    let service = PublisherOnboardingService::new(pool);

    match service.onboard(&&auth.claims.sub, request).await {
        Ok(org) => {
            info!(
                "Publisher onboarding successful for organization: {}",
                org.id
            );

            Ok(Json(OnboardingResponse {
                success: true,
                organization: org,
                message: "Publisher onboarding completed successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Publisher onboarding failed: {}", e);
            Err(map_error(e))
        }
    }
}

/// Map ADQuestError to HTTP response
fn map_error(error: ADQuestError) -> (StatusCode, String) {
    let status_code = StatusCode::from_u16(error.status_code()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (status_code, error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests would require a test setup
}
