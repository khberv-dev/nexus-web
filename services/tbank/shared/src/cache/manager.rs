use crate::{config::RedisConfig, ADQuestError};
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Client};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::info;

#[derive(Clone)]
#[allow(dead_code)]
pub struct CacheManager {
    client: Client,
    connection_manager: ConnectionManager,
}

impl CacheManager {
    pub async fn new(config: &RedisConfig) -> Result<Self, ADQuestError> {
        info!("Initializing Redis connection manager");

        let client = Client::open(config.url.as_str())
            .map_err(|e| ADQuestError::Cache(format!("Failed to create Redis client: {}", e)))?;

        let connection_manager = ConnectionManager::new(client.clone()).await.map_err(|e| {
            ADQuestError::Cache(format!("Failed to create connection manager: {}", e))
        })?;

        info!("Redis connection manager initialized successfully");
        Ok(Self {
            client,
            connection_manager,
        })
    }

    pub async fn get<T>(&self, key: &str) -> Result<Option<T>, ADQuestError>
    where
        T: for<'de> Deserialize<'de>,
    {
        let mut conn = self.connection_manager.clone();

        let result: Option<String> = conn
            .get(key)
            .await
            .map_err(|e| ADQuestError::Cache(format!("Failed to get key '{}': {}", key, e)))?;

        match result {
            Some(json_str) => {
                let value = serde_json::from_str(&json_str).map_err(|e| {
                    ADQuestError::Cache(format!(
                        "Failed to deserialize value for key '{}': {}",
                        key, e
                    ))
                })?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    pub async fn set<T>(
        &self,
        key: &str,
        value: &T,
        ttl: Option<Duration>,
    ) -> Result<(), ADQuestError>
    where
        T: Serialize,
    {
        let mut conn = self.connection_manager.clone();

        let json_str = serde_json::to_string(value).map_err(|e| {
            ADQuestError::Cache(format!(
                "Failed to serialize value for key '{}': {}",
                key, e
            ))
        })?;

        match ttl {
            Some(duration) => {
                conn.set_ex::<_, _, ()>(key, json_str, duration.as_secs())
                    .await
            }
            None => conn.set::<_, _, ()>(key, json_str).await,
        }
        .map_err(|e| ADQuestError::Cache(format!("Failed to set key '{}': {}", key, e)))?;

        Ok(())
    }

    pub async fn delete(&self, key: &str) -> Result<bool, ADQuestError> {
        let mut conn = self.connection_manager.clone();

        let deleted: i32 = conn
            .del(key)
            .await
            .map_err(|e| ADQuestError::Cache(format!("Failed to delete key '{}': {}", key, e)))?;

        Ok(deleted > 0)
    }

    pub async fn exists(&self, key: &str) -> Result<bool, ADQuestError> {
        let mut conn = self.connection_manager.clone();

        let exists: bool = conn.exists(key).await.map_err(|e| {
            ADQuestError::Cache(format!("Failed to check existence of key '{}': {}", key, e))
        })?;

        Ok(exists)
    }

    pub async fn increment(&self, key: &str, delta: i64) -> Result<i64, ADQuestError> {
        let mut conn = self.connection_manager.clone();

        let result: i64 = conn.incr(key, delta).await.map_err(|e| {
            ADQuestError::Cache(format!("Failed to increment key '{}': {}", key, e))
        })?;

        Ok(result)
    }

    pub async fn expire(&self, key: &str, ttl: Duration) -> Result<bool, ADQuestError> {
        let mut conn = self.connection_manager.clone();

        let result: bool = conn.expire(key, ttl.as_secs() as i64).await.map_err(|e| {
            ADQuestError::Cache(format!("Failed to set expiration for key '{}': {}", key, e))
        })?;

        Ok(result)
    }

    pub async fn health_check(&self) -> Result<Duration, ADQuestError> {
        let start = std::time::Instant::now();
        let mut conn = self.connection_manager.clone();

        // Use a simple GET operation as health check since ping might not be available
        let _: Option<String> = conn
            .get("__health_check__")
            .await
            .map_err(|e| ADQuestError::Cache(format!("Redis health check failed: {}", e)))?;

        Ok(start.elapsed())
    }

    pub async fn get_info(&self) -> Result<RedisInfo, ADQuestError> {
        // For now, return mock data since Redis info command might not be available
        // In a real implementation, this would use the INFO command
        Ok(RedisInfo {
            used_memory_bytes: 0,
            max_memory_bytes: 0,
            memory_usage_percent: 0.0,
        })
    }

    #[allow(dead_code)]
    fn parse_info_value(&self, info: &str, key: &str) -> Option<u64> {
        info.lines()
            .find(|line| line.starts_with(key))
            .and_then(|line| line.split(':').nth(1))
            .and_then(|value| value.trim().parse().ok())
    }
}

#[derive(Debug, Clone)]
pub struct RedisInfo {
    pub used_memory_bytes: u64,
    pub max_memory_bytes: u64,
    pub memory_usage_percent: f64,
}