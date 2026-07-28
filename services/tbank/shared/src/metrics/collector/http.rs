use super::core::MetricsCollector;

impl MetricsCollector {
    /// Record HTTP request metrics
    pub fn record_http_request(
        &self,
        method: &str,
        endpoint: &str,
        status_code: u16,
        duration: f64,
        service: &str,
    ) {
        self.http_requests_total
            .with_label_values(&[method, endpoint, &status_code.to_string(), service])
            .inc();

        self.http_request_duration
            .with_label_values(&[method, endpoint, service])
            .observe(duration);
    }
}