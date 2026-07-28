use super::core::MetricsCollector;
use crate::ADQuestError;
use prometheus::{
    CounterVec, Gauge, GaugeVec, HistogramOpts, HistogramVec, Opts, Registry,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

impl MetricsCollector {
    pub fn new() -> Result<Self, ADQuestError> {
        let registry = Registry::new();

        // HTTP Request metrics
        let http_requests_total = CounterVec::new(
            Opts::new("http_requests_total", "Total number of HTTP requests"),
            &["method", "endpoint", "status_code", "service"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create http_requests_total: {}", e))
        })?;

        let http_request_duration = HistogramVec::new(
            HistogramOpts::new(
                "http_request_duration_seconds",
                "HTTP request duration in seconds",
            )
            .buckets(vec![
                0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
            ]),
            &["method", "endpoint", "service"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create http_request_duration: {}", e))
        })?;

        let http_request_size_bytes = HistogramVec::new(
            HistogramOpts::new("http_request_size_bytes", "HTTP request size in bytes")
                .buckets(prometheus::exponential_buckets(100.0, 10.0, 8).unwrap()),
            &["method", "endpoint", "service"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create http_request_size_bytes: {}", e))
        })?;

        let http_response_size_bytes = HistogramVec::new(
            HistogramOpts::new("http_response_size_bytes", "HTTP response size in bytes")
                .buckets(prometheus::exponential_buckets(100.0, 10.0, 8).unwrap()),
            &["method", "endpoint", "service"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create http_response_size_bytes: {}", e))
        })?;

        // Challenge Engine metrics
        let challenges_generated_total = CounterVec::new(
            Opts::new(
                "challenges_generated_total",
                "Total number of challenges generated",
            ),
            &["site_key", "challenge_type", "status"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create challenges_generated_total: {}",
                e
            ))
        })?;

        let challenges_validated_total = CounterVec::new(
            Opts::new(
                "challenges_validated_total",
                "Total number of challenges validated",
            ),
            &["site_key", "challenge_type", "result"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create challenges_validated_total: {}",
                e
            ))
        })?;

        let challenge_generation_duration = HistogramVec::new(
            HistogramOpts::new(
                "challenge_generation_duration_seconds",
                "Challenge generation duration",
            )
            .buckets(vec![0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]),
            &["challenge_type"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create challenge_generation_duration: {}",
                e
            ))
        })?;

        let challenge_validation_duration = HistogramVec::new(
            HistogramOpts::new(
                "challenge_validation_duration_seconds",
                "Challenge validation duration",
            )
            .buckets(vec![0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]),
            &["challenge_type"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create challenge_validation_duration: {}",
                e
            ))
        })?;

        let challenge_quality_score = HistogramVec::new(
            HistogramOpts::new(
                "challenge_quality_score",
                "Challenge quality score distribution",
            )
            .buckets(vec![0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]),
            &["site_key"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create challenge_quality_score: {}", e))
        })?;

        // ERIR Integration metrics
        let erir_requests_total = CounterVec::new(
            Opts::new("erir_requests_total", "Total number of ERIR requests"),
            &["operation", "status"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create erir_requests_total: {}", e))
        })?;

        let erir_request_duration = HistogramVec::new(
            HistogramOpts::new("erir_request_duration_seconds", "ERIR request duration")
                .buckets(vec![0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0]),
            &["operation"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create erir_request_duration: {}", e))
        })?;

        let erir_circuit_breaker_state = GaugeVec::new(
            Opts::new(
                "erir_circuit_breaker_state",
                "ERIR circuit breaker state (0=closed, 1=open, 2=half-open)",
            ),
            &["service"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create erir_circuit_breaker_state: {}",
                e
            ))
        })?;

        // Billing Engine metrics
        let cpv_transactions_total = CounterVec::new(
            Opts::new("cpv_transactions_total", "Total number of CPV transactions"),
            &["advertiser_id", "publisher_id", "status"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create cpv_transactions_total: {}", e))
        })?;

        let cpv_transaction_amount = HistogramVec::new(
            HistogramOpts::new(
                "cpv_transaction_amount_rubles",
                "CPV transaction amount in rubles",
            )
            .buckets(vec![
                0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 50.0,
            ]),
            &["advertiser_id"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create cpv_transaction_amount: {}", e))
        })?;

        let billing_errors_total = CounterVec::new(
            Opts::new("billing_errors_total", "Total number of billing errors"),
            &["error_type", "operation"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create billing_errors_total: {}", e))
        })?;

        // System metrics
        let active_connections = Gauge::new("active_connections", "Number of active connections")
            .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create active_connections: {}", e))
        })?;

        let memory_usage_bytes = Gauge::new("memory_usage_bytes", "Memory usage in bytes")
            .map_err(|e| {
                ADQuestError::Metrics(format!("Failed to create memory_usage_bytes: {}", e))
            })?;

        let cpu_usage_percent =
            Gauge::new("cpu_usage_percent", "CPU usage percentage").map_err(|e| {
                ADQuestError::Metrics(format!("Failed to create cpu_usage_percent: {}", e))
            })?;

        let database_connections_active = Gauge::new(
            "database_connections_active",
            "Number of active database connections",
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create database_connections_active: {}",
                e
            ))
        })?;

        let database_connections_idle = Gauge::new(
            "database_connections_idle",
            "Number of idle database connections",
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create database_connections_idle: {}", e))
        })?;

        let redis_memory_usage_bytes =
            Gauge::new("redis_memory_usage_bytes", "Redis memory usage in bytes").map_err(|e| {
                ADQuestError::Metrics(format!("Failed to create redis_memory_usage_bytes: {}", e))
            })?;

        // Rate limiting metrics
        let rate_limit_violations_total = CounterVec::new(
            Opts::new(
                "rate_limit_violations_total",
                "Total number of rate limit violations",
            ),
            &["rule_id", "identifier_type"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create rate_limit_violations_total: {}",
                e
            ))
        })?;

        let rate_limit_current_usage = GaugeVec::new(
            Opts::new("rate_limit_current_usage", "Current rate limit usage"),
            &["rule_id", "identifier"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!("Failed to create rate_limit_current_usage: {}", e))
        })?;

        // Dead letter queue metrics
        let dead_letter_messages_total = CounterVec::new(
            Opts::new(
                "dead_letter_messages_total",
                "Total number of dead letter messages",
            ),
            &["original_topic", "error_type"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create dead_letter_messages_total: {}",
                e
            ))
        })?;

        let dead_letter_retry_attempts_total = CounterVec::new(
            Opts::new(
                "dead_letter_retry_attempts_total",
                "Total number of dead letter retry attempts",
            ),
            &["original_topic", "result"],
        )
        .map_err(|e| {
            ADQuestError::Metrics(format!(
                "Failed to create dead_letter_retry_attempts_total: {}",
                e
            ))
        })?;

        // Register all metrics
        registry.register(Box::new(http_requests_total.clone()))?;
        registry.register(Box::new(http_request_duration.clone()))?;
        registry.register(Box::new(http_request_size_bytes.clone()))?;
        registry.register(Box::new(http_response_size_bytes.clone()))?;
        registry.register(Box::new(challenges_generated_total.clone()))?;
        registry.register(Box::new(challenges_validated_total.clone()))?;
        registry.register(Box::new(challenge_generation_duration.clone()))?;
        registry.register(Box::new(challenge_validation_duration.clone()))?;
        registry.register(Box::new(challenge_quality_score.clone()))?;
        registry.register(Box::new(erir_requests_total.clone()))?;
        registry.register(Box::new(erir_request_duration.clone()))?;
        registry.register(Box::new(erir_circuit_breaker_state.clone()))?;
        registry.register(Box::new(cpv_transactions_total.clone()))?;
        registry.register(Box::new(cpv_transaction_amount.clone()))?;
        registry.register(Box::new(billing_errors_total.clone()))?;
        registry.register(Box::new(active_connections.clone()))?;
        registry.register(Box::new(memory_usage_bytes.clone()))?;
        registry.register(Box::new(cpu_usage_percent.clone()))?;
        registry.register(Box::new(database_connections_active.clone()))?;
        registry.register(Box::new(database_connections_idle.clone()))?;
        registry.register(Box::new(redis_memory_usage_bytes.clone()))?;
        registry.register(Box::new(rate_limit_violations_total.clone()))?;
        registry.register(Box::new(rate_limit_current_usage.clone()))?;
        registry.register(Box::new(dead_letter_messages_total.clone()))?;
        registry.register(Box::new(dead_letter_retry_attempts_total.clone()))?;

        info!("Metrics collector initialized successfully");

        Ok(Self {
            registry,
            http_requests_total,
            http_request_duration,
            http_request_size_bytes,
            http_response_size_bytes,
            challenges_generated_total,
            challenges_validated_total,
            challenge_generation_duration,
            challenge_validation_duration,
            challenge_quality_score,
            erir_requests_total,
            erir_request_duration,
            erir_circuit_breaker_state,
            cpv_transactions_total,
            cpv_transaction_amount,
            billing_errors_total,
            active_connections,
            memory_usage_bytes,
            cpu_usage_percent,
            database_connections_active,
            database_connections_idle,
            redis_memory_usage_bytes,
            rate_limit_violations_total,
            rate_limit_current_usage,
            dead_letter_messages_total,
            dead_letter_retry_attempts_total,
            latency_percentiles: Arc::new(RwLock::new(HashMap::new())),
        })
    }
}