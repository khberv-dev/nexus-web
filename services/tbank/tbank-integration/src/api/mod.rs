pub mod acquiring_payments;
pub mod crm_compat;
pub mod analytics;
pub mod b2b_invoices;
pub mod b2b_qr;
pub mod balance;
pub mod banking_operations;
pub mod company_verification;
pub mod company_validation;
pub mod config;
pub mod counterparty;
pub mod email;
pub mod health;
pub mod metrics;
pub mod nominal_accounts;
pub mod reconciliation;
pub mod sandbox;
pub mod webhook;

use axum::{http::Method, middleware, Router};
use axum::extract::State;
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use axum::routing::get;

use crate::services::TBankServices;
use crate::middleware::{auth_middleware, rate_limit_middleware, logging_middleware, metrics_middleware};

/// Create the main application router with all endpoints and middleware
pub fn create_app_router() -> Router<Arc<TBankServices>> {
    Router::new()
        // Root health endpoint for simple health checks
        .route("/health", get(health::health_check))
        // CRM-compatible billing endpoints (no auth — called internally from Next.js)
        .merge(crm_compat::create_crm_compat_router())
        // Public registration endpoint (no auth required)
        .nest("/api/v1/organizations", create_public_organization_router())
        // API routes (with auth)
        .nest("/api/v1", create_api_router())
        // Webhook routes (no auth required - signature validation used instead)
        .nest("/webhooks", create_webhook_router())
        // Metrics routes (no auth required - should be restricted by network)
        .nest("/metrics", create_metrics_router())
        // Global middleware layers (applied in reverse order)
        .layer(create_cors_layer())
}

/// Create the complete application with state and middleware for serving
pub fn create_app_with_state(services: Arc<TBankServices>) -> Router {
    create_app_router()
        .with_state(services.clone())
        .layer(middleware::from_fn_with_state(services.clone(), metrics_middleware))
        .layer(middleware::from_fn_with_state(services.clone(), logging_middleware))
}

/// Apply middleware to the router with services state
/// This function should be called after the router is created with state
pub fn with_middleware(router: Router<Arc<TBankServices>>, state: Arc<TBankServices>) -> Router<Arc<TBankServices>> {
    router
        // Add middleware layers (applied in reverse order - last added runs first)
        .layer(middleware::from_fn_with_state(state.clone(), metrics_middleware))
        .layer(middleware::from_fn_with_state(state.clone(), logging_middleware))
}

/// Create the main API router with official T-Bank Business API structure
pub fn create_api_router() -> Router<Arc<TBankServices>> {
    Router::new()
        // Health endpoint for API v1
        .route("/health", get(health::health_check))
        
        // Analytics and logging endpoints (for frontend)
        .nest("/analytics", analytics::create_analytics_router())
        .nest("/logs", analytics::create_logs_router())
        
        // Performance metrics endpoint (for frontend)
        .nest("/metrics", metrics::create_performance_metrics_router())
        
        // Organization management endpoints (Core API compatibility) - with auth
        .nest("/organizations", create_authenticated_organization_router())
        
        // Official T-Bank Business API endpoints (exact match with documentation)
        .nest("/invoice", b2b_invoices::create_b2b_invoice_router())
        .nest("/company", company_verification::create_company_router()
            .merge(company_validation::create_company_validation_router()))
        .nest("/b2b/qr", b2b_qr::create_b2b_qr_router())
        .nest("/bank-accounts", banking_operations::create_banking_operations_router())
        .nest("/bank-statement", banking_operations::create_banking_operations_router())
        .nest("/account-operations", banking_operations::create_banking_operations_router())
        .nest("/statement", banking_operations::create_banking_operations_router())
        .nest("/nominal-accounts", nominal_accounts::create_nominal_accounts_router())
        
        // Legacy/custom endpoints (for backward compatibility)
        .nest("/invoices/b2b", b2b_invoices::create_b2b_invoice_router())
        .nest("/payments/acquiring", acquiring_payments::create_acquiring_payment_router())
        
        // Other endpoints
        .nest("/counterparties", counterparty::create_counterparty_router())
        .nest("/balance", balance::create_balance_router())
        .nest("/reconciliation", reconciliation::create_reconciliation_router())
        .nest("/config", config::create_config_router())
        .nest("/email", email::create_email_router())
        .nest("/sandbox", sandbox::create_sandbox_router())
        // Note: Auth middleware should be added via with_auth_middleware() function
        // after the router is created with state
}

/// Apply auth middleware to API router
/// This function should be called after the router is created with state
pub fn with_auth_middleware(router: Router<Arc<TBankServices>>, state: Arc<TBankServices>) -> Router<Arc<TBankServices>> {
    router
        // Add auth middleware layers (applied in reverse order - last added runs first)
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit_middleware))
}

/// Create the webhook router with separated B2B and acquiring endpoints
pub fn create_webhook_router() -> Router<Arc<TBankServices>> {
    webhook::create_webhook_router()
    // No authentication middleware for webhooks - they use signature validation
}

/// Create the health check router
pub fn create_health_router() -> Router<Arc<TBankServices>> {
    health::create_health_router()
    // No authentication required for health checks
}

/// Create the metrics router
pub fn create_metrics_router() -> Router<Arc<TBankServices>> {
    metrics::create_metrics_router()
    // No authentication required for metrics (should be restricted by network)
}

/// Create the public organization router (no auth required)
pub fn create_public_organization_router() -> Router<Arc<TBankServices>> {
    use axum::extract::{State, Json};
    use axum::routing::post;
    use shared::api::organization::handlers::{create_organization_handler, CreateOrganizationRequest};
    
    Router::new()
        // Public organization creation endpoint
        .route("/register", post(|State(services): State<Arc<TBankServices>>, Json(json): Json<CreateOrganizationRequest>| async move {
            create_organization_handler(State(services.db_pool().clone()), Json(json)).await
        }))
}

/// Create the authenticated organization router (auth required)
pub fn create_authenticated_organization_router() -> Router<Arc<TBankServices>> {
    use axum::extract::State;
    use axum::routing::{get, post, put, delete};
    use shared::api::organization::handlers::{
        get_organization_handler, get_user_organizations_handler,
        switch_organization_handler, update_organization_handler,
        delete_organization_handler, get_members_handler,
        add_member_handler, update_member_role_handler, remove_member_handler,
    };
    
    Router::new()
        // Organization CRUD (requires auth)
        .route("/:id", get(|State(services): State<Arc<TBankServices>>, path, auth| async move {
            get_organization_handler(State(services.db_pool().clone()), auth, path).await
        }))
        .route("/:id", put(|State(services): State<Arc<TBankServices>>, path, auth, json| async move {
            update_organization_handler(State(services.db_pool().clone()), auth, path, json).await
        }))
        .route("/:id", delete(|State(services): State<Arc<TBankServices>>, path, auth| async move {
            delete_organization_handler(State(services.db_pool().clone()), auth, path).await
        }))
        // Members management (requires auth)
        .route("/:id/members", get(|State(services): State<Arc<TBankServices>>, path, auth| async move {
            get_members_handler(State(services.db_pool().clone()), auth, path).await
        }))
        .route("/:id/members", post(|State(services): State<Arc<TBankServices>>, path, auth, json| async move {
            add_member_handler(State(services.db_pool().clone()), auth, path, json).await
        }))
        .route("/:id/members/:user_id", put(|State(services): State<Arc<TBankServices>>, path, auth, json| async move {
            update_member_role_handler(State(services.db_pool().clone()), auth, path, json).await
        }))
        .route("/:id/members/:user_id", delete(|State(services): State<Arc<TBankServices>>, path, auth| async move {
            remove_member_handler(State(services.db_pool().clone()), auth, path).await
        }))
        // User organizations (requires auth)
        .route("/user/organizations", get(|State(services): State<Arc<TBankServices>>, auth| async move {
            get_user_organizations_handler(State(services.db_pool().clone()), auth).await
        }))
        .route("/user/switch", post(|State(services): State<Arc<TBankServices>>, auth, json| async move {
            switch_organization_handler(State(services.db_pool().clone()), auth, json).await
        }))
}

/// Create CORS layer configuration
fn create_cors_layer() -> CorsLayer {
    use tower_http::cors::AllowOrigin;
    
    // Allowed origins for ADQuest platform
    let mut allowed_origins = vec![
        "https://ad-quest.ru".parse().unwrap(),
        "https://widget.ad-quest.ru".parse().unwrap(),
    ];
    
    // Add development origins only in non-production
    if cfg!(debug_assertions) || std::env::var("RUST_ENV").unwrap_or_default() != "production" {
        allowed_origins.extend_from_slice(&[
            "http://localhost:3000".parse().unwrap(),
            "http://localhost:3001".parse().unwrap(),
            "http://aq-admin:3000".parse().unwrap(),
        ]);
        
        // Allow custom admin server IP from environment
        if let Ok(admin_ip) = std::env::var("ADMIN_SERVER_IP") {
            if let Ok(origin) = format!("http://{}:3000", admin_ip).parse() {
                allowed_origins.push(origin);
            }
        }
    }
    
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            "accept".parse::<axum::http::HeaderName>().unwrap(),
            "accept-language".parse::<axum::http::HeaderName>().unwrap(),
            "authorization".parse::<axum::http::HeaderName>().unwrap(),
            "content-type".parse::<axum::http::HeaderName>().unwrap(),
            "dnt".parse::<axum::http::HeaderName>().unwrap(),
            "origin".parse::<axum::http::HeaderName>().unwrap(),
            "user-agent".parse::<axum::http::HeaderName>().unwrap(),
            "x-csrftoken".parse::<axum::http::HeaderName>().unwrap(),
            "x-requested-with".parse::<axum::http::HeaderName>().unwrap(),
        ])
        .allow_credentials(true)
        .max_age(Duration::from_secs(3600))
}
