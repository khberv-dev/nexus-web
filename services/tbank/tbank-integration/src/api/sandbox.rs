use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info};
use uuid::Uuid;

use crate::{
    services::TBankServices,
    types::{
        acquiring::methods::AcquiringPaymentMethod,
        acquiring::payment::{AcquiringPayment, AcquiringPaymentStatus},
        b2b::invoice::{B2BInvoice, B2BInvoiceStatus},
        counterparty::counterparty::{CounterpartyData, CounterpartyStatus},
        Currency, TBankError, TBankResult,
    },
};

/// Sandbox API endpoints for testing T-Bank integration
/// These endpoints provide predefined test data for development and testing

/// Query parameters for sandbox endpoints
#[derive(Debug, Deserialize)]
pub struct SandboxQuery {
    pub format: Option<String>,
    pub include_errors: Option<bool>,
    pub delay_ms: Option<u64>,
}

/// Sandbox counterparty response
#[derive(Debug, Serialize)]
pub struct SandboxCounterpartyResponse {
    pub counterparty: CounterpartyData,
    pub sandbox_info: SandboxInfo,
}

/// Sandbox B2B invoice response
#[derive(Debug, Serialize)]
pub struct SandboxB2BInvoiceResponse {
    pub invoice: B2BInvoice,
    pub sandbox_info: SandboxInfo,
}

/// Sandbox acquiring payment response
#[derive(Debug, Serialize)]
pub struct SandboxAcquiringPaymentResponse {
    pub payment: AcquiringPayment,
    pub sandbox_info: SandboxInfo,
}

/// Sandbox account statement response
#[derive(Debug, Serialize)]
pub struct SandboxStatementResponse {
    pub account_number: String,
    pub balance: rust_decimal::Decimal,
    pub currency: Currency,
    pub operations: Vec<SandboxOperation>,
    pub sandbox_info: SandboxInfo,
}

/// Sandbox operation for account statement
#[derive(Debug, Serialize)]
pub struct SandboxOperation {
    pub operation_id: String,
    pub operation_date: DateTime<Utc>,
    pub amount: rust_decimal::Decimal,
    pub currency: Currency,
    pub operation_type: String, // "Credit" | "Debit"
    pub counterparty_inn: Option<String>,
    pub counterparty_name: Option<String>,
    pub description: String,
    pub document_number: Option<String>,
}

/// Sandbox service status response
#[derive(Debug, Serialize)]
pub struct SandboxStatusResponse {
    pub service: String,
    pub version: String,
    pub environment: String,
    pub status: String,
    pub uptime_seconds: u64,
    pub predefined_data: SandboxPredefinedData,
    pub sandbox_info: SandboxInfo,
}

/// Information about predefined sandbox data
#[derive(Debug, Serialize)]
pub struct SandboxPredefinedData {
    pub counterparties: Vec<String>, // List of test INNs
    pub invoices: Vec<String>,       // List of test invoice IDs
    pub payments: Vec<String>,       // List of test payment IDs
    pub accounts: Vec<String>,       // List of test account numbers
}

/// Sandbox metadata
#[derive(Debug, Serialize)]
pub struct SandboxInfo {
    pub is_sandbox: bool,
    pub generated_at: DateTime<Utc>,
    pub test_scenario: String,
    pub notes: Vec<String>,
}

/// Create sandbox router with all test endpoints
pub fn create_sandbox_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/counterparty/:inn", get(get_sandbox_counterparty))
        .route("/b2b/invoice/:invoice_id", get(get_sandbox_b2b_invoice))
        .route(
            "/acquiring/payment/:payment_id",
            get(get_sandbox_acquiring_payment),
        )
        .route("/statement", get(get_sandbox_statement))
        .route("/status", get(get_sandbox_status))
        .route("/health", get(get_sandbox_health))
        .route("/reset", get(reset_sandbox_data))
}

/// Get sandbox counterparty data by INN
#[axum::debug_handler]
pub async fn get_sandbox_counterparty(
    State(_services): State<Arc<TBankServices>>,
    Path(inn): Path<String>,
    Query(query): Query<SandboxQuery>,
) -> TBankResult<Json<SandboxCounterpartyResponse>> {
    info!(inn = %inn, "Getting sandbox counterparty data");

    // Add artificial delay if requested
    if let Some(delay_ms) = query.delay_ms {
        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
    }

    // Check for error scenarios
    if query.include_errors.unwrap_or(false) && inn == "9999999999" {
        return Err(TBankError::CounterpartyNotFound { inn: inn.clone() });
    }

    let counterparty = match inn.as_str() {
        "7707083893" => CounterpartyData {
            id: Some(Uuid::new_v4()),
            inn: "7707083893".to_string(),
            kpp: Some("770701001".to_string()),
            full_name: "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \"ЯНДЕКС\"".to_string(),
            short_name: "ООО \"ЯНДЕКС\"".to_string(),
            legal_address: "119021, г. Москва, ул. Льва Толстого, д. 16".to_string(),
            status: CounterpartyStatus::Active,
            registration_date: chrono::NaiveDate::from_ymd_opt(2000, 8, 8)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc(),
            okved_codes: vec!["62.01".to_string(), "62.02".to_string()],
            verified_at: Utc::now(),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
        "1234567890" => CounterpartyData {
            id: Some(Uuid::new_v4()),
            inn: "1234567890".to_string(),
            kpp: Some("123456789".to_string()),
            full_name: "ТЕСТОВАЯ КОМПАНИЯ ДЛЯ РАЗРАБОТКИ ООО".to_string(),
            short_name: "ТЕСТ ООО".to_string(),
            legal_address: "123456, г. Тестовый, ул. Разработчиков, д. 1".to_string(),
            status: CounterpartyStatus::Active,
            registration_date: chrono::NaiveDate::from_ymd_opt(2020, 1, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc(),
            okved_codes: vec!["62.01".to_string()],
            verified_at: Utc::now(),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
        "5555555555" => CounterpartyData {
            id: Some(Uuid::new_v4()),
            inn: "5555555555".to_string(),
            kpp: Some("555555555".to_string()),
            full_name: "ЗАБЛОКИРОВАННАЯ КОМПАНИЯ ООО".to_string(),
            short_name: "БЛОК ООО".to_string(),
            legal_address: "555555, г. Заблокированный, ул. Недоступная, д. 5".to_string(),
            status: CounterpartyStatus::Blocked,
            registration_date: chrono::NaiveDate::from_ymd_opt(2015, 5, 5)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc(),
            okved_codes: vec!["01.01".to_string()],
            verified_at: Utc::now(),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        },
        _ => {
            return Err(TBankError::CounterpartyNotFound { inn: inn.clone() });
        }
    };

    let sandbox_info = SandboxInfo {
        is_sandbox: true,
        generated_at: Utc::now(),
        test_scenario: format!("Predefined counterparty data for INN {}", inn),
        notes: vec![
            "This is sandbox test data".to_string(),
            "Use INN 9999999999 to test error scenarios".to_string(),
            "Available test INNs: 7707083893, 1234567890, 5555555555".to_string(),
        ],
    };

    debug!(inn = %inn, status = ?counterparty.status, "Sandbox counterparty data generated");

    Ok(Json(SandboxCounterpartyResponse {
        counterparty,
        sandbox_info,
    }))
}

/// Get sandbox B2B invoice data
#[axum::debug_handler]
pub async fn get_sandbox_b2b_invoice(
    State(_services): State<Arc<TBankServices>>,
    Path(invoice_id): Path<String>,
    Query(query): Query<SandboxQuery>,
) -> TBankResult<Json<SandboxB2BInvoiceResponse>> {
    info!(invoice_id = %invoice_id, "Getting sandbox B2B invoice data");

    // Add artificial delay if requested
    if let Some(delay_ms) = query.delay_ms {
        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
    }

    let invoice_uuid = Uuid::parse_str(&invoice_id)
        .map_err(|_| TBankError::ValidationError("Invalid invoice ID format".to_string()))?;

    let invoice = B2BInvoice {
        id: Some(invoice_uuid),
        invoice_number: format!("INV-SANDBOX-{}", &invoice_id[..8]),
        tbank_invoice_id: Some(format!("tbank_sandbox_{}", &invoice_id[..8])),
        counterparty_inn: "7707083893".to_string(),
        counterparty_kpp: Some("770701001".to_string()),
        counterparty_name: "ООО \"ЯНДЕКС\" (SANDBOX)".to_string(),
        due_date: (Utc::now() + chrono::Duration::days(30)).date_naive(),
        invoice_date: Some(Utc::now().date_naive()),
        account_number: Some("40702810110011000000".to_string()),
        total_amount: rust_decimal::Decimal::new(50000, 2), // 500.00 RUB
        status: B2BInvoiceStatus::Sent,
        pdf_url: Some(format!(
            "https://sandbox.tbank.ru/invoice/{}.pdf",
            invoice_id
        )),
        incoming_invoice_url: Some(format!("https://sandbox.tbank.ru/pay/{}", invoice_id)),
        comment: Some("Sandbox test invoice for development".to_string()),
        custom_payment_purpose: None,
        created_at: Some(Utc::now() - chrono::Duration::hours(1)),
        updated_at: Some(Utc::now()),
    };

    let sandbox_info = SandboxInfo {
        is_sandbox: true,
        generated_at: Utc::now(),
        test_scenario: format!("Predefined B2B invoice data for ID {}", invoice_id),
        notes: vec![
            "This is sandbox test data".to_string(),
            "Invoice is always in 'Sent' status".to_string(),
            "Amount is fixed at 500.00 RUB".to_string(),
            "PDF and payment URLs are sandbox URLs".to_string(),
        ],
    };

    debug!(invoice_id = %invoice_id, status = ?invoice.status, "Sandbox B2B invoice data generated");

    Ok(Json(SandboxB2BInvoiceResponse {
        invoice,
        sandbox_info,
    }))
}

/// Get sandbox acquiring payment data
#[axum::debug_handler]
pub async fn get_sandbox_acquiring_payment(
    State(_services): State<Arc<TBankServices>>,
    Path(payment_id): Path<String>,
    Query(query): Query<SandboxQuery>,
) -> TBankResult<Json<SandboxAcquiringPaymentResponse>> {
    info!(payment_id = %payment_id, "Getting sandbox acquiring payment data");

    // Add artificial delay if requested
    if let Some(delay_ms) = query.delay_ms {
        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
    }

    let payment_uuid = Uuid::parse_str(&payment_id)
        .map_err(|_| TBankError::ValidationError("Invalid payment ID format".to_string()))?;

    let payment = AcquiringPayment {
        id: Some(payment_uuid),
        order_id: format!("ORDER-SANDBOX-{}", &payment_id[..8]),
        tbank_payment_id: Some(format!("tbank_acq_{}", &payment_id[..8])),
        amount: rust_decimal::Decimal::new(125000, 2), // 1250.00 RUB
        currency: Currency::RUB,
        payment_method: AcquiringPaymentMethod::Card,
        status: AcquiringPaymentStatus::Completed,
        description: Some("Sandbox test payment for development".to_string()),
        customer_email: Some("test@sandbox.example.com".to_string()),
        customer_phone: Some("+79001234567".to_string()),
        payment_url: Some(format!(
            "https://sandbox.tbank.ru/acquiring/pay/{}",
            payment_id
        )),
        qr_code: Some(format!("https://sandbox.tbank.ru/qr/{}.png", payment_id)),
        expires_at: Utc::now() + chrono::Duration::hours(1),
        commission_amount: Some(rust_decimal::Decimal::new(3750, 2)), // 37.50 RUB (3%)
        completed_at: Some(Utc::now() - chrono::Duration::minutes(5)),
        created_at: Some(Utc::now() - chrono::Duration::hours(1)),
        updated_at: Some(Utc::now()),
    };

    let sandbox_info = SandboxInfo {
        is_sandbox: true,
        generated_at: Utc::now(),
        test_scenario: format!("Predefined acquiring payment data for ID {}", payment_id),
        notes: vec![
            "This is sandbox test data".to_string(),
            "Payment is always in 'Completed' status".to_string(),
            "Amount is fixed at 1250.00 RUB".to_string(),
            "Commission is 3% (37.50 RUB)".to_string(),
            "Payment method is always 'Card'".to_string(),
        ],
    };

    debug!(payment_id = %payment_id, status = ?payment.status, "Sandbox acquiring payment data generated");

    Ok(Json(SandboxAcquiringPaymentResponse {
        payment,
        sandbox_info,
    }))
}

/// Get sandbox account statement
#[axum::debug_handler]
pub async fn get_sandbox_statement(
    State(_services): State<Arc<TBankServices>>,
    Query(mut query): Query<HashMap<String, String>>,
) -> TBankResult<Json<SandboxStatementResponse>> {
    info!("Getting sandbox account statement");

    let account_number = query
        .remove("account_number")
        .unwrap_or_else(|| "40702810110011000000".to_string());

    // Add artificial delay if requested
    if let Some(delay_str) = query.get("delay_ms") {
        if let Ok(delay_ms) = delay_str.parse::<u64>() {
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }
    }

    let operations = vec![
        SandboxOperation {
            operation_id: "OP001".to_string(),
            operation_date: Utc::now() - chrono::Duration::days(1),
            amount: rust_decimal::Decimal::new(100000, 2), // 1000.00 RUB
            currency: Currency::RUB,
            operation_type: "Credit".to_string(),
            counterparty_inn: Some("7707083893".to_string()),
            counterparty_name: Some("ООО \"ЯНДЕКС\"".to_string()),
            description: "Поступление по счету INV-2024-001".to_string(),
            document_number: Some("INV-2024-001".to_string()),
        },
        SandboxOperation {
            operation_id: "OP002".to_string(),
            operation_date: Utc::now() - chrono::Duration::hours(12),
            amount: rust_decimal::Decimal::new(25000, 2), // 250.00 RUB
            currency: Currency::RUB,
            operation_type: "Debit".to_string(),
            counterparty_inn: Some("1234567890".to_string()),
            counterparty_name: Some("ТЕСТ ООО".to_string()),
            description: "Комиссия за эквайринг".to_string(),
            document_number: Some("COM-2024-001".to_string()),
        },
        SandboxOperation {
            operation_id: "OP003".to_string(),
            operation_date: Utc::now() - chrono::Duration::hours(6),
            amount: rust_decimal::Decimal::new(75000, 2), // 750.00 RUB
            currency: Currency::RUB,
            operation_type: "Credit".to_string(),
            counterparty_inn: Some("1234567890".to_string()),
            counterparty_name: Some("ТЕСТ ООО".to_string()),
            description: "Поступление от эквайринга".to_string(),
            document_number: Some("ACQ-2024-001".to_string()),
        },
    ];

    let balance = operations
        .iter()
        .map(|op| match op.operation_type.as_str() {
            "Credit" => op.amount,
            "Debit" => -op.amount,
            _ => rust_decimal::Decimal::ZERO,
        })
        .sum::<rust_decimal::Decimal>()
        + rust_decimal::Decimal::new(500000, 2); // Starting balance 5000.00

    let sandbox_info = SandboxInfo {
        is_sandbox: true,
        generated_at: Utc::now(),
        test_scenario: "Predefined account statement with sample operations".to_string(),
        notes: vec![
            "This is sandbox test data".to_string(),
            "Statement contains 3 sample operations".to_string(),
            "Balance is calculated from operations + starting balance".to_string(),
            "All amounts are in RUB".to_string(),
        ],
    };

    debug!(
        account_number = %account_number,
        operations_count = operations.len(),
        balance = %balance,
        "Sandbox account statement generated"
    );

    Ok(Json(SandboxStatementResponse {
        account_number,
        balance,
        currency: Currency::RUB,
        operations,
        sandbox_info,
    }))
}

/// Get sandbox service status
#[axum::debug_handler]
pub async fn get_sandbox_status(
    State(_services): State<Arc<TBankServices>>,
    Query(query): Query<SandboxQuery>,
) -> TBankResult<Json<SandboxStatusResponse>> {
    info!("Getting sandbox service status");

    // Add artificial delay if requested
    if let Some(delay_ms) = query.delay_ms {
        tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
    }

    let predefined_data = SandboxPredefinedData {
        counterparties: vec![
            "7707083893".to_string(),
            "1234567890".to_string(),
            "5555555555".to_string(),
        ],
        invoices: vec![
            "550e8400-e29b-41d4-a716-446655440000".to_string(),
            "550e8400-e29b-41d4-a716-446655440001".to_string(),
            "550e8400-e29b-41d4-a716-446655440002".to_string(),
        ],
        payments: vec![
            "660e8400-e29b-41d4-a716-446655440000".to_string(),
            "660e8400-e29b-41d4-a716-446655440001".to_string(),
            "660e8400-e29b-41d4-a716-446655440002".to_string(),
        ],
        accounts: vec![
            "40702810110011000000".to_string(),
            "40702810110011000001".to_string(),
        ],
    };

    let sandbox_info = SandboxInfo {
        is_sandbox: true,
        generated_at: Utc::now(),
        test_scenario: "Service status with predefined test data".to_string(),
        notes: vec![
            "This is sandbox environment".to_string(),
            "All data is predefined for testing".to_string(),
            "Use provided IDs for testing endpoints".to_string(),
            "Service is always reported as healthy in sandbox".to_string(),
        ],
    };

    debug!("Sandbox service status generated");

    Ok(Json(SandboxStatusResponse {
        service: "tbank-integration".to_string(),
        version: "0.1.0-sandbox".to_string(),
        environment: "sandbox".to_string(),
        status: "healthy".to_string(),
        uptime_seconds: 3600, // 1 hour
        predefined_data,
        sandbox_info,
    }))
}

/// Get sandbox health check
#[axum::debug_handler]
pub async fn get_sandbox_health(
    State(_services): State<Arc<TBankServices>>,
) -> TBankResult<Json<Value>> {
    info!("Getting sandbox health check");

    Ok(Json(json!({
        "status": "healthy",
        "service": "tbank-integration-sandbox",
        "version": "0.1.0",
        "environment": "sandbox",
        "timestamp": Utc::now(),
        "components": {
            "database": "healthy",
            "redis": "healthy",
            "tbank_api": "healthy"
        },
        "sandbox_info": {
            "is_sandbox": true,
            "note": "All components are mocked in sandbox environment"
        }
    })))
}

/// Reset sandbox data (for testing)
#[axum::debug_handler]
pub async fn reset_sandbox_data(
    State(_services): State<Arc<TBankServices>>,
) -> TBankResult<Json<Value>> {
    info!("Resetting sandbox data");

    // In a real implementation, this would reset any cached sandbox data
    // For now, just return a success message

    Ok(Json(json!({
        "status": "success",
        "message": "Sandbox data reset successfully",
        "timestamp": Utc::now(),
        "sandbox_info": {
            "is_sandbox": true,
            "note": "All predefined data has been reset to defaults"
        }
    })))
}
