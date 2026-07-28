use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use std::time::Instant;
use tracing::{error, info};

use crate::monitoring::TBankMetrics;
use crate::services::TBankServices;

/// Metrics collection middleware
pub async fn metrics_middleware(
    State(services): State<Arc<TBankServices>>,
    request: Request,
    next: Next,
) -> Response {
    let start_time = Instant::now();

    // Extract request information
    let method = request.method().to_string();
    let uri = request.uri().to_string();

    // Process the request
    let response = next.run(request).await;

    // Calculate request duration
    let duration = start_time.elapsed();
    let duration_secs = duration.as_secs_f64();

    // Extract response information
    let status_code = response.status().as_u16();
    let success = response.status().is_success();

    // Extract endpoint pattern for metrics
    let endpoint = extract_endpoint_pattern(&uri);

    // Record HTTP request metrics
    services.metrics_collector.record_http_request(
        &method,
        &endpoint,
        status_code,
        duration_secs,
        "tbank",
    );

    // Record T-Bank specific metrics based on endpoint
    record_tbank_specific_metrics(&services, &endpoint, &method, duration_secs, success);

    // Update system metrics periodically (every 100 requests)
    if fastrand::u32(0..100) == 0 {
        update_system_metrics(&services).await;
    }

    response
}

/// Record T-Bank specific metrics based on the endpoint
fn record_tbank_specific_metrics(
    services: &TBankServices,
    endpoint: &str,
    method: &str,
    duration: f64,
    success: bool,
) {
    let method_str = method.to_string();
    match (method_str.as_str(), endpoint) {
        ("POST", path) if path.contains("/counterparties/verify") => {
            TBankMetrics::record_counterparty_verification(
                &services.metrics_collector,
                "unknown", // INN would need to be extracted from request
                duration,
                success,
            );
        }
        ("POST", path) if path.contains("/invoices/b2b") => {
            TBankMetrics::record_b2b_invoice_operation(
                &services.metrics_collector,
                "create",
                duration,
                success,
                None, // Amount would need to be extracted from request
            );
        }
        ("POST", path) if path.contains("/payments/acquiring") => {
            TBankMetrics::record_acquiring_payment_operation(
                &services.metrics_collector,
                "init",
                "unknown", // Payment method would need to be extracted
                duration,
                success,
                None, // Amount would need to be extracted from request
            );
        }
        ("POST", path) if path.contains("/webhooks/") => {
            let webhook_type = if path.contains("/webhooks/b2b/") {
                "b2b"
            } else if path.contains("/webhooks/acquiring/") {
                "acquiring"
            } else {
                "unknown"
            };

            TBankMetrics::record_webhook_processing(
                &services.metrics_collector,
                webhook_type,
                "unknown", // Event type would need to be extracted
                duration,
                success,
            );
        }
        _ => {
            // Generic API call metric
            TBankMetrics::record_tbank_api_call(
                &services.metrics_collector,
                "generic",
                endpoint,
                duration,
                success,
            );
        }
    }
}

/// Update system metrics
async fn update_system_metrics(services: &TBankServices) {
    // Get database connection pool metrics
    let db_active = services.db_pool.size() as u32;
    let db_idle = services.db_pool.num_idle() as u32;

    // For now, we'll use placeholder values for other metrics
    // In a real implementation, you would use system monitoring libraries
    let active_connections = 0; // Would need to track active HTTP connections
    let memory_usage = 0; // Would use system monitoring
    let cpu_usage = 0.0; // Would use system monitoring

    TBankMetrics::update_system_metrics(
        &services.metrics_collector,
        active_connections,
        memory_usage,
        cpu_usage,
        db_active,
        db_idle,
    );

    info!(
        db_active = db_active,
        db_idle = db_idle,
        "System metrics updated"
    );
}

/// Extract endpoint pattern for metrics (remove IDs and query parameters)
fn extract_endpoint_pattern(uri: &str) -> String {
    let path = uri.split('?').next().unwrap_or(uri);

    // Replace common ID patterns with placeholders
    let patterns = [
        (
            r"/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
            "/{uuid}",
        ),
        (r"/\b\d+\b", "/{id}"),
        (r"/\b[0-9a-f]{32}\b", "/{hash}"),
        (r"/\b[A-Za-z0-9+/]{22}==\b", "/{token}"),
    ];

    let mut normalized_path = path.to_string();
    for (pattern, replacement) in &patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            normalized_path = regex
                .replace_all(&normalized_path, *replacement)
                .to_string();
        }
    }

    normalized_path
}

/// Rate limiting metrics middleware
pub async fn rate_limit_metrics_middleware(
    State(services): State<Arc<TBankServices>>,
    request: Request,
    next: Next,
) -> Response {
    let uri = request.uri().to_string();
    let response = next.run(request).await;

    // Check if this was a rate limit violation (429 status)
    if response.status().as_u16() == 429 {
        // Extract endpoint for rate limit metrics
        let endpoint = extract_endpoint_pattern(&uri);

        services.metrics_collector.record_rate_limit_violation(
            &endpoint, "endpoint", // identifier type
        );

        info!(
            endpoint = %endpoint,
            "Rate limit violation recorded"
        );
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_endpoint_pattern() {
        assert_eq!(
            extract_endpoint_pattern("/api/v1/invoices/b2b/123"),
            "/api/v1/invoices/b2b/{id}"
        );

        assert_eq!(
            extract_endpoint_pattern("/api/v1/counterparties/7707083893?include=details"),
            "/api/v1/counterparties/{id}"
        );

        assert_eq!(
            extract_endpoint_pattern(
                "/api/v1/payments/acquiring/550e8400-e29b-41d4-a716-446655440000"
            ),
            "/api/v1/payments/acquiring/{uuid}"
        );
    }
}
