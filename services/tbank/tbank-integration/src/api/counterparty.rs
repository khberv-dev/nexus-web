use crate::services::TBankServices;
use axum::{routing::get, Router};
use std::sync::Arc;

// Counterparty API endpoints
// TODO: Implement counterparty verification endpoints

/// Create counterparty router
pub fn create_counterparty_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route(
            "/verify",
            get(|| async { "Counterparty verification endpoint - TODO" }),
        )
        .route("/:inn", get(|| async { "Get counterparty by INN - TODO" }))
}
