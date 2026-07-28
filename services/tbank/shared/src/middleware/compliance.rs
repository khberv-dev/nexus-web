use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::auth::{AuthContext, Permission};

/// Russian compliance audit middleware (152-ФЗ)
pub async fn compliance_audit_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let start_time = std::time::Instant::now();

    // Extract auth context for audit logging
    let auth_context = request.extensions().get::<AuthContext>().cloned();

    // Extract request information for audit
    let method = request.method().clone();
    let uri = request.uri().clone();
    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let trace_id = request
        .headers()
        .get("x-trace-id")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    // Process request
    let response = next.run(request).await;
    let duration = start_time.elapsed();

    // Log for 152-ФЗ compliance if personal data might be involved
    if let Some(auth_ctx) = auth_context {
        let involves_personal_data = uri.path().contains("/users")
            || uri.path().contains("/profile")
            || uri.path().contains("/personal")
            || uri
                .query()
                .is_some_and(|q| q.contains("email") || q.contains("phone"));

        if involves_personal_data {
            tracing::info!(
                "Personal data access audit: user={}, method={}, uri={}, status={}, duration={:?}, trace_id={}, user_agent={}",
                auth_ctx.user_id(),
                method,
                uri,
                response.status(),
                duration,
                trace_id,
                user_agent
            );
        }
    }

    Ok(response)
}

/// ERIR compliance middleware for advertising content
pub async fn erir_compliance_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Check if this is an advertising-related endpoint
    let uri = request.uri();
    let is_advertising_endpoint = uri.path().contains("/campaigns")
        || uri.path().contains("/ads")
        || uri.path().contains("/creative")
        || uri.path().contains("/challenge");

    if is_advertising_endpoint {
        // Extract auth context
        if let Some(auth_context) = request.extensions().get::<AuthContext>() {
            // Log ERIR-related activity
            tracing::info!(
                "ERIR compliance audit: user={}, endpoint={}, method={}, org={:?}",
                auth_context.user_id(),
                uri.path(),
                request.method(),
                auth_context.organization_id()
            );

            // Check if user has ERIR permissions for certain operations
            if (request.method() == "POST" || request.method() == "PUT")
                && !auth_context.has_permission(Permission::ErirRegister)
                && !auth_context.has_permission(Permission::ErirManage)
            {
                tracing::warn!(
                    "ERIR permission denied for user {}: missing erir:register or erir:manage permission",
                    auth_context.user_id()
                );
                return Err(StatusCode::FORBIDDEN);
            }
        }
    }

    Ok(next.run(request).await)
}