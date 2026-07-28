use crate::services::TBankServices;
use crate::{TBankError, TBankResult};
use axum::{extract::State, http::StatusCode, response::Json, routing::get, Router};
use shared::{HealthCheck, HealthChecker, HealthStatus};
use std::sync::Arc;
use tracing::{error, info};

/// Health check endpoint handler
#[axum::debug_handler]
pub async fn health_check(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<HealthCheck>), TBankError> {
    info!("Health check requested");

    let health_check = services.health_checker.check_health().await;

    let status_code = match health_check.status {
        HealthStatus::Healthy => StatusCode::OK,
        HealthStatus::Degraded => StatusCode::OK, // Still OK but with warnings
        HealthStatus::Unhealthy => StatusCode::SERVICE_UNAVAILABLE,
    };

    info!(
        status = ?health_check.status,
        components = health_check.components.len(),
        "Health check completed"
    );

    Ok((status_code, Json(health_check)))
}

/// Readiness check endpoint handler
#[axum::debug_handler]
pub async fn readiness_check(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    info!("Readiness check requested");

    let health_check = services.health_checker.check_health().await;

    let is_ready = health_check.is_ready();
    let status_code = if is_ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let response = serde_json::json!({
        "ready": is_ready,
        "service": health_check.service,
        "version": health_check.version,
        "timestamp": health_check.timestamp,
        "components": health_check.components.iter().map(|(name, component)| {
            serde_json::json!({
                "name": name,
                "status": component.status,
                "message": component.message
            })
        }).collect::<Vec<_>>()
    });

    info!(ready = is_ready, "Readiness check completed");

    Ok((status_code, Json(response)))
}

/// Liveness check endpoint handler
#[axum::debug_handler]
pub async fn liveness_check() -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    // Liveness check is simple - if we can respond, we're alive
    let response = serde_json::json!({
        "alive": true,
        "timestamp": chrono::Utc::now(),
        "service": "tbank-integration"
    });

    Ok((StatusCode::OK, Json(response)))
}

/// T-Bank API health check
#[axum::debug_handler]
pub async fn tbank_api_health_check(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    info!("T-Bank API health check requested");

    // Check T-Bank API connectivity by making a simple request
    let start = std::time::Instant::now();

    // Try to get balance for a test account (this will fail in production but shows connectivity)
    let result = services.tbank_client.check_api_connectivity().await;
    let duration = start.elapsed();

    let (is_healthy, message) = match result {
        Ok(_) => (true, "T-Bank API is accessible".to_string()),
        Err(e) => {
            error!(error = %e, "T-Bank API health check failed");
            (false, format!("T-Bank API error: {}", e))
        }
    };

    let status_code = if is_healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let response = serde_json::json!({
        "healthy": is_healthy,
        "message": message,
        "response_time_ms": duration.as_millis(),
        "timestamp": chrono::Utc::now(),
        "api_type": "tbank"
    });

    info!(
        healthy = is_healthy,
        response_time_ms = duration.as_millis(),
        "T-Bank API health check completed"
    );

    Ok((status_code, Json(response)))
}

/// Create health check router
pub fn create_health_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .route("/live", get(liveness_check))
        .route("/health/tbank-api", get(tbank_api_health_check))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    #[tokio::test]
    async fn test_liveness_check() {
        let result = liveness_check().await;
        assert!(result.is_ok());

        let (status, response) = result.unwrap();
        assert_eq!(status, StatusCode::OK);

        let json_value = response.0;
        assert_eq!(json_value["alive"], true);
        assert_eq!(json_value["service"], "tbank-integration");
    }
}
