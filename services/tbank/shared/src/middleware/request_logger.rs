use axum::{
    body::Body,
    extract::Request,
    middleware::Next,
    response::Response,
};
use tracing::info;

/// Middleware для логирования запросов
pub async fn log_request_middleware(
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    
    info!("📨 Incoming request: {} {}", method, uri);
    
    let response = next.run(request).await;
    
    let status = response.status();
    info!("📤 Response: {} {} -> {}", method, uri, status);
    
    response
}
