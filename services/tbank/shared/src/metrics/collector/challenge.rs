use super::core::MetricsCollector;

impl MetricsCollector {
    /// Record challenge generation metrics
    pub fn record_challenge_generation(
        &self,
        site_key: &str,
        challenge_type: &str,
        duration: f64,
        success: bool,
    ) {
        let status = if success { "success" } else { "error" };

        self.challenges_generated_total
            .with_label_values(&[site_key, challenge_type, status])
            .inc();

        if success {
            self.challenge_generation_duration
                .with_label_values(&[challenge_type])
                .observe(duration);
        }
    }

    /// Record challenge validation metrics
    pub fn record_challenge_validation(
        &self,
        site_key: &str,
        challenge_type: &str,
        duration: f64,
        result: &str,
    ) {
        self.challenges_validated_total
            .with_label_values(&[site_key, challenge_type, result])
            .inc();

        self.challenge_validation_duration
            .with_label_values(&[challenge_type])
            .observe(duration);
    }
}