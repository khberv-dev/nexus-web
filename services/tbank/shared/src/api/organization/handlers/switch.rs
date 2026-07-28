use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    auth::AuthContext,
    models::organization::Organization,
    services::organization::OrganizationSwitchService,
    ADQuestError,
};

/// Request to switch organization
#[derive(Debug, Serialize, Deserialize)]
pub struct SwitchOrganizationRequest {
    pub organization_id: Uuid,
}

/// Response for switch organization
#[derive(Debug, Serialize, Deserialize)]
pub struct SwitchOrganizationResponse {
    pub success: bool,
    pub organization: Organization,
    pub message: String,
}

/// Response for get user organizations
#[derive(Debug, Serialize, Deserialize)]
pub struct GetUserOrganizationsResponse {
    pub success: bool,
    pub organizations: Vec<Organization>,
}

/// Handler to switch organization
pub async fn switch_organization_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Json(request): Json<SwitchOrganizationRequest>,
) -> Result<Json<SwitchOrganizationResponse>, (StatusCode, String)> {
    info!(
        "Switch organization request by user: {} to organization: {}",
        &auth.claims.sub, request.organization_id
    );

    let service = OrganizationSwitchService::new(pool);

    match service
        .switch_organization(&&auth.claims.sub, request.organization_id)
        .await
    {
        Ok(org) => {
            info!(
                "User switched to organization: {} successfully",
                org.id
            );

            Ok(Json(SwitchOrganizationResponse {
                success: true,
                organization: org,
                message: "Switched to organization successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to switch organization: {}", e);
            Err(map_error(e))
        }
    }
}

/// Handler to get user's organizations
pub async fn get_user_organizations_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
) -> Result<Json<GetUserOrganizationsResponse>, (StatusCode, String)> {
    info!("Get user organizations request by user: {}", &auth.claims.sub);

    let service = OrganizationSwitchService::new(pool);

    match service.get_user_organizations(&&auth.claims.sub).await {
        Ok(organizations) => Ok(Json(GetUserOrganizationsResponse {
            success: true,
            organizations,
        })),
        Err(e) => {
            error!("Failed to get user organizations: {}", e);
            Err(map_error(e))
        }
    }
}

/// Map ADQuestError to HTTP response
fn map_error(error: ADQuestError) -> (StatusCode, String) {
    let status_code = StatusCode::from_u16(error.status_code())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (status_code, error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests would require a test setup
}
