use crate::{Claims, ComponentHealth, HealthCheck, JwtAuth, RussianLegalValidator};
use axum::{
    extract::{Json as ExtractJson, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, instrument};
use ts_rs::TS;
use utoipa::{OpenApi, ToSchema};

/// Application state for shared services
#[derive(Clone)]
pub struct SharedServicesState {
    pub jwt_auth: Arc<JwtAuth>,
    pub russian_validator: Arc<RussianLegalValidator>,
    pub start_time: Instant,
}

/// JWT token validation request
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub struct TokenValidationRequest {
    pub token: String,
    pub trace_id: String,
}

/// JWT token validation response
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub struct TokenValidationResponse {
    pub valid: bool,
    pub claims: Option<Claims>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub trace_id: String,
}

/// Russian legal entity validation request
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub struct RussianLegalValidationRequest {
    pub inn: String,
    pub kpp: Option<String>,
    pub ogrn: Option<String>,
    pub trace_id: String,
}

/// Russian legal entity validation response
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub struct RussianLegalValidationResponse {
    pub inn_valid: bool,
    pub kpp_valid: Option<bool>,
    pub ogrn_valid: Option<bool>,
    pub entity_type: Option<String>,
    pub errors: Vec<String>,
    pub trace_id: String,
}

/// Health check endpoint for shared services
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy", body = HealthCheck)
    ),
    tag = "health"
)]
#[instrument(skip(state))]
pub async fn health_handler(
    State(state): State<SharedServicesState>,
) -> Result<Json<HealthCheck>, (StatusCode, String)> {
    let mut health = HealthCheck::new("shared-services", "0.1.0");
    health.update_uptime(state.start_time.elapsed().as_secs());

    // Add JWT auth component health
    health.add_component(
        "jwt_auth",
        ComponentHealth::healthy(Some("JWT authentication service operational".to_string())),
    );

    // Add Russian legal validator component health
    health.add_component(
        "russian_validator",
        ComponentHealth::healthy(Some(
            "Russian legal entity validator operational".to_string(),
        )),
    );

    Ok(Json(health))
}

/// JWT token validation endpoint
#[utoipa::path(
    post,
    path = "/api/v1/auth/validate",
    request_body = TokenValidationRequest,
    responses(
        (status = 200, description = "Token validation result", body = TokenValidationResponse),
        (status = 400, description = "Invalid request", body = String),
        (status = 500, description = "Internal server error", body = String)
    ),
    tag = "auth"
)]
#[instrument(skip(state))]
pub async fn validate_token_handler(
    State(state): State<SharedServicesState>,
    ExtractJson(request): ExtractJson<TokenValidationRequest>,
) -> Result<Json<TokenValidationResponse>, (StatusCode, String)> {
    info!("Validating JWT token");

    match state.jwt_auth.validate_token(&request.token) {
        Ok(claims) => {
            let response = TokenValidationResponse {
                valid: true,
                claims: Some(claims.clone()),
                expires_at: Some(
                    chrono::DateTime::from_timestamp(claims.exp, 0).unwrap_or_default(),
                ),
                trace_id: request.trace_id,
            };
            Ok(Json(response))
        }
        Err(_) => {
            let response = TokenValidationResponse {
                valid: false,
                claims: None,
                expires_at: None,
                trace_id: request.trace_id,
            };
            Ok(Json(response))
        }
    }
}

/// Russian legal entity validation endpoint
#[utoipa::path(
    post,
    path = "/api/v1/validation/russian-legal",
    request_body = RussianLegalValidationRequest,
    responses(
        (status = 200, description = "Russian legal entity validation result", body = RussianLegalValidationResponse),
        (status = 400, description = "Invalid request", body = String),
        (status = 500, description = "Internal server error", body = String)
    ),
    tag = "validation"
)]
#[instrument(skip(_state))]
pub async fn validate_russian_legal_handler(
    State(_state): State<SharedServicesState>,
    ExtractJson(request): ExtractJson<RussianLegalValidationRequest>,
) -> Result<Json<RussianLegalValidationResponse>, (StatusCode, String)> {
    info!("Validating Russian legal entity data");

    let mut errors = Vec::new();

    // Validate INN
    let inn_valid = RussianLegalValidator::validate_inn(&request.inn).is_ok();
    if !inn_valid {
        errors.push("Invalid INN format".to_string());
    }

    // Validate KPP if provided
    let kpp_valid = request.kpp.as_ref().map(|kpp| {
        let valid = RussianLegalValidator::validate_kpp(kpp).is_ok();
        if !valid {
            errors.push("Invalid KPP format".to_string());
        }
        valid
    });

    // Validate OGRN if provided
    let ogrn_valid = request.ogrn.as_ref().map(|ogrn| {
        let valid = RussianLegalValidator::validate_ogrn(ogrn).is_ok();
        if !valid {
            errors.push("Invalid OGRN format".to_string());
        }
        valid
    });

    // Determine entity type based on INN length
    let entity_type = if inn_valid {
        match request.inn.len() {
            10 => Some("Legal Entity".to_string()),
            12 => Some("Individual Entrepreneur".to_string()),
            _ => None,
        }
    } else {
        None
    };

    let response = RussianLegalValidationResponse {
        inn_valid,
        kpp_valid,
        ogrn_valid,
        entity_type,
        errors,
        trace_id: request.trace_id,
    };

    Ok(Json(response))
}

/// OpenAPI documentation for Shared Services
#[derive(OpenApi)]
#[openapi(
    paths(
        health_handler,
        validate_token_handler,
        validate_russian_legal_handler
    ),
    components(
        schemas(
            TokenValidationRequest,
            TokenValidationResponse,
            RussianLegalValidationRequest,
            RussianLegalValidationResponse,
            Claims,
            HealthCheck,
            ComponentHealth
        )
    ),
    tags(
        (name = "auth", description = "Authentication and authorization endpoints"),
        (name = "validation", description = "Data validation endpoints"),
        (name = "health", description = "Health check endpoints")
    ),
    info(
        title = "ADQuest Shared Services API",
        version = "0.1.0",
        description = "API for shared services including authentication, validation, and utilities"
    )
)]
pub struct SharedServicesApi;
