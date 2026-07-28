#[cfg(test)]
mod tests {
    use super::super::{RateLimitConfig, InMemoryRateLimiter};
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_rate_limiter_basic() {
        let config = RateLimitConfig {
            requests_per_minute: 2,
            burst_size: 1,
            window_size_seconds: 60,
            cleanup_interval_seconds: 300,
        };
        let rate_limiter = InMemoryRateLimiter::new(config);

        let key = "test_user";

        assert!(rate_limiter.is_allowed(key));
        assert!(rate_limiter.is_allowed(key));
        assert!(!rate_limiter.is_allowed(key)); // Should be rate limited

        assert_eq!(rate_limiter.remaining_requests(key), 0);
        assert!(rate_limiter.is_rate_limited(key));
    }

    #[test]
    fn test_rate_limiter_time_until_reset() {
        let config = RateLimitConfig {
            requests_per_minute: 1,
            burst_size: 1,
            window_size_seconds: 60,
            cleanup_interval_seconds: 300,
        };
        let rate_limiter = InMemoryRateLimiter::new(config);

        let key = "test_user";

        assert!(rate_limiter.is_allowed(key));
        assert!(!rate_limiter.is_allowed(key)); // Should be rate limited

        let time_until_reset = rate_limiter.time_until_reset(key);
        assert!(time_until_reset.is_some());
        assert!(time_until_reset.unwrap() > 0);
        assert!(time_until_reset.unwrap() <= 60);
    }

    #[test]
    fn test_rate_limiter_stats() {
        let config = RateLimitConfig {
            requests_per_minute: 5,
            burst_size: 2,
            window_size_seconds: 60,
            cleanup_interval_seconds: 300,
        };
        let rate_limiter = InMemoryRateLimiter::new(config);

        // Make some requests
        rate_limiter.is_allowed("user1");
        rate_limiter.is_allowed("user1");
        rate_limiter.is_allowed("user2");

        let stats = rate_limiter.get_stats();
        assert_eq!(stats.active_keys, 2);
        assert_eq!(stats.total_requests, 3);
        assert_eq!(stats.rate_limited_keys, 0);

        let avg = stats.avg_requests_per_key();
        assert_eq!(avg, 1.5);
    }

    #[test]
    fn test_rate_limiter_reset() {
        let config = RateLimitConfig {
            requests_per_minute: 1,
            burst_size: 1,
            window_size_seconds: 60,
            cleanup_interval_seconds: 300,
        };
        let rate_limiter = InMemoryRateLimiter::new(config);

        let key = "test_user";

        assert!(rate_limiter.is_allowed(key));
        assert!(!rate_limiter.is_allowed(key)); // Should be rate limited

        rate_limiter.reset_key(key);
        assert!(rate_limiter.is_allowed(key)); // Should be allowed again
    }

    #[test]
    fn test_rate_limit_info() {
        let config = RateLimitConfig {
            requests_per_minute: 3,
            burst_size: 1,
            window_size_seconds: 60,
            cleanup_interval_seconds: 300,
        };
        let rate_limiter = InMemoryRateLimiter::new(config);

        let key = "test_user";

        rate_limiter.is_allowed(key);
        rate_limiter.is_allowed(key);

        let info = rate_limiter.get_rate_limit_info(key);
        assert_eq!(info.key, key);
        assert_eq!(info.limit, 3);
        assert_eq!(info.remaining, 1);
        assert_eq!(info.current, 2);
        assert!(!info.is_limited);
        assert_eq!(info.window_size, 60);
    }

    #[test]
    fn test_rate_limiter_different_keys() {
        let config = RateLimitConfig {
            requests_per_minute: 1,
            burst_size: 1,
            window_size_seconds: 60,
            cleanup_interval_seconds: 300,
        };
        let rate_limiter = InMemoryRateLimiter::new(config);

        let key1 = "user1";
        let key2 = "user2";

        assert!(rate_limiter.is_allowed(key1));
        assert!(rate_limiter.is_allowed(key2)); // Different key, should be allowed

        assert!(!rate_limiter.is_allowed(key1)); // key1 should be rate limited
        assert!(!rate_limiter.is_allowed(key2)); // key2 should be rate limited
    }

    #[test]
    fn test_rate_limiter_window_expiry() {
        let config = RateLimitConfig {
            requests_per_minute: 1,
            burst_size: 1,
            window_size_seconds: 1, // 1 second window for testing
            cleanup_interval_seconds: 300,
        };
        let rate_limiter = InMemoryRateLimiter::new(config);

        let key = "test_user";

        assert!(rate_limiter.is_allowed(key));
        assert!(!rate_limiter.is_allowed(key)); // Should be rate limited

        // Wait for window to expire
        thread::sleep(Duration::from_secs(2));

        assert!(rate_limiter.is_allowed(key)); // Should be allowed again
    }

    #[test]
    fn test_default_config() {
        let rate_limiter = InMemoryRateLimiter::default();
        let config = rate_limiter.config();

        assert_eq!(config.requests_per_minute, 60);
        assert_eq!(config.burst_size, 10);
        assert_eq!(config.window_size_seconds, 60);
        assert_eq!(config.cleanup_interval_seconds, 300);
    }
}
