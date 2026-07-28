use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    auth::AuthContext,
    models::organization::{Organization, UpdateOrganizationRequest},
    services::organization::OrganizationUpdateService,
    ADQuestError,
};

/// Response for update organization
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateOrganizationResponse {
    pub success: bool,
    pub organization: Organization,
    pub message: String,
}

/// Handler to update organization
pub async fn update_organization_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateOrganizationRequest>,
) -> Result<Json<UpdateOrganizationResponse>, (StatusCode, String)> {
    info!(
        "Update organization request: {} by user: {}",
        id, &auth.claims.sub
    );

    let service = OrganizationUpdateService::new(pool);

    match service.update(id, &&auth.claims.sub, request).await {
        Ok(org) => {
            info!("Organization updated successfully: {}", id);

            Ok(Json(UpdateOrganizationResponse {
                success: true,
                organization: org,
                message: "Organization updated successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to update organization: {}", e);
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
