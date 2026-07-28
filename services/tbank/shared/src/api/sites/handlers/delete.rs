use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use tracing::{info, error};
use uuid::Uuid;
use chrono::Utc;

/// Handler for deleting site (soft delete)
pub async fn delete_site_handler(
    State(pool): State<PgPool>,
    site_id: Uuid,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    info!("[CRM->CORE] DELETE SITE REQUEST received");
    info!("[CRM->CORE] Site ID: {}", site_id);
    
    let now = Utc::now();

    info!("[DB UPDATE] Soft deleting site: {}", site_id);
    let result = sqlx::query_as::<_, (Uuid,)>(
        r#"
        UPDATE sites
        SET status = 'deleted', deleted_at = $1, updated_at = $1
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING id
        "#
    )
    .bind(now)
    .bind(site_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to delete site: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to delete site".to_string(),
        )
    })?;

    match result {
        Some(_) => {
            info!("[DB SUCCESS] Site soft deleted");
            info!("[DB SUCCESS] Site ID: {}", site_id);
            info!("[DB SUCCESS] Status: deleted");
            info!("[DB SUCCESS] Deleted at: {}", now);
            info!("[CRM->CORE] DELETE SITE SUCCESS");
            Ok(Json(serde_json::json!({
                "success": true,
                "siteId": site_id,
                "status": "deleted",
                "deletedAt": now
            })))
        }
        None => {
            error!("[CRM->CORE] DELETE SITE FAILED: Site not found - {}", site_id);
            Err((StatusCode::NOT_FOUND, "Site not found".to_string()))
        }
    }
}
