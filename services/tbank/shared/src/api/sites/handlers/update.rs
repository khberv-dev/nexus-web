use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use tracing::{info, error};
use uuid::Uuid;
use chrono::Utc;

use crate::api::sites::types::*;

/// Handler for updating site
pub async fn update_site_handler(
    State(pool): State<PgPool>,
    site_id: Uuid,
    Json(request): Json<UpdateSiteRequest>,
) -> Result<Json<UpdateSiteResponse>, (StatusCode, Json<UpdateSiteError>)> {
    info!("[CRM->CORE] UPDATE SITE REQUEST received");
    info!("[CRM->CORE] Site ID: {}", site_id);
    info!("[CRM->CORE] Name: {:?}", request.name);
    info!("[CRM->CORE] Description: {:?}", request.description);
    info!("[CRM->CORE] Category: {:?}", request.category);

    // Check if at least one field is provided
    if request.name.is_none() && request.description.is_none() && request.category.is_none() {
        error!("[CRM->CORE] UPDATE SITE FAILED: No fields to update");
        return Err((
            StatusCode::BAD_REQUEST,
            Json(UpdateSiteError {
                success: false,
                error: "NO_FIELDS_TO_UPDATE".to_string(),
                message: "At least one field must be provided for update".to_string(),
            }),
        ));
    }

    // Get current site data
    info!("[DB CHECK] Fetching current site data: {}", site_id);
    let site = sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<String>)>(
        "SELECT id, domain, name, description, category FROM sites WHERE id = $1 AND deleted_at IS NULL"
    )
    .bind(site_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to fetch site: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateSiteError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to fetch site".to_string(),
            }),
        )
    })?;

    let (site_id, domain, current_name, current_description, current_category) = match site {
        Some(s) => {
            info!("[DB SUCCESS] Site found: domain={}, name={}", s.1, s.2);
            s
        }
        None => {
            error!("[CRM->CORE] UPDATE SITE FAILED: Site not found - {}", site_id);
            return Err((
                StatusCode::NOT_FOUND,
                Json(UpdateSiteError {
                    success: false,
                    error: "SITE_NOT_FOUND".to_string(),
                    message: format!("Site with ID {} not found", site_id),
                }),
            ));
        }
    };

    // Use provided values or keep current ones
    let new_name = request.name.unwrap_or(current_name.clone());
    let new_description = request.description.or(current_description.clone());
    let new_category = request.category.or(current_category.clone());
    let now = Utc::now();

    info!("[DB UPDATE] Updating site fields");
    info!("[DB UPDATE] Name: {} -> {}", current_name, new_name);
    info!("[DB UPDATE] Description: {:?} -> {:?}", current_description, new_description);
    info!("[DB UPDATE] Category: {:?} -> {:?}", current_category, new_category);

    // Update site
    sqlx::query(
        r#"
        UPDATE sites
        SET name = $1, description = $2, category = $3, updated_at = $4
        WHERE id = $5
        "#
    )
    .bind(&new_name)
    .bind(&new_description)
    .bind(&new_category)
    .bind(now)
    .bind(site_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to update site: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateSiteError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to update site".to_string(),
            }),
        )
    })?;

    info!("[DB SUCCESS] Site updated in database");
    info!("[DB SUCCESS] Site ID: {}", site_id);
    info!("[DB SUCCESS] Domain: {}", domain);
    info!("[DB SUCCESS] Name: {}", new_name);
    info!("[CRM->CORE] UPDATE SITE SUCCESS");

    Ok(Json(UpdateSiteResponse {
        success: true,
        site_id,
        domain,
        name: new_name,
        description: new_description,
        category: new_category,
        updated_at: now,
    }))
}
