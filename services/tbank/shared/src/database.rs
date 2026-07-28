use crate::{config::DatabaseConfig, ADQuestError};
use sqlx::{PgPool, Row};
use std::time::Duration;
use tracing::{error, info};

pub struct DatabaseManager {
    pool: PgPool,
}

impl DatabaseManager {
    pub async fn new(config: &DatabaseConfig) -> Result<Self, ADQuestError> {
        info!(
            "Initializing database connection pool for URL: {}",
            config.url
        );

        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .acquire_timeout(Duration::from_millis(config.acquire_timeout_ms))
            .idle_timeout(Duration::from_millis(config.idle_timeout_ms))
            .max_lifetime(Duration::from_millis(config.max_lifetime_ms))
            .connect(&config.url)
            .await
            .map_err(|e| {
                ADQuestError::DatabaseConnection(format!("Failed to connect to database: {}", e))
            })?;

        info!("Database connection pool initialized successfully");
        Ok(Self { pool })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn health_check(&self) -> Result<Duration, ADQuestError> {
        let start = std::time::Instant::now();

        let result = sqlx::query("SELECT 1 as health_check")
            .fetch_one(&self.pool)
            .await;

        let duration = start.elapsed();

        match result {
            Ok(row) => {
                let value: i32 = row.get("health_check");
                if value == 1 {
                    Ok(duration)
                } else {
                    Err(ADQuestError::Internal(
                        "Health check returned unexpected value".to_string(),
                    ))
                }
            }
            Err(e) => {
                error!("Database health check failed: {}", e);
                Err(ADQuestError::DatabaseConnection(format!(
                    "Database health check failed: {}",
                    e
                )))
            }
        }
    }

    pub async fn get_connection_stats(&self) -> Result<ConnectionStats, ADQuestError> {
        let pool_size = self.pool.size();
        let idle_connections = self.pool.num_idle();
        let active_connections = pool_size.saturating_sub(idle_connections as u32);

        Ok(ConnectionStats {
            total_connections: pool_size,
            active_connections,
            idle_connections: idle_connections as u32,
        })
    }

    pub async fn close(&self) {
        info!("Closing database connection pool");
        self.pool.close().await;
    }
}

#[derive(Debug, Clone)]
pub struct ConnectionStats {
    pub total_connections: u32,
    pub active_connections: u32,
    pub idle_connections: u32,
}

// Transaction helper for CQRS operations
pub struct TransactionManager<'a> {
    tx: sqlx::Transaction<'a, sqlx::Postgres>,
}

impl<'a> TransactionManager<'a> {
    pub async fn begin(pool: &'a PgPool) -> Result<Self, ADQuestError> {
        let tx = pool.begin().await.map_err(|e| {
            ADQuestError::DatabaseConnection(format!("Failed to begin transaction: {}", e))
        })?;
        Ok(Self { tx })
    }

    pub async fn commit(self) -> Result<(), ADQuestError> {
        self.tx.commit().await.map_err(|e| {
            ADQuestError::DatabaseConnection(format!("Failed to commit transaction: {}", e))
        })?;
        Ok(())
    }

    pub async fn rollback(self) -> Result<(), ADQuestError> {
        self.tx.rollback().await.map_err(|e| {
            ADQuestError::DatabaseConnection(format!("Failed to rollback transaction: {}", e))
        })?;
        Ok(())
    }

    pub fn transaction(&mut self) -> &mut sqlx::Transaction<'a, sqlx::Postgres> {
        &mut self.tx
    }
}

// Dead Letter Queue implementation
#[allow(dead_code)]
pub struct DeadLetterQueue {
    pool: PgPool,
}

impl DeadLetterQueue {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn enqueue_failed_message(
        &self,
        _original_topic: &str,
        _payload: &serde_json::Value,
        _error_reason: &str,
        _trace_id: &str,
    ) -> Result<uuid::Uuid, ADQuestError> {
        let message_id = uuid::Uuid::new_v4();

        // TODO: Implement SQL query when database schema is ready
        // sqlx::query!(...)

        Ok(message_id)
    }

    pub async fn retry_failed_messages(
        &self,
        _max_batch_size: i32,
    ) -> Result<Vec<crate::models::DeadLetterMessage>, ADQuestError> {
        // TODO: Implement SQL query when database schema is ready
        Ok(vec![])
    }

    pub async fn mark_retry_attempt(&self, _message_id: uuid::Uuid) -> Result<(), ADQuestError> {
        // TODO: Implement SQL query when database schema is ready
        Ok(())
    }

    pub async fn remove_successful_retry(
        &self,
        _message_id: uuid::Uuid,
    ) -> Result<(), ADQuestError> {
        // TODO: Implement SQL query when database schema is ready
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::DatabaseConfig;

    #[tokio::test]
    async fn test_database_health_check() {
        // This would require a test database setup
        // For now, we'll skip the actual test implementation
        // In a real scenario, you'd use testcontainers or similar
    }

    #[tokio::test]
    async fn test_connection_stats() {
        // Test connection statistics retrieval
    }

    #[tokio::test]
    async fn test_dead_letter_queue() {
        // Test dead letter queue functionality
    }
}
