use axum::{extract::State, http::StatusCode, response::Json, routing::get, Router};
use std::sync::Arc;
use tracing::{error, info};

use crate::services::TBankServices;
use crate::{TBankError, TBankResult};

/// Health check endpoint - comprehensive health status
#[axum::debug_handler]
pub async fn health_check(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    info!("Health check requested");

    let health_check = services.health_checker.check_health().await;

    let status_code = match health_check.status {
        shared::HealthStatus::Healthy => StatusCode::OK,
        shared::HealthStatus::Degraded => StatusCode::OK, // Still OK but with warnings
        shared::HealthStatus::Unhealthy => StatusCode::SERVICE_UNAVAILABLE,
    };

    let response = serde_json::json!({
        "status": health_check.status,
        "service": health_check.service,
        "version": health_check.version,
        "timestamp": health_check.timestamp,
        "uptime_seconds": health_check.uptime_seconds,
        "memory_usage_bytes": health_check.memory_usage_bytes,
        "cpu_usage_percent": health_check.cpu_usage_percent,
        "components": health_check.components,
        "environment_info": services.get_environment_indicator()
    });

    info!(
        status = ?health_check.status,
        components = health_check.components.len(),
        "Health check completed"
    );

    Ok((status_code, Json(response)))
}

/// Readiness check endpoint - service ready to accept traffic
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
                "message": component.message,
                "response_time_ms": component.response_time_ms
            })
        }).collect::<Vec<_>>()
    });

    info!(ready = is_ready, "Readiness check completed");

    Ok((status_code, Json(response)))
}

/// Liveness check endpoint - service is alive
pub async fn liveness_check() -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    // Liveness check is simple - if we can respond, we're alive
    let response = serde_json::json!({
        "alive": true,
        "timestamp": chrono::Utc::now(),
        "service": "tbank-integration"
    });

    Ok((StatusCode::OK, Json(response)))
}

/// T-Bank API connectivity check
#[axum::debug_handler]
pub async fn tbank_api_health_check(
    State(services): State<Arc<TBankServices>>,
) -> Result<(StatusCode, Json<serde_json::Value>), TBankError> {
    info!("T-Bank API health check requested");

    let start = std::time::Instant::now();

    // Check T-Bank API connectivity
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
        "api_type": "tbank",
        "environment": services.config.environment,
        "business_api_url": services.config.business_api_base_url,
        "acquiring_api_url": services.config.acquiring_api_base_url
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
