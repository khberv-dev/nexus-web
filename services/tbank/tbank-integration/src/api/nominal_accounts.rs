use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put, delete},
    Router,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::services::TBankServices;

/// Nominal accounts API endpoints
/// Handles official T-Bank Business API nominal accounts operations

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBeneficiaryRequest {
    pub name: String,
    pub inn: String,
    pub kpp: Option<String>,
    #[serde(rename = "accountNumber")]
    pub account_number: Option<String>,
    #[serde(rename = "bankName")]
    pub bank_name: Option<String>,
    #[serde(rename = "bankBik")]
    pub bank_bik: Option<String>,
    #[serde(rename = "correspondentAccount")]
    pub correspondent_account: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BeneficiaryResponse {
    pub id: Uuid,
    #[serde(rename = "beneficiaryId")]
    pub beneficiary_id: String,
    pub name: String,
    pub inn: String,
    pub kpp: Option<String>,
    #[serde(rename = "accountNumber")]
    pub account_number: Option<String>,
    #[serde(rename = "bankDetails")]
    pub bank_details: Option<BankDetails>,
    pub status: String, // "active", "blocked", "verification_required"
    #[serde(rename = "verificationStatus")]
    pub verification_status: String, // "verified", "pending", "rejected"
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BankDetails {
    #[serde(rename = "bankName")]
    pub bank_name: String,
    #[serde(rename = "bankBik")]
    pub bank_bik: String,
    #[serde(rename = "correspondentAccount")]
    pub correspondent_account: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScoringResponse {
    #[serde(rename = "beneficiaryId")]
    pub beneficiary_id: String,
    #[serde(rename = "scoringStatus")]
    pub scoring_status: String, // "passed", "failed", "pending"
    #[serde(rename = "riskLevel")]
    pub risk_level: String, // "low", "medium", "high"
    pub restrictions: Vec<String>,
    #[serde(rename = "checkedAt")]
    pub checked_at: DateTime<Utc>,
    #[serde(rename = "validUntil")]
    pub valid_until: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDealRequest {
    pub name: String,
    pub description: String,
    #[serde(rename = "totalAmount")]
    pub total_amount: Decimal,
    pub currency: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: DateTime<Utc>,
    pub steps: Vec<DealStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DealStep {
    pub name: String,
    pub description: String,
    #[serde(rename = "stepOrder")]
    pub step_order: i32,
    pub amount: Decimal,
    #[serde(rename = "beneficiaryId")]
    pub beneficiary_id: String,
    pub conditions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DealResponse {
    pub id: Uuid,
    #[serde(rename = "dealId")]
    pub deal_id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "totalAmount")]
    pub total_amount: Decimal,
    pub currency: String,
    pub status: String, // "draft", "active", "completed", "cancelled"
    #[serde(rename = "currentStep")]
    pub current_step: i32,
    #[serde(rename = "expiresAt")]
    pub expires_at: DateTime<Utc>,
    pub steps: Vec<DealStepResponse>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DealStepResponse {
    pub id: Uuid,
    #[serde(rename = "stepId")]
    pub step_id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "stepOrder")]
    pub step_order: i32,
    pub amount: Decimal,
    pub status: String, // "pending", "completed", "failed"
    #[serde(rename = "beneficiaryId")]
    pub beneficiary_id: String,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePaymentRequest {
    #[serde(rename = "beneficiaryId")]
    pub beneficiary_id: String,
    pub amount: Decimal,
    pub currency: String,
    #[serde(rename = "paymentPurpose")]
    pub payment_purpose: String,
    #[serde(rename = "dealId")]
    pub deal_id: Option<String>,
    #[serde(rename = "stepId")]
    pub step_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentResponse {
    pub id: Uuid,
    #[serde(rename = "paymentId")]
    pub payment_id: String,
    #[serde(rename = "beneficiaryId")]
    pub beneficiary_id: String,
    pub amount: Decimal,
    pub currency: String,
    #[serde(rename = "paymentPurpose")]
    pub payment_purpose: String,
    pub status: String, // "pending", "processing", "completed", "failed"
    #[serde(rename = "dealId")]
    pub deal_id: Option<String>,
    #[serde(rename = "stepId")]
    pub step_id: Option<String>,
    #[serde(rename = "processedAt")]
    pub processed_at: Option<DateTime<Utc>>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct BeneficiariesQuery {
    pub status: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct DealsQuery {
    pub status: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct PaymentsQuery {
    pub status: Option<String>,
    #[serde(rename = "beneficiaryId")]
    pub beneficiary_id: Option<String>,
    #[serde(rename = "dealId")]
    pub deal_id: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl CreateBeneficiaryRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Beneficiary name is required".to_string());
        }

        // Validate INN format (10 or 12 digits)
        if !self.inn.chars().all(|c| c.is_ascii_digit()) {
            return Err("INN must contain only digits".to_string());
        }

        let inn_len = self.inn.len();
        if inn_len != 10 && inn_len != 12 {
            return Err("INN must be 10 or 12 digits".to_string());
        }

        // Validate KPP format if provided (9 digits)
        if let Some(ref kpp) = self.kpp {
            if !kpp.chars().all(|c| c.is_ascii_digit()) || kpp.len() != 9 {
                return Err("KPP must be 9 digits".to_string());
            }
        }

        // Validate email format if provided
        if let Some(ref email) = self.email {
            if !email.contains('@') {
                return Err("Invalid email format".to_string());
            }
        }

        Ok(())
    }
}

impl CreateDealRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Deal name is required".to_string());
        }

        if self.total_amount <= Decimal::ZERO {
            return Err("Total amount must be positive".to_string());
        }

        if self.steps.is_empty() {
            return Err("At least one deal step is required".to_string());
        }

        if self.steps.len() > 100 {
            return Err("Maximum 100 deal steps allowed".to_string());
        }

        // Validate steps
        let mut total_steps_amount = Decimal::ZERO;
        for (i, step) in self.steps.iter().enumerate() {
            if step.step_order != (i as i32 + 1) {
                return Err("Step order must be sequential starting from 1".to_string());
            }

            if step.amount <= Decimal::ZERO {
                return Err("Step amount must be positive".to_string());
            }

            total_steps_amount += step.amount;
        }

        if total_steps_amount != self.total_amount {
            return Err("Sum of step amounts must equal total amount".to_string());
        }

        Ok(())
    }
}

/// Create beneficiary
/// POST /api/v1/nominal-accounts/beneficiaries
pub async fn create_beneficiary(
    State(_services): State<Arc<TBankServices>>,
    Json(request): Json<CreateBeneficiaryRequest>,
) -> Result<Json<BeneficiaryResponse>, StatusCode> {
    // Validate request
    request.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: Implement actual beneficiary creation via T-Bank Business API
    // Official endpoint: POST https://business.tbank.ru/openapi/api/v1/nominal-accounts/beneficiaries

    let beneficiary_id = format!("BEN_{}", Uuid::new_v4().to_string().replace("-", "").to_uppercase());

    let response = BeneficiaryResponse {
        id: Uuid::new_v4(),
        beneficiary_id,
        name: request.name,
        inn: request.inn,
        kpp: request.kpp,
        account_number: request.account_number,
        bank_details: if let (Some(bank_name), Some(bank_bik), Some(correspondent_account)) = 
            (request.bank_name, request.bank_bik, request.correspondent_account) {
            Some(BankDetails {
                bank_name,
                bank_bik,
                correspondent_account,
            })
        } else {
            None
        },
        status: "active".to_string(),
        verification_status: "pending".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Get beneficiaries list
/// GET /api/v1/nominal-accounts/beneficiaries
pub async fn get_beneficiaries(
    State(_services): State<Arc<TBankServices>>,
    Query(_query): Query<BeneficiariesQuery>,
) -> Result<Json<Vec<BeneficiaryResponse>>, StatusCode> {
    // TODO: Implement actual beneficiaries retrieval via T-Bank Business API

    let beneficiaries = vec![
        BeneficiaryResponse {
            id: Uuid::new_v4(),
            beneficiary_id: "BEN_123456".to_string(),
            name: "ООО Бенефициар".to_string(),
            inn: "7707083893".to_string(),
            kpp: Some("770701001".to_string()),
            account_number: Some("40702810100000000001".to_string()),
            bank_details: Some(BankDetails {
                bank_name: "Т-Банк".to_string(),
                bank_bik: "044525974".to_string(),
                correspondent_account: "30101810145250000974".to_string(),
            }),
            status: "active".to_string(),
            verification_status: "verified".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        },
    ];

    Ok(Json(beneficiaries))
}

/// Get beneficiary scoring results
/// GET /api/v1/nominal-accounts/beneficiaries/scoring
pub async fn get_beneficiary_scoring(
    State(_services): State<Arc<TBankServices>>,
    Query(query): Query<BeneficiariesQuery>,
) -> Result<Json<Vec<ScoringResponse>>, StatusCode> {
    // TODO: Implement actual scoring retrieval via T-Bank Business API
    // Official endpoint: GET https://business.tbank.ru/openapi/api/v1/nominal-accounts/beneficiaries/scoring

    let scoring_results = vec![
        ScoringResponse {
            beneficiary_id: "BEN_123456".to_string(),
            scoring_status: "passed".to_string(),
            risk_level: "low".to_string(),
            restrictions: vec![],
            checked_at: Utc::now(),
            valid_until: Utc::now() + chrono::Duration::days(30),
        },
    ];

    Ok(Json(scoring_results))
}

/// Create deal
/// POST /api/v1/nominal-accounts/deals
pub async fn create_deal(
    State(_services): State<Arc<TBankServices>>,
    Json(request): Json<CreateDealRequest>,
) -> Result<Json<DealResponse>, StatusCode> {
    // Validate request
    request.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: Implement actual deal creation via T-Bank Business API
    // Official endpoint: POST https://business.tbank.ru/openapi/api/v1/nominal-accounts/deals

    let deal_id = format!("DEAL_{}", Uuid::new_v4().to_string().replace("-", "").to_uppercase());

    let steps: Vec<DealStepResponse> = request.steps.into_iter().map(|step| {
        DealStepResponse {
            id: Uuid::new_v4(),
            step_id: format!("STEP_{}", Uuid::new_v4().to_string().replace("-", "").to_uppercase()),
            name: step.name,
            description: step.description,
            step_order: step.step_order,
            amount: step.amount,
            status: "pending".to_string(),
            beneficiary_id: step.beneficiary_id,
            completed_at: None,
        }
    }).collect();

    let response = DealResponse {
        id: Uuid::new_v4(),
        deal_id,
        name: request.name,
        description: request.description,
        total_amount: request.total_amount,
        currency: request.currency,
        status: "draft".to_string(),
        current_step: 1,
        expires_at: request.expires_at,
        steps,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Get deals list
/// GET /api/v1/nominal-accounts/deals
pub async fn get_deals(
    State(_services): State<Arc<TBankServices>>,
    Query(_query): Query<DealsQuery>,
) -> Result<Json<Vec<DealResponse>>, StatusCode> {
    // TODO: Implement actual deals retrieval via T-Bank Business API

    let deals = vec![
        DealResponse {
            id: Uuid::new_v4(),
            deal_id: "DEAL_123456".to_string(),
            name: "Тестовая сделка".to_string(),
            description: "Описание тестовой сделки".to_string(),
            total_amount: Decimal::from(100000),
            currency: "RUB".to_string(),
            status: "active".to_string(),
            current_step: 1,
            expires_at: Utc::now() + chrono::Duration::days(30),
            steps: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        },
    ];

    Ok(Json(deals))
}

/// Accept deal
/// POST /api/v1/nominal-accounts/deals/{deal_id}/accept
pub async fn accept_deal(
    State(_services): State<Arc<TBankServices>>,
    Path(deal_id): Path<String>,
) -> Result<Json<DealResponse>, StatusCode> {
    // TODO: Implement actual deal acceptance via T-Bank Business API
    // Official endpoint: POST https://business.tbank.ru/openapi/api/v1/nominal-accounts/deals/{dealId}/accept

    let response = DealResponse {
        id: Uuid::new_v4(),
        deal_id,
        name: "Тестовая сделка".to_string(),
        description: "Описание тестовой сделки".to_string(),
        total_amount: Decimal::from(100000),
        currency: "RUB".to_string(),
        status: "active".to_string(),
        current_step: 1,
        expires_at: Utc::now() + chrono::Duration::days(30),
        steps: vec![],
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Create payment
/// POST /api/v1/nominal-accounts/payments
pub async fn create_payment(
    State(_services): State<Arc<TBankServices>>,
    Json(request): Json<CreatePaymentRequest>,
) -> Result<Json<PaymentResponse>, StatusCode> {
    if request.amount <= Decimal::ZERO {
        return Err(StatusCode::BAD_REQUEST);
    }

    // TODO: Implement actual payment creation via T-Bank Business API
    // Official endpoint: POST https://business.tbank.ru/openapi/api/v1/nominal-accounts/payments

    let payment_id = format!("PAY_{}", Uuid::new_v4().to_string().replace("-", "").to_uppercase());

    let response = PaymentResponse {
        id: Uuid::new_v4(),
        payment_id,
        beneficiary_id: request.beneficiary_id,
        amount: request.amount,
        currency: request.currency,
        payment_purpose: request.payment_purpose,
        status: "pending".to_string(),
        deal_id: request.deal_id,
        step_id: request.step_id,
        processed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok(Json(response))
}

/// Get payments list
/// GET /api/v1/nominal-accounts/payments
pub async fn get_payments(
    State(_services): State<Arc<TBankServices>>,
    Query(_query): Query<PaymentsQuery>,
) -> Result<Json<Vec<PaymentResponse>>, StatusCode> {
    // TODO: Implement actual payments retrieval via T-Bank Business API

    let payments = vec![
        PaymentResponse {
            id: Uuid::new_v4(),
            payment_id: "PAY_123456".to_string(),
            beneficiary_id: "BEN_123456".to_string(),
            amount: Decimal::from(50000),
            currency: "RUB".to_string(),
            payment_purpose: "Оплата по договору".to_string(),
            status: "completed".to_string(),
            deal_id: Some("DEAL_123456".to_string()),
            step_id: Some("STEP_123456".to_string()),
            processed_at: Some(Utc::now()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        },
    ];

    Ok(Json(payments))
}

/// Create nominal accounts router
pub fn create_nominal_accounts_router() -> Router<Arc<TBankServices>> {
    Router::new()
        // Beneficiaries
        .route("/beneficiaries", post(create_beneficiary))
        .route("/beneficiaries", get(get_beneficiaries))
        .route("/beneficiaries/scoring", get(get_beneficiary_scoring))
        
        // Deals
        .route("/deals", post(create_deal))
        .route("/deals", get(get_deals))
        .route("/deals/:deal_id/accept", post(accept_deal))
        
        // Payments
        .route("/payments", post(create_payment))
        .route("/payments", get(get_payments))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn test_create_beneficiary_request_validation() {
        let valid_request = CreateBeneficiaryRequest {
            name: "ООО Тест".to_string(),
            inn: "7707083893".to_string(),
            kpp: Some("770701001".to_string()),
            account_number: Some("40702810100000000001".to_string()),
            bank_name: Some("Т-Банк".to_string()),
            bank_bik: Some("044525974".to_string()),
            correspondent_account: Some("30101810145250000974".to_string()),
            address: None,
            phone: None,
            email: Some("test@example.com".to_string()),
        };

        assert!(valid_request.validate().is_ok());

        // Test invalid INN
        let mut invalid_request = valid_request.clone();
        invalid_request.inn = "123".to_string();
        assert!(invalid_request.validate().is_err());

        // Test invalid email
        let mut invalid_request = valid_request.clone();
        invalid_request.email = Some("invalid-email".to_string());
        assert!(invalid_request.validate().is_err());
    }

    #[test]
    fn test_create_deal_request_validation() {
        let valid_request = CreateDealRequest {
            name: "Test Deal".to_string(),
            description: "Test Description".to_string(),
            total_amount: Decimal::from(1000),
            currency: "RUB".to_string(),
            expires_at: Utc::now() + chrono::Duration::days(30),
            steps: vec![
                DealStep {
                    name: "Step 1".to_string(),
                    description: "First step".to_string(),
                    step_order: 1,
                    amount: Decimal::from(500),
                    beneficiary_id: "BEN_123".to_string(),
                    conditions: vec![],
                },
                DealStep {
                    name: "Step 2".to_string(),
                    description: "Second step".to_string(),
                    step_order: 2,
                    amount: Decimal::from(500),
                    beneficiary_id: "BEN_456".to_string(),
                    conditions: vec![],
                },
            ],
        };

        assert!(valid_request.validate().is_ok());

        // Test invalid total amount
        let mut invalid_request = valid_request.clone();
        invalid_request.total_amount = Decimal::from(2000); // Doesn't match sum of steps
        assert!(invalid_request.validate().is_err());

        // Test empty steps
        let mut invalid_request = valid_request.clone();
        invalid_request.steps = vec![];
        assert!(invalid_request.validate().is_err());
    }
}