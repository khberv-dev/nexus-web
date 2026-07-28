//! Token extraction utilities

use axum::{extract::Request, http::HeaderMap};
use crate::auth::AuthContext;
use crate::errors::ADQuestError;

/// Extract JWT token from Authorization header
pub fn extract_token_from_header(headers: &HeaderMap) -> Result<String, ADQuestError> {
    let auth_header = headers
        .get("authorization")
        .ok_or_else(|| ADQuestError::Authentication("Missing Authorization header".to_string()))?
        .to_str()
        .map_err(|_| {
            ADQuestError::Authentication("Invalid Authorization header format".to_string())
        })?;

    if let Some(token) = auth_header.strip_prefix("Bearer ") {
        Ok(token.to_string())
    } else {
        Err(ADQuestError::Authentication(
            "Invalid Authorization header format, expected 'Bearer <token>'".to_string(),
        ))
    }
}

/// Extract auth context from request (for use in handlers)
pub fn extract_auth_context(request: &Request) -> Result<&AuthContext, ADQuestError> {
    request
        .extensions()
        .get::<AuthContext>()
        .ok_or_else(|| ADQuestError::Authentication("No authentication context found".to_string()))
}
