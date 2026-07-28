use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use rust_decimal::Decimal;
use std::env;
use std::sync::Arc;
use tbank_integration::client::TBankClient;
use tbank_integration::config::TBankConfig;
use tbank_integration::types::TBankError;

#[cfg(test)]
mod sandbox_environment_tests {
    use super::*;

    // Helper function to set up sandbox test environment
    fn setup_sandbox_env() {
        env::set_var("TBANK_ENVIRONMENT", "sandbox");
        env::set_var("TBANK_API_TOKEN", "sandbox_test_token_12345");
        env::set_var("TBANK_TERMINAL_KEY", "sandbox_test_terminal_key_12345");
        env::set_var("DATABASE_URL", "postgresql://user:pass@localhost/test_db");
        env::set_var("REDIS_URL", "redis://localhost:6379");
        env::set_var("TBANK_WEBHOOK_SECRET", "sandbox_webhook_secret");
        env::set_var("ZITADEL_ISSUER", "https://auth.ad-quest.ru");
        env::set_var("ZITADEL_AUDIENCE", "352242948684972035");
        // 32-byte encryption key for AES-256-GCM (base64 encoded)
        env::set_var(
            "TBANK_ENCRYPTION_KEY",
            "1/tsqqoVyGM2zIFAL2o/+7gTqZte3/xcExXcyj2RiDQ=",
        );
    }

    // Helper function to set up production test environment
    fn setup_production_env() {
        env::set_var("TBANK_ENVIRONMENT", "production");
        env::set_var("TBANK_API_TOKEN", "production_test_token_12345");
        env::set_var("TBANK_TERMINAL_KEY", "production_test_terminal_key_12345");
        env::set_var("DATABASE_URL", "postgresql://user:pass@localhost/prod_db");
        env::set_var("REDIS_URL", "redis://localhost:6379");
        env::set_var("TBANK_WEBHOOK_SECRET", "production_webhook_secret");
        env::set_var("ZITADEL_ISSUER", "https://auth.ad-quest.ru");
        env::set_var("ZITADEL_AUDIENCE", "352242948684972035");
        // 32-byte encryption key for AES-256-GCM (base64 encoded)
        env::set_var(
            "TBANK_ENCRYPTION_KEY",
            "YEXpbNXwG23oC6p/55P1pOOZtNAGwoQ/nMjSpDLtfjo=",
        );
    }

    fn cleanup_test_env() {
        // Remove all environment variables to ensure clean state
        let vars_to_remove = [
            "TBANK_ENVIRONMENT",
            "TBANK_API_TOKEN",
            "TBANK_TERMINAL_KEY",
            "DATABASE_URL",
            "REDIS_URL",
            "TBANK_WEBHOOK_SECRET",
            "ZITADEL_ISSUER",
            "ZITADEL_AUDIENCE",
            "TBANK_ENCRYPTION_KEY",
        ];

        for var in &vars_to_remove {
            env::remove_var(var);
        }

        // Wait a bit to ensure environment changes take effect
        std::thread::sleep(std::time::Duration::from_millis(10));
    }

    #[quickcheck]
    fn sandbox_environment_behavior_property(
        test_inn: String,
        test_account: String,
        test_amount: u64,
    ) -> TestResult {
        // Feature: tbank-integration, Property 76: Sandbox Environment Behavior
        // **Validates: Requirements 11.11**

        // Filter out invalid characters and ensure reasonable test data
        let clean_inn = test_inn
            .chars()
            .filter(|&c| c.is_ascii_digit())
            .take(12)
            .collect::<String>();

        let clean_account = test_account
            .chars()
            .filter(|&c| c.is_ascii_alphanumeric())
            .take(20)
            .collect::<String>();

        // Skip if we don't have meaningful test data
        if clean_inn.len() < 10 || clean_account.len() < 10 || test_amount == 0 {
            return TestResult::discard();
        }

        // Test sandbox environment behavior
        setup_sandbox_env();

        let sandbox_result = test_sandbox_behavior(&clean_inn, &clean_account, test_amount);
        cleanup_test_env();

        // Test production environment behavior (should reject sandbox operations)
        setup_production_env();

        let production_result =
            test_production_rejects_sandbox_operations(&clean_inn, &clean_account);
        cleanup_test_env();

        TestResult::from_bool(sandbox_result && production_result)
    }

    fn test_sandbox_behavior(inn: &str, account: &str, amount: u64) -> bool {
        // Clean up environment first
        cleanup_test_env();
        setup_sandbox_env();

        let config_result = TBankConfig::from_env();
        if config_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let config = Arc::new(config_result.unwrap());
        let client_result = TBankClient::new(config);
        if client_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let client = client_result.unwrap();

        // Verify client is in sandbox mode
        if !client.is_sandbox() || client.is_production() {
            cleanup_test_env();
            return false;
        }

        // Test 1: Sandbox should use predefined counterparty test data
        let predefined_test_data = test_predefined_counterparty_data(&client);

        // Test 2: Sandbox should provide test account data
        let test_account_data = test_predefined_account_data(&client);

        // Test 3: Sandbox should allow test operations without real API calls
        let test_operations = test_sandbox_operations(&client, inn, account, amount);

        // Test 4: Sandbox should have different URLs than production
        let sandbox_urls = test_sandbox_urls(&client);

        cleanup_test_env();
        predefined_test_data && test_account_data && test_operations && sandbox_urls
    }

    fn test_predefined_counterparty_data(client: &TBankClient) -> bool {
        // Test predefined sandbox counterparty data
        let known_test_inns = vec!["7707083893", "1234567890"];
        let error_test_inn = "9999999999";

        for inn in known_test_inns {
            match client.get_sandbox_counterparty(inn) {
                Ok(Some(counterparty)) => {
                    // Verify counterparty has expected structure
                    if counterparty.inn != inn
                        || counterparty.full_name.is_empty()
                        || counterparty.status != "ACTIVE"
                    {
                        return false;
                    }
                }
                Ok(None) => return false, // Should find predefined data
                Err(_) => return false,   // Should not error for known INNs
            }
        }

        // Test that error INN returns error
        match client.get_sandbox_counterparty(error_test_inn) {
            Ok(_) => false, // Should return error for 9999999999
            Err(TBankError::CounterpartyNotFound { .. }) => true,
            Err(_) => false, // Wrong error type
        }
    }

    fn test_predefined_account_data(client: &TBankClient) -> bool {
        let known_test_accounts = vec![
            "40702810110011000000",
            "40702810110011000001",
            "40702810110011000002",
        ];

        for account in known_test_accounts {
            // Test balance retrieval
            match client.get_sandbox_balance(account) {
                Ok(balance) => {
                    // Balance should be non-negative decimal
                    if balance < Decimal::ZERO {
                        return false;
                    }
                }
                Err(_) => return false,
            }

            // Test statement retrieval
            match client.get_sandbox_statement(account) {
                Ok(transactions) => {
                    // Verify transaction structure if any exist
                    for transaction in transactions {
                        if transaction.currency != "RUB"
                            || transaction.description.is_empty()
                            || (transaction.operation_type != "Credit"
                                && transaction.operation_type != "Debit")
                        {
                            return false;
                        }
                    }
                }
                Err(_) => return false,
            }
        }

        true
    }

    fn test_sandbox_operations(
        client: &TBankClient,
        inn: &str,
        _account: &str,
        amount: u64,
    ) -> bool {
        let decimal_amount = Decimal::new(amount as i64, 2);

        // Test sandbox invoice creation (should work without real API)
        if inn.len() >= 10 {
            let padded_inn = format!("{:0<10}", &inn[..std::cmp::min(inn.len(), 10)]);
            match client.create_sandbox_invoice(&padded_inn, decimal_amount) {
                Ok(invoice_number) => {
                    if !invoice_number.starts_with("INV-SANDBOX-") {
                        return false;
                    }
                }
                Err(TBankError::CounterpartyNotFound { .. }) => {
                    // Expected for unknown INNs
                }
                Err(_) => return false,
            }
        }

        // Test sandbox payment initialization (should work without real API)
        match client.initialize_sandbox_payment("test_invoice_123", "Card") {
            Ok(payment_response) => {
                if payment_response.transaction_id.is_empty()
                    || payment_response.payment_url.is_empty()
                    || !payment_response.payment_url.contains("sandbox")
                {
                    return false;
                }
            }
            Err(_) => return false,
        }

        // Test sandbox payment status (should work without real API)
        let test_transaction_ids = vec![
            "success_12345",
            "failed_67890",
            "pending_11111",
            "cancelled_22222",
            "unknown_99999",
        ];

        for transaction_id in test_transaction_ids {
            match client.get_sandbox_payment_status(transaction_id) {
                Ok(status) => {
                    let expected_statuses =
                        vec!["Completed", "Failed", "Pending", "Cancelled", "Initialized"];
                    if !expected_statuses.contains(&status.as_str()) {
                        return false;
                    }
                }
                Err(_) => return false,
            }
        }

        true
    }

    fn test_sandbox_urls(client: &TBankClient) -> bool {
        // Verify sandbox URLs contain "sandbox"
        client.business_base_url().contains("sandbox")
            && client.acquiring_base_url().contains("securepay.tbank.ru")
    }

    fn test_production_rejects_sandbox_operations(inn: &str, _account: &str) -> bool {
        // Clean up environment first
        cleanup_test_env();
        setup_production_env();

        let config_result = TBankConfig::from_env();
        if config_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let config = Arc::new(config_result.unwrap());
        let client_result = TBankClient::new(config);
        if client_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let client = client_result.unwrap();

        // Verify client is in production mode
        if client.is_sandbox() || !client.is_production() {
            cleanup_test_env();
            return false;
        }

        // Test that sandbox operations are rejected in production
        let padded_inn = if inn.len() >= 10 {
            format!("{:0<10}", &inn[..std::cmp::min(inn.len(), 10)])
        } else {
            format!("{:0<10}", inn)
        };

        // Test counterparty sandbox operation rejection
        let result = match client.get_sandbox_counterparty(&padded_inn) {
            Ok(_) => false, // Should not succeed in production
            Err(TBankError::SandboxOperationInProduction) => true,
            Err(_) => false, // Wrong error type
        };

        cleanup_test_env();
        result
    }

    #[quickcheck]
    fn sandbox_test_data_completeness_property(
        _dummy: u8, // Dummy parameter for quickcheck
    ) -> TestResult {
        // Feature: tbank-integration, Property 76: Sandbox Environment Behavior
        // **Validates: Requirements 11.11**

        setup_sandbox_env();

        let result = test_complete_sandbox_test_data();
        cleanup_test_env();

        TestResult::from_bool(result)
    }

    fn test_complete_sandbox_test_data() -> bool {
        // Clean up environment first
        cleanup_test_env();
        setup_sandbox_env();

        let config_result = TBankConfig::from_env();
        if config_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let config = Arc::new(config_result.unwrap());
        let client_result = TBankClient::new(config);
        if client_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let client = client_result.unwrap();

        // Test complete sandbox test data retrieval
        let result = match client.get_sandbox_test_data() {
            Ok(test_data) => {
                // Verify counterparties data
                if test_data.counterparties.len() < 2 {
                    false
                } else {
                    let mut valid = true;
                    for counterparty in &test_data.counterparties {
                        if counterparty.inn.is_empty()
                            || counterparty.full_name.is_empty()
                            || counterparty.status != "ACTIVE"
                        {
                            valid = false;
                            break;
                        }
                    }

                    if !valid {
                        false
                    } else {
                        // Verify accounts data
                        if test_data.accounts.len() < 3 {
                            false
                        } else {
                            let mut accounts_valid = true;
                            for account in &test_data.accounts {
                                if account.account_number.is_empty()
                                    || account.balance < Decimal::ZERO
                                {
                                    accounts_valid = false;
                                    break;
                                }

                                // Verify transaction structure
                                for transaction in &account.transactions {
                                    if transaction.currency != "RUB"
                                        || transaction.description.is_empty()
                                        || (transaction.operation_type != "Credit"
                                            && transaction.operation_type != "Debit")
                                    {
                                        accounts_valid = false;
                                        break;
                                    }
                                }

                                if !accounts_valid {
                                    break;
                                }
                            }
                            accounts_valid
                        }
                    }
                }
            }
            Err(_) => false,
        };

        cleanup_test_env();
        result
    }

    #[quickcheck]
    fn sandbox_security_validation_disabled_property(
        webhook_payload: String,
        signature: String,
    ) -> TestResult {
        // Feature: tbank-integration, Property 76: Sandbox Environment Behavior
        // **Validates: Requirements 11.11**

        // Filter out problematic characters
        let clean_payload = webhook_payload
            .chars()
            .filter(|&c| c.is_ascii_graphic() || c.is_whitespace())
            .take(1000)
            .collect::<String>();

        let clean_signature = signature
            .chars()
            .filter(|&c| c.is_ascii_alphanumeric() || c == '=' || c == '+' || c == '/')
            .take(100)
            .collect::<String>();

        if clean_payload.trim().is_empty() || clean_signature.trim().is_empty() {
            return TestResult::discard();
        }

        // Test sandbox environment (should disable webhook signature validation)
        setup_sandbox_env();
        let sandbox_result =
            test_webhook_signature_validation_disabled(&clean_payload, &clean_signature);
        cleanup_test_env();

        // Test production environment (should require webhook signature validation)
        setup_production_env();
        let production_result =
            test_webhook_signature_validation_required(&clean_payload, &clean_signature);
        cleanup_test_env();

        TestResult::from_bool(sandbox_result && production_result)
    }

    fn test_webhook_signature_validation_disabled(_payload: &str, _signature: &str) -> bool {
        // Clean up environment first
        cleanup_test_env();
        setup_sandbox_env();

        let config_result = TBankConfig::from_env();
        if config_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let config = Arc::new(config_result.unwrap());

        // In sandbox, webhook signature validation should be disabled
        // This means the system should accept webhooks even with invalid signatures
        let result = !config.enforce_webhook_signature();

        cleanup_test_env();
        result
    }

    fn test_webhook_signature_validation_required(_payload: &str, _signature: &str) -> bool {
        // Clean up environment first
        cleanup_test_env();
        setup_production_env();

        let config_result = TBankConfig::from_env();
        if config_result.is_err() {
            cleanup_test_env();
            return false;
        }

        let config = Arc::new(config_result.unwrap());

        // In production, webhook signature validation should be required
        let result = config.enforce_webhook_signature();

        cleanup_test_env();
        result
    }

    // Unit tests for specific sandbox behaviors
    #[test]
    fn test_sandbox_environment_detection() {
        // Clean up any existing environment first
        cleanup_test_env();

        setup_sandbox_env();

        let config = TBankConfig::from_env().expect("Failed to load sandbox config");
        let client = TBankClient::new(Arc::new(config)).expect("Failed to create sandbox client");

        assert!(client.is_sandbox(), "Client should be in sandbox mode");
        assert!(
            !client.is_production(),
            "Client should not be in production mode"
        );
        assert!(
            client.business_base_url().contains("sandbox"),
            "Business URL should contain 'sandbox'"
        );

        cleanup_test_env();
    }

    #[test]
    fn test_production_environment_detection() {
        // Clean up any existing environment first
        cleanup_test_env();

        setup_production_env();

        let config = TBankConfig::from_env().expect("Failed to load production config");
        let client =
            TBankClient::new(Arc::new(config)).expect("Failed to create production client");

        assert!(!client.is_sandbox(), "Client should not be in sandbox mode");
        assert!(
            client.is_production(),
            "Client should be in production mode"
        );
        assert!(
            !client.business_base_url().contains("sandbox"),
            "Business URL should not contain 'sandbox'"
        );

        cleanup_test_env();
    }

    #[test]
    fn test_sandbox_predefined_counterparty_data() {
        // Clean up any existing environment first
        cleanup_test_env();

        setup_sandbox_env();

        let config = TBankConfig::from_env().expect("Failed to load sandbox config");
        let client = TBankClient::new(Arc::new(config)).expect("Failed to create sandbox client");

        // Test known good INNs
        let counterparty1 = client
            .get_sandbox_counterparty("7707083893")
            .expect("Failed to get sandbox counterparty")
            .expect("Counterparty should exist");

        assert_eq!(counterparty1.inn, "7707083893");
        assert_eq!(counterparty1.status, "ACTIVE");
        assert!(!counterparty1.full_name.is_empty());

        let counterparty2 = client
            .get_sandbox_counterparty("1234567890")
            .expect("Failed to get sandbox counterparty")
            .expect("Counterparty should exist");

        assert_eq!(counterparty2.inn, "1234567890");
        assert_eq!(counterparty2.status, "ACTIVE");
        assert!(!counterparty2.full_name.is_empty());

        // Test error INN
        let error_result = client.get_sandbox_counterparty("9999999999");
        assert!(matches!(
            error_result,
            Err(TBankError::CounterpartyNotFound { .. })
        ));

        cleanup_test_env();
    }

    #[test]
    fn test_sandbox_predefined_account_data() {
        // Clean up any existing environment first
        cleanup_test_env();

        setup_sandbox_env();

        let config = TBankConfig::from_env().expect("Failed to load sandbox config");
        let client = TBankClient::new(Arc::new(config)).expect("Failed to create sandbox client");

        // Test known account balances
        let balance1 = client
            .get_sandbox_balance("40702810110011000000")
            .expect("Failed to get sandbox balance");
        assert!(balance1 > Decimal::ZERO);

        let balance2 = client
            .get_sandbox_balance("40702810110011000001")
            .expect("Failed to get sandbox balance");
        assert!(balance2 >= Decimal::ZERO);

        let balance3 = client
            .get_sandbox_balance("40702810110011000002")
            .expect("Failed to get sandbox balance");
        assert_eq!(balance3, Decimal::ZERO);

        // Test account statements
        let statement1 = client
            .get_sandbox_statement("40702810110011000000")
            .expect("Failed to get sandbox statement");
        assert!(!statement1.is_empty());

        let statement2 = client
            .get_sandbox_statement("40702810110011000002")
            .expect("Failed to get sandbox statement");
        assert!(statement2.is_empty()); // Empty account

        cleanup_test_env();
    }
}
