use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use tracing::error;
use uuid::Uuid;
use chrono::Utc;

use crate::api::sites::types::*;

/// Handler for getting site information
pub async fn get_site_handler(
    State(pool): State<PgPool>,
    site_id: Uuid,
) -> Result<Json<SiteInfoResponse>, (StatusCode, String)> {
    let site = sqlx::query_as::<_, (
        Uuid, Option<String>, String, String, String, Option<String>, Option<String>,
        Option<Uuid>, Option<i32>, Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>
    )>(
        r#"
        SELECT id, public_key, site_key, domain, name, description, status,
               organization_id, rate_limit_per_hour, created_at, verified_at
        FROM sites
        WHERE id = $1 AND deleted_at IS NULL
        "#
    )
    .bind(site_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch site".to_string(),
        )
    })?;

    match site {
        Some((id, public_key, site_key, domain, name, description, status, organization_id, rate_limit_per_hour, created_at, verified_at)) => {
            Ok(Json(SiteInfoResponse {
                success: true,
                site: SiteInfo {
                    id,
                    public_key,
                    site_key,
                    domain,
                    name,
                    description,
                    status: status.unwrap_or_else(|| "active".to_string()),
                    organization_id: organization_id.unwrap(),
                    rate_limit_per_hour: rate_limit_per_hour.unwrap_or(10000),
                    created_at: created_at.unwrap(),
                    verified_at,
                },
            }))
        }
        None => Err((StatusCode::NOT_FOUND, "Site not found".to_string())),
    }
}
