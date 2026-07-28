use crate::services::TBankServices;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

// Reconciliation API endpoints
// TODO: Implement reconciliation endpoints

/// Create reconciliation router
pub fn create_reconciliation_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/run", post(|| async { "Run reconciliation - TODO" }))
        .route(
            "/reports/:date",
            get(|| async { "Get reconciliation report - TODO" }),
        )
}
