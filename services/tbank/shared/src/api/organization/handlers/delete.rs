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
    auth::AuthContext, services::organization::OrganizationDeleteService, ADQuestError,
};

/// Response for delete organization
#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteOrganizationResponse {
    pub success: bool,
    pub message: String,
}

/// Handler to delete organization
pub async fn delete_organization_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Path(id): Path<Uuid>,
) -> Result<Json<DeleteOrganizationResponse>, (StatusCode, String)> {
    info!(
        "Delete organization request: {} by user: {}",
        id, &auth.claims.sub
    );

    let service = OrganizationDeleteService::new(pool);

    match service.delete(id, &&auth.claims.sub).await {
        Ok(_) => {
            info!("Organization deleted successfully: {}", id);

            Ok(Json(DeleteOrganizationResponse {
                success: true,
                message: "Organization deleted successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to delete organization: {}", e);
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
