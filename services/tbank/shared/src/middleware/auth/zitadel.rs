//! Zitadel-only authentication middleware

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::auth::AuthContext;
use super::extractors::extract_token_from_header;
use super::state::AuthMiddlewareState;

/// Zitadel-only authentication middleware (for new services)
pub async fn zitadel_auth_middleware(
    State(state): State<AuthMiddlewareState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip authentication for WebDAV and other non-API requests
    let request_method = request.method().to_string();
    if request_method == "PROPFIND" || request_method == "OPTIONS" {
        tracing::debug!("🔐 Skipping auth for {} {}", request_method, request.uri().path());
        return Ok(next.run(request).await);
    }
    
    // Extract token from header
    let token = match extract_token_from_header(request.headers()) {
        Ok(token) => token,
        Err(e) => {
            tracing::warn!("Authentication failed: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Validate token using Zitadel only
    let zitadel_claims = match state.zitadel_validator.validate_token(&token).await {
        Ok(claims) => claims,
        Err(e) => {
            tracing::warn!("Zitadel token validation failed: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Convert to ADQuest claims
    let claims = match zitadel_claims.to_adquest_claims() {
        Ok(claims) => claims,
        Err(e) => {
            tracing::warn!("Failed to convert Zitadel claims: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Create auth context
    let auth_context = AuthContext::new(claims);

    // Add trace ID for distributed tracing
    if let Some(trace_id) = request.headers().get("x-trace-id") {
        if let Ok(trace_id_str) = trace_id.to_str() {
            tracing::info!("Processing request with trace ID: {}", trace_id_str);
        }
    }

    // Log authentication success for audit (152-ФЗ compliance)
    tracing::info!(
        "Zitadel authentication successful for user: {} (session: {}, org: {:?})",
        auth_context.user_id(),
        auth_context.session_id(),
        auth_context.organization_id()
    );

    // Add auth context to request extensions
    request.extensions_mut().insert(auth_context);

    // Continue to next middleware/handler
    Ok(next.run(request).await)
}
