use axum::http::{HeaderMap, HeaderValue};
use uuid::Uuid;

/// Correlation ID header name
pub const CORRELATION_ID_HEADER: &str = "x-correlation-id";

/// Request ID header name
pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Extract or generate correlation ID from request headers
pub fn extract_or_generate_correlation_id(headers: &HeaderMap) -> String {
    // Try to extract from various common headers
    let correlation_headers = [
        CORRELATION_ID_HEADER,
        "x-trace-id",
        "x-request-id",
        "traceparent",
    ];

    for header_name in &correlation_headers {
        if let Some(header_value) = headers.get(*header_name) {
            if let Ok(value_str) = header_value.to_str() {
                if !value_str.is_empty() {
                    return value_str.to_string();
                }
            }
        }
    }

    // Generate new correlation ID if none found
    Uuid::new_v4().to_string()
}

/// Extract client IP address considering proxy headers
pub fn extract_client_ip(headers: &HeaderMap) -> String {
    // Try to extract from various proxy headers in order of preference
    let ip_headers = [
        "x-forwarded-for",
        "x-real-ip",
        "x-client-ip",
        "cf-connecting-ip", // Cloudflare
        "true-client-ip",   // Cloudflare Enterprise
    ];

    for header_name in &ip_headers {
        if let Some(header_value) = headers.get(*header_name) {
            if let Ok(value_str) = header_value.to_str() {
                // X-Forwarded-For can contain multiple IPs, take the first one
                let ip = value_str.split(',').next().unwrap_or("").trim();
                if !ip.is_empty() && ip != "unknown" {
                    return ip.to_string();
                }
            }
        }
    }

    "unknown".to_string()
}

/// Add headers to request for correlation and request tracking
pub fn add_tracking_headers(
    headers: &mut axum::http::HeaderMap,
    correlation_id: &str,
    request_id: &str,
) {
    headers.insert(
        CORRELATION_ID_HEADER,
        HeaderValue::from_str(correlation_id)
            .unwrap_or_else(|_| HeaderValue::from_static("invalid")),
    );
    headers.insert(
        REQUEST_ID_HEADER,
        HeaderValue::from_str(request_id).unwrap_or_else(|_| HeaderValue::from_static("invalid")),
    );
}

/// Add environment and tracking headers to response
pub fn add_response_headers(
    headers: &mut axum::http::HeaderMap,
    correlation_id: &str,
    request_id: &str,
    environment: &crate::config::Environment,
) {
    // Add correlation ID and request ID to response headers
    headers.insert(
        CORRELATION_ID_HEADER,
        HeaderValue::from_str(correlation_id)
            .unwrap_or_else(|_| HeaderValue::from_static("invalid")),
    );
    headers.insert(
        REQUEST_ID_HEADER,
        HeaderValue::from_str(request_id).unwrap_or_else(|_| HeaderValue::from_static("invalid")),
    );

    // Add environment indicator to response
    let env_header = match environment {
        crate::config::Environment::Sandbox => "sandbox",
        crate::config::Environment::Production => "production",
    };
    headers.insert(
        "x-environment",
        HeaderValue::from_str(env_header).unwrap_or_else(|_| HeaderValue::from_static("unknown")),
    );
}