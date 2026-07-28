use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::encryption::InputValidator;

/// Input validation middleware for preventing injection attacks
pub async fn input_validation_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Validate query parameters
    if let Some(query) = request.uri().query() {
        for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
            // Validate common injection patterns
            if let Err(e) = InputValidator::validate_sql_input(&value) {
                tracing::warn!(
                    "Malicious query parameter detected: {} = {}, error: {}",
                    key,
                    value,
                    e
                );
                return Err(StatusCode::BAD_REQUEST);
            }

            // Validate parameter length
            if let Err(e) = InputValidator::validate_string_length(&value, 0, 1000) {
                tracing::warn!(
                    "Query parameter too long: {} = {}, error: {}",
                    key,
                    value,
                    e
                );
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    }

    // Validate headers for potential injection
    for (name, value) in request.headers() {
        if let Ok(value_str) = value.to_str() {
            // Skip standard headers that might contain special characters
            let header_name = name.as_str().to_lowercase();
            if ![
                "authorization",
                "content-type",
                "user-agent",
                "accept",
                "accept-encoding",
            ]
            .contains(&header_name.as_str())
            {
                if let Err(e) = InputValidator::validate_sql_input(value_str) {
                    tracing::warn!(
                        "Malicious header detected: {} = {}, error: {}",
                        name,
                        value_str,
                        e
                    );
                    return Err(StatusCode::BAD_REQUEST);
                }
            }
        }
    }

    // Continue to next middleware/handler
    Ok(next.run(request).await)
}

/// Security headers middleware
pub async fn security_headers_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let mut response = next.run(request).await;

    let headers = response.headers_mut();

    // Add security headers
    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert("X-XSS-Protection", "1; mode=block".parse().unwrap());
    headers.insert(
        "Referrer-Policy",
        "strict-origin-when-cross-origin".parse().unwrap(),
    );
    headers.insert(
        "Content-Security-Policy",
        "default-src 'self'".parse().unwrap(),
    );

    // Remove server information
    headers.remove("server");

    Ok(response)
}