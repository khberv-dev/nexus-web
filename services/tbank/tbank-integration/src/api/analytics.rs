use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};

use crate::services::TBankServices;

#[derive(Debug, Deserialize)]
pub struct AnalyticsEvent {
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse {
    pub status: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Deserialize)]
pub struct LogEntry {
    pub level: String,
    pub message: String,
    #[serde(default)]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub context: Option<serde_json::Value>,
    #[serde(default)]
    pub user_id: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub trace_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchLogsRequest {
    pub logs: Vec<LogEntry>,
}

#[derive(Debug, Serialize)]
pub struct LogResponse {
    pub status: String,
    pub processed: usize,
    pub timestamp: String,
}

/// Handle performance analytics endpoint
pub async fn handle_performance_analytics(
    State(_services): State<Arc<TBankServices>>,
) -> Result<Json<AnalyticsResponse>, StatusCode> {
    info!("Performance analytics endpoint called - simple version");
    
    Ok(Json(AnalyticsResponse {
        status: "success".to_string(),
        message: "Analytics endpoint working".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }))
}

/// Handle batch logs endpoint
pub async fn handle_batch_logs(
    State(_services): State<Arc<TBankServices>>,
    Json(request): Json<BatchLogsRequest>,
) -> Result<Json<LogResponse>, StatusCode> {
    info!(
        count = request.logs.len(),
        "Batch logs received"
    );

    // Log each entry for debugging
    for log_entry in &request.logs {
        info!(
            level = %log_entry.level,
            message = %log_entry.message,
            url = ?log_entry.url,
            "Log entry processed"
        );
    }

    // TODO: Process log entries (store in database, send to logging service, etc.)
    // For now, just log and return success

    Ok(Json(LogResponse {
        status: "success".to_string(),
        processed: request.logs.len(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }))
}

/// Handle single log endpoint
pub async fn handle_single_log(
    State(_services): State<Arc<TBankServices>>,
    Json(log_entry): Json<LogEntry>,
) -> Result<Json<LogResponse>, StatusCode> {
    info!(
        level = %log_entry.level,
        message = %log_entry.message,
        url = ?log_entry.url,
        "Single log received"
    );

    // TODO: Process log entry
    // For now, just log and return success

    Ok(Json(LogResponse {
        status: "success".to_string(),
        processed: 1,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }))
}

/// Handle health check for analytics service
pub async fn handle_analytics_health(
    State(_services): State<Arc<TBankServices>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "analytics",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "version": "0.1.0"
    })))
}

/// Create analytics router
pub fn create_analytics_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/performance", post(handle_performance_analytics))
        .route("/test", post(handle_test_endpoint))
        .route("/test-get", get(handle_test_get_endpoint))
        .route("/health", get(handle_analytics_health))
}

/// Test endpoint to debug the issue
pub async fn handle_test_endpoint(
    State(_services): State<Arc<TBankServices>>,
) -> Result<Json<AnalyticsResponse>, StatusCode> {
    info!("Test endpoint called");
    
    Ok(Json(AnalyticsResponse {
        status: "success".to_string(),
        message: "Test endpoint working".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }))
}

/// Test GET endpoint to debug the issue
pub async fn handle_test_get_endpoint(
    State(_services): State<Arc<TBankServices>>,
) -> Result<Json<AnalyticsResponse>, StatusCode> {
    info!("Test GET endpoint called");
    
    Ok(Json(AnalyticsResponse {
        status: "success".to_string(),
        message: "Test GET endpoint working".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    }))
}

/// Create logs router  
pub fn create_logs_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/batch", post(handle_batch_logs))
        .route("/", post(handle_single_log))
}