//! Legacy authentication middleware (supports multiple auth methods)
//! 
//! This module is kept for backward compatibility with services that still use
//! PAT tokens or legacy JWT. New services should use jwt_only module instead.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::auth::AuthContext;
use super::extractors::extract_token_from_header;
use super::state::AuthMiddlewareState;

/// Authentication middleware with Zitadel support (legacy)
pub async fn auth_middleware(
    State(state): State<AuthMiddlewareState>,
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
    
    tracing::info!("🔐 Auth middleware: Processing {} request to {}", request_method, request_path);
    
    // Extract token from header
    let token = match extract_token_from_header(request.headers()) {
        Ok(token) => {
            tracing::info!("🔐 Auth middleware: Token extracted successfully for {}", request_path);
            token
        },
        Err(e) => {
            tracing::warn!("🔐 Auth middleware: Authentication failed for {} {}: {}", request_method, request_path, e);
            return Err(StatusCode::UNAUTHORIZED);
        }
    };
    
    // Security check: Prevent using client secrets as tokens
    if token.len() < 100 && !token.contains('.') {
        tracing::error!("🔐 SECURITY: Possible client secret used as token! Token length: {}, first 20 chars: {}", 
            token.len(), 
            &token.chars().take(20).collect::<String>()
        );
        tracing::error!("🔐 CRM TEAM: Please use ZITADEL_PAT_TOKEN or JWT token, NOT client_secret!");
        tracing::error!("🔐 Expected: JWT token (3 parts with dots) or PAT token (longer opaque string)");
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Choose validation method based on configuration
    let auth_context = if state.use_zitadel {
        // Check if token is JWT (contains dots) or PAT (no dots)
        let token_parts: Vec<&str> = token.split('.').collect();
        let is_valid_jwt = token_parts.len() == 3 && token_parts.iter().all(|part| !part.is_empty());
        
        if is_valid_jwt {
            // Use Zitadel JWT validation
            tracing::info!("🔐 Validating JWT token via JWKS (signature verification)");
            match state.zitadel_validator.validate_token(&token).await {
                Ok(zitadel_claims) => {
                    tracing::info!("✅ JWT JWKS validation successful for user: {}", zitadel_claims.sub);
                    match zitadel_claims.to_adquest_claims() {
                        Ok(claims) => {
                            tracing::info!("✅ JWT claims converted successfully: user_id={}, email={}", claims.user_id, claims.email);
                            AuthContext::new(claims)
                        }
                        Err(e) => {
                            tracing::warn!("❌ Failed to convert Zitadel claims: {}", e);
                            return Err(StatusCode::UNAUTHORIZED);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("❌ Zitadel JWT validation failed: {}", e);
                    // Fallback to legacy JWT validation
                    tracing::info!("🔄 Attempting fallback to legacy JWT validation");
                    match state.jwt_auth.validate_token(&token) {
                        Ok(claims) => {
                            tracing::info!("✅ Fallback to legacy JWT validation successful");
                            AuthContext::new(claims)
                        }
                        Err(e) => {
                            tracing::warn!("❌ Legacy JWT validation also failed: {}", e);
                            return Err(StatusCode::UNAUTHORIZED);
                        }
                    }
                }
            }
        } else {
            // This is a PAT token - use introspection API
            if let Some(pat_validator) = &state.pat_validator {
                tracing::info!("🔐 Validating PAT/opaque token via introspection API");
                match pat_validator.validate_pat(&token).await {
                    Ok(zitadel_claims) => {
                        tracing::info!("✅ PAT validation successful for user: {}", zitadel_claims.sub);
                        match zitadel_claims.to_adquest_claims() {
                            Ok(claims) => {
                                tracing::info!("✅ PAT claims converted successfully");
                                AuthContext::new(claims)
                            }
                            Err(e) => {
                                tracing::warn!("Failed to convert PAT claims: {}", e);
                                return Err(StatusCode::UNAUTHORIZED);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!("PAT token validation failed: {}", e);
                        return Err(StatusCode::UNAUTHORIZED);
                    }
                }
            } else {
                tracing::warn!("🔐 PAT token detected but introspection not configured");
                tracing::warn!("Please use JWT tokens from NextAuth session instead");
                tracing::warn!("Or configure ZITADEL_INTROSPECTION_CLIENT_SECRET in .env");
                return Err(StatusCode::UNAUTHORIZED);
            }
        }
    } else {
        // Use legacy JWT validation
        match state.jwt_auth.validate_token(&token) {
            Ok(claims) => AuthContext::new(claims),
            Err(e) => {
                tracing::warn!("JWT validation failed: {}", e);
                return Err(StatusCode::UNAUTHORIZED);
            }
        }
    };

    // Add trace ID for distributed tracing
    if let Some(trace_id) = request.headers().get("x-trace-id") {
        if let Ok(trace_id_str) = trace_id.to_str() {
            tracing::info!("Processing request with trace ID: {}", trace_id_str);
        }
    }

    // Log authentication success for audit
    tracing::info!(
        "Authentication successful for user: {} (session: {})",
        auth_context.user_id(),
        auth_context.session_id()
    );

    // Debug: Log user permissions
    tracing::info!(
        "🔍 User permissions: user={}, roles={:?}, permissions={:?}",
        auth_context.user_id(),
        auth_context.roles(),
        auth_context.permissions_list()
    );

    // Add auth context to request extensions
    request.extensions_mut().insert(auth_context);

    // Continue to next middleware/handler
    Ok(next.run(request).await)
}

/// Rate limiting middleware (legacy)
pub async fn rate_limit_middleware(
    State(state): State<AuthMiddlewareState>,
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
