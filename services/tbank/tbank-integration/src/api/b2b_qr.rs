use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::services::TBankServices;

/// B2B QR-code API endpoints for СБП payments
/// Handles /api/v1/b2b/qr/* endpoints according to official T-Bank Business API

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateB2BQrRequest {
    pub amount: Decimal,
    pub currency: String,
    pub description: String,
    pub counterparty_inn: String,
    pub counterparty_kpp: Option<String>,
    pub counterparty_name: String,
    pub account_number: Option<String>,
    pub payment_purpose: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B2BQrResponse {
    pub id: Uuid,
    pub qr_id: String,
    pub amount: Decimal,
    pub currency: String,
    pub description: String,
    pub counterparty_inn: String,
    pub counterparty_kpp: Option<String>,
    pub counterparty_name: String,
    pub status: String,
    pub qr_url: String,
    pub qr_image: Option<String>,
    pub payment_url: String,
    pub expires_at: DateTime<Utc>,
    pub is_reusable: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct QrInfoQuery {
    #[serde(default)]
    pub with_image: bool,
}

impl CreateB2BQrRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.amount <= Decimal::ZERO {
            return Err("Amount must be positive".to_string());
        }

        if !self.counterparty_inn.chars().all(|c| c.is_ascii_digit()) {
            return Err("INN must contain only digits".to_string());
        }

        let inn_len = self.counterparty_inn.len();
        if inn_len != 10 && inn_len != 12 {
            return Err("INN must be 10 or 12 digits".to_string());
        }

        if let Some(ref kpp) = self.counterparty_kpp {
            if !kpp.chars().all(|c| c.is_ascii_digit()) || kpp.len() != 9 {
                return Err("KPP must be 9 digits".to_string());
            }
        }

        if self.description.trim().is_empty() {
            return Err("Description is required".to_string());
        }

        if self.counterparty_name.trim().is_empty() {
            return Err("Counterparty name is required".to_string());
        }

        Ok(())
    }
}

/// Create one-time B2B QR-code
/// POST /api/v1/b2b/qr/onetime
pub async fn create_onetime_qr(
    Json(request): Json<CreateB2BQrRequest>,
) -> Result<Json<B2BQrResponse>, StatusCode> {
    // Validate request
    request.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: Implement actual QR creation via T-Bank Business API
    // Official endpoint: POST https://business.tbank.ru/openapi/api/v1/b2b/qr/onetime

    let qr_id = format!("QR_{}", Uuid::new_v4().to_string().replace("-", "").to_uppercase());
    let expires_at = request.expires_at.unwrap_or_else(|| Utc::now() + chrono::Duration::hours(24));

    let response = B2BQrResponse {
        id: Uuid::new_v4(),
        qr_id: qr_id.clone(),
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        counterparty_inn: request.counterparty_inn,
        counterparty_kpp: request.counterparty_kpp,
        counterparty_name: request.counterparty_name,
        status: "active".to_string(),
        qr_url: format!("https://qr.nspk.ru/AD100004BAI7227F9BNP6KNE007J9B3K?type=02&bank=100000000004&sum={}&cur=RUB&crc=AB75", request.amount),
        qr_image: Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()),
        payment_url: format!("https://business.tbank.ru/pay/{}", qr_id),
        expires_at,
        is_reusable: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Create reusable B2B QR-code
/// POST /api/v1/b2b/qr/reusable
pub async fn create_reusable_qr(
    Json(request): Json<CreateB2BQrRequest>,
) -> Result<Json<B2BQrResponse>, StatusCode> {
    // Validate request
    request.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: Implement actual QR creation via T-Bank Business API
    // Official endpoint: POST https://business.tbank.ru/openapi/api/v1/b2b/qr/reusable

    let qr_id = format!("QR_{}", Uuid::new_v4().to_string().replace("-", "").to_uppercase());
    let expires_at = request.expires_at.unwrap_or_else(|| Utc::now() + chrono::Duration::days(365));

    let response = B2BQrResponse {
        id: Uuid::new_v4(),
        qr_id: qr_id.clone(),
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        counterparty_inn: request.counterparty_inn,
        counterparty_kpp: request.counterparty_kpp,
        counterparty_name: request.counterparty_name,
        status: "active".to_string(),
        qr_url: format!("https://qr.nspk.ru/AD100004BAI7227F9BNP6KNE007J9B3K?type=02&bank=100000000004&sum={}&cur=RUB&crc=AB75", request.amount),
        qr_image: Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()),
        payment_url: format!("https://business.tbank.ru/pay/{}", qr_id),
        expires_at,
        is_reusable: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Get QR-code information
/// GET /api/v1/b2b/qr/{qr_id}/info
pub async fn get_qr_info(
    Path(qr_id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<QrInfoQuery>,
) -> Result<Json<B2BQrResponse>, StatusCode> {
    // TODO: Implement actual QR info retrieval via T-Bank Business API
    // Official endpoint: GET https://business.tbank.ru/openapi/api/v1/b2b/qr/{qrId}/info

    let response = B2BQrResponse {
        id: Uuid::new_v4(),
        qr_id: qr_id.clone(),
        amount: Decimal::from(1000),
        currency: "RUB".to_string(),
        description: "Test payment".to_string(),
        counterparty_inn: "7707083893".to_string(),
        counterparty_kpp: Some("770701001".to_string()),
        counterparty_name: "ООО Тест".to_string(),
        status: "active".to_string(),
        qr_url: format!("https://qr.nspk.ru/AD100004BAI7227F9BNP6KNE007J9B3K?type=02&bank=100000000004&sum=1000&cur=RUB&crc=AB75"),
        qr_image: if query.with_image {
            Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string())
        } else {
            None
        },
        payment_url: format!("https://business.tbank.ru/pay/{}", qr_id),
        expires_at: Utc::now() + chrono::Duration::hours(24),
        is_reusable: false,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Create B2B QR router
pub fn create_b2b_qr_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/onetime", post(create_onetime_qr))
        .route("/reusable", post(create_reusable_qr))
        .route("/:qr_id/info", get(get_qr_info))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn test_create_b2b_qr_request_validation() {
        let valid_request = CreateB2BQrRequest {
            amount: Decimal::from(1000),
            currency: "RUB".to_string(),
            description: "Test payment".to_string(),
            counterparty_inn: "7707083893".to_string(),
            counterparty_kpp: Some("770701001".to_string()),
            counterparty_name: "ООО Тест".to_string(),
            account_number: None,
            payment_purpose: None,
            expires_at: None,
        };

        assert!(valid_request.validate().is_ok());

        // Test invalid amount
        let mut invalid_request = valid_request.clone();
        invalid_request.amount = Decimal::from(-100);
        assert!(invalid_request.validate().is_err());

        // Test invalid INN
        let mut invalid_request = valid_request.clone();
        invalid_request.counterparty_inn = "123".to_string();
        assert!(invalid_request.validate().is_err());

        // Test invalid KPP
        let mut invalid_request = valid_request.clone();
        invalid_request.counterparty_kpp = Some("123".to_string());
        assert!(invalid_request.validate().is_err());
    }
}