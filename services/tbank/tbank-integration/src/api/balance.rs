use crate::services::TBankServices;
use axum::{routing::get, Router};
use std::sync::Arc;

// Balance API endpoints
// TODO: Implement balance monitoring endpoints

/// Create balance router
pub fn create_balance_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route(
            "/:account_number",
            get(|| async { "Get account balance - TODO" }),
        )
        .route(
            "/:account_number/statement",
            get(|| async { "Get account statement - TODO" }),
        )
}
