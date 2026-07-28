use axum::{http::StatusCode, Json};
use sqlx::PgPool;
use tracing::{info, error, warn};
use uuid::Uuid;
use chrono::{Utc, Datelike};

use super::types::{CreateOrganizationRequest, CreateOrganizationResponse, CreateOrganizationError};
use crate::{
    models::organization::Organization,
    repositories::organization::OrganizationRepository,
};

/// Business logic for organization creation
pub async fn create_organization_business_logic(
    pool: PgPool,
    request: CreateOrganizationRequest,
) -> Result<CreateOrganizationResponse, (StatusCode, Json<CreateOrganizationError>)> {
    let repo = OrganizationRepository::new(pool.clone());

    // 1. Проверяем, что CRM передал Zitadel данные (обязательно!)
    let (zitadel_org_id, zitadel_project_id, zitadel_client_id) = match 
        (&request.zitadel_org_id, &request.zitadel_project_id, &request.zitadel_client_id) {
        (Some(org_id), Some(proj_id), Some(client_id)) => {
            info!("Using Zitadel organization data from CRM: org_id={}, project_id={}, client_id={}", 
                org_id, proj_id, client_id);
            (org_id.clone(), proj_id.clone(), client_id.clone())
        }
        _ => {
            error!("CRM must provide Zitadel organization data (zitadelOrgId, zitadelProjectId, zitadelClientId)");
            return Err((
                StatusCode::BAD_REQUEST,
                Json(CreateOrganizationError {
                    success: false,
                    error: "MISSING_ZITADEL_DATA".to_string(),
                    message: "CRM must create organization in Zitadel first and provide zitadelOrgId, zitadelProjectId, zitadelClientId".to_string(),
                    suggested_names: None,
                    details: None,
                    retry_after: None,
                }),
            ));
        }
    };

    // 2. Проверяем, существует ли организация с таким zitadel_org_id
    let existing_org = sqlx::query_as::<_, (String, String, String, String)>(
        r#"
        SELECT id::text, metadata->>'zitadel_org_id', metadata->>'zitadel_project_id', metadata->>'zitadel_client_id'
        FROM organizations
        WHERE metadata->>'zitadel_org_id' = $1
        AND deleted_at IS NULL
        "#
    )
    .bind(&zitadel_org_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        error!("Database error checking existing organization: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(CreateOrganizationError {
                success: false,
                error: "DATABASE_ERROR".to_string(),
                message: "Failed to check existing organization".to_string(),
                suggested_names: None,
                details: None,
                retry_after: Some(10),
            }),
        )
    })?;

    // Если организация уже существует - вернуть ее данные
    if let Some((existing_id, existing_zitadel_org_id, existing_zitadel_project_id, existing_zitadel_client_id)) = existing_org {
        info!(
            "Organization already exists for zitadel_org_id={}: returning existing ID {}",
            zitadel_org_id, existing_id
        );

        let login_url = format!(
            "{}/ui/login/loginname?authRequestID={}",
            std::env::var("ZITADEL_URL").unwrap_or_else(|_| "http://localhost:8080".to_string()),
            existing_zitadel_client_id
        );

        let redirect_url = format!(
            "{}/dashboard/onboarding/complete?org={}",
            std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()),
            existing_id
        );

        return Ok(CreateOrganizationResponse {
            success: true,
            organization_id: existing_id,
            zitadel_org_id: existing_zitadel_org_id,
            zitadel_project_id: existing_zitadel_project_id,
            client_id: existing_zitadel_client_id,
            login_url,
            redirect_url,
        });
    }

    // 3. Создание новой организации в базе данных
    let organization_id = Uuid::new_v4();
    let now = Utc::now();

    // Подготовка legal_entity JSON
    let legal_entity_json = request.legal_entity.as_ref().map(|le| {
        serde_json::json!({
            "name": le.name,
            "inn": le.inn,
            "kpp": le.kpp,
            "ogrn": le.ogrn,
            "address": le.address,
            "organization_form": le.organization_form
        })
    }).unwrap_or_else(|| serde_json::json!({})); // Default to empty object if None

    // Подготовка metadata JSON
    let metadata = serde_json::json!({
        "created_via": "api-registration",
        "owner_first_name": request.owner_first_name,
        "owner_last_name": request.owner_last_name,
        "owner_email": request.owner_email,
        "zitadel_org_id": zitadel_org_id,
        "zitadel_project_id": zitadel_project_id,
        "zitadel_client_id": zitadel_client_id,
        "registration_complete": true,
        "created_at": now.to_rfc3339()
    });

    // Используем owner_user_id от CRM если передан, иначе генерируем
    let owner_user_id = request.owner_user_id
        .unwrap_or_else(|| format!("zitadel-user-{}", request.owner_email));

    let organization = Organization {
        id: organization_id,
        name: request.organization_name.clone(),
        organization_type: request.organization_type,
        owner_user_id,
        legal_entity: Some(legal_entity_json),
        metadata,
        created_at: now,
        updated_at: now,
        deleted_at: None,
    };

    let created_org = match repo.create_organization(organization).await {
        Ok(org) => org,
        Err(e) => {
            error!("Failed to create organization in database: {}", e);
            
            // TODO: Реализовать cleanup Zitadel организации при ошибке
            warn!("Organization created in Zitadel but failed to save in database");

            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateOrganizationError {
                    success: false,
                    error: "DATABASE_ERROR".to_string(),
                    message: "Failed to save organization".to_string(),
                    suggested_names: None,
                    details: None,
                    retry_after: Some(10),
                }),
            ));
        }
    };

    info!(
        "Organization created successfully: {} (ID: {}, Zitadel: {})",
        created_org.name, created_org.id, zitadel_org_id
    );

    // 4. Формирование ответа
    let login_url = format!(
        "{}/ui/login/loginname?authRequestID={}",
        std::env::var("ZITADEL_URL").unwrap_or_else(|_| "http://localhost:8080".to_string()),
        zitadel_client_id
    );

    let redirect_url = format!(
        "{}/dashboard/onboarding/complete?org={}",
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:3000".to_string()),
        created_org.id
    );

    Ok(CreateOrganizationResponse {
        success: true,
        organization_id: created_org.id.to_string(),
        zitadel_org_id,
        zitadel_project_id,
        client_id: zitadel_client_id,
        login_url,
        redirect_url,
    })
}

/// Generate suggested organization names
fn generate_suggested_names(original_name: &str) -> Vec<String> {
    let current_year = Utc::now().year();
    let base_name = original_name.trim();
    
    vec![
        format!("{} {}", base_name, current_year),
        format!("{} LLC", base_name),
        format!("{} Ltd", base_name),
        format!("{} Group", base_name),
        format!("{} Company", base_name),
    ]
}