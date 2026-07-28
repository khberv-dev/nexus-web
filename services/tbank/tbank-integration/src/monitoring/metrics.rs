use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use shared::metrics::MetricsCollector;
use std::sync::Arc;
use tracing::{error, info};

use crate::services::TBankServices;
use crate::{TBankError, TBankResult};

/// Prometheus metrics endpoint
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

/// Health metrics endpoint - subset of metrics for health monitoring
#[axum::debug_handler]
pub async fn health_metrics_endpoint(
    State(services): State<Arc<TBankServices>>,
) -> Result<Response, TBankError> {
    info!("Health metrics endpoint requested");

    let health_check = services.health_checker.check_health().await;

    let mut health_metrics = String::new();

    // Service health status
    let health_status_value = match health_check.status {
        shared::HealthStatus::Healthy => 1.0,
        shared::HealthStatus::Degraded => 0.5,
        shared::HealthStatus::Unhealthy => 0.0,
    };

    health_metrics.push_str(&format!(
        "# HELP tbank_health_status T-Bank service health status (1=healthy, 0.5=degraded, 0=unhealthy)\n\
         # TYPE tbank_health_status gauge\n\
         tbank_health_status{{service=\"{}\"}} {}\n\n",
        health_check.service, health_status_value
    ));

    // Component health status
    health_metrics.push_str("# HELP tbank_component_health T-Bank component health status\n");
    health_metrics.push_str("# TYPE tbank_component_health gauge\n");

    for (component_name, component_health) in &health_check.components {
        let component_status_value = match component_health.status {
            shared::HealthStatus::Healthy => 1.0,
            shared::HealthStatus::Degraded => 0.5,
            shared::HealthStatus::Unhealthy => 0.0,
        };

        health_metrics.push_str(&format!(
            "tbank_component_health{{component=\"{}\"}} {}\n",
            component_name, component_status_value
        ));

        // Add response time if available
        if let Some(response_time) = component_health.response_time_ms {
            health_metrics.push_str(&format!(
                "tbank_component_response_time_ms{{component=\"{}\"}} {}\n",
                component_name, response_time
            ));
        }
    }

    health_metrics.push('\n');

    // Service uptime
    health_metrics.push_str(&format!(
        "# HELP tbank_uptime_seconds T-Bank service uptime in seconds\n\
         # TYPE tbank_uptime_seconds counter\n\
         tbank_uptime_seconds {}\n\n",
        health_check.uptime_seconds
    ));

    // Memory usage if available
    if let Some(memory_bytes) = health_check.memory_usage_bytes {
        health_metrics.push_str(&format!(
            "# HELP tbank_memory_usage_bytes T-Bank service memory usage in bytes\n\
             # TYPE tbank_memory_usage_bytes gauge\n\
             tbank_memory_usage_bytes {}\n\n",
            memory_bytes
        ));
    }

    // CPU usage if available
    if let Some(cpu_percent) = health_check.cpu_usage_percent {
        health_metrics.push_str(&format!(
            "# HELP tbank_cpu_usage_percent T-Bank service CPU usage percentage\n\
             # TYPE tbank_cpu_usage_percent gauge\n\
             tbank_cpu_usage_percent {}\n\n",
            cpu_percent
        ));
    }

    info!(
        metrics_size = health_metrics.len(),
        "Health metrics rendered successfully"
    );

    Ok((
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        health_metrics,
    )
        .into_response())
}

/// Create metrics router
pub fn create_metrics_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/metrics", get(metrics_endpoint))
        .route("/metrics/tbank", get(tbank_metrics_endpoint))
        .route("/metrics/health", get(health_metrics_endpoint))
}

/// T-Bank specific metrics recording functions
pub struct TBankMetrics;

impl TBankMetrics {
    /// Record counterparty verification metrics
    pub fn record_counterparty_verification(
        metrics: &MetricsCollector,
        inn: &str,
        duration: f64,
        success: bool,
    ) {
        let status = if success { "success" } else { "error" };

        metrics
            .http_requests_total
            .with_label_values(&["POST", "/counterparties/verify", "200", "tbank"])
            .inc();

        metrics
            .http_request_duration
            .with_label_values(&["POST", "/counterparties/verify", "tbank"])
            .observe(duration);

        // Record T-Bank specific metric
        metrics
            .erir_requests_total
            .with_label_values(&["counterparty_verification", status])
            .inc();

        metrics
            .erir_request_duration
            .with_label_values(&["counterparty_verification"])
            .observe(duration);
    }

    /// Record B2B invoice metrics
    pub fn record_b2b_invoice_operation(
        metrics: &MetricsCollector,
        operation: &str,
        duration: f64,
        success: bool,
        amount: Option<f64>,
    ) {
        let status = if success { "success" } else { "error" };

        metrics
            .http_requests_total
            .with_label_values(&["POST", "/invoices/b2b", "200", "tbank"])
            .inc();

        metrics
            .http_request_duration
            .with_label_values(&["POST", "/invoices/b2b", "tbank"])
            .observe(duration);

        // Record billing metrics if amount is provided
        if let Some(amount_value) = amount {
            metrics
                .cpv_transaction_amount
                .with_label_values(&["b2b_invoice"])
                .observe(amount_value);
        }
    }

    /// Record acquiring payment metrics
    pub fn record_acquiring_payment_operation(
        metrics: &MetricsCollector,
        operation: &str,
        payment_method: &str,
        duration: f64,
        success: bool,
        amount: Option<f64>,
    ) {
        let status = if success { "success" } else { "error" };

        metrics
            .http_requests_total
            .with_label_values(&["POST", "/payments/acquiring", "200", "tbank"])
            .inc();

        metrics
            .http_request_duration
            .with_label_values(&["POST", "/payments/acquiring", "tbank"])
            .observe(duration);

        // Record payment-specific metrics
        if let Some(amount_value) = amount {
            metrics
                .cpv_transaction_amount
                .with_label_values(&["acquiring_payment"])
                .observe(amount_value);
        }
    }

    /// Record T-Bank API call metrics
    pub fn record_tbank_api_call(
        metrics: &MetricsCollector,
        api_type: &str,
        endpoint: &str,
        duration: f64,
        success: bool,
    ) {
        let status = if success { "success" } else { "error" };
        let status_label = status.to_string();

        let api_type_label = format!("tbank_{}", api_type);
        metrics
            .erir_requests_total
            .with_label_values(&[&api_type_label, &status_label])
            .inc();

        metrics
            .erir_request_duration
            .with_label_values(&[&format!("tbank_{}", api_type)])
            .observe(duration);
    }

    /// Record webhook processing metrics
    pub fn record_webhook_processing(
        metrics: &MetricsCollector,
        webhook_type: &str,
        event_type: &str,
        duration: f64,
        success: bool,
    ) {
        let status = if success { "success" } else { "error" };

        metrics
            .http_requests_total
            .with_label_values(&[
                "POST",
                &format!("/webhooks/{}", webhook_type),
                "200",
                "tbank",
            ])
            .inc();

        metrics
            .http_request_duration
            .with_label_values(&["POST", &format!("/webhooks/{}", webhook_type), "tbank"])
            .observe(duration);
    }

    /// Update system metrics
    pub fn update_system_metrics(
        metrics: &MetricsCollector,
        active_connections: u32,
        memory_usage: u64,
        cpu_usage: f64,
        db_active: u32,
        db_idle: u32,
    ) {
        metrics.update_system_metrics(
            active_connections,
            memory_usage,
            cpu_usage,
            db_active,
            db_idle,
            0, // Redis memory usage - would need to be fetched separately
        );
    }
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
