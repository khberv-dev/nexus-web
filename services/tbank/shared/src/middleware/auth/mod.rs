//! Authentication and authorization middleware
//!
//! This module provides various authentication strategies:
//! - JWT-only (recommended for new services)
//! - Legacy (supports JWT, PAT, and fallback)
//! - Zitadel-only (strict Zitadel validation)
//!
//! ## Usage
//!
//! ### JWT-only (recommended)
//! ```rust,ignore
//! use shared::middleware::auth::{JwtOnlyAuthState, jwt_only_auth_middleware};
//!
//! let auth_state = JwtOnlyAuthState {
//!     zitadel_validator,
//!     rate_limiter,
//! };
//!
//! let app = Router::new()
//!     .route("/api/v1/resource", get(handler))
//!     .layer(from_fn_with_state(auth_state, jwt_only_auth_middleware));
//! ```
//!
//! ### Legacy (backward compatibility)
//! ```rust,ignore
//! use shared::middleware::auth::{AuthMiddlewareState, auth_middleware};
//!
//! let auth_state = AuthMiddlewareState {
//!     jwt_auth,
//!     zitadel_validator,
//!     pat_validator,
//!     rate_limiter,
//!     use_zitadel: true,
//! };
//!
//! let app = Router::new()
//!     .route("/api/v1/resource", get(handler))
//!     .layer(from_fn_with_state(auth_state, auth_middleware));
//! ```

mod state;
mod extractors;
mod jwt_only;
mod legacy;
mod zitadel;
mod authorization;

// Re-export state types
pub use state::{AuthMiddlewareState, JwtOnlyAuthState};

// Re-export extractors
pub use extractors::{extract_auth_context, extract_token_from_header};

// Re-export JWT-only middleware (recommended)
pub use jwt_only::{jwt_only_auth_middleware, jwt_only_rate_limit_middleware};

// Re-export legacy middleware (backward compatibility)
pub use legacy::{auth_middleware, rate_limit_middleware};

// Re-export Zitadel-only middleware
pub use zitadel::zitadel_auth_middleware;

// Re-export authorization middleware
pub use authorization::{require_permission, require_role};
