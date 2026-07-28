use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use std::time::Instant;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::services::TBankServices;
use super::{
    context::{extract_or_generate_correlation_id, extract_client_ip, add_tracking_headers, add_response_headers},
    utils::{extract_endpoint_pattern, get_status_class, format_duration, StatusClass},
};

/// Logging middleware that adds correlation IDs and structured logging
pub async fn logging_middleware(
    State(services): State<Arc<TBankServices>>,
    mut request: Request,
    next: Next,
) -> Response {
    let start_time = Instant::now();

    // Extract or generate correlation ID
    let correlation_id = extract_or_generate_correlation_id(request.headers());

    // Generate unique request ID
    let request_id = Uuid::new_v4().to_string();

    // Extract request information
    let method = request.method().to_string();
    let uri = request.uri().to_string();
    let version = format!("{:?}", request.version());
    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    // Extract client IP (considering proxy headers)
    let client_ip = extract_client_ip(request.headers());

    // Add correlation ID and request ID to request headers
    add_tracking_headers(request.headers_mut(), &correlation_id, &request_id);

    // Create structured logging span
    let span = tracing::info_span!(
        "http_request",
        correlation_id = %correlation_id,
        request_id = %request_id,
        method = %method,
        uri = %uri,
        version = %version,
        user_agent = %user_agent,
        client_ip = %client_ip,
        environment = ?services.config.environment
    );

    let _enter = span.enter();

    info!(
        method = %method,
        uri = %uri,
        correlation_id = %correlation_id,
        request_id = %request_id,
        client_ip = %client_ip,
        user_agent = %user_agent,
        "Request started"
    );

    // Process the request
    let mut response = next.run(request).await;

    // Calculate request duration
    let duration = start_time.elapsed();
    let (duration_ms, duration_secs) = format_duration(duration);

    // Extract response information
    let status_code = response.status().as_u16();
    let status_class = get_status_class(status_code);

    // Add correlation ID, request ID, and environment to response headers
    add_response_headers(
        response.headers_mut(),
        &correlation_id,
        &request_id,
        &services.config.environment,
    );

    // Record metrics
    let endpoint = extract_endpoint_pattern(&uri);
    services.metrics_collector.record_http_request(
        &method,
        &endpoint,
        status_code,
        duration_secs,
        "tbank",
    );

    // Log request completion with appropriate level
    log_request_completion(
        &method,
        &uri,
        status_code,
        duration_ms,
        &correlation_id,
        &request_id,
        &client_ip,
        status_class,
    );

    response
}

/// Log request completion with appropriate log level based on status
fn log_request_completion(
    method: &str,
    uri: &str,
    status_code: u16,
    duration_ms: u64,
    correlation_id: &str,
    request_id: &str,
    client_ip: &str,
    status_class: StatusClass,
) {
    match status_class {
        StatusClass::Success => {
            info!(
                method = %method,
                uri = %uri,
                status_code = %status_code,
                duration_ms = %duration_ms,
                correlation_id = %correlation_id,
                request_id = %request_id,
                client_ip = %client_ip,
                "Request completed successfully"
            );
        }
        StatusClass::ClientError => {
            warn!(
                method = %method,
                uri = %uri,
                status_code = %status_code,
                duration_ms = %duration_ms,
                correlation_id = %correlation_id,
                request_id = %request_id,
                client_ip = %client_ip,
                "Request completed with client error"
            );
        }
        StatusClass::ServerError => {
            error!(
                method = %method,
                uri = %uri,
                status_code = %status_code,
                duration_ms = %duration_ms,
                correlation_id = %correlation_id,
                request_id = %request_id,
                client_ip = %client_ip,
                "Request completed with server error"
            );
        }
        StatusClass::Other => {
            info!(
                method = %method,
                uri = %uri,
                status_code = %status_code,
                duration_ms = %duration_ms,
                correlation_id = %correlation_id,
                request_id = %request_id,
                client_ip = %client_ip,
                "Request completed"
            );
        }
    }
}