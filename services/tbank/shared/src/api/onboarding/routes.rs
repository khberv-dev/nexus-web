use axum::{
    routing::post,
    Router,
};
use sqlx::PgPool;

use super::handlers::{
    onboard_advertiser_handler, onboard_agency_handler, onboard_publisher_handler,
};

/// Create onboarding routes
pub fn onboarding_routes(pool: PgPool) -> Router {
    Router::new()
        .route("/publisher", post(onboard_publisher_handler))
        .route("/advertiser", post(onboard_advertiser_handler))
        .route("/agency", post(onboard_agency_handler))
        .with_state(pool)
}
