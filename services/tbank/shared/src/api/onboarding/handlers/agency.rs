use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use tracing::{error, info};

use crate::{
    auth::AuthContext,
    models::organization::AgencyOnboardingRequest,
    services::onboarding::AgencyOnboardingService,
    ADQuestError,
};

use super::publisher::OnboardingResponse;

/// Handler for Agency onboarding
pub async fn onboard_agency_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Json(request): Json<AgencyOnboardingRequest>,
) -> Result<Json<OnboardingResponse>, (StatusCode, String)> {
    info!(
        "Agency onboarding request from user: {}",
        &auth.claims.sub
    );

    let service = AgencyOnboardingService::new(pool);

    match service.onboard(&&auth.claims.sub, request).await {
        Ok(org) => {
            info!(
                "Agency onboarding successful for organization: {}",
                org.id
            );

            Ok(Json(OnboardingResponse {
                success: true,
                organization: org,
                message: "Agency onboarding completed successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Agency onboarding failed: {}", e);
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
