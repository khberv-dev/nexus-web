use axum::{
    extract::Query,
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::services::TBankServices;

/// Company verification API endpoints
/// Handles /api/v1/company/* endpoints according to official T-Bank Business API

#[derive(Debug, Deserialize)]
pub struct CompanyInfoQuery {
    #[serde(default)]
    pub inn: Option<String>,
    #[serde(default)]
    pub kpp: Option<String>,
}

/// Official T-Bank API response structure
#[derive(Debug, Serialize, Deserialize)]
pub struct TBankCompanyResponse {
    pub name: String,
    pub city: String,
    pub requisites: TBankRequisites,
    #[serde(rename = "registrationDate")]
    pub registration_date: Option<String>,
    pub opf: Option<String>,
    #[serde(rename = "taxationScheme")]
    pub taxation_scheme: Option<String>,
    #[serde(rename = "legalStatus")]
    pub legal_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TBankRequisites {
    #[serde(rename = "fullName")]
    pub full_name: String,
    #[serde(rename = "foreignName")]
    pub foreign_name: Option<String>,
    pub address: String,
    #[serde(rename = "legalAddress")]
    pub legal_address: String,
    pub inn: String,
    pub kpp: Option<String>,
    pub ogrn: Option<String>,
    pub bank: TBankBankInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TBankBankInfo {
    #[serde(rename = "bankName")]
    pub bank_name: String,
    #[serde(rename = "bankAddress")]
    pub bank_address: String,
    #[serde(rename = "corrAccount")]
    pub corr_account: String,
    #[serde(rename = "bankInn")]
    pub bank_inn: String,
    #[serde(rename = "bankBic")]
    pub bank_bic: String,
}

/// Simplified response for CRM (backward compatibility)
#[derive(Debug, Serialize)]
pub struct CompanyInfoResponse {
    pub inn: String,
    pub kpp: Option<String>,
    pub name: String,
    pub full_name: String,
    pub address: String,
    pub legal_address: String,
    pub city: String,
    pub status: String,
    pub legal_status: String,
    pub registration_date: Option<String>,
    pub ogrn: Option<String>,
    pub opf: Option<String>,
    pub taxation_scheme: Option<String>,
    pub bank: Option<BankInfo>,
}

#[derive(Debug, Serialize)]
pub struct BankInfo {
    pub name: String,
    pub address: String,
    pub corr_account: String,
    pub inn: String,
    pub bic: String,
}

#[derive(Debug, Serialize)]
pub struct SignerStatusResponse {
    pub inn: String,
    pub status: String,
    pub can_sign: bool,
    pub restrictions: Vec<String>,
}

/// Get company information
/// GET /api/v1/company (returns info about token owner's company)
pub async fn get_company_info(
    Query(_query): Query<CompanyInfoQuery>,
) -> Result<Json<TBankCompanyResponse>, StatusCode> {
    tracing::info!("Getting company info for token owner");
    
    // Get T-Bank API configuration
    let tbank_api_url = std::env::var("TBANK_BUSINESS_API_BASE_URL")
        .unwrap_or_else(|_| "https://business.tbank.ru/openapi/api/v1".to_string());
    let tbank_api_token = std::env::var("TBANK_API_TOKEN")
        .map_err(|e| {
            tracing::error!("TBANK_API_TOKEN not set: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let url = format!("{}/company", tbank_api_url);

    tracing::debug!("Calling T-Bank API: {}", url);

    // Call T-Bank Business API
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| {
            tracing::error!("Failed to create HTTP client: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let tbank_response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", tbank_api_token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to call T-Bank API: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    let status = tbank_response.status();
    let response_text = tbank_response.text().await.unwrap_or_default();

    tracing::info!(
        "T-Bank API response: status={}, body_length={}",
        status,
        response_text.len()
    );

    if !status.is_success() {
        tracing::error!(
            "T-Bank API returned error: status={}, body={}",
            status,
            response_text
        );
        return Err(StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY));
    }

    // Parse T-Bank response
    let tbank_data: TBankCompanyResponse = serde_json::from_str(&response_text)
        .map_err(|e| {
            tracing::error!("Failed to parse T-Bank response: {} - body: {}", e, response_text);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!("Company info retrieved successfully: {}", tbank_data.name);

    Ok(Json(tbank_data))
}

/// Get signer status
/// GET /api/v1/company/signer/status
pub async fn get_signer_status(
    Query(query): Query<CompanyInfoQuery>,
) -> Result<Json<SignerStatusResponse>, StatusCode> {
    // TODO: Implement actual signer status check via T-Bank Business API
    // Official endpoint: GET https://business.tbank.ru/openapi/api/v1/company/signer/status
    
    let response = SignerStatusResponse {
        inn: query.inn.unwrap_or_default(),
        status: "active".to_string(),
        can_sign: true,
        restrictions: vec![],
    };

    Ok(Json(response))
}

/// Create company verification router
pub fn create_company_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/", get(get_company_info))
        .route("/signer/status", get(get_signer_status))
}