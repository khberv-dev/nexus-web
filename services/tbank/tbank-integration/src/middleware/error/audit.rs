use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use tracing::{error, warn};

use shared::auth::AuthContext;

/// Security audit middleware for sensitive operations
pub async fn security_audit_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let start_time = std::time::Instant::now();

    // Extract request information for audit
    let method = request.method().clone();
    let uri = request.uri().clone();
    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let ip_address = request
        .headers()
        .get("x-forwarded-for")
        .or_else(|| request.headers().get("x-real-ip"))
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    // Extract auth context for audit logging
    let auth_context = request.extensions().get::<AuthContext>().cloned();

    // Process request
    let response = next.run(request).await;
    let duration = start_time.elapsed();

    // Log security-sensitive operations
    let is_sensitive_operation = uri.path().contains("/invoices")
        || uri.path().contains("/payments")
        || uri.path().contains("/counterparties")
        || uri.path().contains("/reconciliation")
        || method == "POST"
        || method == "PUT"
        || method == "DELETE";

    if is_sensitive_operation {
        if let Some(auth_ctx) = auth_context {
            tracing::info!(
                "T-Bank security audit: user={}, method={}, uri={}, status={}, duration={:?}, ip={}, user_agent={}",
                auth_ctx.user_id(),
                method,
                uri,
                response.status(),
                duration,
                ip_address,
                user_agent
            );
        } else {
            tracing::warn!(
                "T-Bank unauthenticated access attempt: method={}, uri={}, status={}, ip={}, user_agent={}",
                method,
                uri,
                response.status(),
                ip_address,
                user_agent
            );
        }
    }

    Ok(response)
}

/// Log error for audit purposes with context
pub fn log_error_for_audit(
    auth_context: Option<&AuthContext>,
    method: &str,
    path: &str,
    status: StatusCode,
) {
    if let Some(auth_ctx) = auth_context {
        error!(
            "T-Bank API error: user={}, method={}, path={}, status={}",
            auth_ctx.user_id(),
            method,
            path,
            status
        );
    } else {
        error!(
            "T-Bank API error: method={}, path={}, status={}",
            method, path, status
        );
    }
}