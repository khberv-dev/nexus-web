use futures;
use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use sqlx::Row;
use std::env;
use std::time::Duration;
use tbank_integration::config::TBankConfig;
use tbank_integration::services::TBankServices;
use tokio::time::timeout;

#[cfg(test)]
mod connection_pool_tests {
    use super::*;

    #[quickcheck]
    fn connection_pool_management_property(
        concurrent_operations: u8,
        operation_duration_ms: u16,
    ) -> TestResult {
        // Feature: tbank-integration, Property 71: Connection Pool Management
        // **Validates: Requirements 10.8**

        // Filter out extreme values to keep tests reasonable
        let concurrent_ops = (concurrent_operations % 50) + 1; // 1-50 concurrent operations
        let duration_ms = (operation_duration_ms % 1000) + 10; // 10-1010ms duration

        // Skip if too many concurrent operations for testing
        if concurrent_ops > 30 {
            return TestResult::discard();
        }

        let rt = match tokio::runtime::Runtime::new() {
            Ok(rt) => rt,
            Err(_) => return TestResult::error("Failed to create tokio runtime"),
        };

        rt.block_on(async {
            // Set up test environment
            setup_test_env();

            let config_result = TBankConfig::from_env();
            cleanup_test_env();

            let config = match config_result {
                Ok(c) => c,
                Err(_) => return TestResult::error("Failed to create config"),
            };

            // Create services with connection pooling
            let services = match TBankServices::new(config).await {
                Ok(s) => s,
                Err(_) => return TestResult::error("Failed to create services"),
            };

            // Test PostgreSQL connection pool management
            let pg_pool_test = test_postgresql_pool_management(
                &services,
                concurrent_ops as usize,
                Duration::from_millis(duration_ms as u64),
            )
            .await;

            // Test Redis connection pool management
            let redis_pool_test = test_redis_pool_management(
                &services,
                concurrent_ops as usize,
                Duration::from_millis(duration_ms as u64),
            )
            .await;

            // Test connection lifecycle management
            let lifecycle_test = test_connection_lifecycle_management(&services).await;

            // Test pool metrics availability
            let metrics_test = test_pool_metrics_availability(&services).await;

            TestResult::from_bool(pg_pool_test && redis_pool_test && lifecycle_test && metrics_test)
        })
    }

    #[tokio::test]
    async fn test_postgresql_connection_pool_limits() {
        // Feature: tbank-integration, Property 71: Connection Pool Management
        // **Validates: Requirements 10.8**

        setup_test_env();
        let config = TBankConfig::from_env().unwrap();
        let services = TBankServices::new(config).await.unwrap();
        cleanup_test_env();

        let db_pool = services.db_pool();

        // Test that pool respects max connections limit (20)
        assert!(
            db_pool.size() <= 20,
            "PostgreSQL pool size should not exceed 20 connections"
        );

        // Test that pool can handle concurrent operations
        let mut handles = Vec::new();

        for i in 0..15 {
            let pool = db_pool.clone();
            let handle = tokio::spawn(async move {
                let result = timeout(
                    Duration::from_secs(5),
                    sqlx::query("SELECT 1 as test_value").fetch_one(&pool),
                )
                .await;

                match result {
                    Ok(Ok(row)) => {
                        let value: i32 = row.get("test_value");
                        value == 1
                    }
                    _ => false,
                }
            });
            handles.push(handle);
        }

        let results: Vec<bool> = futures::future::join_all(handles)
            .await
            .into_iter()
            .map(|r| r.unwrap_or(false))
            .collect();

        // At least 80% of operations should succeed
        let success_rate = results.iter().filter(|&&r| r).count() as f64 / results.len() as f64;
        assert!(
            success_rate >= 0.8,
            "Success rate should be at least 80%, got {}",
            success_rate
        );
    }

    #[tokio::test]
    async fn test_redis_connection_pool_limits() {
        // Feature: tbank-integration, Property 71: Connection Pool Management
        // **Validates: Requirements 10.8**

        setup_test_env();
        let config = TBankConfig::from_env().unwrap();
        let services = TBankServices::new(config).await.unwrap();
        cleanup_test_env();

        let cache_manager = services.cache_manager();

        // Test Redis connection pool through cache operations
        let mut handles = Vec::new();

        for i in 0..15 {
            let cache = cache_manager.clone();
            let key = format!("test_key_{}", i);
            let value = format!("test_value_{}", i);

            let handle = tokio::spawn(async move {
                let set_result = timeout(
                    Duration::from_secs(5),
                    cache.set(&key, &value, Some(Duration::from_secs(60))),
                )
                .await;

                if set_result.is_err() || set_result.unwrap().is_err() {
                    return false;
                }

                let get_result = timeout(Duration::from_secs(5), cache.get::<String>(&key)).await;

                match get_result {
                    Ok(Ok(Some(retrieved_value))) => retrieved_value == value,
                    _ => false,
                }
            });
            handles.push(handle);
        }

        let results: Vec<bool> = futures::future::join_all(handles)
            .await
            .into_iter()
            .map(|r| r.unwrap_or(false))
            .collect();

        // At least 80% of operations should succeed
        let success_rate = results.iter().filter(|&&r| r).count() as f64 / results.len() as f64;
        assert!(
            success_rate >= 0.8,
            "Redis success rate should be at least 80%, got {}",
            success_rate
        );
    }

    #[tokio::test]
    async fn test_connection_lifecycle_management_unit() {
        // Feature: tbank-integration, Property 71: Connection Pool Management
        // **Validates: Requirements 10.8**

        setup_test_env();
        let config = TBankConfig::from_env().unwrap();
        let services = TBankServices::new(config).await.unwrap();
        cleanup_test_env();

        let db_pool = services.db_pool();

        // Test connection acquisition and release
        let initial_idle = db_pool.num_idle();

        // Acquire a connection
        let conn_result = timeout(Duration::from_secs(5), db_pool.acquire()).await;

        assert!(conn_result.is_ok(), "Should be able to acquire connection");
        let conn = conn_result.unwrap();
        assert!(conn.is_ok(), "Connection should be valid");

        // Connection should be automatically returned to pool when dropped
        drop(conn);

        // Give some time for connection to be returned to pool
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Pool should have same or more idle connections
        let final_idle = db_pool.num_idle();
        assert!(
            final_idle >= initial_idle,
            "Connection should be returned to pool"
        );
    }

    #[tokio::test]
    async fn test_pool_metrics_availability_unit() {
        // Feature: tbank-integration, Property 71: Connection Pool Management
        // **Validates: Requirements 10.8**

        setup_test_env();
        let config = TBankConfig::from_env().unwrap();
        let services = TBankServices::new(config).await.unwrap();
        cleanup_test_env();

        let db_pool = services.db_pool();

        // Test that pool metrics are available
        let pool_size = db_pool.size();
        let idle_connections = db_pool.num_idle();

        // Pool should have reasonable metrics
        assert!(pool_size > 0, "Pool size should be greater than 0");
        assert!(
            pool_size <= 20,
            "Pool size should not exceed 20 connections"
        );
        assert!(
            idle_connections <= pool_size as usize,
            "Idle connections should not exceed pool size"
        );

        // Test that metrics change with usage
        let initial_idle = db_pool.num_idle();

        // Use a connection
        let _conn = db_pool.acquire().await.unwrap();
        let during_use_idle = db_pool.num_idle();

        // Idle connections should decrease when connection is in use
        assert!(
            during_use_idle <= initial_idle,
            "Idle connections should decrease when connection is acquired"
        );
    }

    #[tokio::test]
    async fn test_connection_pool_error_handling() {
        // Feature: tbank-integration, Property 71: Connection Pool Management
        // **Validates: Requirements 10.8**

        setup_test_env();
        let config = TBankConfig::from_env().unwrap();
        let services = TBankServices::new(config).await.unwrap();
        cleanup_test_env();

        let db_pool = services.db_pool();

        // Test that pool handles connection errors gracefully
        let result = timeout(
            Duration::from_secs(1),
            sqlx::query("SELECT * FROM non_existent_table").fetch_one(&*db_pool),
        )
        .await;

        // Should get an error, but pool should remain functional
        assert!(result.is_ok(), "Query should complete (even if with error)");
        assert!(
            result.unwrap().is_err(),
            "Query should return an error for non-existent table"
        );

        // Pool should still be functional after error
        let health_check = timeout(
            Duration::from_secs(5),
            sqlx::query("SELECT 1 as health_check").fetch_one(&*db_pool),
        )
        .await;

        assert!(
            health_check.is_ok(),
            "Pool should remain functional after error"
        );
        assert!(
            health_check.unwrap().is_ok(),
            "Health check query should succeed"
        );
    }

    // Helper functions for property tests
    async fn test_postgresql_pool_management(
        services: &TBankServices,
        concurrent_ops: usize,
        operation_duration: Duration,
    ) -> bool {
        let db_pool = services.db_pool();
        let mut handles = Vec::new();

        for _ in 0..concurrent_ops {
            let pool = db_pool.clone();
            let duration = operation_duration;

            let handle = tokio::spawn(async move {
                let result = timeout(Duration::from_secs(10), async {
                    let _conn = pool.acquire().await?;
                    tokio::time::sleep(duration).await;
                    sqlx::query("SELECT 1").fetch_one(&pool).await
                })
                .await;

                result.is_ok() && result.unwrap().is_ok()
            });
            handles.push(handle);
        }

        let results: Vec<bool> = futures::future::join_all(handles)
            .await
            .into_iter()
            .map(|r| r.unwrap_or(false))
            .collect();

        // At least 70% should succeed under concurrent load
        let success_rate = results.iter().filter(|&&r| r).count() as f64 / results.len() as f64;
        success_rate >= 0.7
    }

    async fn test_redis_pool_management(
        services: &TBankServices,
        concurrent_ops: usize,
        operation_duration: Duration,
    ) -> bool {
        let cache_manager = services.cache_manager();
        let mut handles = Vec::new();

        for i in 0..concurrent_ops {
            let cache = cache_manager.clone();
            let key = format!("pool_test_{}", i);
            let value = format!("value_{}", i);
            let duration = operation_duration;

            let handle = tokio::spawn(async move {
                tokio::time::sleep(duration).await;

                let set_result = timeout(
                    Duration::from_secs(10),
                    cache.set(&key, &value, Some(Duration::from_secs(60))),
                )
                .await;

                set_result.is_ok() && set_result.unwrap().is_ok()
            });
            handles.push(handle);
        }

        let results: Vec<bool> = futures::future::join_all(handles)
            .await
            .into_iter()
            .map(|r| r.unwrap_or(false))
            .collect();

        // At least 70% should succeed under concurrent load
        let success_rate = results.iter().filter(|&&r| r).count() as f64 / results.len() as f64;
        success_rate >= 0.7
    }

    async fn test_connection_lifecycle_management(services: &TBankServices) -> bool {
        let db_pool = services.db_pool();

        // Test connection acquisition and release cycle
        let initial_idle = db_pool.num_idle();

        // Acquire multiple connections
        let mut connections = Vec::new();
        for _ in 0..3 {
            match timeout(Duration::from_secs(5), db_pool.acquire()).await {
                Ok(Ok(conn)) => connections.push(conn),
                _ => return false,
            }
        }

        // Idle connections should decrease
        let during_use_idle = db_pool.num_idle();
        if during_use_idle >= initial_idle {
            return false;
        }

        // Release connections
        drop(connections);

        // Give time for connections to return to pool
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Idle connections should increase back
        let final_idle = db_pool.num_idle();
        final_idle >= during_use_idle
    }

    async fn test_pool_metrics_availability(services: &TBankServices) -> bool {
        let db_pool = services.db_pool();

        // Test that metrics are available and reasonable
        let pool_size = db_pool.size();
        let idle_connections = db_pool.num_idle();

        // Basic sanity checks
        pool_size > 0 && pool_size <= 20 && idle_connections <= pool_size as usize
    }

    // Helper functions for test environment setup
    fn setup_test_env() {
        env::set_var("TBANK_ENVIRONMENT", "sandbox");
        env::set_var("TBANK_API_TOKEN", "test_api_token_12345");
        env::set_var("TBANK_TERMINAL_KEY", "test_terminal_key_12345");
        env::set_var(
            "DATABASE_URL",
            "postgresql://postgres:password@localhost:5432/tbank_test",
        );
        env::set_var("REDIS_URL", "redis://localhost:6379/1");
        env::set_var("TBANK_WEBHOOK_SECRET", "test_secret");
        env::set_var("ZITADEL_ISSUER", "https://auth.ad-quest.ru");
        env::set_var("ZITADEL_AUDIENCE", "352242948684972035");
        env::set_var(
            "TBANK_ENCRYPTION_KEY",
            "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
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
        env::remove_var("TBANK_ENCRYPTION_KEY");
    }
}
