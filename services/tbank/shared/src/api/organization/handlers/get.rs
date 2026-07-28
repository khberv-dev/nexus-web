use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

use crate::{
    auth::AuthContext,
    models::organization::Organization,
    repositories::organization::OrganizationRepository,
    ADQuestError,
};

/// Response for get organization
#[derive(Debug, Serialize, Deserialize)]
pub struct GetOrganizationResponse {
    pub success: bool,
    pub organization: Organization,
}

/// Handler to get organization by ID
pub async fn get_organization_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Path(id): Path<Uuid>,
) -> Result<Json<GetOrganizationResponse>, (StatusCode, String)> {
    info!("Get organization request: {} by user: {}", id, &auth.claims.sub);

    let repo = OrganizationRepository::new(pool);

    // Check if user is a member
    let user_orgs = repo
        .get_user_organizations(&&auth.claims.sub)
        .await
        .map_err(map_error)?;

    if !user_orgs.iter().any(|uo| uo.organization_id == id) {
        return Err((
            StatusCode::FORBIDDEN,
            "User is not a member of this organization".to_string(),
        ));
    }

    // Get organization
    let org = repo
        .get_by_id(id)
        .await
        .map_err(map_error)?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                "Organization not found".to_string(),
            )
        })?;

    Ok(Json(GetOrganizationResponse {
        success: true,
        organization: org,
    }))
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
