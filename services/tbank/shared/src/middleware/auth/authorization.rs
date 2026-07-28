//! Authorization middleware (permissions and roles)

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::auth::{AuthContext, Permission};

/// Permission-based authorization middleware
pub fn require_permission(
    required_permission: Permission,
) -> impl Fn(
    Request,
    Next,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<Response, StatusCode>> + Send>,
> + Clone {
    move |request: Request, next: Next| {
        let required_permission = required_permission.clone();
        Box::pin(async move {
            // Debug: Log the request path and required permission
            tracing::info!(
                "🔒 Permission check: path={}, method={}, required_permission={}",
                request.uri().path(),
                request.method(),
                required_permission.to_string()
            );

            // Get auth context from request extensions
            let auth_context = request
                .extensions()
                .get::<AuthContext>()
                .ok_or(StatusCode::UNAUTHORIZED)?;

            // Debug: Log user permissions
            tracing::info!(
                "🔒 User permissions: user={}, roles={:?}, permissions={:?}",
                auth_context.user_id(),
                auth_context.roles(),
                auth_context.get_permissions()
            );

            // Check if user has required permission
            if !auth_context.has_permission(required_permission.clone()) {
                tracing::warn!(
                    "Permission denied for user {}: required {:?}",
                    auth_context.user_id(),
                    required_permission.to_string()
                );
                return Err(StatusCode::FORBIDDEN);
            }

            // Continue to next middleware/handler
            Ok(next.run(request).await)
        })
    }
}

/// Role-based authorization middleware
pub fn require_role(
    required_role: &'static str,
) -> impl Fn(
    Request,
    Next,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<Response, StatusCode>> + Send>,
> + Clone {
    move |request: Request, next: Next| {
        Box::pin(async move {
            // Get auth context from request extensions
            let auth_context = request
                .extensions()
                .get::<AuthContext>()
                .ok_or(StatusCode::UNAUTHORIZED)?;

            // Check if user has required role
            if !auth_context.has_role(required_role) {
                tracing::warn!(
                    "Role access denied for user {}: required role '{}'",
                    auth_context.user_id(),
                    required_role
                );
                return Err(StatusCode::FORBIDDEN);
            }

            // Continue to next middleware/handler
            Ok(next.run(request).await)
        })
    }
}
