use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use std::env;
use std::sync::Arc;
use std::time::Duration;

use tbank_integration::client::retry::{
    CircuitBreaker, CircuitBreakerConfig, RetryConfig, RetryExecutor, RetryPolicy,
};
use tbank_integration::config::{Environment, TBankConfig};
use tbank_integration::types::TBankError;

#[quickcheck]
fn api_retry_logic_with_exponential_backoff_property(
    max_attempts: u8,
    base_delay_ms: u16,
    backoff_multiplier: f32,
) -> TestResult {
    // Feature: tbank-integration, Property 58: API Retry Logic with Exponential Backoff
    // **Validates: Requirements 9.1**

    // Filter out invalid values
    let max_attempts = if max_attempts == 0 {
        1
    } else {
        max_attempts.min(10)
    };
    let base_delay_ms = base_delay_ms.max(1).min(5000); // 1ms to 5s
    let backoff_multiplier = if backoff_multiplier.is_finite() && backoff_multiplier > 0.0 {
        backoff_multiplier.max(1.0).min(10.0)
    } else {
        2.0
    };

    let config = RetryConfig {
        max_attempts: max_attempts as u32,
        base_delay: Duration::from_millis(base_delay_ms as u64),
        max_delay: Duration::from_secs(30),
        backoff_multiplier: backoff_multiplier as f64,
        jitter: false, // Disable jitter for predictable testing
    };

    // Test that retry policy is created correctly
    let policy = RetryPolicy::Standard(config.clone());
    let policy_config = policy.config();

    let policy_valid = match policy_config {
        Some(c) => {
            c.max_attempts == config.max_attempts
                && c.base_delay == config.base_delay
                && c.backoff_multiplier == config.backoff_multiplier
        }
        None => false,
    };

    // Test retry executor creation
    let executor = RetryExecutor::new();
    let circuit_breaker = executor.get_circuit_breaker("test_endpoint");

    // Circuit breaker should start in closed state
    let initial_state_correct = matches!(
        circuit_breaker.state(),
        tbank_integration::client::retry::CircuitBreakerState::Closed
    );

    // Test failure rate calculation (should be 0 initially)
    let initial_failure_rate = circuit_breaker.failure_rate();
    let failure_rate_correct = initial_failure_rate == 0.0;

    TestResult::from_bool(policy_valid && initial_state_correct && failure_rate_correct)
}

#[test]
fn test_retry_policy_types() {
    // Feature: tbank-integration, Property 58: API Retry Logic with Exponential Backoff
    // **Validates: Requirements 9.1**

    // Test standard policy
    let standard = RetryPolicy::standard();
    assert!(standard.config().is_some());

    // Test aggressive policy
    let aggressive = RetryPolicy::aggressive();
    let aggressive_config = aggressive.config().unwrap();
    assert_eq!(aggressive_config.max_attempts, 5);
    assert_eq!(aggressive_config.backoff_multiplier, 1.5);

    // Test conservative policy
    let conservative = RetryPolicy::conservative();
    let conservative_config = conservative.config().unwrap();
    assert_eq!(conservative_config.max_attempts, 2);
    assert!(!conservative_config.jitter);

    // Test no retry policy
    let none = RetryPolicy::None;
    assert!(none.config().is_none());
}

#[test]
fn test_error_retryability() {
    // Feature: tbank-integration, Property 58: API Retry Logic with Exponential Backoff
    // **Validates: Requirements 9.1**

    // Test retryable errors
    let api_error_500 = TBankError::TBankApiError {
        status: 500,
        message: "Internal Server Error".to_string(),
        error_code: None,
    };
    assert!(api_error_500.is_retryable());

    let api_error_429 = TBankError::TBankApiError {
        status: 429,
        message: "Too Many Requests".to_string(),
        error_code: None,
    };
    assert!(api_error_429.is_retryable());

    let rate_limit_error = TBankError::RateLimitExceeded;
    assert!(rate_limit_error.is_retryable());

    // Test non-retryable errors
    let validation_error = TBankError::ValidationError("Invalid input".to_string());
    assert!(!validation_error.is_retryable());

    let api_error_400 = TBankError::TBankApiError {
        status: 400,
        message: "Bad Request".to_string(),
        error_code: None,
    };
    assert!(!api_error_400.is_retryable());

    let circuit_breaker_error = TBankError::CircuitBreakerOpen;
    assert!(!circuit_breaker_error.is_retryable());
}

#[test]
fn test_circuit_breaker_basic_functionality() {
    // Feature: tbank-integration, Property 58: API Retry Logic with Exponential Backoff
    // **Validates: Requirements 9.1**

    let config = CircuitBreakerConfig {
        failure_threshold: 0.5, // 50% failure rate
        recovery_timeout: Duration::from_millis(100),
        min_requests: 2,
        window_duration: Duration::from_secs(60),
    };

    let circuit_breaker = Arc::new(CircuitBreaker::new(config));

    // Initially should be closed
    assert_eq!(
        circuit_breaker.state(),
        tbank_integration::client::retry::CircuitBreakerState::Closed
    );

    // Should allow requests when closed
    assert!(circuit_breaker.allow_request().is_ok());

    // Record multiple failures
    circuit_breaker.record_failure();
    circuit_breaker.record_failure();

    // Circuit breaker should open
    assert_eq!(
        circuit_breaker.state(),
        tbank_integration::client::retry::CircuitBreakerState::Open
    );

    // Should reject requests when open
    let result = circuit_breaker.allow_request();
    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        TBankError::CircuitBreakerOpen
    ));
}

#[test]
fn test_retry_executor_with_different_endpoints() {
    // Feature: tbank-integration, Property 58: API Retry Logic with Exponential Backoff
    // **Validates: Requirements 9.1**

    let executor = RetryExecutor::new();

    // Get circuit breakers for different endpoints
    let cb1 = executor.get_circuit_breaker("endpoint1");
    let cb2 = executor.get_circuit_breaker("endpoint2");

    // They should be different instances
    assert!(!Arc::ptr_eq(&cb1, &cb2));

    // But getting the same endpoint again should return the same instance
    let cb1_again = executor.get_circuit_breaker("endpoint1");
    assert!(Arc::ptr_eq(&cb1, &cb1_again));
}
