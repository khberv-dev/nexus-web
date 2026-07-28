#[cfg(test)]
mod tests {
    use super::super::{
        context::{extract_or_generate_correlation_id, extract_client_ip, CORRELATION_ID_HEADER},
        utils::{extract_endpoint_pattern, get_status_class, StatusClass},
        config::LoggingConfig,
    };
    use axum::http::{HeaderMap, HeaderValue};
    use uuid::Uuid;

    #[test]
    fn test_extract_correlation_id_existing() {
        let mut headers = HeaderMap::new();
        headers.insert(
            CORRELATION_ID_HEADER,
            HeaderValue::from_static("test-correlation-id"),
        );

        let correlation_id = extract_or_generate_correlation_id(&headers);
        assert_eq!(correlation_id, "test-correlation-id");
    }

    #[test]
    fn test_extract_correlation_id_generate() {
        let headers = HeaderMap::new();
        let correlation_id = extract_or_generate_correlation_id(&headers);

        // Should be a valid UUID
        assert!(Uuid::parse_str(&correlation_id).is_ok());
    }

    #[test]
    fn test_extract_client_ip() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("192.168.1.1, 10.0.0.1"),
        );

        let client_ip = extract_client_ip(&headers);
        assert_eq!(client_ip, "192.168.1.1");
    }

    #[test]
    fn test_extract_client_ip_unknown() {
        let headers = HeaderMap::new();
        let client_ip = extract_client_ip(&headers);
        assert_eq!(client_ip, "unknown");
    }

    #[test]
    fn test_extract_endpoint_pattern() {
        assert_eq!(
            extract_endpoint_pattern("/api/v1/invoices/b2b/123"),
            "/api/v1/invoices/b2b/{id}"
        );

        assert_eq!(
            extract_endpoint_pattern("/api/v1/counterparties/7707083893?include=details"),
            "/api/v1/counterparties/{id}"
        );

        assert_eq!(
            extract_endpoint_pattern("/api/v1/payments/550e8400-e29b-41d4-a716-446655440000"),
            "/api/v1/payments/{uuid}"
        );
    }

    #[test]
    fn test_status_class() {
        assert_eq!(get_status_class(200), StatusClass::Success);
        assert_eq!(get_status_class(201), StatusClass::Success);
        assert_eq!(get_status_class(404), StatusClass::ClientError);
        assert_eq!(get_status_class(400), StatusClass::ClientError);
        assert_eq!(get_status_class(500), StatusClass::ServerError);
        assert_eq!(get_status_class(503), StatusClass::ServerError);
        assert_eq!(get_status_class(301), StatusClass::Other);
        assert_eq!(get_status_class(100), StatusClass::Other);
    }

    #[test]
    fn test_logging_config_default() {
        let config = LoggingConfig::default();
        
        assert!(config.enable_request_logging);
        assert!(config.enable_response_logging);
        assert!(!config.log_request_body);
        assert!(!config.log_response_body);
        assert_eq!(config.max_body_size, 1024);
        assert!(config.sensitive_headers.contains(&"authorization".to_string()));
    }

    #[test]
    fn test_logging_config_builder() {
        let config = LoggingConfig::new()
            .with_request_logging(false)
            .with_response_logging(true)
            .with_request_body_logging(true)
            .with_max_body_size(2048);

        assert!(!config.enable_request_logging);
        assert!(config.enable_response_logging);
        assert!(config.log_request_body);
        assert_eq!(config.max_body_size, 2048);
    }

    #[test]
    fn test_sensitive_header_detection() {
        let config = LoggingConfig::default();
        
        assert!(config.is_sensitive_header("authorization"));
        assert!(config.is_sensitive_header("Authorization"));
        assert!(config.is_sensitive_header("AUTHORIZATION"));
        assert!(config.is_sensitive_header("x-api-key"));
        assert!(!config.is_sensitive_header("content-type"));
        assert!(!config.is_sensitive_header("user-agent"));
    }

    #[test]
    fn test_extract_correlation_id_from_trace_id() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-trace-id",
            HeaderValue::from_static("trace-123"),
        );

        let correlation_id = extract_or_generate_correlation_id(&headers);
        assert_eq!(correlation_id, "trace-123");
    }

    #[test]
    fn test_extract_client_ip_cloudflare() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "cf-connecting-ip",
            HeaderValue::from_static("203.0.113.1"),
        );

        let client_ip = extract_client_ip(&headers);
        assert_eq!(client_ip, "203.0.113.1");
    }

    #[test]
    fn test_extract_client_ip_priority() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("192.168.1.1"),
        );
        headers.insert(
            "x-real-ip",
            HeaderValue::from_static("10.0.0.1"),
        );

        let client_ip = extract_client_ip(&headers);
        // x-forwarded-for should have priority
        assert_eq!(client_ip, "192.168.1.1");
    }
}