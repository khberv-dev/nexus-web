use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;
use tracing::{debug, error, warn};

use super::circuit_breaker::CircuitBreaker;
use super::config::{CircuitBreakerConfig, RetryConfig};
use super::policy::RetryPolicy;
use crate::types::{TBankError, TBankResult};

/// Retry executor with circuit breaker integration
#[derive(Debug)]
pub struct RetryExecutor {
    circuit_breakers: Arc<Mutex<HashMap<String, Arc<CircuitBreaker>>>>,
}

impl RetryExecutor {
    pub fn new() -> Self {
        Self {
            circuit_breakers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get or create circuit breaker for endpoint
    pub fn get_circuit_breaker(&self, endpoint: &str) -> Arc<CircuitBreaker> {
        let mut breakers = self.circuit_breakers.lock().unwrap();

        breakers
            .entry(endpoint.to_string())
            .or_insert_with(|| Arc::new(CircuitBreaker::new(CircuitBreakerConfig::default())))
            .clone()
    }

    /// Execute operation with retry and circuit breaker
    pub async fn execute<F, Fut, T>(
        &self,
        endpoint: &str,
        policy: RetryPolicy,
        operation: F,
    ) -> TBankResult<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = TBankResult<T>>,
    {
        let circuit_breaker = self.get_circuit_breaker(endpoint);

        // Check circuit breaker before attempting
        circuit_breaker.allow_request()?;

        let config = match policy.config() {
            Some(config) => config,
            None => {
                // No retry policy, execute once
                let result = operation().await;
                match &result {
                    Ok(_) => circuit_breaker.record_success(),
                    Err(e) if e.is_retryable() => circuit_breaker.record_failure(),
                    Err(_) => {} // Don't record non-retryable errors as circuit breaker failures
                }
                return result;
            }
        };

        let mut last_error = None;

        for attempt in 1..=config.max_attempts {
            debug!(
                endpoint = endpoint,
                attempt = attempt,
                max_attempts = config.max_attempts,
                "Executing operation attempt"
            );

            // Check circuit breaker for each attempt
            if let Err(e) = circuit_breaker.allow_request() {
                return Err(e);
            }

            match operation().await {
                Ok(result) => {
                    if attempt > 1 {
                        debug!(
                            endpoint = endpoint,
                            attempt = attempt,
                            "Operation succeeded after retry"
                        );
                    }
                    circuit_breaker.record_success();
                    return Ok(result);
                }
                Err(error) => {
                    last_error = Some(error.clone());

                    if error.is_retryable() {
                        circuit_breaker.record_failure();

                        if attempt < config.max_attempts {
                            let delay = calculate_delay(config, attempt);
                            warn!(
                                endpoint = endpoint,
                                attempt = attempt,
                                delay_ms = delay.as_millis(),
                                error = %error,
                                "Operation failed, retrying after delay"
                            );
                            sleep(delay).await;
                        } else {
                            error!(
                                endpoint = endpoint,
                                attempts = attempt,
                                error = %error,
                                "Operation failed after all retry attempts"
                            );
                        }
                    } else {
                        debug!(
                            endpoint = endpoint,
                            error = %error,
                            "Operation failed with non-retryable error"
                        );
                        // Don't record non-retryable errors as circuit breaker failures
                        return Err(error);
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            TBankError::InternalError("Retry loop completed without error".to_string())
        }))
    }
}

impl Default for RetryExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Calculate delay for exponential backoff with optional jitter
fn calculate_delay(config: &RetryConfig, attempt: u32) -> Duration {
    use rand::Rng;

    let base_delay_ms = config.base_delay.as_millis() as f64;
    let exponential_delay = base_delay_ms * config.backoff_multiplier.powi((attempt - 1) as i32);

    let delay_ms = if config.jitter {
        // Add random jitter (±25%)
        let mut rng = rand::thread_rng();
        let jitter_factor = 1.0 + (rng.gen::<f64>() - 0.5) * 0.5;
        exponential_delay * jitter_factor
    } else {
        exponential_delay
    };

    let capped_delay = delay_ms.min(config.max_delay.as_millis() as f64);
    Duration::from_millis(capped_delay as u64)
}
