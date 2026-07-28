use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tracing::{debug, error, warn};

use crate::services::TBankServices;
use super::{
    validation::{validate_zitadel_token, validate_tbank_api_key, validate_internal_service_token, check_rate_limit_placeholder},
    types::TBankPermission,
};

/// Authentication middleware for T-Bank API endpoints
/// Supports both Zitadel JWT tokens and T-Bank API keys
pub async fn auth_middleware(
    State(services): State<Arc<TBankServices>>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip authentication for health checks and metrics
    let path = request.uri().path();
    if path.starts_with("/health") || path.starts_with("/metrics") {
        return Ok(next.run(request).await);
    }

    // Skip authentication for webhooks (they use signature validation)
    if path.starts_with("/webhooks") {
        return Ok(next.run(request).await);
    }

    // Skip authentication in sandbox mode for testing endpoints
    if path.starts_with("/sandbox") && services.config.environment == crate::config::Environment::Sandbox {
        debug!("Skipping authentication for sandbox endpoint: {}", path);
        return Ok(next.run(request).await);
    }

    // Try Zitadel JWT authentication first (if enabled)
    if services.config.use_zitadel {
        if let Some(auth_header) = headers.get("authorization") {
            if let Ok(auth_str) = auth_header.to_str() {
                if auth_str.starts_with("Bearer ") {
                    let token = &auth_str[7..];
                    
                    match validate_zitadel_token(&services, token).await {
                        Ok(_) => {
                            debug!("Successfully authenticated with Zitadel JWT");
                            return Ok(next.run(request).await);
                        }
                        Err(e) => {
                            warn!("Zitadel JWT validation failed: {}", e);
                            // Continue to try API key authentication
                        }
                    }
                }
            }
        }
    }

    // Try T-Bank API key authentication
    if let Some(api_key) = headers.get("x-api-key") {
        if let Ok(key_str) = api_key.to_str() {
            if validate_tbank_api_key(&services, key_str) {
                debug!("Successfully authenticated with T-Bank API key");
                return Ok(next.run(request).await);
            } else {
                error!("Invalid T-Bank API key provided");
                return Err(StatusCode::UNAUTHORIZED);
            }
        }
    }

    // Check for internal service authentication (for service-to-service calls)
    if let Some(service_token) = headers.get("x-service-token") {
        if let Ok(token_str) = service_token.to_str() {
            if validate_internal_service_token(&services, token_str) {
                debug!("Successfully authenticated with internal service token");
                return Ok(next.run(request).await);
            }
        }
    }

    error!("No valid authentication provided for path: {}", path);
    Err(StatusCode::UNAUTHORIZED)
}

/// Rate limiting middleware for T-Bank API endpoints
pub async fn rate_limit_middleware(
    State(services): State<Arc<TBankServices>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = request.uri().path();
    
    // Skip rate limiting for health checks and metrics
    if path.starts_with("/health") || path.starts_with("/metrics") {
        return Ok(next.run(request).await);
    }

    // Determine rate limit based on endpoint
    let rate_limit = match path {
        p if p.contains("/counterparties") => services.config.rate_limit_config.counterparty_verification,
        p if p.contains("/invoices") || p.contains("/invoice") => services.config.rate_limit_config.b2b_invoices,
        p if p.contains("/payments") || p.contains("/acquiring") => services.config.rate_limit_config.acquiring_payments,
        p if p.contains("/balance") || p.contains("/bank-accounts") || p.contains("/statement") => services.config.rate_limit_config.balance_queries,
        p if p.contains("/reconciliation") => services.config.rate_limit_config.reconciliation,
        p if p.contains("/audit") => services.config.rate_limit_config.audit_queries,
        _ => 100, // Default rate limit
    };

    // Get client identifier for rate limiting (IP address or API key)
    let client_id = get_client_identifier(&request);
    
    // Check rate limit using Redis-based rate limiter (placeholder for now)
    // TODO: Implement actual rate limiter integration
    match check_rate_limit_placeholder(&client_id, rate_limit).await {
        Ok(true) => {
            debug!("Rate limit check passed for client: {}", client_id);
            Ok(next.run(request).await)
        }
        Ok(false) => {
            warn!("Rate limit exceeded for client: {}", client_id);
            Err(StatusCode::TOO_MANY_REQUESTS)
        }
        Err(e) => {
            error!("Rate limit check failed: {}", e);
            // Allow request to proceed if rate limiter is unavailable
            Ok(next.run(request).await)
        }
    }
}

/// Extract client identifier for rate limiting
fn get_client_identifier(request: &Request) -> String {
    // Try to get API key first
    if let Some(api_key) = request.headers().get("x-api-key") {
        if let Ok(key_str) = api_key.to_str() {
            return format!("api_key:{}", key_str);
        }
    }

    // Try to get JWT subject
    if let Some(auth_header) = request.headers().get("authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                // In a real implementation, we would decode the JWT to get the subject
                return format!("jwt:{}", &auth_str[7..15]); // Use first 8 chars as identifier
            }
        }
    }

    // Fall back to IP address
    if let Some(forwarded_for) = request.headers().get("x-forwarded-for") {
        if let Ok(ip_str) = forwarded_for.to_str() {
            return format!("ip:{}", ip_str.split(',').next().unwrap_or("unknown").trim());
        }
    }

    if let Some(real_ip) = request.headers().get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            return format!("ip:{}", ip_str);
        }
    }

    // Default identifier
    "unknown".to_string()
}

/// Require specific T-Bank permission (middleware function)
pub async fn require_tbank_permission(
    permission: TBankPermission,
) -> impl Fn(HeaderMap, Next, Request) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, StatusCode>> + Send>> + Clone {
    move |headers: HeaderMap, next: Next, request: Request| {
        let required_permission = permission.clone();
        Box::pin(async move {
            let permissions = super::permissions::extract_tbank_permissions(&headers);
            if super::permissions::has_tbank_permission(&permissions, &required_permission) {
                Ok(next.run(request).await)
            } else {
                Err(StatusCode::FORBIDDEN)
            }
        })
    }
}

/// Legacy T-Bank authentication middleware (for backward compatibility)
pub async fn tbank_auth_middleware(
    State(services): State<Arc<TBankServices>>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    auth_middleware(State(services), headers, request, next).await
}

/// Legacy T-Bank rate limiting middleware (for backward compatibility)
pub async fn tbank_rate_limit_middleware(
    State(services): State<Arc<TBankServices>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    rate_limit_middleware(State(services), request, next).await
}