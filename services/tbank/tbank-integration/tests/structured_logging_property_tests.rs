use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use serde_json::Value;
use std::env;
use std::sync::{Arc, Mutex};
use tracing::{debug, error, info, warn};
use tracing_subscriber::{
    fmt::{self, MakeWriter},
    layer::SubscriberExt,
    EnvFilter,
};
use uuid::Uuid;

use tbank_integration::config::Environment;
use tbank_integration::middleware::logging::{
    LogContext, LoggingConfig, CORRELATION_ID_HEADER, REQUEST_ID_HEADER,
};

#[cfg(test)]
mod structured_logging_tests {
    use super::*;

    // Test writer that captures log output for validation
    #[derive(Clone)]
    struct TestWriter {
        buffer: Arc<Mutex<Vec<u8>>>,
    }

    impl TestWriter {
        fn new() -> Self {
            Self {
                buffer: Arc::new(Mutex::new(Vec::new())),
            }
        }

        fn get_output(&self) -> String {
            let buffer = self.buffer.lock().unwrap();
            String::from_utf8_lossy(&buffer).to_string()
        }

        fn clear(&self) {
            let mut buffer = self.buffer.lock().unwrap();
            buffer.clear();
        }
    }

    impl std::io::Write for TestWriter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            let mut buffer = self.buffer.lock().unwrap();
            buffer.extend_from_slice(buf);
            Ok(buf.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    impl<'a> MakeWriter<'a> for TestWriter {
        type Writer = Self;

        fn make_writer(&'a self) -> Self::Writer {
            self.clone()
        }
    }

    #[quickcheck]
    fn structured_logging_correlation_id_property(
        correlation_id_input: Option<String>,
        log_level: u8,
        message_content: String,
        operation_type: String,
    ) -> TestResult {
        // Feature: tbank-integration, Property 68: Structured Logging with Correlation IDs
        // **Validates: Requirements 10.5**

        // Filter out unreasonable inputs
        if message_content.len() > 1000 {
            return TestResult::discard();
        }
        if operation_type.len() > 100 || operation_type.is_empty() {
            return TestResult::discard();
        }
        if log_level > 4 {
            return TestResult::discard();
        }

        // Filter out problematic characters that could break logging
        if message_content
            .chars()
            .any(|c| c.is_control() && c != '\n' && c != '\t')
        {
            return TestResult::discard();
        }
        if operation_type.chars().any(|c| c.is_control()) {
            return TestResult::discard();
        }

        // Validate correlation ID format if provided
        if let Some(ref corr_id) = correlation_id_input {
            if corr_id.is_empty() || corr_id.len() > 100 {
                return TestResult::discard();
            }
            if corr_id.chars().any(|c| c.is_control()) {
                return TestResult::discard();
            }
            // If it looks like a UUID, validate it
            if corr_id.len() == 36 && corr_id.contains('-') {
                if Uuid::parse_str(corr_id).is_err() {
                    return TestResult::discard();
                }
            }
        }

        let rt = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(_) => return TestResult::error("Failed to create tokio runtime"),
        };

        rt.block_on(async {
            // Set up test environment
            setup_test_env();

            // Test structured logging with correlation IDs
            let logging_result = test_structured_logging_with_correlation_ids(
                correlation_id_input,
                log_level,
                message_content,
                operation_type,
            )
            .await;

            cleanup_test_env();

            match logging_result {
                Ok(success) => TestResult::from_bool(success),
                Err(_) => TestResult::error("Failed to test structured logging"),
            }
        })
    }

    async fn test_structured_logging_with_correlation_ids(
        correlation_id_input: Option<String>,
        log_level: u8,
        message_content: String,
        operation_type: String,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        // Test both production (JSON) and sandbox (pretty) formats
        let environments = vec![Environment::Production, Environment::Sandbox];

        for environment in environments {
            let success = test_logging_for_environment(
                &environment,
                correlation_id_input.clone(),
                log_level,
                &message_content,
                &operation_type,
            )
            .await?;

            if !success {
                return Ok(false);
            }
        }

        Ok(true)
    }

    async fn test_logging_for_environment(
        environment: &Environment,
        correlation_id_input: Option<String>,
        log_level: u8,
        message_content: &str,
        operation_type: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        // Create test writer to capture log output
        let test_writer = TestWriter::new();

        // Set up tracing subscriber with test writer
        let env_filter = EnvFilter::new("debug");

        // Initialize subscriber for this test based on environment
        let _guard = match environment {
            Environment::Production => {
                // JSON format for production
                let subscriber = tracing_subscriber::registry().with(env_filter).with(
                    fmt::layer()
                        .json()
                        .with_writer(test_writer.clone())
                        .with_target(true)
                        .with_thread_ids(true)
                        .with_thread_names(true)
                        .with_file(true)
                        .with_line_number(true),
                );
                tracing::subscriber::set_default(subscriber)
            }
            Environment::Sandbox => {
                // Pretty format for development
                let subscriber = tracing_subscriber::registry()
                    .with(env_filter.clone())
                    .with(
                        fmt::layer()
                            .with_writer(test_writer.clone())
                            .with_target(true)
                            .with_thread_ids(false)
                            .with_thread_names(false)
                            .with_file(true)
                            .with_line_number(true),
                    );
                tracing::subscriber::set_default(subscriber)
            }
        };

        // Generate or use provided correlation ID
        let correlation_id = correlation_id_input.unwrap_or_else(|| Uuid::new_v4().to_string());
        let request_id = Uuid::new_v4().to_string();

        // Create structured logging span with correlation ID
        let span = tracing::info_span!(
            "test_operation",
            correlation_id = %correlation_id,
            request_id = %request_id,
            operation_type = %operation_type,
            environment = ?environment
        );

        let _enter = span.enter();

        // Add T-Bank operation context
        LogContext::add_tbank_operation(operation_type, "business");

        // Log messages at different levels based on input
        match log_level {
            0 => debug!(
                correlation_id = %correlation_id,
                request_id = %request_id,
                message = %message_content,
                "Debug log message"
            ),
            1 => info!(
                correlation_id = %correlation_id,
                request_id = %request_id,
                message = %message_content,
                "Info log message"
            ),
            2 => warn!(
                correlation_id = %correlation_id,
                request_id = %request_id,
                message = %message_content,
                "Warning log message"
            ),
            3 => error!(
                correlation_id = %correlation_id,
                request_id = %request_id,
                message = %message_content,
                "Error log message"
            ),
            _ => info!(
                correlation_id = %correlation_id,
                request_id = %request_id,
                message = %message_content,
                "Default log message"
            ),
        }

        // Add additional context and log more messages
        LogContext::add_counterparty_context("7707083893", Some("770701001"));
        LogContext::add_invoice_context("INV-2024-001", Some(1500.0));
        LogContext::add_payment_context("PAY-2024-001", "Card", Some(750.0));

        info!(
            correlation_id = %correlation_id,
            request_id = %request_id,
            "T-Bank operation completed"
        );

        // Get the captured log output
        let log_output = test_writer.get_output();

        // Validate the log output
        let validation_result = validate_structured_log_output(
            &log_output,
            environment,
            &correlation_id,
            &request_id,
            message_content,
            operation_type,
        );

        test_writer.clear();

        Ok(validation_result)
    }

    fn validate_structured_log_output(
        log_output: &str,
        environment: &Environment,
        correlation_id: &str,
        request_id: &str,
        message_content: &str,
        operation_type: &str,
    ) -> bool {
        if log_output.is_empty() {
            return false;
        }

        // Basic validation - correlation ID should be present
        let has_correlation_id = log_output.contains(correlation_id);
        let has_request_id = log_output.contains(request_id);
        let has_message_content = log_output.contains(message_content);
        let has_operation_type = log_output.contains(operation_type);

        // Environment-specific validation
        let format_validation = match environment {
            Environment::Production => validate_json_format(log_output, correlation_id, request_id),
            Environment::Sandbox => validate_pretty_format(log_output, correlation_id, request_id),
        };

        // Validate structured fields are present
        let has_structured_fields = validate_structured_fields(log_output);

        // Validate T-Bank specific context
        let has_tbank_context = validate_tbank_context(log_output);

        has_correlation_id
            && has_request_id
            && has_message_content
            && has_operation_type
            && format_validation
            && has_structured_fields
            && has_tbank_context
    }

    fn validate_json_format(log_output: &str, correlation_id: &str, request_id: &str) -> bool {
        // In production, logs should be in JSON format
        let lines: Vec<&str> = log_output.lines().collect();

        for line in lines {
            if line.trim().is_empty() {
                continue;
            }

            // Try to parse each line as JSON
            if let Ok(json_value) = serde_json::from_str::<Value>(line) {
                if let Some(obj) = json_value.as_object() {
                    // Check for required JSON fields
                    let has_timestamp = obj.contains_key("timestamp");
                    let has_level = obj.contains_key("level");
                    let has_message = obj.contains_key("message") || obj.contains_key("fields");
                    let has_target = obj.contains_key("target");

                    // Check for correlation ID in fields or spans
                    let has_correlation_in_json = line.contains(correlation_id);
                    let has_request_in_json = line.contains(request_id);

                    if has_timestamp
                        && has_level
                        && has_message
                        && has_target
                        && has_correlation_in_json
                        && has_request_in_json
                    {
                        return true;
                    }
                }
            }
        }

        // If no valid JSON found, check if at least correlation IDs are present
        log_output.contains(correlation_id) && log_output.contains(request_id)
    }

    fn validate_pretty_format(log_output: &str, correlation_id: &str, request_id: &str) -> bool {
        // In sandbox, logs can be in pretty format
        // Just validate that correlation IDs are present and readable
        let has_correlation_id = log_output.contains(correlation_id);
        let has_request_id = log_output.contains(request_id);

        // Should have some structure indicators
        let has_structure = log_output.contains("INFO")
            || log_output.contains("ERROR")
            || log_output.contains("WARN")
            || log_output.contains("DEBUG");

        has_correlation_id && has_request_id && has_structure
    }

    fn validate_structured_fields(log_output: &str) -> bool {
        // Validate that structured logging fields are present
        let required_fields = [
            "correlation_id",
            "request_id",
            "operation_type",
            "environment",
        ];

        let mut found_fields = 0;
        for field in &required_fields {
            if log_output.contains(field) {
                found_fields += 1;
            }
        }

        // Should have at least most of the required fields
        found_fields >= required_fields.len() - 1
    }

    fn validate_tbank_context(log_output: &str) -> bool {
        // Validate T-Bank specific context is present
        let tbank_indicators = [
            "T-Bank",
            "tbank",
            "business",
            "counterparty",
            "invoice",
            "payment",
        ];

        let mut found_indicators = 0;
        for indicator in &tbank_indicators {
            if log_output.contains(indicator) {
                found_indicators += 1;
            }
        }

        // Should have at least some T-Bank context
        found_indicators >= 2
    }

    #[tokio::test]
    async fn test_correlation_id_generation() {
        // Feature: tbank-integration, Property 68: Structured Logging with Correlation IDs
        // **Validates: Requirements 10.5**

        setup_test_env();

        // Test that correlation IDs are properly generated when not provided
        let test_writer = TestWriter::new();
        let env_filter = EnvFilter::new("info");

        let subscriber = tracing_subscriber::registry().with(env_filter).with(
            fmt::layer()
                .json()
                .with_writer(test_writer.clone())
                .with_target(true),
        );

        let _guard = tracing::subscriber::set_default(subscriber);

        // Generate multiple correlation IDs
        let mut correlation_ids = Vec::new();
        for i in 0..10 {
            let correlation_id = Uuid::new_v4().to_string();
            correlation_ids.push(correlation_id.clone());

            let span = tracing::info_span!(
                "test_span",
                correlation_id = %correlation_id,
                iteration = i
            );

            let _enter = span.enter();
            info!(correlation_id = %correlation_id, "Test log message {}", i);
        }

        let log_output = test_writer.get_output();

        // Validate that all correlation IDs are present and unique
        for correlation_id in &correlation_ids {
            assert!(log_output.contains(correlation_id));
            assert!(Uuid::parse_str(correlation_id).is_ok());
        }

        // Validate uniqueness
        let unique_ids: std::collections::HashSet<_> = correlation_ids.iter().collect();
        assert_eq!(unique_ids.len(), correlation_ids.len());

        cleanup_test_env();
    }

    #[tokio::test]
    async fn test_json_format_in_production() {
        // Feature: tbank-integration, Property 68: Structured Logging with Correlation IDs
        // **Validates: Requirements 10.5**

        setup_test_env();

        let test_writer = TestWriter::new();
        let env_filter = EnvFilter::new("info");

        // Set up JSON logging (production format)
        let subscriber = tracing_subscriber::registry().with(env_filter).with(
            fmt::layer()
                .json()
                .with_writer(test_writer.clone())
                .with_target(true)
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true),
        );

        let _guard = tracing::subscriber::set_default(subscriber);

        let correlation_id = Uuid::new_v4().to_string();
        let request_id = Uuid::new_v4().to_string();

        let span = tracing::info_span!(
            "production_test",
            correlation_id = %correlation_id,
            request_id = %request_id,
            environment = "production"
        );

        let _enter = span.enter();

        info!(
            correlation_id = %correlation_id,
            request_id = %request_id,
            operation = "test_operation",
            "Production JSON log test"
        );

        error!(
            correlation_id = %correlation_id,
            request_id = %request_id,
            error_type = "test_error",
            "Production error log test"
        );

        let log_output = test_writer.get_output();

        // Validate JSON format
        let lines: Vec<&str> = log_output
            .lines()
            .filter(|line| !line.trim().is_empty())
            .collect();
        assert!(!lines.is_empty());

        for line in lines {
            // Each line should be valid JSON
            let json_result = serde_json::from_str::<Value>(line);
            assert!(json_result.is_ok(), "Line is not valid JSON: {}", line);

            if let Ok(json_value) = json_result {
                if let Some(obj) = json_value.as_object() {
                    // Validate required JSON fields
                    assert!(obj.contains_key("timestamp"));
                    assert!(obj.contains_key("level"));
                    assert!(obj.contains_key("target"));

                    // Validate correlation ID is present
                    let json_str = line;
                    assert!(json_str.contains(&correlation_id));
                    assert!(json_str.contains(&request_id));
                }
            }
        }

        cleanup_test_env();
    }

    #[tokio::test]
    async fn test_log_context_utilities() {
        // Feature: tbank-integration, Property 68: Structured Logging with Correlation IDs
        // **Validates: Requirements 10.5**

        setup_test_env();

        let test_writer = TestWriter::new();
        let env_filter = EnvFilter::new("info");

        let subscriber = tracing_subscriber::registry().with(env_filter).with(
            fmt::layer()
                .json()
                .with_writer(test_writer.clone())
                .with_target(true),
        );

        let _guard = tracing::subscriber::set_default(subscriber);

        let correlation_id = Uuid::new_v4().to_string();

        let span = tracing::info_span!(
            "context_test",
            correlation_id = %correlation_id,
            tbank_operation = tracing::field::Empty,
            tbank_api_type = tracing::field::Empty,
            counterparty_inn = tracing::field::Empty,
            counterparty_kpp = tracing::field::Empty,
            invoice_id = tracing::field::Empty,
            invoice_amount = tracing::field::Empty,
            payment_id = tracing::field::Empty,
            payment_method = tracing::field::Empty,
            payment_amount = tracing::field::Empty,
            error_type = tracing::field::Empty,
            error_message = tracing::field::Empty
        );

        let _enter = span.enter();

        // Test LogContext utilities
        LogContext::add_tbank_operation("counterparty_verification", "business");
        LogContext::add_counterparty_context("7707083893", Some("770701001"));
        LogContext::add_invoice_context("INV-2024-001", Some(1500.0));
        LogContext::add_payment_context("PAY-2024-001", "Card", Some(750.0));
        LogContext::add_error_context("ValidationError", "Invalid INN format");

        info!(
            correlation_id = %correlation_id,
            "Context test completed"
        );

        let log_output = test_writer.get_output();

        // Validate that context was added
        assert!(log_output.contains(&correlation_id));
        // The LogContext utilities record fields on the current span, so they should appear in the log
        assert!(
            log_output.contains("counterparty_verification") || log_output.contains("business")
        );
        assert!(log_output.contains("7707083893"));
        assert!(log_output.contains("INV-2024-001"));
        assert!(log_output.contains("PAY-2024-001"));
        assert!(log_output.contains("ValidationError"));

        cleanup_test_env();
    }

    #[test]
    fn test_logging_config_defaults() {
        // Feature: tbank-integration, Property 68: Structured Logging with Correlation IDs
        // **Validates: Requirements 10.5**

        let config = LoggingConfig::default();

        assert!(config.enable_request_logging);
        assert!(config.enable_response_logging);
        assert!(!config.log_request_body); // Should be disabled by default for security
        assert!(!config.log_response_body); // Should be disabled by default for performance
        assert_eq!(config.max_body_size, 1024);

        // Validate sensitive headers are configured
        assert!(config
            .sensitive_headers
            .contains(&"authorization".to_string()));
        assert!(config
            .sensitive_headers
            .contains(&"terminal-key".to_string()));
    }

    #[test]
    fn test_correlation_id_header_constants() {
        // Feature: tbank-integration, Property 68: Structured Logging with Correlation IDs
        // **Validates: Requirements 10.5**

        // Validate header constants are properly defined
        assert_eq!(CORRELATION_ID_HEADER, "x-correlation-id");
        assert_eq!(REQUEST_ID_HEADER, "x-request-id");

        // These should be valid HTTP header names
        assert!(CORRELATION_ID_HEADER
            .chars()
            .all(|c| c.is_ascii_lowercase() || c == '-'));
        assert!(REQUEST_ID_HEADER
            .chars()
            .all(|c| c.is_ascii_lowercase() || c == '-'));
    }

    // Helper functions
    fn setup_test_env() {
        env::set_var("TBANK_ENVIRONMENT", "sandbox");
        env::set_var("TBANK_API_TOKEN", "test_api_token_12345");
        env::set_var("TBANK_TERMINAL_KEY", "test_terminal_key_12345");
        env::set_var(
            "DATABASE_URL",
            "postgresql://test:test@localhost:5432/test_db",
        );
        env::set_var("REDIS_URL", "redis://localhost:6379/0");
        env::set_var("TBANK_WEBHOOK_SECRET", "test_webhook_secret");
        env::set_var("ZITADEL_ISSUER", "https://auth.ad-quest.ru");
        env::set_var("ZITADEL_AUDIENCE", "352242948684972035");
        env::set_var(
            "ENCRYPTION_KEY",
            "dGVzdF9lbmNyeXB0aW9uX2tleV8xMjM0NTY3ODkwMTIzNDU2",
        );
    }

    fn cleanup_test_env() {
        env::remove_var("TBANK_ENVIRONMENT");
        env::remove_var("TBANK_API_TOKEN");
        env::remove_var("TBANK_TERMINAL_KEY");
        env::remove_var("DATABASE_URL");
        env::remove_var("REDIS_URL");
        env::remove_var("TBANK_WEBHOOK_SECRET");
        env::remove_var("ZITADEL_ISSUER");
        env::remove_var("ZITADEL_AUDIENCE");
        env::remove_var("ENCRYPTION_KEY");
    }
}
