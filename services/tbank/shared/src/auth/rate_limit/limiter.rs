use chrono::{DateTime, Utc};
use dashmap::DashMap;
use parking_lot::Mutex;
use std::sync::Arc;

use super::config::RateLimitConfig;
use super::stats::{RateLimitInfo, RateLimitStats};

/// In-memory rate limiter implementation with sliding window
#[derive(Debug)]
pub struct InMemoryRateLimiter {
    config: RateLimitConfig,
    // In production, this would use Redis or another distributed store
    // For now, using in-memory storage for simplicity
    requests: Arc<DashMap<String, Vec<DateTime<Utc>>>>,
    last_cleanup: Arc<Mutex<DateTime<Utc>>>,
}

impl InMemoryRateLimiter {
    /// Create new rate limiter with configuration
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            requests: Arc::new(DashMap::new()),
            last_cleanup: Arc::new(Mutex::new(Utc::now())),
        }
    }

    /// Create rate limiter with default configuration
    #[allow(clippy::should_implement_trait)]
    pub fn default() -> Self {
        Self::new(RateLimitConfig::default())
    }

    /// Check if request is allowed for the given key (e.g., user ID or IP)
    pub fn is_allowed(&self, key: &str) -> bool {
        self.cleanup_if_needed();

        let now = Utc::now();
        let window_start = now - chrono::Duration::seconds(self.config.window_size_seconds as i64);

        let mut entry = self.requests.entry(key.to_string()).or_default();

        // Remove old requests outside the window
        entry.retain(|&timestamp| timestamp > window_start);

        // Check if we're within limits
        if entry.len() >= self.config.requests_per_minute as usize {
            false
        } else {
            entry.push(now);
            true
        }
    }

    /// Get remaining requests for the given key
    pub fn remaining_requests(&self, key: &str) -> u32 {
        let now = Utc::now();
        let window_start = now - chrono::Duration::seconds(self.config.window_size_seconds as i64);

        if let Some(mut entry) = self.requests.get_mut(key) {
            entry.retain(|&timestamp| timestamp > window_start);
            self.config
                .requests_per_minute
                .saturating_sub(entry.len() as u32)
        } else {
            self.config.requests_per_minute
        }
    }

    /// Get time until next request is allowed (in seconds)
    pub fn time_until_reset(&self, key: &str) -> Option<u64> {
        let now = Utc::now();
        let window_start = now - chrono::Duration::seconds(self.config.window_size_seconds as i64);

        if let Some(entry) = self.requests.get(key) {
            if entry.len() >= self.config.requests_per_minute as usize {
                // Find the oldest request in the current window
                if let Some(&oldest) = entry.iter().filter(|&&ts| ts > window_start).min() {
                    let reset_time =
                        oldest + chrono::Duration::seconds(self.config.window_size_seconds as i64);
                    let seconds_until_reset = (reset_time - now).num_seconds();
                    return Some(seconds_until_reset.max(0) as u64);
                }
            }
        }
        None
    }

    /// Reset rate limit for a specific key (useful for testing or admin override)
    pub fn reset_key(&self, key: &str) {
        self.requests.remove(key);
    }

    /// Reset all rate limits (useful for testing)
    pub fn reset_all(&self) {
        self.requests.clear();
    }

    /// Get current request count for a key
    pub fn current_requests(&self, key: &str) -> u32 {
        let now = Utc::now();
        let window_start = now - chrono::Duration::seconds(self.config.window_size_seconds as i64);

        if let Some(entry) = self.requests.get(key) {
            entry.iter().filter(|&&ts| ts > window_start).count() as u32
        } else {
            0
        }
    }

    /// Check if key is currently rate limited
    pub fn is_rate_limited(&self, key: &str) -> bool {
        self.remaining_requests(key) == 0
    }

    /// Get rate limit information for a key
    pub fn get_rate_limit_info(&self, key: &str) -> RateLimitInfo {
        let remaining = self.remaining_requests(key);
        let current = self.current_requests(key);
        let reset_time = self.time_until_reset(key);
        let is_limited = remaining == 0;

        RateLimitInfo {
            key: key.to_string(),
            limit: self.config.requests_per_minute,
            remaining,
            current,
            reset_time,
            is_limited,
            window_size: self.config.window_size_seconds,
        }
    }

    /// Clean up old entries to prevent memory leaks
    fn cleanup_if_needed(&self) {
        let mut last_cleanup = self.last_cleanup.lock();
        let now = Utc::now();

        if now.signed_duration_since(*last_cleanup).num_seconds()
            > self.config.cleanup_interval_seconds as i64
        {
            let cutoff =
                now - chrono::Duration::seconds(self.config.window_size_seconds as i64 * 2);

            // Remove entries that are completely outside the window
            self.requests.retain(|_, timestamps| {
                timestamps.retain(|&ts| ts > cutoff);
                !timestamps.is_empty()
            });

            *last_cleanup = now;
        }
    }

    /// Get current statistics for monitoring
    pub fn get_stats(&self) -> RateLimitStats {
        let total_keys = self.requests.len();
        let mut total_requests = 0;
        let mut active_keys = 0;
        let mut rate_limited_keys = 0;

        let now = Utc::now();
        let window_start = now - chrono::Duration::seconds(self.config.window_size_seconds as i64);

        for entry in self.requests.iter() {
            let active_requests: Vec<_> = entry
                .value()
                .iter()
                .filter(|&&ts| ts > window_start)
                .collect();

            if !active_requests.is_empty() {
                active_keys += 1;
                total_requests += active_requests.len();

                if active_requests.len() >= self.config.requests_per_minute as usize {
                    rate_limited_keys += 1;
                }
            }
        }

        RateLimitStats {
            total_keys,
            active_keys,
            rate_limited_keys,
            total_requests,
            config: self.config.clone(),
            last_cleanup: *self.last_cleanup.lock(),
        }
    }

    /// Get configuration
    pub fn config(&self) -> &RateLimitConfig {
        &self.config
    }

    /// Update configuration (creates new rate limiter with new config)
    pub fn with_config(config: RateLimitConfig) -> Self {
        Self::new(config)
    }
}
