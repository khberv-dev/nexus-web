use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{info, error, warn};
use uuid::Uuid;

use crate::{
    models::organization::AccountType,
    repositories::organization::OrganizationRepository,
    services::zitadel::ZitadelOrganizationService,
};

/// Request for assigning role to user after registration
#[derive(Debug, Deserialize)]
pub struct AssignUserRoleRequest {
    #[serde(rename = "userEmail")]
    pub user_email: String,
    #[serde(rename = "organizationType")]
    pub organization_type: AccountType,
}

/// Response for role assignment
#[derive(Debug, Serialize)]
pub struct AssignUserRoleResponse {
    pub success: bool,
    pub message: String,
    #[serde(rename = "userEmail")]
    pub user_email: String,
    #[serde(rename = "assignedRole")]
    pub assigned_role: String,
}

/// Error response for role assignment
#[derive(Debug, Serialize)]
pub struct AssignUserRoleError {
    pub success: bool,
    pub error: String,
    pub message: String,
}

/// Handler to assign role to user after they register in Zitadel
/// This is called after user completes OAuth registration flow
pub async fn assign_user_role_handler(
    State(pool): State<PgPool>,
    Path(org_id): Path<String>,
    Json(request): Json<AssignUserRoleRequest>,
) -> Result<Json<AssignUserRoleResponse>, (StatusCode, Json<AssignUserRoleError>)> {
    info!(
        "Assigning role to user {} in organization {}",
        request.user_email, org_id
    );

    let repo = OrganizationRepository::new(pool);

    // 1. Парсим UUID организации
    let org_uuid = match Uuid::parse_str(&org_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            warn!("Invalid organization ID format: {}", org_id);
            return Err((
                StatusCode::BAD_REQUEST,
                Json(AssignUserRoleError {
                    success: false,
                    error: "INVALID_ORG_ID".to_string(),
                    message: "Некорректный формат ID организации".to_string(),
                }),
            ));
        }
    };

    // 2. Получаем организацию из базы данных
    let organization = match repo.get_by_id(org_uuid).await {
        Ok(Some(org)) => org,
        Ok(None) => {
            warn!("Organization not found: {}", org_id);
            return Err((
                StatusCode::NOT_FOUND,
                Json(AssignUserRoleError {
                    success: false,
                    error: "ORGANIZATION_NOT_FOUND".to_string(),
                    message: "Организация не найдена".to_string(),
                }),
            ));
        }
        Err(e) => {
            error!("Database error getting organization: {:?}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AssignUserRoleError {
                    success: false,
                    error: "DATABASE_ERROR".to_string(),
                    message: "Ошибка базы данных".to_string(),
                }),
            ));
        }
    };

    // 2. Извлекаем Zitadel данные из метаданных организации
    let zitadel_org_id = organization.metadata
        .get("zitadel_org_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            error!("Missing zitadel_org_id in organization metadata");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AssignUserRoleError {
                    success: false,
                    error: "MISSING_ZITADEL_DATA".to_string(),
                    message: "Отсутствуют данные Zitadel в организации".to_string(),
                }),
            )
        })?;

    let zitadel_project_id = organization.metadata
        .get("zitadel_project_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            error!("Missing zitadel_project_id in organization metadata");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AssignUserRoleError {
                    success: false,
                    error: "MISSING_ZITADEL_DATA".to_string(),
                    message: "Отсутствуют данные проекта Zitadel".to_string(),
                }),
            )
        })?;

    // 3. Инициализируем Zitadel сервис
    let zitadel_service = match ZitadelOrganizationService::new() {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize Zitadel service: {:?}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AssignUserRoleError {
                    success: false,
                    error: "ZITADEL_SERVICE_ERROR".to_string(),
                    message: "Не удалось инициализировать сервис Zitadel".to_string(),
                }),
            ));
        }
    };

    // 4. Присваиваем роль пользователю
    let organization_type_str = match request.organization_type {
        AccountType::Advertiser => "advertiser",
        AccountType::Publisher => "publisher",
        AccountType::Agency => "agency",
    };

    match zitadel_service
        .assign_default_role_to_user(
            zitadel_org_id,
            zitadel_project_id,
            &request.user_email,
            organization_type_str,
        )
        .await
    {
        Ok(_) => {
            let assigned_role = match request.organization_type {
                AccountType::Advertiser => "adquest.advertiser",
                AccountType::Publisher => "adquest.publisher",
                AccountType::Agency => "adquest.advertiser", // Агентства получают права рекламодателя
            };

            info!(
                "Successfully assigned role {} to user {} in organization {}",
                assigned_role, request.user_email, org_id
            );

            Ok(Json(AssignUserRoleResponse {
                success: true,
                message: format!("Роль {} успешно присвоена пользователю", assigned_role),
                user_email: request.user_email,
                assigned_role: assigned_role.to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to assign role to user: {:?}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AssignUserRoleError {
                    success: false,
                    error: "ROLE_ASSIGNMENT_FAILED".to_string(),
                    message: format!("Не удалось присвоить роль: {}", e),
                }),
            ))
        }
    }
}