use axum::{http::StatusCode, Json};
use super::types::{CreateOrganizationRequest, CreateOrganizationError};
use crate::validation::{organization::OrganizationValidator, russian_legal::RussianLegalValidator};

/// Валидация запроса на создание организации
pub fn validate_request(
    request: &CreateOrganizationRequest,
) -> Result<(), (StatusCode, Json<CreateOrganizationError>)> {
    // Валидация имени организации
    if let Err(e) = OrganizationValidator::validate_name(&request.organization_name) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(CreateOrganizationError {
                success: false,
                error: "VALIDATION_ERROR".to_string(),
                message: e.to_string(),
                suggested_names: None,
                details: None,
                retry_after: None,
            }),
        ));
    }

    // Валидация email владельца
    if let Err(e) = OrganizationValidator::validate_email(&request.owner_email) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(CreateOrganizationError {
                success: false,
                error: "VALIDATION_ERROR".to_string(),
                message: e.to_string(),
                suggested_names: None,
                details: None,
                retry_after: None,
            }),
        ));
    }

    // Валидация имени владельца
    if let Err(e) = OrganizationValidator::validate_owner_name(
        &request.owner_first_name,
        &request.owner_last_name,
    ) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(CreateOrganizationError {
                success: false,
                error: "VALIDATION_ERROR".to_string(),
                message: e.to_string(),
                suggested_names: None,
                details: None,
                retry_after: None,
            }),
        ));
    }

    // Валидация юридического лица (если указано)
    if let Some(legal_entity) = &request.legal_entity {
        if let Err(e) = RussianLegalValidator::validate_inn(&legal_entity.inn) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(CreateOrganizationError {
                    success: false,
                    error: "VALIDATION_ERROR".to_string(),
                    message: format!("Invalid INN: {}", e),
                    suggested_names: None,
                    details: None,
                    retry_after: None,
                }),
            ));
        }

        if let Some(kpp) = &legal_entity.kpp {
            if let Err(e) = RussianLegalValidator::validate_kpp(kpp) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(CreateOrganizationError {
                        success: false,
                        error: "VALIDATION_ERROR".to_string(),
                        message: format!("Invalid KPP: {}", e),
                        suggested_names: None,
                        details: None,
                        retry_after: None,
                    }),
                ));
            }
        }

        if let Some(ogrn) = &legal_entity.ogrn {
            if let Err(e) = RussianLegalValidator::validate_ogrn(ogrn) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(CreateOrganizationError {
                        success: false,
                        error: "VALIDATION_ERROR".to_string(),
                        message: format!("Invalid OGRN: {}", e),
                        suggested_names: None,
                        details: None,
                        retry_after: None,
                    }),
                ));
            }
        }

        // Валидация имени юридического лица
        if let Err(e) = OrganizationValidator::validate_name(&legal_entity.name) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(CreateOrganizationError {
                    success: false,
                    error: "VALIDATION_ERROR".to_string(),
                    message: format!("Invalid legal entity name: {}", e),
                    suggested_names: None,
                    details: None,
                    retry_after: None,
                }),
            ));
        }

        // Валидация адреса
        if legal_entity.address.trim().is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(CreateOrganizationError {
                    success: false,
                    error: "VALIDATION_ERROR".to_string(),
                    message: "Legal entity address cannot be empty".to_string(),
                    suggested_names: None,
                    details: None,
                    retry_after: None,
                }),
            ));
        }
    }

    Ok(())
}