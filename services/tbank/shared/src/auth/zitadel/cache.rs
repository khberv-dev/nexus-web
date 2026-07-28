use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Zitadel cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZitadelCacheStats {
    pub is_cached: bool,
    pub cached_at: Option<DateTime<Utc>>,
    pub keys_count: usize,
    pub cache_expiry: Option<DateTime<Utc>>,
    pub is_expired: bool,
}

impl ZitadelCacheStats {
    /// Get cache age in seconds
    pub fn cache_age_seconds(&self) -> Option<i64> {
        self.cached_at
            .map(|cached_at| (Utc::now() - cached_at).num_seconds())
    }

    /// Get time until cache expires (in seconds)
    pub fn time_until_expiry_seconds(&self) -> Option<i64> {
        self.cache_expiry
            .map(|expiry| (expiry - Utc::now()).num_seconds().max(0))
    }

    /// Get cache hit ratio (would need to track hits/misses)
    pub fn cache_utilization(&self) -> f64 {
        if self.is_cached && !self.is_expired {
            1.0
        } else {
            0.0
        }
    }
}
