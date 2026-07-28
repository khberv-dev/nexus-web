use super::core::MetricsCollector;

impl MetricsCollector {
    /// Record ERIR request metrics
    pub fn record_erir_request(&self, operation: &str, duration: f64, success: bool) {
        let status = if success { "success" } else { "error" };

        self.erir_requests_total
            .with_label_values(&[operation, status])
            .inc();

        self.erir_request_duration
            .with_label_values(&[operation])
            .observe(duration);
    }

    /// Update circuit breaker state
    pub fn update_circuit_breaker_state(&self, service_name: &str, state: u8) {
        self.erir_circuit_breaker_state
            .with_label_values(&[service_name])
            .set(state as f64);
    }
}