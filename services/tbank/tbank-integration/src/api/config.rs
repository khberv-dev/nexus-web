use axum::{extract::State, http::StatusCode, response::Json, routing::get, Router};
use std::sync::Arc;
use tracing::info;

use crate::services::TBankServices;
use crate::{TBankError, TBankResult};

/// Get current hot-reloadable configuration
#[axum::debug_handler]
pub async fn get_config(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    info!("Configuration request received");

    let hot_config = services.hot_reload_manager.get_config().await;
    let environment_info = services.get_environment_indicator();

    let response = serde_json::json!({
        "hot_reloadable_config": hot_config,
        "environment_info": environment_info,
        "timestamp": chrono::Utc::now(),
        "note": "This shows only hot-reloadable configuration. Security-sensitive config is not exposed."
    });

    info!("Configuration response sent");

    Ok((StatusCode::OK, Json(response)))
}

/// Get environment information
#[axum::debug_handler]
pub async fn get_environment_info(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    info!("Environment info request received");

    let environment_info = services.get_environment_indicator();

    let response = serde_json::json!({
        "environment_info": environment_info,
        "timestamp": chrono::Utc::now(),
        "api_endpoints": {
            "business_api": services.config.business_api_base_url,
            "acquiring_api": services.config.acquiring_api_base_url
        },
        "features": {
            "hot_reload_enabled": true,
            "webhook_signature_validation": services.enforce_webhook_signature(),
            "zitadel_auth": services.config.use_zitadel
        }
    });

    info!(
        environment = ?services.config.environment,
        "Environment info response sent"
    );

    Ok((StatusCode::OK, Json(response)))
}

/// Trigger configuration reload (for testing/debugging)
#[axum::debug_handler]
pub async fn reload_config(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    info!("Manual configuration reload requested");

    // Note: The actual reload happens automatically in the background task
    // This endpoint just returns the current config and confirms hot-reload is active
    let hot_config = services.hot_reload_manager.get_config().await;

    let response = serde_json::json!({
        "message": "Configuration is automatically reloaded every minute",
        "current_config": hot_config,
        "timestamp": chrono::Utc::now(),
        "hot_reload_active": true
    });

    info!("Configuration reload response sent");

    Ok((StatusCode::OK, Json(response)))
}

/// Create configuration router
pub fn create_config_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/config", get(get_config))
        .route("/config/environment", get(get_environment_info))
        .route("/config/reload", get(reload_config))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    // Note: These tests would require a full service setup
    // In a real test environment, you would create mock services

    #[test]
    fn test_config_router_creation() {
        let router = create_config_router();
        // Basic test that router can be created - just check it's not empty
        // We can't easily test the service without full setup
        println!("Config router created successfully");
    }
}
