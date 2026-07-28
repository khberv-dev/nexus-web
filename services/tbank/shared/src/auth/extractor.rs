use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};

use super::{AuthContext, Claims};

/// Extractor for AuthContext from request
#[async_trait]
impl<S> FromRequestParts<S> for AuthContext
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        // Try to get AuthContext from extensions (set by middleware)
        parts
            .extensions
            .get::<AuthContext>()
            .cloned()
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    "Missing authentication context. Please ensure auth middleware is enabled."
                        .to_string(),
                )
            })
    }
}

/// Helper to extract Claims directly
#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        // Try to get AuthContext from extensions
        let auth_context = parts
            .extensions
            .get::<AuthContext>()
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    "Missing authentication context".to_string(),
                )
            })?;

        Ok(auth_context.claims.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;
    use uuid::Uuid;

    fn create_test_claims() -> Claims {
        Claims {
            sub: "test-user".to_string(),
            iss: "adquest".to_string(),
            aud: "adquest-api".to_string(),
            exp: chrono::Utc::now().timestamp() + 3600,
            iat: chrono::Utc::now().timestamp(),
            nbf: chrono::Utc::now().timestamp(),
            jti: "test-jti".to_string(),
            user_id: Uuid::new_v4(),
            email: "test@example.com".to_string(),
            roles: vec!["adquest.publisher".to_string()],
            permissions: vec!["sites:view".to_string()],
            organization_id: Some(Uuid::new_v4()),
            session_id: "test-session".to_string(),
        }
    }

    #[tokio::test]
    async fn test_auth_context_extractor_with_context() {
        let claims = create_test_claims();
        let auth_context = AuthContext::new(claims);

        let mut req = Request::builder().body(()).unwrap();
        req.extensions_mut().insert(auth_context.clone());

        let (mut parts, _) = req.into_parts();

        let extracted = AuthContext::from_request_parts(&mut parts, &())
            .await
            .unwrap();

        assert_eq!(extracted.claims.sub, auth_context.claims.sub);
    }

    #[tokio::test]
    async fn test_auth_context_extractor_without_context() {
        let req = Request::builder().body(()).unwrap();
        let (mut parts, _) = req.into_parts();

        let result = AuthContext::from_request_parts(&mut parts, &()).await;

        assert!(result.is_err());
        let (status, message) = result.unwrap_err();
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(message.contains("Missing authentication"));
    }
}
