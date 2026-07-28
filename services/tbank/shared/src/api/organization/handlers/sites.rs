use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use tracing::{error, info};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::Serialize;

/// Site information for organization
#[derive(Debug, Serialize)]
pub struct OrganizationSite {
    pub id: Uuid,
    #[serde(rename = "siteKey", skip_serializing_if = "Option::is_none")]
    pub site_key: Option<String>,
    pub domain: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "rateLimitPerHour")]
    pub rate_limit_per_hour: i32,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "verifiedAt", skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<DateTime<Utc>>,
}

/// Response for getting organization sites
#[derive(Debug, Serialize)]
pub struct GetOrganizationSitesResponse {
    pub success: bool,
    pub sites: Vec<OrganizationSite>,
    pub total: usize,
}

/// Error response
#[derive(Debug, Serialize)]
pub struct GetOrganizationSitesError {
    pub success: bool,
    pub error: String,
    pub message: String,
}

/// Handler to get all sites for an organization
pub async fn get_organization_sites_handler(
    State(pool): State<PgPool>,
    Path(org_id): Path<String>,
) -> Result<Json<GetOrganizationSitesResponse>, (StatusCode, Json<GetOrganizationSitesError>)> {
    info!("Getting sites for organization: {}", org_id);

    // Parse organization ID
    let org_uuid = match Uuid::parse_str(&org_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(GetOrganizationSitesError {
                    success: false,
                    error: "INVALID_ORG_ID".to_string(),
                    message: "Invalid organization ID format".to_string(),
                }),
            ));
        }
    };

    // Check if organization exists
    let org_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1)"
    )
    .bind(org_uuid)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        error!("Database error checking organization: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GetOrganizationSitesError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to check organization".to_string(),
            }),
        )
    })?;

    if !org_exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(GetOrganizationSitesError {
                success: false,
                error: "ORGANIZATION_NOT_FOUND".to_string(),
                message: format!("Organization {} not found", org_id),
            }),
        ));
    }

    // Get all sites for the organization
    let sites = sqlx::query_as::<_, (
        Uuid,
        Option<String>,
        String,
        String,
        Option<String>,
        String,
        i32,
        DateTime<Utc>,
        Option<DateTime<Utc>>,
    )>(
        r#"
        SELECT 
            s.id,
            sk.site_key,
            s.domain,
            s.name,
            s.description,
            s.status,
            COALESCE(s.rate_limit_per_hour, 10000) as rate_limit_per_hour,
            s.created_at,
            s.verified_at
        FROM sites s
        LEFT JOIN site_keys sk ON s.id = sk.site_id AND sk.is_active = true
        WHERE s.organization_id = $1
        ORDER BY s.created_at DESC
        "#
    )
    .bind(org_uuid)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch sites: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(GetOrganizationSitesError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to fetch sites".to_string(),
            }),
        )
    })?;

    let total = sites.len();
    let sites: Vec<OrganizationSite> = sites
        .into_iter()
        .map(|(id, site_key, domain, name, description, status, rate_limit_per_hour, created_at, verified_at)| {
            OrganizationSite {
                id,
                site_key,
                domain,
                name,
                description,
                status,
                rate_limit_per_hour,
                created_at,
                verified_at,
            }
        })
        .collect();

    info!("Found {} sites for organization {}", total, org_id);

    Ok(Json(GetOrganizationSitesResponse {
        success: true,
        sites,
        total,
    }))
}
