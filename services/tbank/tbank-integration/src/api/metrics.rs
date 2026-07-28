use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info};

use crate::services::TBankServices;
use crate::{TBankError, TBankResult};

/// Frontend performance metric for monitoring
#[derive(Debug, Deserialize, Serialize)]
pub struct FrontendMetric {
    pub metric_name: String,
    pub metric_value: f64,
    pub metric_type: String, // "counter", "histogram", "gauge"
    pub labels: HashMap<String, String>,
    pub timestamp: u64,
}

/// Frontend performance metrics endpoint
#[axum::debug_handler]
pub async fn frontend_metrics_handler(
    State(services): State<Arc<TBankServices>>,
    Json(metric): Json<FrontendMetric>,
) -> Result<Response, TBankError> {
    info!(
        "Recording frontend metric: {} = {}",
        metric.metric_name, metric.metric_value
    );

    // Record the metric in our metrics collector
    match metric.metric_type.as_str() {
        "counter" => {
            // For counters, we increment by the value
            if let Err(e) = services.metrics_collector.increment_counter(&metric.metric_name, metric.metric_value) {
                tracing::warn!("Failed to record counter metric: {}", e);
            }
        }
        "histogram" => {
            // For histograms, we observe the value
            if let Err(e) = services.metrics_collector.observe_histogram(&metric.metric_name, metric.metric_value) {
                tracing::warn!("Failed to record histogram metric: {}", e);
            }
        }
        "gauge" => {
            // For gauges, we set the value
            if let Err(e) = services.metrics_collector.set_gauge(&metric.metric_name, metric.metric_value) {
                tracing::warn!("Failed to record gauge metric: {}", e);
            }
        }
        _ => {
            return Err(TBankError::ValidationError(format!(
                "Unsupported metric type: {}",
                metric.metric_type
            )));
        }
    }

    info!(
        metric_name = %metric.metric_name,
        metric_value = metric.metric_value,
        metric_type = %metric.metric_type,
        "Frontend metric recorded successfully"
    );

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "metric": metric.metric_name,
            "status": "recorded",
            "timestamp": chrono::Utc::now(),
            "value": metric.metric_value
        })),
    )
        .into_response())
}
#[axum::debug_handler]
pub async fn metrics_endpoint(
    State(services): State<Arc<TBankServices>>,
) -> Result<Response, TBankError> {
    info!("Metrics endpoint requested");

    // Get metrics from the shared metrics collector
    let metrics_text = services
        .metrics_collector
        .render_metrics()
        .map_err(|e| TBankError::InternalError(format!("Failed to render metrics: {}", e)))?;

    info!(
        metrics_size = metrics_text.len(),
        "Metrics rendered successfully"
    );

    // Return metrics in Prometheus text format
    Ok((
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        metrics_text,
    )
        .into_response())
}

/// T-Bank specific metrics endpoint with additional context
#[axum::debug_handler]
pub async fn tbank_metrics_endpoint(
    State(services): State<Arc<TBankServices>>,
) -> Result<Response, TBankError> {
    info!("T-Bank specific metrics endpoint requested");

    // Get base metrics
    let base_metrics = services
        .metrics_collector
        .render_metrics()
        .map_err(|e| TBankError::InternalError(format!("Failed to render base metrics: {}", e)))?;

    // Add T-Bank specific metrics
    let mut tbank_metrics = String::new();

    // Add service information
    tbank_metrics.push_str(&format!(
        "# HELP tbank_service_info T-Bank Integration Service information\n\
         # TYPE tbank_service_info gauge\n\
         tbank_service_info{{version=\"0.1.0\",environment=\"{:?}\"}} 1\n\n",
        services.config.environment
    ));

    // Add configuration metrics
    tbank_metrics.push_str(&format!(
        "# HELP tbank_config_rate_limits T-Bank rate limit configurations\n\
         # TYPE tbank_config_rate_limits gauge\n\
         tbank_config_rate_limits{{operation=\"counterparty_verification\"}} {}\n\
         tbank_config_rate_limits{{operation=\"b2b_invoices\"}} {}\n\
         tbank_config_rate_limits{{operation=\"acquiring_payments\"}} {}\n\
         tbank_config_rate_limits{{operation=\"balance_queries\"}} {}\n\
         tbank_config_rate_limits{{operation=\"reconciliation\"}} {}\n\
         tbank_config_rate_limits{{operation=\"audit_queries\"}} {}\n\n",
        services.config.rate_limit_config.counterparty_verification,
        services.config.rate_limit_config.b2b_invoices,
        services.config.rate_limit_config.acquiring_payments,
        services.config.rate_limit_config.balance_queries,
        services.config.rate_limit_config.reconciliation,
        services.config.rate_limit_config.audit_queries
    ));

    // Add API endpoint status
    tbank_metrics.push_str(&format!(
        "# HELP tbank_api_endpoints T-Bank API endpoint configurations\n\
         # TYPE tbank_api_endpoints gauge\n\
         tbank_api_endpoints{{type=\"business\",url=\"{}\"}} 1\n\
         tbank_api_endpoints{{type=\"acquiring\",url=\"{}\"}} 1\n\n",
        services.config.business_api_base_url, services.config.acquiring_api_base_url
    ));

    // Add authentication configuration
    tbank_metrics.push_str(&format!(
        "# HELP tbank_auth_config T-Bank authentication configuration\n\
         # TYPE tbank_auth_config gauge\n\
         tbank_auth_config{{type=\"zitadel_enabled\"}} {}\n\
         tbank_auth_config{{type=\"webhook_signature_enforced\"}} {}\n\n",
        if services.config.use_zitadel { 1 } else { 0 },
        if services.config.enforce_webhook_signature() {
            1
        } else {
            0
        }
    ));

    // Combine base metrics with T-Bank specific metrics
    let combined_metrics = format!("{}{}", base_metrics, tbank_metrics);

    info!(
        base_metrics_size = base_metrics.len(),
        tbank_metrics_size = tbank_metrics.len(),
        total_size = combined_metrics.len(),
        "T-Bank metrics rendered successfully"
    );

    Ok((
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        combined_metrics,
    )
        .into_response())
}

/// Create metrics router
pub fn create_metrics_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/metrics", get(metrics_endpoint))
        .route("/metrics/tbank", get(tbank_metrics_endpoint))
}

/// Create performance metrics router for API v1
pub fn create_performance_metrics_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/performance", post(frontend_metrics_handler))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_formatting() {
        let metrics_text = format!(
            "# HELP test_metric Test metric\n\
             # TYPE test_metric gauge\n\
             test_metric{{label=\"value\"}} 1\n"
        );

        assert!(metrics_text.contains("test_metric"));
        assert!(metrics_text.contains("label=\"value\""));
    }
}
