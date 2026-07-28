use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{info, warn, error};

use crate::services::zitadel::ZitadelOrganizationService;

/// Zitadel webhook payload for user events
#[derive(Debug, Deserialize)]
pub struct ZitadelWebhookPayload {
    #[serde(rename = "eventType")]
    pub event_type: String,
    pub aggregate: ZitadelAggregate,
    pub user: Option<ZitadelUser>,
    pub org: Option<ZitadelOrg>,
}

#[derive(Debug, Deserialize)]
pub struct ZitadelAggregate {
    pub id: String,
    #[serde(rename = "type")]
    pub aggregate_type: String,
    #[serde(rename = "resourceOwner")]
    pub resource_owner: String,
}

#[derive(Debug, Deserialize)]
pub struct ZitadelUser {
    pub id: String,
    pub human: Option<ZitadelHuman>,
}

#[derive(Debug, Deserialize)]
pub struct ZitadelHuman {
    pub email: Option<ZitadelEmail>,
    pub profile: Option<ZitadelProfile>,
}

#[derive(Debug, Deserialize)]
pub struct ZitadelEmail {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ZitadelProfile {
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
}

#[derive(Debug, Deserialize)]
pub struct ZitadelOrg {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub success: bool,
    pub message: String,
}

/// Webhook handler for Zitadel user events
/// Automatically assigns roles when users are created/registered
pub async fn zitadel_user_webhook_handler(
    State(_pool): State<PgPool>,
    Json(payload): Json<ZitadelWebhookPayload>,
) -> Result<Json<WebhookResponse>, (StatusCode, Json<WebhookResponse>)> {
    info!("Received Zitadel webhook: {}", payload.event_type);

    // Обрабатываем только события создания/регистрации пользователей
    if !matches!(payload.event_type.as_str(), "user.added" | "user.registered" | "user.human.added") {
        info!("Ignoring event type: {}", payload.event_type);
        return Ok(Json(WebhookResponse {
            success: true,
            message: "Event ignored".to_string(),
        }));
    }

    let user = match payload.user {
        Some(user) => user,
        None => {
            warn!("No user data in webhook payload");
            return Ok(Json(WebhookResponse {
                success: true,
                message: "No user data".to_string(),
            }));
        }
    };

    let org = match payload.org {
        Some(org) => org,
        None => {
            warn!("No org data in webhook payload");
            return Ok(Json(WebhookResponse {
                success: true,
                message: "No org data".to_string(),
            }));
        }
    };

    // Пропускаем основную организацию ADQuest
    if org.id == "356291810764587018" {
        info!("Skipping main ADQuest organization");
        return Ok(Json(WebhookResponse {
            success: true,
            message: "Main org skipped".to_string(),
        }));
    }

    let user_email = match user.human.as_ref().and_then(|h| h.email.as_ref()) {
        Some(email) => &email.email,
        None => {
            warn!("No email in user data");
            return Ok(Json(WebhookResponse {
                success: true,
                message: "No email".to_string(),
            }));
        }
    };

    info!("Processing user registration: {} in org: {} ({})", user_email, org.name, org.id);

    // Инициализируем Zitadel сервис
    let zitadel_service = match ZitadelOrganizationService::new() {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize Zitadel service: {:?}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(WebhookResponse {
                    success: false,
                    message: "Service initialization failed".to_string(),
                }),
            ));
        }
    };

    // Определяем тип организации по имени
    let organization_type = if org.name.to_lowercase().contains("publisher") {
        "publisher"
    } else if org.name.to_lowercase().contains("agency") {
        "agency"
    } else {
        "advertiser" // По умолчанию
    };

    // Ищем проекты в организации
    // Для этого нам нужно найти соответствующую организацию в нашей базе данных
    // и получить zitadel_project_id из метаданных
    
    // Пока используем простой подход - ищем первый проект в организации
    // В будущем можно улучшить, связав с нашей базой данных
    
    // Для демонстрации используем фиксированный project_id
    // В реальности нужно получить его из базы данных по org.id
    let project_id = "357307063472226306"; // Это нужно получать динамически

    match zitadel_service
        .assign_default_role_to_user(&org.id, project_id, user_email, organization_type)
        .await
    {
        Ok(_) => {
            info!("✅ Successfully assigned role to user {} in org {}", user_email, org.id);
            Ok(Json(WebhookResponse {
                success: true,
                message: format!("Role assigned to {}", user_email),
            }))
        }
        Err(e) => {
            error!("Failed to assign role to user {}: {:?}", user_email, e);
            // Не возвращаем ошибку, чтобы не блокировать регистрацию пользователя
            Ok(Json(WebhookResponse {
                success: false,
                message: format!("Role assignment failed: {}", e),
            }))
        }
    }
}