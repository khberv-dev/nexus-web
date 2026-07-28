use crate::{
    config::{DatabaseConfig, RedisConfig},
    ADQuestError, CacheManager, DatabaseManager,
};
use std::sync::Arc;

/// Create a mock DatabaseManager for testing
/// This is a placeholder that returns an error - in real tests you'd use testcontainers
pub async fn create_mock_database() -> Result<Arc<DatabaseManager>, ADQuestError> {
    Err(ADQuestError::Internal(
        "Mock database not implemented - use testcontainers for real tests".to_string(),
    ))
}

/// Create a mock CacheManager for testing
/// This is a placeholder that returns an error - in real tests you'd use a test Redis instance
pub async fn create_mock_cache() -> Result<Arc<CacheManager>, ADQuestError> {
    Err(ADQuestError::Internal(
        "Mock cache not implemented - use test Redis for real tests".to_string(),
    ))
}

/// Create mock database config for testing
pub fn create_mock_database_config() -> DatabaseConfig {
    DatabaseConfig {
        url: "postgresql://test:test@localhost:5432/test_db".to_string(),
        max_connections: 5,
        min_connections: 1,
        acquire_timeout_ms: 1000,
        idle_timeout_ms: 30000,
        max_lifetime_ms: 60000,
    }
}

/// Create mock Redis config for testing
pub fn create_mock_redis_config() -> RedisConfig {
    RedisConfig {
        url: "redis://localhost:6379".to_string(),
        pool_size: 5,
        connection_timeout_ms: 1000,
        command_timeout_ms: 500,
    }
}

/// Create a mock DatabaseManager synchronously for tests (returns error)
/// Use this in tests that don't have async context
pub fn create_sync_mock_database() -> Arc<DatabaseManager> {
    // This is a hack for tests - we can't actually create a real DatabaseManager
    // without async context, so we'll create a dummy one that will fail if used
    panic!("Mock database cannot be created synchronously - use async test or mock the service directly")
}

/// Create a mock CacheManager synchronously for tests (returns error)
/// Use this in tests that don't have async context
pub fn create_sync_mock_cache() -> Arc<CacheManager> {
    // This is a hack for tests - we can't actually create a real CacheManager
    // without async context, so we'll create a dummy one that will fail if used
    panic!(
        "Mock cache cannot be created synchronously - use async test or mock the service directly"
    )
}
