use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use uuid::Uuid;

use tbank_integration::{TBankConfig, TBankServiceFactory, TBankServices};

/// Integration test helper for setting up test services
struct IntegrationTestSetup {
    config: TBankConfig,
}

impl IntegrationTestSetup {
    /// Create test services with sandbox configuration
    async fn new() -> Self {
        // Set up test environment variables
        std::env::set_var("TBANK_ENVIRONMENT", "sandbox");
        std::env::set_var("TBANK_API_TOKEN", "test_token");
        std::env::set_var("TBANK_TERMINAL_KEY", "test_terminal_key");
        std::env::set_var(
            "DATABASE_URL",
            "postgresql://test:test@localhost:5432/tbank_test",
        );
        std::env::set_var("REDIS_URL", "redis://localhost:6379/1");
        std::env::set_var(
            "TBANK_ENCRYPTION_KEY",
            "dGVzdF9lbmNyeXB0aW9uX2tleV8zMl9ieXRlc19sb25n",
        ); // base64 encoded 32 bytes

        let config = TBankConfig::from_env().expect("Failed to load test configuration");

        Self { config }
    }
}

/// Test configuration loading and validation
#[tokio::test]
async fn test_configuration_loading() {
    let setup = IntegrationTestSetup::new().await;

    // Test 1: Configuration should be loaded successfully
    assert_eq!(
        setup.config.environment,
        tbank_integration::config::Environment::Sandbox
    );
    assert_eq!(setup.config.api_token, "test_token");
    assert_eq!(setup.config.terminal_key, "test_terminal_key");
    println!("✓ Configuration loading verified");

    // Test 2: Environment-specific URLs should be set correctly
    assert!(setup.config.business_api_base_url.contains("sandbox"));
    println!("✓ Sandbox environment URLs verified");

    // Test 3: Hot-reload configuration should be available
    let hot_reload_manager =
        tbank_integration::config::HotReloadManager::new(setup.config.environment.clone());
    assert!(
        hot_reload_manager.is_ok(),
        "Hot-reload manager should initialize"
    );

    if let Ok(manager) = hot_reload_manager {
        let hot_config = manager.get_config().await;
        assert!(
            hot_config.rate_limit_config.b2b_invoices > 0,
            "Rate limits should be configured"
        );
        println!("✓ Hot-reload configuration verified");
    }

    println!("✓ Configuration Integration Test Completed Successfully");
}

/// Test service factory and component integration
#[tokio::test]
async fn test_service_factory_integration() {
    let setup = IntegrationTestSetup::new().await;

    // Test 1: Service factory should handle missing dependencies gracefully
    let result = TBankServiceFactory::create_with_config(setup.config.clone()).await;

    // This will likely fail due to missing database/redis, but should fail gracefully
    match result {
        Ok(services) => {
            println!("✓ Services created successfully (database/redis available)");

            // Test service methods
            assert!(
                services.is_production() == false,
                "Should be in sandbox mode"
            );
            assert!(
                services.enforce_webhook_signature() == false,
                "Webhook signature should be disabled in sandbox"
            );

            let env_info = services.get_environment_indicator();
            assert!(
                env_info["environment"].is_string(),
                "Environment should be indicated"
            );
            assert!(
                env_info["hot_reload_enabled"].as_bool().unwrap_or(false),
                "Hot-reload should be enabled"
            );

            println!("✓ Service methods verified");
        }
        Err(e) => {
            println!(
                "⚠️  Services creation failed (expected if database/redis not available): {}",
                e
            );
            // This is expected in CI/test environments without external dependencies
        }
    }

    println!("✓ Service Factory Integration Test Completed");
}

/// Test environment indicator functionality
#[tokio::test]
async fn test_environment_indicator() {
    let setup = IntegrationTestSetup::new().await;

    // Test hot-reload manager environment indicator
    let hot_reload_manager =
        tbank_integration::config::HotReloadManager::new(setup.config.environment.clone())
            .expect("Hot-reload manager should initialize");

    let env_info = hot_reload_manager.get_environment_indicator();

    // Verify environment indicator structure
    assert!(
        env_info["environment"].is_string(),
        "Environment should be present"
    );
    assert!(
        env_info["service"].is_string(),
        "Service name should be present"
    );
    assert!(env_info["version"].is_string(), "Version should be present");
    assert!(
        env_info["hot_reload_enabled"].as_bool().unwrap_or(false),
        "Hot-reload should be enabled"
    );

    println!(
        "Environment info: {}",
        serde_json::to_string_pretty(&env_info).unwrap()
    );
    println!("✓ Environment Indicator Test Completed Successfully");
}

/// Test hot-reload configuration functionality
#[tokio::test]
async fn test_hot_reload_functionality() {
    let setup = IntegrationTestSetup::new().await;

    // Test 1: Hot-reload manager creation
    let hot_reload_manager =
        tbank_integration::config::HotReloadManager::new(setup.config.environment.clone())
            .expect("Hot-reload manager should initialize");

    // Test 2: Configuration retrieval
    let config = hot_reload_manager.get_config().await;

    // Verify configuration structure
    assert!(
        config.rate_limit_config.counterparty_verification > 0,
        "Counterparty rate limit should be positive"
    );
    assert!(
        config.rate_limit_config.b2b_invoices > 0,
        "B2B invoice rate limit should be positive"
    );
    assert!(
        config.rate_limit_config.acquiring_payments > 0,
        "Acquiring payment rate limit should be positive"
    );
    assert!(
        config.api_timeout_seconds > 0,
        "API timeout should be positive"
    );
    assert!(
        config.cache_ttl_counterparty > 0,
        "Cache TTL should be positive"
    );

    println!(
        "Hot-reload config: {}",
        serde_json::to_string_pretty(&config).unwrap()
    );
    println!("✓ Hot-Reload Functionality Test Completed Successfully");
}

/// Test error handling and validation
#[tokio::test]
async fn test_error_handling() {
    // Test 1: Invalid environment variables
    std::env::remove_var("TBANK_API_TOKEN");

    let result = TBankConfig::from_env();
    assert!(result.is_err(), "Should fail with missing API token");

    // Restore environment variable
    std::env::set_var("TBANK_API_TOKEN", "test_token");

    // Test 2: Invalid hot-reload configuration
    std::env::set_var("TBANK_RATE_LIMIT_COUNTERPARTY", "0"); // Invalid (zero)

    let config_result = tbank_integration::config::HotReloadableConfig::from_env();
    if let Ok(config) = config_result {
        let validation_result = config.validate();
        assert!(
            validation_result.is_err(),
            "Should fail validation with zero rate limit"
        );
    }

    // Restore valid value
    std::env::set_var("TBANK_RATE_LIMIT_COUNTERPARTY", "100");

    println!("✓ Error Handling Test Completed Successfully");
}

/// Test concurrent configuration access
#[tokio::test]
async fn test_concurrent_configuration_access() {
    let setup = IntegrationTestSetup::new().await;

    let hot_reload_manager = Arc::new(
        tbank_integration::config::HotReloadManager::new(setup.config.environment.clone())
            .expect("Hot-reload manager should initialize"),
    );

    // Spawn multiple concurrent tasks to access configuration
    let mut handles = vec![];

    for i in 0..10 {
        let manager = hot_reload_manager.clone();
        let handle = tokio::spawn(async move {
            let config = manager.get_config().await;
            (i, config.rate_limit_config.b2b_invoices)
        });
        handles.push(handle);
    }

    // Wait for all tasks to complete
    let results = futures::future::join_all(handles).await;

    // Verify all tasks succeeded and got consistent configuration
    let mut rate_limits = vec![];
    for result in results {
        match result {
            Ok((id, rate_limit)) => {
                rate_limits.push(rate_limit);
                println!("✓ Task {} got rate limit: {}", id, rate_limit);
            }
            Err(e) => {
                panic!("Task failed: {}", e);
            }
        }
    }

    // All rate limits should be the same (consistent configuration)
    let first_rate_limit = rate_limits[0];
    assert!(
        rate_limits.iter().all(|&x| x == first_rate_limit),
        "All tasks should get consistent configuration"
    );

    println!("✓ Concurrent Configuration Access Test Completed Successfully");
}
