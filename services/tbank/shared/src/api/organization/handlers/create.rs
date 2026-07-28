use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;
use tracing::info;

mod types;
mod validation;
mod business_logic;

pub use types::*;
use validation::validate_request;
use business_logic::create_organization_business_logic;

/// Handler to create a new organization
/// Создает организацию в Zitadel и сохраняет в базу данных
pub async fn create_organization_handler(
    State(pool): State<PgPool>,
    Json(request): Json<CreateOrganizationRequest>,
) -> Result<Json<CreateOrganizationResponse>, (StatusCode, Json<CreateOrganizationError>)> {
    info!(
        "Create organization request: {} (type: {:?}) by {}",
        request.organization_name, request.organization_type, request.owner_email
    );

    // 1. Валидация входных данных
    validate_request(&request)?;

    // 2. Бизнес-логика создания организации
    let response = create_organization_business_logic(pool, request).await?;

    Ok(Json(response))
}