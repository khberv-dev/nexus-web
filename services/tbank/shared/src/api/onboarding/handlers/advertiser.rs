use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use tracing::{error, info};

use crate::{
    auth::AuthContext,
    models::organization::AdvertiserOnboardingRequest,
    services::onboarding::AdvertiserOnboardingService,
    ADQuestError,
};

use super::publisher::OnboardingResponse;

/// Handler for Advertiser onboarding
pub async fn onboard_advertiser_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Json(request): Json<AdvertiserOnboardingRequest>,
) -> Result<Json<OnboardingResponse>, (StatusCode, String)> {
    info!(
        "Advertiser onboarding request from user: {}",
        &auth.claims.sub
    );

    let service = AdvertiserOnboardingService::new(pool);

    match service.onboard(&&auth.claims.sub, request).await {
        Ok(org) => {
            info!(
                "Advertiser onboarding successful for organization: {}",
                org.id
            );

            Ok(Json(OnboardingResponse {
                success: true,
                organization: org,
                message: "Advertiser onboarding completed successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Advertiser onboarding failed: {}", e);
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
