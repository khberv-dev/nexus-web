use crate::metrics::percentiles::{LatencyPercentiles, LatencyPercentilesMap};
use crate::ADQuestError;
use prometheus::{
    CounterVec, Encoder, Gauge, GaugeVec, HistogramVec, Registry, TextEncoder,
};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct PerformanceMonitor {
    metrics: Arc<MetricsCollector>,
}

impl PerformanceMonitor {
    pub fn new(metrics: Arc<MetricsCollector>) -> Self {
        Self { metrics }
    }

    pub fn record_operation(&self, operation: &str, _duration: f64, success: bool) {
        let _status = if success { "success" } else { "error" };
        self.metrics
            .http_requests_total
            .with_label_values(&["POST", operation, "200", "performance"])
            .inc();
    }

    pub async fn start_monitoring(&self) {
        // Placeholder implementation for monitoring
        tracing::info!("Performance monitoring started");
    }
}

#[derive(Debug)]
pub struct MetricsCollector {
    pub registry: Registry,

    // Request metrics
    pub http_requests_total: CounterVec,
    pub http_request_duration: HistogramVec,
    pub http_request_size_bytes: HistogramVec,
    pub http_response_size_bytes: HistogramVec,

    // Challenge Engine metrics
    pub challenges_generated_total: CounterVec,
    pub challenges_validated_total: CounterVec,
    pub challenge_generation_duration: HistogramVec,
    pub challenge_validation_duration: HistogramVec,
    pub challenge_quality_score: HistogramVec,

    // ERIR Integration metrics
    pub erir_requests_total: CounterVec,
    pub erir_request_duration: HistogramVec,
    pub erir_circuit_breaker_state: GaugeVec,

    // Billing Engine metrics
    pub cpv_transactions_total: CounterVec,
    pub cpv_transaction_amount: HistogramVec,
    pub billing_errors_total: CounterVec,

    // System metrics
    pub active_connections: Gauge,
    pub memory_usage_bytes: Gauge,
    pub cpu_usage_percent: Gauge,
    pub database_connections_active: Gauge,
    pub database_connections_idle: Gauge,
    pub redis_memory_usage_bytes: Gauge,

    // Rate limiting metrics
    pub rate_limit_violations_total: CounterVec,
    pub rate_limit_current_usage: GaugeVec,

    // Dead letter queue metrics
    pub dead_letter_messages_total: CounterVec,
    pub dead_letter_retry_attempts_total: CounterVec,

    // Performance percentiles (p50, p95, p99, p999)
    pub latency_percentiles: LatencyPercentilesMap,
}

impl MetricsCollector {
    pub fn render_metrics(&self) -> Result<String, ADQuestError> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();

        let mut buffer = Vec::new();
        encoder
            .encode(&metric_families, &mut buffer)
            .map_err(|e| ADQuestError::Metrics(format!("Failed to encode metrics: {}", e)))?;

        String::from_utf8(buffer).map_err(|e| {
            ADQuestError::Metrics(format!("Failed to convert metrics to string: {}", e))
        })
    }

    pub async fn update_latency_percentiles(&self, service: &str, percentiles: LatencyPercentiles) {
        let mut map = self.latency_percentiles.write().await;
        map.insert(service.to_string(), percentiles);
    }

    pub async fn get_latency_percentiles(&self, service: &str) -> Option<LatencyPercentiles> {
        let map = self.latency_percentiles.read().await;
        map.get(service).cloned()
    }

    // Frontend metrics methods
    pub fn increment_counter(&self, name: &str, value: f64) -> Result<(), ADQuestError> {
        // Use existing counters or create a generic one
        self.http_requests_total
            .with_label_values(&["POST", name, "200", "frontend"])
            .inc_by(value);
        Ok(())
    }

    pub fn observe_histogram(&self, name: &str, value: f64) -> Result<(), ADQuestError> {
        // Use existing histograms or create a generic one
        self.http_request_duration
            .with_label_values(&["POST", name, "frontend"])
            .observe(value / 1000.0); // Convert ms to seconds
        Ok(())
    }

    pub fn set_gauge(&self, _name: &str, value: f64) -> Result<(), ADQuestError> {
        // For gauges, we can use the memory usage gauge as a generic one
        // In a real implementation, you'd want to create dynamic gauges
        self.memory_usage_bytes.set(value);
        Ok(())
    }
}

impl From<prometheus::Error> for ADQuestError {
    fn from(err: prometheus::Error) -> Self {
        ADQuestError::Metrics(format!("Prometheus error: {}", err))
    }
}