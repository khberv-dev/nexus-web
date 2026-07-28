use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use tracing::{info, error, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::api::sites::types::*;
use crate::api::sites::utils::*;

/// Handler for getting site keys
/// Returns site_key and optionally secret_key (only if created within 24 hours)
pub async fn get_site_keys_handler(
    State(pool): State<PgPool>,
    site_id: Uuid,
) -> Result<Json<SiteKeysResponse>, (StatusCode, String)> {
    info!("Getting keys for site: {}", site_id);

    let site = sqlx::query_as::<_, (
        Uuid, String, Option<String>, Option<i32>, Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>
    )>(
        r#"
        SELECT id, site_key, secret_key, rate_limit_per_hour, verified_at, created_at
        FROM sites
        WHERE id = $1 AND deleted_at IS NULL AND status = 'verified'
        "#
    )
    .bind(site_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!("Database error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch site keys".to_string(),
        )
    })?;

    match site {
        Some((id, site_key, secret_key, rate_limit_per_hour, verified_at, created_at)) => {
            // Only return secret_key if site was verified within last 24 hours
            let show_secret = if let Some(verified) = verified_at {
                let hours_since_verification = Utc::now().signed_duration_since(verified).num_hours();
                hours_since_verification < 24
            } else {
                false
            };

            Ok(Json(SiteKeysResponse {
                success: true,
                site_id: id,
                site_key,
                secret_key: if show_secret { secret_key } else { None },
                is_active: true,
                rate_limit_per_hour: rate_limit_per_hour.unwrap_or(10000),
                created_at: created_at.unwrap_or_else(|| Utc::now()),
            }))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            "Site not found or not verified".to_string(),
        )),
    }
}

/// Handler for regenerating site keys
/// Generates new keys and keeps old ones active during grace period
pub async fn regenerate_keys_handler(
    State(pool): State<PgPool>,
    site_id: Uuid,
    Json(request): Json<RegenerateKeysRequest>,
) -> Result<Json<RegenerateKeysResponse>, (StatusCode, String)> {
    info!("Regenerating keys for site: {}", site_id);

    // 1. Get current site and keys
    let site = sqlx::query_as::<_, (Uuid, String, Option<String>)>(
        "SELECT id, site_key, secret_key FROM sites WHERE id = $1 AND deleted_at IS NULL AND status = 'verified'"
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

    let (site_id, old_site_key, old_secret_key) = match site {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                "Site not found or not verified".to_string(),
            ));
        }
    };

    // 2. Generate new keys
    let new_site_key = generate_site_key();
    let new_secret_key = generate_secret_key();
    let now = Utc::now();
    let grace_period_days = request.grace_period_days.unwrap_or(30);
    let grace_period_ends = now + chrono::Duration::days(grace_period_days as i64);

    // 3. Update site with new keys
    sqlx::query(
        r#"
        UPDATE sites 
        SET site_key = $1, secret_key = $2, updated_at = $3
        WHERE id = $4
        "#
    )
    .bind(&new_site_key)
    .bind(&new_secret_key)
    .bind(now)
    .bind(site_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        error!("Failed to update site keys: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to regenerate keys".to_string(),
        )
    })?;

    // 4. Save old keys to history with grace period
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO site_keys_history (site_id, site_key, secret_key, reason, created_at, deprecated_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#
    )
    .bind(site_id)
    .bind(&old_site_key)
    .bind(&old_secret_key)
    .bind("rotation")
    .bind(now)
    .bind(now)
    .bind(grace_period_ends)
    .execute(&pool)
    .await
    {
        warn!("Failed to save old key to history: {}", e);
    }

    // 5. Save new keys to history
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO site_keys_history (site_id, site_key, secret_key, reason, created_at)
        VALUES ($1, $2, $3, $4, $5)
        "#
    )
    .bind(site_id)
    .bind(&new_site_key)
    .bind(&new_secret_key)
    .bind("rotation")
    .bind(now)
    .execute(&pool)
    .await
    {
        warn!("Failed to save new key to history: {}", e);
    }

    info!(
        "Keys regenerated for site: {} (old: {}, new: {})",
        site_id, old_site_key, new_site_key
    );

    Ok(Json(RegenerateKeysResponse {
        success: true,
        site_id,
        new_site_key,
        new_secret_key,
        old_site_key,
        grace_period_ends,
        message: format!(
            "Old keys will continue to work until {}",
            grace_period_ends.format("%Y-%m-%d %H:%M:%S UTC")
        ),
    }))
}
