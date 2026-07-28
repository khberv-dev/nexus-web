use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

/// CORS middleware for cross-origin requests
pub async fn cors_middleware(request: Request, next: Next) -> Result<Response, StatusCode> {
    let origin = request
        .headers()
        .get("origin")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();

    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    // Allow specific origins for ADQuest platform
    // Production origins
    let mut allowed_origins = vec![
        "https://ad-quest.ru",
        "https://widget.ad-quest.ru",
    ];
    
    // Development origins (only in non-production)
    if cfg!(debug_assertions) || std::env::var("RUST_ENV").unwrap_or_default() != "production" {
        allowed_origins.extend_from_slice(&[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://aq-admin:3000",
        ]);
        
        // Allow custom admin server IP from environment
        if let Ok(admin_ip) = std::env::var("ADMIN_SERVER_IP") {
            allowed_origins.push(Box::leak(format!("http://{}:3000", admin_ip).into_boxed_str()));
        }
    }

    if allowed_origins.contains(&origin.as_str()) {
        headers.insert("Access-Control-Allow-Origin", origin.parse().unwrap());
    }

    headers.insert(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS".parse().unwrap(),
    );
    headers.insert(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Trace-ID".parse().unwrap(),
    );
    headers.insert("Access-Control-Max-Age", "86400".parse().unwrap()); // 24 hours

    Ok(response)
}

/// Health check middleware that bypasses authentication
pub async fn health_check_middleware(request: Request, next: Next) -> Result<Response, StatusCode> {
    // Skip authentication for health check endpoints
    let path = request.uri().path();
    if path == "/health" || path == "/metrics" || path == "/ready" {
        return Ok(next.run(request).await);
    }

    // For all other endpoints, continue with normal flow
    Ok(next.run(request).await)
}