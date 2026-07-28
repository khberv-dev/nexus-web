use super::core::MetricsCollector;

impl MetricsCollector {
    /// Record CPV transaction metrics
    pub fn record_cpv_transaction(
        &self,
        advertiser_id: &str,
        publisher_id: &str,
        amount: f64,
        status: &str,
    ) {
        self.cpv_transactions_total
            .with_label_values(&[advertiser_id, publisher_id, status])
            .inc();

        self.cpv_transaction_amount
            .with_label_values(&[advertiser_id])
            .observe(amount);
    }

    /// Record financial error metrics
    pub fn record_financial_error(&self, error_type: &str, operation: &str) {
        self.billing_errors_total
            .with_label_values(&[error_type, operation])
            .inc();
    }
}