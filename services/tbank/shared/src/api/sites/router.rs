use axum::{
    routing::{get, post, delete, put},
    Router,
    extract::{Path, State, rejection::JsonRejection},
    Json,
    http::StatusCode,
};
use sqlx::PgPool;
use uuid::Uuid;
use tracing::{error, info};

use super::handlers::*;
use super::types::*;

/// Create sites router
pub fn sites_router(pool: PgPool) -> Router {
    Router::new()
        .route("/", post(create_site_wrapper))
        .route("/:site_id/verify", post(verify_site_wrapper))
        .route("/:site_id", get(get_site_info))
        .route("/:site_id", put(update_site_wrapper))
        .route("/:site_id", delete(delete_site_info))
        .route("/:site_id/keys", get(get_site_keys_wrapper))
        .route("/:site_id/keys/regenerate", post(regenerate_keys_wrapper))
        .with_state(pool)
}

/// Wrapper for create_site_handler with detailed error logging
async fn create_site_wrapper(
    State(pool): State<PgPool>,
    payload: Result<Json<CreateSiteRequest>, JsonRejection>,
) -> Result<Json<CreateSiteResponse>, (StatusCode, Json<CreateSiteError>)> {
    // Handle JSON deserialization errors
    let Json(request) = match payload {
        Ok(json) => {
            info!("✅ JSON deserialized successfully");
            json
        }
        Err(rejection) => {
            error!("❌ JSON deserialization failed: {:?}", rejection);
            error!("❌ Rejection details: {}", rejection);
            
            // Try to extract more details from the error
            let error_msg = format!("{}", rejection);
            if error_msg.contains("UUID parsing failed") {
                error!("💡 Hint: organizationId must be a valid UUID format (e.g., '550e8400-e29b-41d4-a716-446655440000')");
            }
            
            return Err((
                StatusCode::BAD_REQUEST,
                Json(CreateSiteError {
                    success: false,
                    error: "INVALID_JSON".to_string(),
                    message: format!("Failed to parse JSON: {}", rejection),
                }),
            ));
        }
    };
    
    info!("📥 Received create site request: domain={}, name={}, org_id={}", 
        request.domain, request.name, request.organization_id);
    create_site_handler(State(pool), Json(request)).await
}

/// Wrapper for verify_site_handler with Path extractor
async fn verify_site_wrapper(
    State(pool): State<PgPool>,
    Path(site_id): Path<Uuid>,
    Json(request): Json<VerifySiteRequest>,
) -> Result<Json<VerifySiteResponse>, (axum::http::StatusCode, Json<VerifySiteError>)> {
    verify_site_handler(State(pool), site_id, Json(request)).await
}

/// Wrapper for get_site_handler with Path extractor
async fn get_site_info(
    State(pool): State<PgPool>,
    Path(site_id): Path<Uuid>,
) -> Result<Json<SiteInfoResponse>, (axum::http::StatusCode, String)> {
    get_site_handler(State(pool), site_id).await
}

/// Wrapper for delete_site_handler with Path extractor
async fn delete_site_info(
    State(pool): State<PgPool>,
    Path(site_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    delete_site_handler(State(pool), site_id).await
}

/// Wrapper for update_site_handler with Path extractor
async fn update_site_wrapper(
    State(pool): State<PgPool>,
    Path(site_id): Path<Uuid>,
    Json(request): Json<UpdateSiteRequest>,
) -> Result<Json<UpdateSiteResponse>, (axum::http::StatusCode, Json<UpdateSiteError>)> {
    update_site_handler(State(pool), site_id, Json(request)).await
}

/// Wrapper for get_site_keys_handler with Path extractor
async fn get_site_keys_wrapper(
    State(pool): State<PgPool>,
    Path(site_id): Path<Uuid>,
) -> Result<Json<SiteKeysResponse>, (axum::http::StatusCode, String)> {
    get_site_keys_handler(State(pool), site_id).await
}

/// Wrapper for regenerate_keys_handler with Path extractor
async fn regenerate_keys_wrapper(
    State(pool): State<PgPool>,
    Path(site_id): Path<Uuid>,
    Json(request): Json<RegenerateKeysRequest>,
) -> Result<Json<RegenerateKeysResponse>, (axum::http::StatusCode, String)> {
    regenerate_keys_handler(State(pool), site_id, Json(request)).await
}
