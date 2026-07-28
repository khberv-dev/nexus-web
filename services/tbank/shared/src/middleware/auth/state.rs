//! Authentication middleware state types

use std::sync::Arc;
use crate::auth::{JwtAuth, InMemoryRateLimiter, ZitadelValidator};

/// Authentication middleware state (legacy, supports multiple auth methods)
#[derive(Clone)]
pub struct AuthMiddlewareState {
    pub jwt_auth: Arc<JwtAuth>,
    pub zitadel_validator: Arc<ZitadelValidator>,
    pub pat_validator: Option<Arc<crate::auth::zitadel::PatValidator>>,
    pub rate_limiter: Arc<InMemoryRateLimiter>,
    pub use_zitadel: bool,
}

/// Simplified authentication middleware state (JWT-only, recommended)
#[derive(Clone)]
pub struct JwtOnlyAuthState {
    pub zitadel_validator: Arc<ZitadelValidator>,
    pub rate_limiter: Arc<InMemoryRateLimiter>,
}
