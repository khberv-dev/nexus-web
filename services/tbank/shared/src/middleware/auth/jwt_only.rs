//! JWT-only authentication middleware (recommended for new services)

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::auth::AuthContext;
use super::extractors::extract_token_from_header;
use super::state::JwtOnlyAuthState;

/// JWT-only authentication middleware (simplified, recommended for Core API)
pub async fn jwt_only_auth_middleware(
    State(state): State<JwtOnlyAuthState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let request_path = request.uri().path().to_string();
    let request_method = request.method().to_string();
    
    // Skip authentication for WebDAV and other non-API requests
    if request_method == "PROPFIND" || request_method == "OPTIONS" {
        tracing::debug!("🔐 Skipping auth for {} {}", request_method, request_path);
        return Ok(next.run(request).await);
    }
    
    tracing::info!("🔐 JWT-only auth: Processing {} {}", request_method, request_path);
    
    // Extract token from header
    let token = match extract_token_from_header(request.headers()) {
        Ok(token) => {
            tracing::debug!("🔐 Token extracted successfully");
            token
        },
        Err(e) => {
            tracing::warn!("🔐 Authentication failed for {} {}: {}", request_method, request_path, e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };
    
    // Validate JWT via JWKS
    let zitadel_claims = match state.zitadel_validator.validate_token(&token).await {
        Ok(claims) => {
            tracing::info!(
                "✅ JWT validation successful for user: {} (type: {})", 
                claims.sub,
                claims.token_type()
            );
            claims
        }
        Err(e) => {
            tracing::warn!("❌ JWT validation failed: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };
    
    // Convert to ADQuest claims
    let claims = match zitadel_claims.to_adquest_claims() {
        Ok(claims) => {
            tracing::debug!("✅ Claims converted: user_id={}, email={}", claims.user_id, claims.email);
            claims
        }
        Err(e) => {
            tracing::warn!("❌ Failed to convert claims: {}", e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };
    
    // Create auth context
    let auth_context = AuthContext::new(claims);
    
    // Add trace ID for distributed tracing
    if let Some(trace_id) = request.headers().get("x-trace-id") {
        if let Ok(trace_id_str) = trace_id.to_str() {
            tracing::debug!("Processing request with trace ID: {}", trace_id_str);
        }
    }
    
    // Log authentication success
    tracing::info!(
        "Authentication successful for user: {} (session: {}, org: {:?})",
        auth_context.user_id(),
        auth_context.session_id(),
        auth_context.organization_id()
    );
    
    // Add auth context to request extensions
    request.extensions_mut().insert(auth_context);
    
    // Continue to next middleware/handler
    Ok(next.run(request).await)
}

/// Rate limiting middleware for JWT-only auth
pub async fn jwt_only_rate_limit_middleware(
    State(state): State<JwtOnlyAuthState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract user identifier for rate limiting
    let user_key = if let Some(auth_context) = request.extensions().get::<AuthContext>() {
        auth_context.user_id().to_string()
    } else {
        // Fall back to IP address if no auth context
        request
            .headers()
            .get("x-forwarded-for")
            .or_else(|| request.headers().get("x-real-ip"))
            .and_then(|h| h.to_str().ok())
            .unwrap_or("unknown")
            .to_string()
    };

    // Check rate limit
    if !state.rate_limiter.is_allowed(&user_key) {
        tracing::warn!("Rate limit exceeded for key: {}", user_key);
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // Continue to next middleware/handler
    Ok(next.run(request).await)
}
