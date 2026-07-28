use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};

use shared::auth::AuthContext;

use super::{
    audit::log_error_for_audit,
    responses::create_status_error_response,
};

/// T-Bank unified error handling middleware
pub async fn tbank_error_middleware(request: Request, next: Next) -> Result<Response, Response> {
    // Get auth context for error logging
    let auth_context = request.extensions().get::<AuthContext>().cloned();
    let request_path = request.uri().path().to_string();
    let request_method = request.method().to_string();

    // Process request and handle any errors
    let response = next.run(request).await;

    // If response is an error, convert it to proper JSON format
    if response.status().is_client_error() || response.status().is_server_error() {
        let status = response.status();

        // Log error for audit purposes
        log_error_for_audit(
            auth_context.as_ref(),
            &request_method,
            &request_path,
            status,
        );

        // Convert to standardized error response
        let error_response = create_status_error_response(status);

        return Err((status, Json(error_response)).into_response());
    }

    Ok(response)
}