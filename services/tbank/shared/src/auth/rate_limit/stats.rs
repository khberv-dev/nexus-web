use super::config::RateLimitConfig;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Rate limit information for a specific key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub key: String,
    pub limit: u32,
    pub remaining: u32,
    pub current: u32,
    pub reset_time: Option<u64>,
    pub is_limited: bool,
    pub window_size: u64,
}

/// Rate limiting statistics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitStats {
    pub total_keys: usize,
    pub active_keys: usize,
    pub rate_limited_keys: usize,
    pub total_requests: usize,
    pub config: RateLimitConfig,
    pub last_cleanup: DateTime<Utc>,
}

impl RateLimitStats {
    /// Get average requests per key
    pub fn avg_requests_per_key(&self) -> f64 {
        if self.active_keys > 0 {
            self.total_requests as f64 / self.active_keys as f64
        } else {
            0.0
        }
    }

    /// Get rate limit utilization percentage
    pub fn utilization_percentage(&self) -> f64 {
        if self.active_keys > 0 {
            (self.rate_limited_keys as f64 / self.active_keys as f64) * 100.0
        } else {
            0.0
        }
    }

    /// Check if cleanup is needed
    pub fn needs_cleanup(&self) -> bool {
        let now = Utc::now();
        now.signed_duration_since(self.last_cleanup).num_seconds()
            > self.config.cleanup_interval_seconds as i64
    }
}
