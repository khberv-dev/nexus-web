/// CRM-compatible billing endpoints
///
/// Maps simple CRM billing.ts interface to the T-Bank acquiring logic:
///
///   POST /payments          → init acquiring payment  → { paymentId, paymentUrl }
///   POST /payments/extra    → same, tagged as extra    → { paymentId, paymentUrl }
///   POST /payments/:id/release → mark payment released (admin payout trigger)

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::post,
    Json, Router,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    acquiring::initialization::PaymentInitializationService,
    database::acquiring_queries::AcquiringQueries,
    services::TBankServices,
    types::{
        AcquiringPaymentInitializationRequest,
        AcquiringPaymentMethod,
        AcquiringPaymentStatus,
        Currency,
        TBankError,
    },
};

// ── Request / Response types ─────────────────────────────────────────────────

/// Payload sent by Next.js billing.ts
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentRequest {
    pub order_id: String,
    /// Amount in RUB (integer rubles, e.g. 15000)
    pub amount: i64,
    pub description: String,
    pub return_url: String,
}

/// Response consumed by billing.ts
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentResponse {
    pub payment_id: String,
    pub payment_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: String,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/// POST /payments  — initial stage payment
pub async fn create_payment(
    State(services): State<Arc<TBankServices>>,
    Json(req): Json<CreatePaymentRequest>,
) -> Result<Json<CreatePaymentResponse>, (StatusCode, Json<ErrorResponse>)> {
    init_payment(services, req, false).await
}

/// POST /payments/extra  — extra revision payment
pub async fn create_extra_payment(
    State(services): State<Arc<TBankServices>>,
    Json(req): Json<CreatePaymentRequest>,
) -> Result<Json<CreatePaymentResponse>, (StatusCode, Json<ErrorResponse>)> {
    init_payment(services, req, true).await
}

/// POST /payments/:id/release  — mark payment as released (admin triggers payout)
pub async fn release_payment(
    State(services): State<Arc<TBankServices>>,
    Path(order_id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let pool = services.db_pool();

    let payment = AcquiringQueries::get_payment_by_order_id(pool, &order_id)
        .await
        .map_err(|e| internal_error(e.to_string()))?;

    match payment {
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Payment for order {} not found", order_id),
            }),
        )),
        Some(p) => {
            let payment_uuid = p.id.unwrap_or_else(Uuid::new_v4);

            AcquiringQueries::update_payment_status(
                pool,
                payment_uuid,
                AcquiringPaymentStatus::Completed,
                None,
                Some(chrono::Utc::now()),
            )
            .await
            .map_err(|e| internal_error(e.to_string()))?;

            info!("Payment {:?} released for order {}", payment_uuid, order_id);
            Ok(StatusCode::NO_CONTENT)
        }
    }
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn create_crm_compat_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/payments", post(create_payment))
        .route("/payments/extra", post(create_extra_payment))
        .route("/payments/:id/release", post(release_payment))
}

// ── Private helpers ───────────────────────────────────────────────────────────

async fn init_payment(
    services: Arc<TBankServices>,
    req: CreatePaymentRequest,
    is_extra: bool,
) -> Result<Json<CreatePaymentResponse>, (StatusCode, Json<ErrorResponse>)> {
    let label = if is_extra { "extra" } else { "regular" };
    info!(
        order_id = %req.order_id,
        amount = req.amount,
        extra = is_extra,
        "Initializing {} payment",
        label
    );

    if req.amount <= 0 {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ErrorResponse {
                error: "amount must be positive".into(),
            }),
        ));
    }

    // amount in RUB → Decimal (T-Bank service converts to kopecks internally)
    let amount_decimal = Decimal::from(req.amount);

    let tbank_order_id = if is_extra {
        format!("extra-{}", req.order_id)
    } else {
        req.order_id.clone()
    };

    let config = &services.config;
    let init_svc = PaymentInitializationService::new(
        config.terminal_key.clone(),
        config.terminal_secret.clone(),
        config.acquiring_api_base_url.clone(),
    );

    let init_req = AcquiringPaymentInitializationRequest {
        order_id: tbank_order_id,
        amount: amount_decimal,
        currency: Currency::RUB,
        payment_method: AcquiringPaymentMethod::Card,
        description: Some(req.description),
        customer_email: None,
        customer_phone: None,
        success_url: Some(req.return_url.clone()),
        failure_url: Some(req.return_url.clone()),
        notification_url: None,
    };

    let result = init_svc
        .initialize_payment(&init_req, amount_decimal, init_req.description.clone().unwrap_or_default(), None)
        .await
        .map_err(|e| {
            error!(error = %e, "T-Bank payment initialization failed");
            match e {
                TBankError::PaymentInitializationFailed { ref reason, .. } => (
                    StatusCode::BAD_GATEWAY,
                    Json(ErrorResponse {
                        error: reason.clone(),
                    }),
                ),
                other => internal_error(other.to_string()),
            }
        })?;

    let payment_url = result.payment_url.unwrap_or_default();

    Ok(Json(CreatePaymentResponse {
        payment_id: result.payment_id,
        payment_url,
    }))
}

fn internal_error(msg: String) -> (StatusCode, Json<ErrorResponse>) {
    error!("Internal billing error: {}", msg);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse { error: msg }),
    )
}
