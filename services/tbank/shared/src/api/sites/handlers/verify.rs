use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use tracing::{info, error, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::api::sites::types::*;
use crate::api::sites::utils::*;

/// Handler for site verification
/// CRM has already verified DNS, Core API just generates keys and updates status
pub async fn verify_site_handler(
    State(pool): State<PgPool>,
    site_id: Uuid,
    Json(request): Json<VerifySiteRequest>,
) -> Result<Json<VerifySiteResponse>, (StatusCode, Json<VerifySiteError>)> {
    info!("=================================================");
    info!("[CRM->CORE] VERIFY SITE REQUEST received");
    info!("[CRM->CORE] Site ID from URL: {}", site_id);
    info!("[CRM->CORE] Domain from request: {}", request.domain);
    info!("[CRM->CORE] Verification token: {}", request.verification_token);
    info!("=================================================");

    // 1. Get site from database
    info!("[DB CHECK] Fetching site from database with ID: {}", site_id);
    let site = sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<Uuid>)>(
        "SELECT id, domain, name, status, organization_id FROM sites WHERE id = $1"
    )
    .bind(site_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to fetch site: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VerifySiteError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to fetch site".to_string(),
                existing_site_id: None,
            }),
        )
    })?;

    let (site_id, site_domain, site_name, site_status, organization_id) = match site {
        Some(s) => {
            info!("[DB SUCCESS] Site found in Core API database");
            info!("[DB SUCCESS] Site ID: {}", s.0);
            info!("[DB SUCCESS] Domain: {}", s.1);
            info!("[DB SUCCESS] Name: {}", s.2);
            info!("[DB SUCCESS] Status: {:?}", s.3);
            info!("[DB SUCCESS] Organization ID: {:?}", s.4);
            s
        }
        None => {
            error!("=================================================");
            error!("[CRM->CORE] VERIFY SITE FAILED: Site not found in Core API");
            error!("[CRM->CORE] Requested Site ID: {}", site_id);
            error!("[CRM->CORE] This means CRM has a site with this ID, but Core API doesn't");
            error!("[CRM->CORE] Possible reasons:");
            error!("[CRM->CORE] 1. Site was created in CRM but not synced to Core API");
            error!("[CRM->CORE] 2. Site was deleted from Core API but still exists in CRM");
            error!("[CRM->CORE] 3. CRM is using wrong core_site_id from metadata");
            error!("=================================================");
            
            // List all sites in Core API for debugging
            let all_sites = sqlx::query_as::<_, (Uuid, String, String)>(
                "SELECT id, domain, status FROM sites ORDER BY created_at DESC LIMIT 10"
            )
            .fetch_all(&pool)
            .await
            .unwrap_or_default();
            
            if all_sites.is_empty() {
                error!("[DB INFO] No sites found in Core API database");
            } else {
                error!("[DB INFO] Recent sites in Core API (last 10):");
                for (id, domain, status) in all_sites {
                    error!("[DB INFO]   - ID: {}, Domain: {}, Status: {}", id, domain, status);
                }
            }
            
            return Err((
                StatusCode::NOT_FOUND,
                Json(VerifySiteError {
                    success: false,
                    error: "SITE_NOT_FOUND".to_string(),
                    message: format!("Site with ID {} not found", site_id),
                    existing_site_id: None,
                }),
            ));
        }
    };

    // 2. Check if already verified - return existing keys instead of error
    if site_status == Some("verified".to_string()) {
        info!("[CRM->CORE] Site already verified - returning existing keys: {}", site_domain);
        
        // Get existing keys
        let existing_keys = sqlx::query_as::<_, (Option<String>, String, Option<String>, Option<chrono::DateTime<Utc>>)>(
            "SELECT public_key, site_key, secret_key, verified_at FROM sites WHERE id = $1"
        )
        .bind(site_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            error!("[DB ERROR] Failed to fetch existing keys: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VerifySiteError {
                    success: false,
                    error: "DATABASE_ERROR".to_string(),
                    message: "Failed to fetch existing keys".to_string(),
                    existing_site_id: None,
                }),
            )
        })?;

        let (public_key, site_key, secret_key, verified_at) = existing_keys;
        
        // Check if keys exist
        if public_key.is_none() || secret_key.is_none() {
            warn!("[CRM->CORE] Site verified but missing keys - regenerating keys");
            // Continue to key generation below
        } else {
            info!("[CRM->CORE] Returning existing keys for already verified site");
            return Ok(Json(VerifySiteResponse {
                success: true,
                site_id,
                public_key: public_key.clone().unwrap(),
                site_key: site_key.clone(),
                secret_key: secret_key, // Return actual secret_key
                domain: site_domain,
                name: site_name,
                status: "verified".to_string(),
                verified_at: verified_at.unwrap_or_else(|| Utc::now()),
                rate_limit_per_hour: 10000,
            }));
        }
    }

    // 3. Validate domain matches
    if site_domain != request.domain {
        error!("[CRM->CORE] VERIFY SITE FAILED: Domain mismatch - expected={}, got={}", site_domain, request.domain);
        return Err((
            StatusCode::BAD_REQUEST,
            Json(VerifySiteError {
                success: false,
                error: "DOMAIN_MISMATCH".to_string(),
                message: format!("Domain mismatch: expected {}, got {}", site_domain, request.domain),
                existing_site_id: None,
            }),
        ));
    }

    // 4. CRM has already verified DNS - we trust CRM's verification
    // Core API just generates keys and updates status
    info!("[CRM->CORE] CRM verified DNS for domain: {}", request.domain);
    info!("[CORE] Generating site keys...");

    // 5. Generate THREE keys (public_key for widget, site_key for identification, secret_key for signing)
    let public_key = generate_public_key();
    let site_key = generate_site_key();
    let secret_key = generate_secret_key();
    let now = Utc::now();

    info!("[CORE] Generated public_key: {}", public_key);
    info!("[CORE] Generated site_key: {}", site_key);
    info!("[CORE] Generated secret_key: {}", secret_key);

    // 6. Update site status and save keys
    info!("[DB UPDATE] Updating site status to verified and saving keys");
    sqlx::query(
        r#"
        UPDATE sites 
        SET status = $1, verified_at = $2, updated_at = $2, 
            public_key = $3, site_key = $4, secret_key = $5, rate_limit_per_hour = $6
        WHERE id = $7
        "#
    )
    .bind("verified")
    .bind(now)
    .bind(&public_key)
    .bind(&site_key)
    .bind(&secret_key)
    .bind(10000)
    .bind(site_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to update site status: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(VerifySiteError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to update site".to_string(),
                existing_site_id: None,
            }),
        )
    })?;

    info!("[DB SUCCESS] Site verified in database");
    info!("[DB SUCCESS] Site ID: {}", site_id);
    info!("[DB SUCCESS] Status: verified");
    info!("[DB SUCCESS] Public key: {}", public_key);
    info!("[DB SUCCESS] Site key: {}", site_key);
    info!("[DB SUCCESS] Secret key: {}", secret_key);

    // 7. Save keys to site_keys_history table
    info!("[DB INSERT] Saving keys to history table");
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO site_keys_history (site_id, public_key, site_key, secret_key, reason, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#
    )
    .bind(site_id)
    .bind(&public_key)
    .bind(&site_key)
    .bind(&secret_key)
    .bind("initial")
    .bind(now)
    .execute(&pool)
    .await
    {
        warn!("[DB WARNING] Failed to save key history: {}", e);
        // Non-critical, continue
    } else {
        info!("[DB SUCCESS] Keys saved to history table");
    }

    info!("=================================================");
    info!("[CRM->CORE] VERIFY SITE SUCCESS");
    info!("[CRM->CORE] Domain: {}", request.domain);
    info!("[CRM->CORE] Site ID: {}", site_id);
    info!("[CRM->CORE] Organization ID: {:?}", organization_id);
    info!("[CRM->CORE] Public key (for widget): {}", public_key);
    info!("[CRM->CORE] Site key (for identification): {}", site_key);
    info!("[CRM->CORE] Secret key (for signing): {}", secret_key);
    info!("[CRM->CORE] Rate limit: 10000 per hour");
    info!("[CRM->CORE] Verified at: {}", now);
    info!("[CRM->CORE] Returning THREE different keys to CRM in response");
    info!("=================================================");

    Ok(Json(VerifySiteResponse {
        success: true,
        site_id,
        public_key: public_key.clone(),
        site_key: site_key.clone(),
        secret_key: Some(secret_key), // Return actual secret_key (different from site_key)
        domain: request.domain,
        name: site_name,
        status: "verified".to_string(),
        verified_at: now,
        rate_limit_per_hour: 10000,
    }))
}
