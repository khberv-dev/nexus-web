use std::env;
use std::process::Command;

/// Integration test runner with proper setup and teardown
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Starting T-Bank Integration Tests");

    // Set up test environment
    setup_test_environment();

    // Check prerequisites
    if !check_prerequisites().await {
        println!("❌ Prerequisites not met. Skipping integration tests.");
        return Ok(());
    }

    // Set up test database
    if let Err(e) = setup_test_database().await {
        println!(
            "⚠️  Database setup failed: {}. Some tests may be skipped.",
            e
        );
    }

    // Set up test Redis
    if let Err(e) = setup_test_redis().await {
        println!("⚠️  Redis setup failed: {}. Some tests may be skipped.", e);
    }

    // Run integration tests
    println!("🧪 Running integration tests...");

    let test_result = Command::new("cargo")
        .args(&["test", "--test", "integration_tests", "--", "--nocapture"])
        .current_dir(".")
        .status()?;

    if test_result.success() {
        println!("✅ All integration tests passed!");
    } else {
        println!("❌ Some integration tests failed!");
        std::process::exit(1);
    }

    // Cleanup
    cleanup_test_environment().await;

    println!("🏁 Integration tests completed");
    Ok(())
}

/// Set up test environment variables
fn setup_test_environment() {
    println!("🔧 Setting up test environment...");

    // Core configuration
    env::set_var("TBANK_ENVIRONMENT", "sandbox");
    env::set_var("TBANK_API_TOKEN", "test_token_for_integration_tests");
    env::set_var("TBANK_TERMINAL_KEY", "test_terminal_key");
    env::set_var("TBANK_WEBHOOK_SECRET", "test_webhook_secret");

    // Database configuration
    env::set_var(
        "DATABASE_URL",
        env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/tbank_test".to_string()),
    );

    // Redis configuration
    env::set_var(
        "REDIS_URL",
        env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379/1".to_string()),
    );

    // Encryption key (base64 encoded 32 bytes)
    env::set_var(
        "TBANK_ENCRYPTION_KEY",
        "dGVzdF9lbmNyeXB0aW9uX2tleV8zMl9ieXRlc19sb25n",
    );

    // Zitadel configuration
    env::set_var("ZITADEL_ISSUER", "https://auth.ad-quest.ru");
    env::set_var("ZITADEL_AUDIENCE", "352242948684972035");
    env::set_var("TBANK_USE_ZITADEL", "false"); // Disable for tests

    // Rate limiting (lower for tests)
    env::set_var("TBANK_RATE_LIMIT_COUNTERPARTY", "10");
    env::set_var("TBANK_RATE_LIMIT_B2B_INVOICES", "20");
    env::set_var("TBANK_RATE_LIMIT_ACQUIRING_PAYMENTS", "50");
    env::set_var("TBANK_RATE_LIMIT_BALANCE", "30");
    env::set_var("TBANK_RATE_LIMIT_RECONCILIATION", "5");
    env::set_var("TBANK_RATE_LIMIT_AUDIT", "10");

    // Logging
    env::set_var("TBANK_LOG_LEVEL", "debug");
    env::set_var("RUST_LOG", "tbank_integration=debug,sqlx=warn");

    println!("✅ Test environment configured");
}

/// Check if prerequisites are available
async fn check_prerequisites() -> bool {
    println!("🔍 Checking prerequisites...");

    let mut all_good = true;

    // Check PostgreSQL
    match tokio::process::Command::new("psql")
        .args(&["--version"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            println!("✅ PostgreSQL client available");
        }
        _ => {
            println!("⚠️  PostgreSQL client not found. Database tests may fail.");
            // Don't fail completely, tests can handle missing DB
        }
    }

    // Check Redis
    match tokio::process::Command::new("redis-cli")
        .args(&["--version"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            println!("✅ Redis client available");
        }
        _ => {
            println!("⚠️  Redis client not found. Cache tests may fail.");
            // Don't fail completely, tests can handle missing Redis
        }
    }

    // Check Rust/Cargo
    match tokio::process::Command::new("cargo")
        .args(&["--version"])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            println!("✅ Cargo available");
        }
        _ => {
            println!("❌ Cargo not found. Cannot run tests.");
            all_good = false;
        }
    }

    all_good
}

/// Set up test database
async fn setup_test_database() -> Result<(), Box<dyn std::error::Error>> {
    println!("🗄️  Setting up test database...");

    use tbank_integration::tests::TestDatabase;

    let test_db = TestDatabase::new();

    // Try to migrate
    match test_db.migrate().await {
        Ok(_) => {
            println!("✅ Test database ready");
            Ok(())
        }
        Err(e) => {
            println!("⚠️  Database migration failed: {}", e);
            Err(e.into())
        }
    }
}

/// Set up test Redis
async fn setup_test_redis() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔴 Setting up test Redis...");

    use tbank_integration::tests::TestRedis;

    let test_redis = TestRedis::new();

    // Try to flush
    match test_redis.flush().await {
        Ok(_) => {
            println!("✅ Test Redis ready");
            Ok(())
        }
        Err(e) => {
            println!("⚠️  Redis flush failed: {}", e);
            Err(e.into())
        }
    }
}

/// Clean up test environment
async fn cleanup_test_environment() {
    println!("🧹 Cleaning up test environment...");

    // Clean up database
    if let Ok(test_db) = std::panic::catch_unwind(|| {
        use tbank_integration::tests::TestDatabase;
        TestDatabase::new()
    }) {
        if let Err(e) = test_db.cleanup().await {
            println!("⚠️  Database cleanup failed: {}", e);
        } else {
            println!("✅ Database cleaned up");
        }
    }

    // Clean up Redis
    if let Ok(test_redis) = std::panic::catch_unwind(|| {
        use tbank_integration::tests::TestRedis;
        TestRedis::new()
    }) {
        if let Err(e) = test_redis.flush().await {
            println!("⚠️  Redis cleanup failed: {}", e);
        } else {
            println!("✅ Redis cleaned up");
        }
    }

    println!("✅ Cleanup completed");
}
