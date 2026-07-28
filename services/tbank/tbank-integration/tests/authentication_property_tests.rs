use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use std::env;
use std::sync::Arc;
use tbank_integration::client::TBankClient;
use tbank_integration::config::{Environment, TBankConfig};

#[cfg(test)]
mod authentication_tests {
    use super::*;

    #[quickcheck]
    fn counterparty_api_authentication_property(
        api_token: String,
        terminal_key: String,
    ) -> TestResult {
        // Feature: tbank-integration, Property 2: Counterparty API Authentication
        // **Validates: Requirements 1.2**

        // Filter out strings with null bytes or control characters
        let clean_api_token: String = api_token
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect();
        let clean_terminal_key: String = terminal_key
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect();

        // Skip empty or very short tokens as they're not valid
        if clean_api_token.trim().is_empty() || clean_api_token.len() < 10 {
            return TestResult::discard();
        }
        if clean_terminal_key.trim().is_empty() || clean_terminal_key.len() < 10 {
            return TestResult::discard();
        }

        // Skip extremely long tokens to avoid performance issues
        if clean_api_token.len() > 1000 || clean_terminal_key.len() > 1000 {
            return TestResult::discard();
        }

        // Set up test environment
        setup_test_env(
            "sandbox",
            &clean_api_token,
            &clean_terminal_key,
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let config_result = TBankConfig::from_env();
        cleanup_test_env();

        let config = match config_result {
            Ok(c) => Arc::new(c),
            Err(_) => return TestResult::error("Failed to create config"),
        };

        // Create T-Bank client
        let client = match TBankClient::new(config) {
            Ok(c) => c,
            Err(_) => return TestResult::error("Failed to create T-Bank client"),
        };

        // Test counterparty authentication context
        let auth_context = client.counterparty_auth();

        // Verify that authentication context includes Bearer token
        let has_bearer = auth_context.has_bearer();

        // Verify that authentication context includes proper headers
        let has_environment_header = auth_context
            .additional_headers
            .contains_key("X-Environment");
        let has_user_agent = auth_context.additional_headers.contains_key("User-Agent");

        // Test creating authenticated request
        let request_result =
            client.request_with_auth(reqwest::Method::GET, "/counterparty/verify", &auth_context);

        let request_created = request_result.is_ok();

        // Test authentication validation
        let auth_validation = client.validate_auth();
        let auth_valid = auth_validation.is_ok();

        TestResult::from_bool(
            has_bearer && has_environment_header && has_user_agent && request_created && auth_valid,
        )
    }

    #[test]
    fn test_authentication_context_types() {
        // Feature: tbank-integration, Property 2: Counterparty API Authentication
        // **Validates: Requirements 1.2**

        setup_test_env(
            "sandbox",
            "test_api_token_12345",
            "test_terminal_key_12345",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let config = Arc::new(TBankConfig::from_env().unwrap());
        let client = TBankClient::new(config).unwrap();

        cleanup_test_env();

        // Test counterparty authentication (Bearer only)
        let counterparty_auth = client.counterparty_auth();
        assert!(counterparty_auth.has_bearer());
        assert!(!counterparty_auth.has_terminal_key());

        // Test payment authentication (Bearer + Terminal-Key)
        let payment_auth = client.payment_auth();
        assert!(payment_auth.has_bearer());
        assert!(payment_auth.has_terminal_key());

        // Test invoice authentication (Bearer + Terminal-Key)
        let invoice_auth = client.invoice_auth();
        assert!(invoice_auth.has_bearer());
        assert!(invoice_auth.has_terminal_key());

        // Test balance authentication (Bearer only)
        let balance_auth = client.balance_auth();
        assert!(balance_auth.has_bearer());
        assert!(!balance_auth.has_terminal_key());
    }

    #[test]
    fn test_authentication_validation() {
        // Feature: tbank-integration, Property 2: Counterparty API Authentication
        // **Validates: Requirements 1.2**

        // Test with valid credentials
        setup_test_env(
            "sandbox",
            "valid_api_token_12345",
            "valid_terminal_key_12345",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let config = Arc::new(TBankConfig::from_env().unwrap());
        let client = TBankClient::new(config).unwrap();

        cleanup_test_env();

        // Validation should pass for valid credentials
        assert!(client.validate_auth().is_ok());

        // Test with invalid credentials (too short)
        setup_test_env(
            "sandbox",
            "short",
            "short",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let config = Arc::new(TBankConfig::from_env().unwrap());
        let client_result = TBankClient::new(config);

        cleanup_test_env();

        // Client creation should fail with invalid credentials
        assert!(client_result.is_err());
    }

    #[test]
    fn test_environment_specific_authentication() {
        // Feature: tbank-integration, Property 2: Counterparty API Authentication
        // **Validates: Requirements 1.2**

        // Test sandbox environment
        setup_test_env(
            "sandbox",
            "sandbox_api_token_12345",
            "sandbox_terminal_key_12345",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let sandbox_config = Arc::new(TBankConfig::from_env().unwrap());
        let sandbox_client = TBankClient::new(sandbox_config).unwrap();

        cleanup_test_env();

        assert!(sandbox_client.is_sandbox());
        assert!(!sandbox_client.is_production());
        assert!(sandbox_client.base_url.contains("sandbox"));

        // Test production environment
        setup_test_env(
            "production",
            "prod_api_token_12345",
            "prod_terminal_key_12345",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let prod_config = Arc::new(TBankConfig::from_env().unwrap());
        let prod_client = TBankClient::new(prod_config).unwrap();

        cleanup_test_env();

        assert!(!prod_client.is_sandbox());
        assert!(prod_client.is_production());
        assert!(!prod_client.base_url.contains("sandbox"));
    }

    #[test]
    fn test_authentication_headers() {
        // Feature: tbank-integration, Property 2: Counterparty API Authentication
        // **Validates: Requirements 1.2**

        setup_test_env(
            "sandbox",
            "test_api_token_12345",
            "test_terminal_key_12345",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let config = Arc::new(TBankConfig::from_env().unwrap());
        let client = TBankClient::new(config).unwrap();

        cleanup_test_env();

        // Test that authenticated request includes proper headers
        let _request = client.authenticated_request(reqwest::Method::GET, "/test");

        // We can't easily inspect the headers in the RequestBuilder, but we can verify
        // that the request was created successfully
        // In a real test, we would need to mock the HTTP client to inspect headers

        // Test authentication context creation
        let auth_context = client.counterparty_auth();

        // Verify environment header is set
        assert!(auth_context
            .additional_headers
            .contains_key("X-Environment"));
        assert_eq!(
            auth_context
                .additional_headers
                .get("X-Environment")
                .unwrap(),
            "sandbox"
        );

        // Verify user agent is set
        assert!(auth_context.additional_headers.contains_key("User-Agent"));
        assert_eq!(
            auth_context.additional_headers.get("User-Agent").unwrap(),
            "ADQuest-TBank-Integration/1.0"
        );
    }

    // Helper functions for authentication tests
    fn setup_test_env(
        environment: &str,
        api_token: &str,
        terminal_key: &str,
        database_url: &str,
        redis_url: &str,
    ) {
        env::set_var("TBANK_ENVIRONMENT", environment);
        env::set_var("TBANK_API_TOKEN", api_token);
        env::set_var("TBANK_TERMINAL_KEY", terminal_key);
        env::set_var("DATABASE_URL", database_url);
        env::set_var("REDIS_URL", redis_url);
        env::set_var("TBANK_WEBHOOK_SECRET", "test_secret");
        env::set_var("ZITADEL_ISSUER", "https://auth.ad-quest.ru");
        env::set_var("ZITADEL_AUDIENCE", "352242948684972035");
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
    }
}
