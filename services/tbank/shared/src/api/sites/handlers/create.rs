use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use tracing::{info, error};
use uuid::Uuid;
use chrono::Utc;

use crate::api::sites::types::*;
use crate::api::sites::utils::*;

/// Handler for creating a new site
/// Creates a site record and generates verification token
pub async fn create_site_handler(
    State(pool): State<PgPool>,
    Json(request): Json<CreateSiteRequest>,
) -> Result<Json<CreateSiteResponse>, (StatusCode, Json<CreateSiteError>)> {
    info!("[CRM->CORE] CREATE SITE REQUEST received");
    info!("[CRM->CORE] Domain: {}", request.domain);
    info!("[CRM->CORE] Name: {}", request.name);
    info!("[CRM->CORE] Organization ID: {}", request.organization_id);
    info!("[CRM->CORE] Description: {:?}", request.description);
    info!("[CRM->CORE] Category: {:?}", request.category);

    // 1. Validate domain format
    if request.domain.is_empty() || !request.domain.contains('.') {
        error!("[CRM->CORE] CREATE SITE FAILED: Invalid domain format - {}", request.domain);
        return Err((
            StatusCode::BAD_REQUEST,
            Json(CreateSiteError {
                success: false,
                error: "INVALID_DOMAIN".to_string(),
                message: "Invalid domain format".to_string(),
            }),
        ));
    }

    // 2. Check if organization exists
    info!("[DB CHECK] Checking if organization exists: {}", request.organization_id);
    let org_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1)"
    )
    .bind(request.organization_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to check organization: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateSiteError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to check organization".to_string(),
            }),
        )
    })?;

    if !org_exists {
        error!("[CRM->CORE] CREATE SITE FAILED: Organization not found - {}", request.organization_id);
        return Err((
            StatusCode::NOT_FOUND,
            Json(CreateSiteError {
                success: false,
                error: "ORGANIZATION_NOT_FOUND".to_string(),
                message: format!("Organization {} not found", request.organization_id),
            }),
        ));
    }

    // 3. Check if domain already exists for this organization
    info!("[DB CHECK] Checking if domain already exists: {}", request.domain);
    let existing_site = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, status FROM sites WHERE domain = $1 AND organization_id = $2"
    )
    .bind(&request.domain)
    .bind(request.organization_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to check existing site: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateSiteError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to check existing site".to_string(),
            }),
        )
    })?;

    if let Some((existing_id, status)) = existing_site {
        error!("[CRM->CORE] CREATE SITE FAILED: Site already exists - domain={}, existing_id={}, status={}", 
            request.domain, existing_id, status);
        return Err((
            StatusCode::CONFLICT,
            Json(CreateSiteError {
                success: false,
                error: "SITE_ALREADY_EXISTS".to_string(),
                message: format!(
                    "Site with domain {} already exists for this organization (status: {})",
                    request.domain, status
                ),
            }),
        ));
    }

    // 4. Generate verification token
    let verification_token = generate_verification_token();
    let site_id = Uuid::new_v4();
    let now = Utc::now();

    info!("[DB INSERT] Creating site in database");
    info!("[DB INSERT] Site ID: {}", site_id);
    info!("[DB INSERT] Domain: {}", request.domain);
    info!("[DB INSERT] Verification token: {}", verification_token);

    // 5. Insert site into database
    sqlx::query(
        r#"
        INSERT INTO sites (
            id, domain, name, description, organization_id, 
            status, verification_token, category, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#
    )
    .bind(site_id)
    .bind(&request.domain)
    .bind(&request.name)
    .bind(&request.description)
    .bind(request.organization_id)
    .bind("pending")
    .bind(&verification_token)
    .bind(&request.category)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(|e| {
        error!("[DB ERROR] Failed to insert site: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateSiteError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to create site".to_string(),
            }),
        )
    })?;

    info!("=================================================");
    info!("[DB SUCCESS] Site created in database");
    info!("[DB SUCCESS] Site ID: {}", site_id);
    info!("[DB SUCCESS] Domain: {}", request.domain);
    info!("[DB SUCCESS] Name: {}", request.name);
    info!("[DB SUCCESS] Status: pending");
    info!("[DB SUCCESS] Organization ID: {}", request.organization_id);
    info!("[DB SUCCESS] Verification token: {}", verification_token);
    info!("[CRM->CORE] CREATE SITE SUCCESS");
    info!("[CRM->CORE] IMPORTANT: CRM must save this site_id in metadata as 'core_site_id'");
    info!("[CRM->CORE] Returning response to CRM:");
    info!("[CRM->CORE]   - siteId: {}", site_id);
    info!("[CRM->CORE]   - verificationToken: {}", verification_token);
    info!("[CRM->CORE]   - status: pending");
    info!("=================================================");

    Ok(Json(CreateSiteResponse {
        success: true,
        site_id,
        domain: request.domain,
        name: request.name,
        verification_token,
        status: "pending".to_string(),
        organization_id: request.organization_id,
        created_at: now,
    }))
}
