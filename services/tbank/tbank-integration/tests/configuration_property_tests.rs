use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use std::env;
use tbank_integration::config::{Environment, TBankConfig};
use tbank_integration::types::TBankError;

#[cfg(test)]
mod configuration_tests {
    use super::*;

    // Helper function to set up test environment variables
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
        env::set_var(
            "TBANK_ENCRYPTION_KEY",
            "dGVzdF9lbmNyeXB0aW9uX2tleV8zMl9ieXRlc19sb24=",
        );
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
        env::remove_var("TBANK_ENCRYPTION_KEY");
        env::remove_var("TBANK_BUSINESS_API_BASE_URL");
        env::remove_var("ZITADEL_ISSUER");
        env::remove_var("ZITADEL_AUDIENCE");
    }

    #[quickcheck]
    fn configuration_validation_and_fail_fast_property(
        api_token: String,
        terminal_key: String,
        database_url: String,
        redis_url: String,
    ) -> TestResult {
        // Feature: tbank-integration, Property 78: Configuration Validation and Fail-Fast
        // **Validates: Requirements 11.13**

        // Filter out strings with null bytes or other invalid characters for Windows environment variables
        let api_token_clean = api_token
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect::<String>();
        let terminal_key_clean = terminal_key
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect::<String>();
        let database_url_clean = database_url
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect::<String>();
        let redis_url_clean = redis_url
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect::<String>();

        // Skip empty strings as they're not meaningful for this test
        if api_token_clean.trim().is_empty()
            || terminal_key_clean.trim().is_empty()
            || database_url_clean.trim().is_empty()
            || redis_url_clean.trim().is_empty()
        {
            return TestResult::discard();
        }

        // Test with valid configuration
        setup_test_env(
            "sandbox",
            &api_token_clean,
            &terminal_key_clean,
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let valid_result = TBankConfig::from_env();
        cleanup_test_env();

        // Test with invalid database URL
        setup_test_env(
            "sandbox",
            &api_token_clean,
            &terminal_key_clean,
            &database_url_clean,
            "redis://localhost:6379",
        );

        let invalid_db_result = TBankConfig::from_env();
        cleanup_test_env();

        // Test with invalid Redis URL
        setup_test_env(
            "sandbox",
            &api_token_clean,
            &terminal_key_clean,
            "postgresql://user:pass@localhost/db",
            &redis_url_clean,
        );

        let invalid_redis_result = TBankConfig::from_env();
        cleanup_test_env();

        // Valid configuration should succeed
        let valid_config_works = valid_result.is_ok();

        // Invalid database URL should fail if it doesn't start with postgresql:// or postgres://
        let invalid_db_fails = if !database_url_clean.starts_with("postgresql://")
            && !database_url_clean.starts_with("postgres://")
        {
            invalid_db_result.is_err()
        } else {
            true // If URL format is correct, we don't expect it to fail on format validation
        };

        // Invalid Redis URL should fail if it doesn't start with redis:// or rediss://
        let invalid_redis_fails = if !redis_url_clean.starts_with("redis://")
            && !redis_url_clean.starts_with("rediss://")
        {
            invalid_redis_result.is_err()
        } else {
            true // If URL format is correct, we don't expect it to fail on format validation
        };

        TestResult::from_bool(valid_config_works && invalid_db_fails && invalid_redis_fails)
    }

    #[test]
    fn test_configuration_fail_fast_on_missing_required_vars() {
        // Feature: tbank-integration, Property 78: Configuration Validation and Fail-Fast
        // **Validates: Requirements 11.13**

        cleanup_test_env();

        // Test missing API token
        env::set_var("TBANK_ENVIRONMENT", "sandbox");
        // Don't set TBANK_API_TOKEN
        env::set_var("TBANK_TERMINAL_KEY", "test_key");
        env::set_var("DATABASE_URL", "postgresql://user:pass@localhost/db");
        env::set_var("REDIS_URL", "redis://localhost:6379");
        env::set_var(
            "TBANK_ENCRYPTION_KEY",
            "dGVzdF9lbmNyeXB0aW9uX2tleV8zMl9ieXRlc19sb24=",
        );

        let result = TBankConfig::from_env();
        assert!(result.is_err());

        if let Err(TBankError::ConfigurationError(msg)) = result {
            assert!(msg.contains("TBANK_API_TOKEN"));
        } else {
            panic!("Expected ConfigurationError for missing API token");
        }

        cleanup_test_env();
    }

    #[test]
    fn test_environment_detection() {
        // Ensure clean state
        cleanup_test_env();

        // Test sandbox environment
        setup_test_env(
            "sandbox",
            "test_token",
            "test_key",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let config = TBankConfig::from_env().unwrap();
        assert_eq!(config.environment, Environment::Sandbox);
        assert!(config.business_api_base_url.contains("sandbox"));

        cleanup_test_env();

        // Test production environment
        setup_test_env(
            "production",
            "test_token",
            "test_key",
            "postgresql://user:pass@localhost/db",
            "redis://localhost:6379",
        );

        let config = TBankConfig::from_env().unwrap();
        assert_eq!(config.environment, Environment::Production);
        assert!(!config.business_api_base_url.contains("sandbox"));

        cleanup_test_env();
    }

    #[test]
    fn test_configuration_validation_edge_cases() {
        cleanup_test_env();

        // Test empty API token
        env::set_var("TBANK_ENVIRONMENT", "sandbox");
        env::set_var("TBANK_API_TOKEN", "");
        env::set_var("TBANK_TERMINAL_KEY", "test_key");
        env::set_var("DATABASE_URL", "postgresql://user:pass@localhost/db");
        env::set_var("REDIS_URL", "redis://localhost:6379");

        let result = TBankConfig::from_env();
        assert!(result.is_err());
        cleanup_test_env();

        // Test empty terminal key
        env::set_var("TBANK_ENVIRONMENT", "sandbox");
        env::set_var("TBANK_API_TOKEN", "test_token");
        env::set_var("TBANK_TERMINAL_KEY", "");
        env::set_var("DATABASE_URL", "postgresql://user:pass@localhost/db");
        env::set_var("REDIS_URL", "redis://localhost:6379");

        let result = TBankConfig::from_env();
        assert!(result.is_err());
        cleanup_test_env();

        // Test invalid Zitadel issuer URL
        env::set_var("TBANK_ENVIRONMENT", "sandbox");
        env::set_var("TBANK_API_TOKEN", "test_token");
        env::set_var("TBANK_TERMINAL_KEY", "test_key");
        env::set_var("DATABASE_URL", "postgresql://user:pass@localhost/db");
        env::set_var("REDIS_URL", "redis://localhost:6379");
        env::set_var("ZITADEL_ISSUER", "invalid-url");

        let result = TBankConfig::from_env();
        assert!(result.is_err());
        cleanup_test_env();
    }
}
