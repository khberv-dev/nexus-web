#[cfg(test)]
mod tests {
    use super::super::{
        middleware::tbank_error_middleware,
        responses::tbank_error_to_response,
        types::adquest_error_to_tbank_error,
        utils::generate_request_id,
    };
    use crate::types::TBankError;
    use shared::errors::ADQuestError;

    use axum::{
        body::Body,
        http::{Method, Request, StatusCode},
        middleware,
        response::Response,
        routing::get,
        Router,
    };
    use tower::util::ServiceExt;

    async fn test_handler() -> &'static str {
        "success"
    }

    async fn error_handler() -> Result<&'static str, TBankError> {
        Err(TBankError::ValidationError(
            "Test validation error".to_string(),
        ))
    }

    #[tokio::test]
    async fn test_error_middleware_success() {
        let app = Router::new()
            .route("/test", get(test_handler))
            .layer(middleware::from_fn(tbank_error_middleware));

        let request = Request::builder()
            .method(Method::GET)
            .uri("/test")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[test]
    fn test_tbank_error_conversion() {
        let validation_error = TBankError::ValidationError("Invalid input".to_string());
        let response = tbank_error_to_response(validation_error);
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let auth_error = TBankError::AuthenticationError("Invalid token".to_string());
        let response = tbank_error_to_response(auth_error);
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let not_found_error = TBankError::InvoiceNotFound {
            id: uuid::Uuid::new_v4(),
        };
        let response = tbank_error_to_response(not_found_error);
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_adquest_error_conversion() {
        let auth_error = ADQuestError::Authentication("Invalid credentials".to_string());
        let tbank_error = adquest_error_to_tbank_error(auth_error);

        match tbank_error {
            TBankError::AuthenticationError(msg) => {
                assert_eq!(msg, "Invalid credentials");
            }
            _ => panic!("Expected AuthenticationError"),
        }

        let validation_error = ADQuestError::Validation("Invalid format".to_string());
        let tbank_error = adquest_error_to_tbank_error(validation_error);

        match tbank_error {
            TBankError::ValidationError(msg) => {
                assert_eq!(msg, "Invalid format");
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[test]
    fn test_request_id_generation() {
        let id1 = generate_request_id();
        let id2 = generate_request_id();

        assert_ne!(id1, id2);
        assert!(uuid::Uuid::parse_str(&id1).is_ok());
        assert!(uuid::Uuid::parse_str(&id2).is_ok());
    }
}