use super::handlers::{
    health_handler, validate_russian_legal_handler, validate_token_handler, SharedServicesState,
};
use axum::{
    routing::{get, post},
    Router,
};

pub fn build_shared_services_router() -> Router<SharedServicesState> {
    Router::new()
        .route("/health", get(health_handler))
        .route("/api/v1/auth/validate", post(validate_token_handler))
        .route(
            "/api/v1/validation/russian-legal",
            post(validate_russian_legal_handler),
        )
        // TODO: Add organization routes when database connection is available
        // .nest("/api/v1/organizations", organization_routes(pool))
}
