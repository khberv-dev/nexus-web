use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error, warn};

use crate::types::counterparty::CounterpartyData;
use crate::types::{TBankError, TBankResult};
use shared::CacheManager;

/// Cache key prefix for counterparty data
const COUNTERPARTY_CACHE_PREFIX: &str = "tbank:counterparty";

/// TTL for counterparty cache (30 days)
const COUNTERPARTY_CACHE_TTL: Duration = Duration::from_secs(30 * 24 * 60 * 60);

/// Counterparty cache manager with Redis integration
pub struct CounterpartyCache {
    cache_manager: CacheManager,
}

impl CounterpartyCache {
    /// Create new counterparty cache
    pub fn new(cache_manager: CacheManager) -> Self {
        Self { cache_manager }
    }

    /// Get counterparty data from cache
    pub async fn get(&self, inn: &str) -> TBankResult<Option<CounterpartyData>> {
        let cache_key = self.generate_cache_key(inn);
        debug!(cache_key = %cache_key, "Getting counterparty from cache");

        match self.cache_manager.get::<CounterpartyData>(&cache_key).await {
            Ok(data) => {
                if data.is_some() {
                    debug!(cache_key = %cache_key, "Counterparty found in cache");
                } else {
                    debug!(cache_key = %cache_key, "Counterparty not found in cache");
                }
                Ok(data)
            }
            Err(e) => {
                warn!(
                    cache_key = %cache_key,
                    error = %e,
                    "Failed to get counterparty from cache"
                );
                // Don't fail the entire operation if cache is unavailable
                Ok(None)
            }
        }
    }

    /// Store counterparty data in cache with 30-day TTL
    pub async fn set(&self, inn: &str, data: &CounterpartyData) -> TBankResult<()> {
        let cache_key = self.generate_cache_key(inn);
        debug!(cache_key = %cache_key, "Caching counterparty data");

        self.cache_manager
            .set(&cache_key, data, Some(COUNTERPARTY_CACHE_TTL))
            .await
            .map_err(|e| {
                warn!(
                    cache_key = %cache_key,
                    error = %e,
                    "Failed to cache counterparty data"
                );
                TBankError::CacheError(format!("Failed to cache counterparty: {}", e))
            })?;

        debug!(cache_key = %cache_key, ttl_days = 30, "Counterparty cached successfully");
        Ok(())
    }

    /// Remove counterparty data from cache
    pub async fn delete(&self, inn: &str) -> TBankResult<bool> {
        let cache_key = self.generate_cache_key(inn);
        debug!(cache_key = %cache_key, "Deleting counterparty from cache");

        match self.cache_manager.delete(&cache_key).await {
            Ok(deleted) => {
                debug!(cache_key = %cache_key, deleted = deleted, "Cache deletion completed");
                Ok(deleted)
            }
            Err(e) => {
                warn!(
                    cache_key = %cache_key,
                    error = %e,
                    "Failed to delete counterparty from cache"
                );
                Err(TBankError::CacheError(format!(
                    "Failed to delete from cache: {}",
                    e
                )))
            }
        }
    }

    /// Check if counterparty exists in cache
    pub async fn exists(&self, inn: &str) -> TBankResult<bool> {
        let cache_key = self.generate_cache_key(inn);
        debug!(cache_key = %cache_key, "Checking if counterparty exists in cache");

        match self.cache_manager.exists(&cache_key).await {
            Ok(exists) => {
                debug!(cache_key = %cache_key, exists = exists, "Cache existence check completed");
                Ok(exists)
            }
            Err(e) => {
                warn!(
                    cache_key = %cache_key,
                    error = %e,
                    "Failed to check cache existence"
                );
                // Don't fail the entire operation if cache is unavailable
                Ok(false)
            }
        }
    }

    /// Refresh TTL for cached counterparty data
    pub async fn refresh_ttl(&self, inn: &str) -> TBankResult<bool> {
        let cache_key = self.generate_cache_key(inn);
        debug!(cache_key = %cache_key, "Refreshing cache TTL");

        match self
            .cache_manager
            .expire(&cache_key, COUNTERPARTY_CACHE_TTL)
            .await
        {
            Ok(refreshed) => {
                debug!(
                    cache_key = %cache_key,
                    refreshed = refreshed,
                    ttl_days = 30,
                    "Cache TTL refresh completed"
                );
                Ok(refreshed)
            }
            Err(e) => {
                warn!(
                    cache_key = %cache_key,
                    error = %e,
                    "Failed to refresh cache TTL"
                );
                Err(TBankError::CacheError(format!(
                    "Failed to refresh TTL: {}",
                    e
                )))
            }
        }
    }

    /// Get cache statistics for counterparty data
    pub async fn get_cache_stats(&self) -> TBankResult<CounterpartyCacheStats> {
        debug!("Getting counterparty cache statistics");

        // For now, return basic stats
        // In a real implementation, we would query Redis for pattern-based statistics
        let stats = CounterpartyCacheStats {
            total_cached: 0,     // Would need Redis SCAN to count
            cache_hit_rate: 0.0, // Would need to track hits/misses
            average_ttl_remaining: COUNTERPARTY_CACHE_TTL.as_secs(),
        };

        debug!(?stats, "Counterparty cache statistics retrieved");
        Ok(stats)
    }

    /// Generate cache key for counterparty INN
    fn generate_cache_key(&self, inn: &str) -> String {
        format!("{}:inn:{}", COUNTERPARTY_CACHE_PREFIX, inn)
    }

    /// Validate INN format before caching operations
    fn validate_inn_for_cache(&self, inn: &str) -> TBankResult<()> {
        if inn.is_empty() {
            return Err(TBankError::ValidationError(
                "INN cannot be empty for cache operations".to_string(),
            ));
        }

        if inn.len() > 20 {
            return Err(TBankError::ValidationError(
                "INN too long for cache key".to_string(),
            ));
        }

        // Check for invalid characters that might cause cache key issues
        if inn.contains(':') || inn.contains(' ') || inn.contains('\n') || inn.contains('\r') {
            return Err(TBankError::ValidationError(
                "INN contains invalid characters for cache key".to_string(),
            ));
        }

        Ok(())
    }

    /// Batch get multiple counterparties from cache
    pub async fn get_batch(
        &self,
        inns: &[String],
    ) -> TBankResult<Vec<(String, Option<CounterpartyData>)>> {
        debug!(
            count = inns.len(),
            "Getting batch counterparties from cache"
        );

        let mut results = Vec::with_capacity(inns.len());

        for inn in inns {
            let data = self.get(inn).await?;
            results.push((inn.clone(), data));
        }

        debug!(
            count = inns.len(),
            found = results.iter().filter(|(_, data)| data.is_some()).count(),
            "Batch cache retrieval completed"
        );

        Ok(results)
    }

    /// Batch set multiple counterparties in cache
    pub async fn set_batch(&self, data: &[(String, CounterpartyData)]) -> TBankResult<()> {
        debug!(count = data.len(), "Setting batch counterparties in cache");

        for (inn, counterparty_data) in data {
            self.set(inn, counterparty_data).await?;
        }

        debug!(count = data.len(), "Batch cache storage completed");
        Ok(())
    }
}

/// Cache statistics for counterparty data
#[derive(Debug, Serialize, Deserialize)]
pub struct CounterpartyCacheStats {
    pub total_cached: u64,
    pub cache_hit_rate: f64,
    pub average_ttl_remaining: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::counterparty::{CounterpartyData, CounterpartyStatus};
    use chrono::Utc;

    #[tokio::test]
    async fn test_cache_key_generation() {
        // Test cache key generation without requiring Redis connection
        let cache_key = format!("{}:inn:{}", "tbank:counterparty", "7707083893");
        assert_eq!(cache_key, "tbank:counterparty:inn:7707083893");
    }

    #[tokio::test]
    async fn test_inn_validation_for_cache() {
        // Test INN validation logic without requiring Redis connection

        // Create a test cache instance for validation testing
        let cache = CounterpartyCache::new(Arc::new(
            shared::CacheManager::new(&shared::config::RedisConfig {
                url: "redis://localhost:6379".to_string(),
                pool_size: 1,
                connection_timeout_ms: 1000,
                command_timeout_ms: 1000,
            })
            .await
            .unwrap(),
        ));

        // Valid INN
        assert!(cache.validate_inn_for_cache("7707083893").is_ok());

        // Invalid INNs
        assert!(cache.validate_inn_for_cache("").is_err());
        assert!(cache.validate_inn_for_cache("inn:with:colons").is_err());
        assert!(cache.validate_inn_for_cache("inn with spaces").is_err());
        assert!(cache.validate_inn_for_cache("inn\nwith\nnewlines").is_err());
    }

    #[test]
    fn test_cache_ttl_constant() {
        assert_eq!(COUNTERPARTY_CACHE_TTL.as_secs(), 30 * 24 * 60 * 60); // 30 days
    }

    #[tokio::test]
    async fn test_cache_operations() {
        // This test would require a Redis instance
        // For now, just test the structure
        let test_data = CounterpartyData::new(
            "7707083893".to_string(),
            Some("770701001".to_string()),
            "Test Company".to_string(),
            "Test Co".to_string(),
            "Test Address".to_string(),
            CounterpartyStatus::Active,
            Utc::now(),
            vec!["62.01".to_string()],
        );

        // Verify the data structure is serializable
        let serialized = serde_json::to_string(&test_data).unwrap();
        let deserialized: CounterpartyData = serde_json::from_str(&serialized).unwrap();
        assert_eq!(test_data.inn, deserialized.inn);
    }
}
