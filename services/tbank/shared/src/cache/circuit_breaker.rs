use super::manager::CacheManager;
use crate::ADQuestError;
use std::time::Duration;

// Circuit breaker state management using Redis
pub struct CircuitBreakerManager {
    cache: CacheManager,
}

impl CircuitBreakerManager {
    pub fn new(cache: CacheManager) -> Self {
        Self { cache }
    }

    pub async fn get_state(
        &self,
        service_name: &str,
    ) -> Result<crate::models::CircuitBreakerState, ADQuestError> {
        let key = format!("circuit_breaker:{}", service_name);

        match self
            .cache
            .get::<crate::models::CircuitBreakerState>(&key)
            .await?
        {
            Some(state) => Ok(state),
            None => {
                // Initialize default state
                let default_state = crate::models::CircuitBreakerState {
                    service_name: service_name.to_string(),
                    state: crate::models::CircuitState::Closed,
                    failure_count: 0,
                    success_count: 0,
                    last_failure_time: None,
                    next_attempt_time: None,
                    failure_threshold: 5,
                    recovery_timeout_seconds: 60,
                };

                self.update_state(&default_state).await?;
                Ok(default_state)
            }
        }
    }

    pub async fn update_state(
        &self,
        state: &crate::models::CircuitBreakerState,
    ) -> Result<(), ADQuestError> {
        let key = format!("circuit_breaker:{}", state.service_name);
        self.cache
            .set(&key, state, Some(Duration::from_secs(3600)))
            .await // 1 hour TTL
    }

    pub async fn record_success(&self, service_name: &str) -> Result<(), ADQuestError> {
        let mut state = self.get_state(service_name).await?;

        state.success_count += 1;
        state.failure_count = 0; // Reset failure count on success

        // Transition from HalfOpen to Closed if we have enough successes
        if matches!(state.state, crate::models::CircuitState::HalfOpen) && state.success_count >= 3
        {
            state.state = crate::models::CircuitState::Closed;
            state.success_count = 0;
        }

        self.update_state(&state).await
    }

    pub async fn record_failure(&self, service_name: &str) -> Result<(), ADQuestError> {
        let mut state = self.get_state(service_name).await?;

        state.failure_count += 1;
        state.last_failure_time = Some(chrono::Utc::now());

        // Transition to Open if failure threshold exceeded
        if state.failure_count >= state.failure_threshold {
            state.state = crate::models::CircuitState::Open;
            state.next_attempt_time = Some(
                chrono::Utc::now()
                    + chrono::Duration::seconds(state.recovery_timeout_seconds as i64),
            );
        }

        self.update_state(&state).await
    }

    pub async fn can_attempt(&self, service_name: &str) -> Result<bool, ADQuestError> {
        let mut state = self.get_state(service_name).await?;

        match state.state {
            crate::models::CircuitState::Closed => Ok(true),
            crate::models::CircuitState::Open => {
                if let Some(next_attempt) = state.next_attempt_time {
                    if chrono::Utc::now() >= next_attempt {
                        // Transition to HalfOpen
                        state.state = crate::models::CircuitState::HalfOpen;
                        state.success_count = 0;
                        self.update_state(&state).await?;
                        Ok(true)
                    } else {
                        Ok(false)
                    }
                } else {
                    Ok(false)
                }
            }
            crate::models::CircuitState::HalfOpen => Ok(true),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_circuit_breaker() {
        // Test circuit breaker state management
        // This would require a test Redis instance
    }
}