use super::config::RetryConfig;
use std::time::Duration;

/// Retry policy for different types of operations
#[derive(Debug, Clone)]
pub enum RetryPolicy {
    /// Standard retry for most operations
    Standard(RetryConfig),
    /// Aggressive retry for critical operations
    Aggressive(RetryConfig),
    /// Conservative retry for operations that might have side effects
    Conservative(RetryConfig),
    /// No retry for operations that should not be retried
    None,
}

impl RetryPolicy {
    pub fn standard() -> Self {
        Self::Standard(RetryConfig::default())
    }

    pub fn aggressive() -> Self {
        Self::Aggressive(RetryConfig {
            max_attempts: 5,
            base_delay: Duration::from_millis(50),
            max_delay: Duration::from_secs(5),
            backoff_multiplier: 1.5,
            jitter: true,
        })
    }

    pub fn conservative() -> Self {
        Self::Conservative(RetryConfig {
            max_attempts: 2,
            base_delay: Duration::from_millis(200),
            max_delay: Duration::from_secs(2),
            backoff_multiplier: 2.0,
            jitter: false,
        })
    }

    pub fn config(&self) -> Option<&RetryConfig> {
        match self {
            Self::Standard(config) | Self::Aggressive(config) | Self::Conservative(config) => {
                Some(config)
            }
            Self::None => None,
        }
    }
}
