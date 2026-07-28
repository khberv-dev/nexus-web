use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::services::TBankServices;

/// Banking operations API endpoints
/// Handles official T-Bank Business API banking operations

#[derive(Debug, Serialize, Deserialize)]
pub struct BankAccount {
    #[serde(rename = "accountNumber")]
    pub account_number: String,
    #[serde(rename = "accountName")]
    pub account_name: String,
    pub currency: String,
    pub balance: Decimal,
    #[serde(rename = "availableBalance")]
    pub available_balance: Decimal,
    pub status: String, // "active", "blocked", "closed"
    #[serde(rename = "openDate")]
    pub open_date: String,
    #[serde(rename = "accountType")]
    pub account_type: String, // "current", "deposit", "credit"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BankStatement {
    #[serde(rename = "accountNumber")]
    pub account_number: String,
    #[serde(rename = "fromDate")]
    pub from_date: String,
    #[serde(rename = "toDate")]
    pub to_date: String,
    #[serde(rename = "openingBalance")]
    pub opening_balance: Decimal,
    #[serde(rename = "closingBalance")]
    pub closing_balance: Decimal,
    pub operations: Vec<BankOperation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BankOperation {
    #[serde(rename = "operationId")]
    pub operation_id: String,
    #[serde(rename = "operationDate")]
    pub operation_date: String,
    #[serde(rename = "valueDate")]
    pub value_date: String,
    pub amount: Decimal,
    pub currency: String,
    #[serde(rename = "operationType")]
    pub operation_type: String, // "debit", "credit"
    pub description: String,
    #[serde(rename = "counterpartyName")]
    pub counterparty_name: Option<String>,
    #[serde(rename = "counterpartyAccount")]
    pub counterparty_account: Option<String>,
    #[serde(rename = "counterpartyInn")]
    pub counterparty_inn: Option<String>,
    #[serde(rename = "paymentPurpose")]
    pub payment_purpose: Option<String>,
    pub status: String, // "processed", "pending", "rejected"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountOperations {
    #[serde(rename = "accountNumber")]
    pub account_number: String,
    #[serde(rename = "fromDate")]
    pub from_date: String,
    #[serde(rename = "toDate")]
    pub to_date: String,
    pub operations: Vec<AccountOperation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountOperation {
    #[serde(rename = "operationId")]
    pub operation_id: String,
    #[serde(rename = "operationDate")]
    pub operation_date: String,
    pub amount: Decimal,
    pub currency: String,
    #[serde(rename = "operationType")]
    pub operation_type: String,
    pub description: String,
    #[serde(rename = "authorizationCode")]
    pub authorization_code: Option<String>,
    #[serde(rename = "merchantName")]
    pub merchant_name: Option<String>,
    #[serde(rename = "merchantCategory")]
    pub merchant_category: Option<String>,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct BankAccountsQuery {
    pub currency: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StatementQuery {
    #[serde(rename = "fromDate")]
    pub from_date: String, // Required: YYYY-MM-DD
    #[serde(rename = "toDate")]
    pub to_date: String,   // Required: YYYY-MM-DD
    pub currency: Option<String>,
}

/// Get bank accounts (multiple API versions supported)
/// GET /api/v1/bank-accounts, /api/v2/bank-accounts, /api/v3/bank-accounts, /api/v4/bank-accounts
pub async fn get_bank_accounts_v1(
    State(_services): State<Arc<TBankServices>>,
    Query(_query): Query<BankAccountsQuery>,
) -> Result<Json<Vec<BankAccount>>, StatusCode> {
    // TODO: Implement actual bank accounts retrieval via T-Bank Business API
    // Official endpoint: GET https://business.tbank.ru/openapi/api/v1/bank-accounts

    let accounts = vec![
        BankAccount {
            account_number: "40802810100000000001".to_string(),
            account_name: "Расчетный счет".to_string(),
            currency: "RUB".to_string(),
            balance: Decimal::from(1000000),
            available_balance: Decimal::from(950000),
            status: "active".to_string(),
            open_date: "2020-01-01".to_string(),
            account_type: "current".to_string(),
        },
        BankAccount {
            account_number: "40802840100000000002".to_string(),
            account_name: "Валютный счет USD".to_string(),
            currency: "USD".to_string(),
            balance: Decimal::from(10000),
            available_balance: Decimal::from(9500),
            status: "active".to_string(),
            open_date: "2020-06-01".to_string(),
            account_type: "current".to_string(),
        },
    ];

    Ok(Json(accounts))
}

/// Get bank accounts v2 (enhanced version)
pub async fn get_bank_accounts_v2(
    State(_services): State<Arc<TBankServices>>,
    Query(_query): Query<BankAccountsQuery>,
) -> Result<Json<Vec<BankAccount>>, StatusCode> {
    // TODO: Implement v2 API with additional fields
    get_bank_accounts_v1(State(_services), Query(_query)).await
}

/// Get bank accounts v3 (latest version)
pub async fn get_bank_accounts_v3(
    State(_services): State<Arc<TBankServices>>,
    Query(_query): Query<BankAccountsQuery>,
) -> Result<Json<Vec<BankAccount>>, StatusCode> {
    // TODO: Implement v3 API with additional features
    get_bank_accounts_v1(State(_services), Query(_query)).await
}

/// Get bank accounts v4 (newest version)
pub async fn get_bank_accounts_v4(
    State(_services): State<Arc<TBankServices>>,
    Query(_query): Query<BankAccountsQuery>,
) -> Result<Json<Vec<BankAccount>>, StatusCode> {
    // TODO: Implement v4 API with latest features
    get_bank_accounts_v1(State(_services), Query(_query)).await
}

/// Get bank statement
/// GET /api/v1/bank-statement
pub async fn get_bank_statement(
    State(_services): State<Arc<TBankServices>>,
    Query(query): Query<StatementQuery>,
) -> Result<Json<BankStatement>, StatusCode> {
    // Validate date format
    if !is_valid_date(&query.from_date) || !is_valid_date(&query.to_date) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // TODO: Implement actual bank statement retrieval via T-Bank Business API
    // Official endpoint: GET https://business.tbank.ru/openapi/api/v1/bank-statement

    let statement = BankStatement {
        account_number: "40802810100000000001".to_string(),
        from_date: query.from_date,
        to_date: query.to_date,
        opening_balance: Decimal::from(950000),
        closing_balance: Decimal::from(1000000),
        operations: vec![
            BankOperation {
                operation_id: "OP_001".to_string(),
                operation_date: "2024-01-15".to_string(),
                value_date: "2024-01-15".to_string(),
                amount: Decimal::from(50000),
                currency: "RUB".to_string(),
                operation_type: "credit".to_string(),
                description: "Поступление от контрагента".to_string(),
                counterparty_name: Some("ООО Контрагент".to_string()),
                counterparty_account: Some("40702810100000000002".to_string()),
                counterparty_inn: Some("7707083893".to_string()),
                payment_purpose: Some("Оплата по договору №123".to_string()),
                status: "processed".to_string(),
            },
        ],
    };

    Ok(Json(statement))
}

/// Get account operations with authorizations
/// GET /api/v1/account-operations
pub async fn get_account_operations(
    State(_services): State<Arc<TBankServices>>,
    Query(query): Query<StatementQuery>,
) -> Result<Json<AccountOperations>, StatusCode> {
    // Validate date format
    if !is_valid_date(&query.from_date) || !is_valid_date(&query.to_date) {
        return Err(StatusCode::BAD_REQUEST);
    }

    // TODO: Implement actual account operations retrieval via T-Bank Business API
    // Official endpoint: GET https://business.tbank.ru/openapi/api/v1/account-operations

    let operations = AccountOperations {
        account_number: "40802810100000000001".to_string(),
        from_date: query.from_date,
        to_date: query.to_date,
        operations: vec![
            AccountOperation {
                operation_id: "AUTH_001".to_string(),
                operation_date: "2024-01-15T10:30:00Z".to_string(),
                amount: Decimal::from(1500),
                currency: "RUB".to_string(),
                operation_type: "debit".to_string(),
                description: "Покупка в магазине".to_string(),
                authorization_code: Some("123456".to_string()),
                merchant_name: Some("Магазин продуктов".to_string()),
                merchant_category: Some("5411".to_string()),
                status: "processed".to_string(),
            },
        ],
    };

    Ok(Json(operations))
}

/// Get statement (alternative endpoint)
/// GET /api/v1/statement
pub async fn get_statement(
    State(_services): State<Arc<TBankServices>>,
    Query(query): Query<StatementQuery>,
) -> Result<Json<BankStatement>, StatusCode> {
    // TODO: Implement alternative statement endpoint
    // Official endpoint: GET https://business.tbank.ru/openapi/api/v1/statement
    
    get_bank_statement(State(_services), Query(query)).await
}

/// Helper function to validate date format (YYYY-MM-DD)
fn is_valid_date(date_str: &str) -> bool {
    if date_str.len() != 10 {
        return false;
    }

    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return false;
    }

    // Check if all parts are numeric and have correct length
    parts[0].len() == 4 && parts[0].chars().all(|c| c.is_ascii_digit()) &&
    parts[1].len() == 2 && parts[1].chars().all(|c| c.is_ascii_digit()) &&
    parts[2].len() == 2 && parts[2].chars().all(|c| c.is_ascii_digit())
}

/// Create banking operations router
pub fn create_banking_operations_router() -> Router<Arc<TBankServices>> {
    Router::new()
        // Multiple API versions for bank accounts
        .route("/bank-accounts", get(get_bank_accounts_v1))
        .route("/v2/bank-accounts", get(get_bank_accounts_v2))
        .route("/v3/bank-accounts", get(get_bank_accounts_v3))
        .route("/v4/bank-accounts", get(get_bank_accounts_v4))
        
        // Bank statement endpoints
        .route("/bank-statement", get(get_bank_statement))
        .route("/account-operations", get(get_account_operations))
        .route("/statement", get(get_statement))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_date_validation() {
        assert!(is_valid_date("2024-01-15"));
        assert!(is_valid_date("2020-12-31"));
        assert!(!is_valid_date("2024-1-15"));
        assert!(!is_valid_date("24-01-15"));
        assert!(!is_valid_date("2024/01/15"));
        assert!(!is_valid_date("invalid"));
        assert!(!is_valid_date(""));
    }

    #[test]
    fn test_bank_account_serialization() {
        let account = BankAccount {
            account_number: "40802810100000000001".to_string(),
            account_name: "Расчетный счет".to_string(),
            currency: "RUB".to_string(),
            balance: Decimal::from(1000000),
            available_balance: Decimal::from(950000),
            status: "active".to_string(),
            open_date: "2020-01-01".to_string(),
            account_type: "current".to_string(),
        };

        let json = serde_json::to_string(&account).unwrap();
        assert!(json.contains("accountNumber"));
        assert!(json.contains("accountName"));
        assert!(json.contains("availableBalance"));
    }
}