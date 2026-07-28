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
    models::organization::{
        AddUserToOrganizationRequest, UpdateUserRoleRequest, UserOrganization,
    },
    services::organization::OrganizationMembersService,
    ADQuestError,
};

/// Response for get members
#[derive(Debug, Serialize, Deserialize)]
pub struct GetMembersResponse {
    pub success: bool,
    pub members: Vec<UserOrganization>,
}

/// Response for member operations
#[derive(Debug, Serialize, Deserialize)]
pub struct MemberOperationResponse {
    pub success: bool,
    pub message: String,
}

/// Handler to get organization members
pub async fn get_members_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Path(id): Path<Uuid>,
) -> Result<Json<GetMembersResponse>, (StatusCode, String)> {
    info!(
        "Get members request for organization: {} by user: {}",
        id, &auth.claims.sub
    );

    let service = OrganizationMembersService::new(pool);

    match service.get_members(id, &&auth.claims.sub).await {
        Ok(members) => Ok(Json(GetMembersResponse {
            success: true,
            members,
        })),
        Err(e) => {
            error!("Failed to get members: {}", e);
            Err(map_error(e))
        }
    }
}

/// Handler to add member to organization
pub async fn add_member_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Path(id): Path<Uuid>,
    Json(request): Json<AddUserToOrganizationRequest>,
) -> Result<Json<MemberOperationResponse>, (StatusCode, String)> {
    info!(
        "Add member request for organization: {} by user: {}",
        id, &auth.claims.sub
    );

    let service = OrganizationMembersService::new(pool);

    match service.add_member(id, &&auth.claims.sub, request).await {
        Ok(_) => {
            info!("Member added successfully to organization: {}", id);

            Ok(Json(MemberOperationResponse {
                success: true,
                message: "Member added successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to add member: {}", e);
            Err(map_error(e))
        }
    }
}

/// Handler to update member role
pub async fn update_member_role_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Path((id, user_id)): Path<(Uuid, String)>,
    Json(request): Json<UpdateUserRoleRequest>,
) -> Result<Json<MemberOperationResponse>, (StatusCode, String)> {
    info!(
        "Update member role request for organization: {} by user: {}",
        id, &auth.claims.sub
    );

    let service = OrganizationMembersService::new(pool);

    match service
        .update_member_role(id, &user_id, &&auth.claims.sub, request)
        .await
    {
        Ok(_) => {
            info!("Member role updated successfully in organization: {}", id);

            Ok(Json(MemberOperationResponse {
                success: true,
                message: "Member role updated successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to update member role: {}", e);
            Err(map_error(e))
        }
    }
}

/// Handler to remove member from organization
pub async fn remove_member_handler(
    State(pool): State<PgPool>,
    auth: AuthContext,
    Path((id, user_id)): Path<(Uuid, String)>,
) -> Result<Json<MemberOperationResponse>, (StatusCode, String)> {
    info!(
        "Remove member request for organization: {} by user: {}",
        id, &auth.claims.sub
    );

    let service = OrganizationMembersService::new(pool);

    match service.remove_member(id, &user_id, &&auth.claims.sub).await {
        Ok(_) => {
            info!("Member removed successfully from organization: {}", id);

            Ok(Json(MemberOperationResponse {
                success: true,
                message: "Member removed successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to remove member: {}", e);
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
