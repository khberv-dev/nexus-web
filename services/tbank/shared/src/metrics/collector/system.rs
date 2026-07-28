use super::core::MetricsCollector;

impl MetricsCollector {
    /// Update system metrics
    pub fn update_system_metrics(
        &self,
        active_connections: u32,
        memory_usage: u64,
        cpu_usage: f64,
        db_active: u32,
        db_idle: u32,
        redis_memory: u64,
    ) {
        self.active_connections.set(active_connections as f64);
        self.memory_usage_bytes.set(memory_usage as f64);
        self.cpu_usage_percent.set(cpu_usage);
        self.database_connections_active.set(db_active as f64);
        self.database_connections_idle.set(db_idle as f64);
        self.redis_memory_usage_bytes.set(redis_memory as f64);
    }

    /// Record rate limit violation
    pub fn record_rate_limit_violation(&self, rule_id: &str, identifier_type: &str) {
        self.rate_limit_violations_total
            .with_label_values(&[rule_id, identifier_type])
            .inc();
    }
}