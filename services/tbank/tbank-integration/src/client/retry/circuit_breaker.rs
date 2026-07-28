use std::sync::Mutex;
use std::time::Instant;
use tracing::{debug, error, warn};

use super::config::CircuitBreakerConfig;
use crate::types::{TBankError, TBankResult};

/// Circuit breaker states
#[derive(Debug, Clone, PartialEq)]
pub enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

/// Circuit breaker statistics
#[derive(Debug, Clone)]
struct CircuitBreakerStats {
    requests: u32,
    failures: u32,
    last_failure: Option<Instant>,
    state_changed_at: Instant,
}

impl Default for CircuitBreakerStats {
    fn default() -> Self {
        Self {
            requests: 0,
            failures: 0,
            last_failure: None,
            state_changed_at: Instant::now(),
        }
    }
}

/// Circuit breaker implementation
#[derive(Debug)]
pub struct CircuitBreaker {
    config: CircuitBreakerConfig,
    state: Mutex<CircuitBreakerState>,
    stats: Mutex<CircuitBreakerStats>,
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            state: Mutex::new(CircuitBreakerState::Closed),
            stats: Mutex::new(CircuitBreakerStats::default()),
        }
    }

    /// Check if request should be allowed through circuit breaker
    pub fn allow_request(&self) -> TBankResult<()> {
        let mut state = self.state.lock().unwrap();
        let mut stats = self.stats.lock().unwrap();

        let now = Instant::now();

        // Reset stats if window has expired
        if now.duration_since(stats.state_changed_at) > self.config.window_duration {
            stats.requests = 0;
            stats.failures = 0;
            stats.state_changed_at = now;
        }

        match *state {
            CircuitBreakerState::Closed => {
                // Allow request in closed state
                Ok(())
            }
            CircuitBreakerState::Open => {
                // Check if recovery timeout has passed
                if now.duration_since(stats.state_changed_at) > self.config.recovery_timeout {
                    debug!("Circuit breaker transitioning from Open to HalfOpen");
                    *state = CircuitBreakerState::HalfOpen;
                    stats.state_changed_at = now;
                    Ok(())
                } else {
                    error!("Circuit breaker is open, rejecting request");
                    Err(TBankError::CircuitBreakerOpen)
                }
            }
            CircuitBreakerState::HalfOpen => {
                // Allow limited requests in half-open state
                Ok(())
            }
        }
    }

    /// Record successful request
    pub fn record_success(&self) {
        let mut state = self.state.lock().unwrap();
        let mut stats = self.stats.lock().unwrap();

        stats.requests += 1;

        match *state {
            CircuitBreakerState::HalfOpen => {
                debug!("Circuit breaker transitioning from HalfOpen to Closed after success");
                *state = CircuitBreakerState::Closed;
                stats.state_changed_at = Instant::now();
                stats.failures = 0; // Reset failure count
            }
            _ => {
                // No state change needed for closed state
            }
        }
    }

    /// Record failed request
    pub fn record_failure(&self) {
        let mut state = self.state.lock().unwrap();
        let mut stats = self.stats.lock().unwrap();

        stats.requests += 1;
        stats.failures += 1;
        stats.last_failure = Some(Instant::now());

        // Check if we should open the circuit breaker
        if stats.requests >= self.config.min_requests {
            let failure_rate = stats.failures as f64 / stats.requests as f64;

            if failure_rate >= self.config.failure_threshold {
                match *state {
                    CircuitBreakerState::Closed | CircuitBreakerState::HalfOpen => {
                        warn!(
                            failure_rate = failure_rate,
                            threshold = self.config.failure_threshold,
                            "Circuit breaker opening due to high failure rate"
                        );
                        *state = CircuitBreakerState::Open;
                        stats.state_changed_at = Instant::now();
                    }
                    CircuitBreakerState::Open => {
                        // Already open, just update timestamp
                        stats.state_changed_at = Instant::now();
                    }
                }
            }
        }
    }

    /// Get current circuit breaker state
    pub fn state(&self) -> CircuitBreakerState {
        self.state.lock().unwrap().clone()
    }

    /// Get current failure rate
    pub fn failure_rate(&self) -> f64 {
        let stats = self.stats.lock().unwrap();
        if stats.requests == 0 {
            0.0
        } else {
            stats.failures as f64 / stats.requests as f64
        }
    }
}
