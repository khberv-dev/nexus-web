use super::manager::CacheManager;
use crate::ADQuestError;
use std::time::Duration;

// Redis-based rate limiting implementation
pub struct RedisRateLimiter {
    cache: CacheManager,
}

impl RedisRateLimiter {
    pub fn new(cache: CacheManager) -> Self {
        Self { cache }
    }

    pub async fn check_rate_limit(
        &self,
        identifier: &str,
        rule: &crate::models::RateLimitRule,
    ) -> Result<RateLimitResult, ADQuestError> {
        if !rule.enabled {
            return Ok(RateLimitResult::Allowed);
        }

        let key = format!("rate_limit:{}:{}", rule.rule_id, identifier);
        let _window_key = format!("{}:window", key);

        // Get current count
        let current_count: i64 = self.cache.get(&key).await?.unwrap_or(0);

        // Check if we're within limits
        if current_count >= rule.limit as i64 {
            // Check burst limit if configured
            if let Some(burst_limit) = rule.burst_limit {
                if current_count >= burst_limit as i64 {
                    return Ok(RateLimitResult::Blocked {
                        current_count: current_count as u32,
                        limit: rule.limit,
                        reset_time: chrono::Utc::now()
                            + chrono::Duration::seconds(rule.window_seconds as i64),
                    });
                }
            } else {
                return Ok(RateLimitResult::Blocked {
                    current_count: current_count as u32,
                    limit: rule.limit,
                    reset_time: chrono::Utc::now()
                        + chrono::Duration::seconds(rule.window_seconds as i64),
                });
            }
        }

        // Increment counter
        let new_count = self.cache.increment(&key, 1).await?;

        // Set expiration if this is the first request in the window
        if new_count == 1 {
            self.cache
                .expire(&key, Duration::from_secs(rule.window_seconds as u64))
                .await?;
        }

        Ok(RateLimitResult::Allowed)
    }

    pub async fn reset_rate_limit(
        &self,
        identifier: &str,
        rule_id: &str,
    ) -> Result<(), ADQuestError> {
        let key = format!("rate_limit:{}:{}", rule_id, identifier);
        self.cache.delete(&key).await?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub enum RateLimitResult {
    Allowed,
    Blocked {
        current_count: u32,
        limit: u32,
        reset_time: chrono::DateTime<chrono::Utc>,
    },
}