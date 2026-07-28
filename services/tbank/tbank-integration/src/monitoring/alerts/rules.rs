// Alert Rules and Evaluation Logic
//
// This module contains the logic for creating and evaluating alert rules.

use crate::monitoring::alerts::types::{
    Alert, AlertCondition, AlertLevel, AlertRule, AlertType, MetricThreshold,
    AlertContext, AlertMetadata,
};
use chrono::Utc;
use std::collections::HashMap;
use tracing::{debug, warn};
use uuid::Uuid;

/// Evaluate all alert rules against current metrics
pub async fn evaluate_alert_rules(
    rules: &[AlertRule],
    metrics: &HashMap<String, f64>,
    context: &AlertContext,
) -> Vec<Alert> {
    let mut triggered_alerts = Vec::new();

    for rule in rules {
        if !rule.enabled {
            continue;
        }

        debug!("Evaluating rule: {}", rule.name);

        // Check if any threshold in this rule is violated
        for threshold in &rule.thresholds {
            if let Some(&metric_value) = metrics.get(&threshold.metric_name) {
                if threshold.evaluate(metric_value) {
                    let alert = create_alert_from_rule(rule, threshold, metric_value, context);
                    triggered_alerts.push(alert);
                    break; // Only trigger one alert per rule
                }
            } else {
                warn!("Metric '{}' not found for rule '{}'", threshold.metric_name, rule.name);
            }
        }
    }

    triggered_alerts
}

/// Create an alert from a triggered rule
fn create_alert_from_rule(
    rule: &AlertRule,
    threshold: &MetricThreshold,
    current_value: f64,
    context: &AlertContext,
) -> Alert {
    let threshold_value = match &threshold.condition {
        AlertCondition::GreaterThan(val) => *val,
        AlertCondition::LessThan(val) => *val,
        AlertCondition::Equals(val) => *val,
        AlertCondition::Between(min, _) => *min,
        AlertCondition::NotBetween(min, _) => *min,
        AlertCondition::IsTrue => 1.0,
        AlertCondition::IsFalse => 0.0,
        AlertCondition::Matches(_) => 0.0,
    };

    let title = format!("{} - {}", rule.name, threshold.metric_name);
    let message = format!(
        "Metric '{}' has {} (current: {:.2}, threshold: {:.2})",
        threshold.metric_name,
        describe_condition(&threshold.condition),
        current_value,
        threshold_value
    );

    let metadata = AlertMetadata {
        current_value,
        threshold_value,
        previous_value: None,
        trend: None,
        related_metrics: HashMap::new(),
    };

    let mut alert = Alert::new(
        rule.id,
        title,
        message,
        rule.alert_type.clone(),
        rule.level.clone(),
        context.clone(),
        metadata,
    );

    // Copy tags from rule
    alert.tags = rule.tags.clone();

    alert
}

/// Describe an alert condition in human-readable format
fn describe_condition(condition: &AlertCondition) -> String {
    match condition {
        AlertCondition::GreaterThan(val) => format!("exceeded threshold of {:.2}", val),
        AlertCondition::LessThan(val) => format!("fallen below threshold of {:.2}", val),
        AlertCondition::Equals(val) => format!("equals {:.2}", val),
        AlertCondition::Between(min, max) => format!("is between {:.2} and {:.2}", min, max),
        AlertCondition::NotBetween(min, max) => format!("is outside range {:.2} to {:.2}", min, max),
        AlertCondition::IsTrue => "is true".to_string(),
        AlertCondition::IsFalse => "is false".to_string(),
        AlertCondition::Matches(pattern) => format!("matches pattern '{}'", pattern),
    }
}

/// Create a performance-related alert rule
pub fn create_performance_rule(
    name: String,
    metric_name: String,
    max_response_time_ms: f64,
    notification_channels: Vec<String>,
) -> AlertRule {
    let threshold = MetricThreshold::new(
        metric_name,
        AlertCondition::GreaterThan(max_response_time_ms),
        60, // Duration: 1 minute
        30, // Evaluation interval: 30 seconds
    );

    let mut rule = AlertRule::new(
        name,
        format!("Performance alert for response time > {:.0}ms", max_response_time_ms),
        AlertType::Performance,
        AlertLevel::Warning,
        vec![threshold],
        notification_channels,
    );

    rule.add_tag("category".to_string(), "performance".to_string());
    rule.add_tag("metric_type".to_string(), "response_time".to_string());

    rule
}

/// Create an error rate alert rule
pub fn create_error_rate_rule(
    name: String,
    metric_name: String,
    max_error_rate_percent: f64,
    notification_channels: Vec<String>,
) -> AlertRule {
    let threshold = MetricThreshold::new(
        metric_name,
        AlertCondition::GreaterThan(max_error_rate_percent),
        120, // Duration: 2 minutes
        60,  // Evaluation interval: 1 minute
    );

    let mut rule = AlertRule::new(
        name,
        format!("Error rate alert for > {:.1}% errors", max_error_rate_percent),
        AlertType::ErrorRate,
        AlertLevel::Critical,
        vec![threshold],
        notification_channels,
    );

    rule.add_tag("category".to_string(), "reliability".to_string());
    rule.add_tag("metric_type".to_string(), "error_rate".to_string());

    rule
}

/// Create a service availability alert rule
pub fn create_availability_rule(
    name: String,
    metric_name: String,
    min_availability_percent: f64,
    notification_channels: Vec<String>,
) -> AlertRule {
    let threshold = MetricThreshold::new(
        metric_name,
        AlertCondition::LessThan(min_availability_percent),
        30, // Duration: 30 seconds
        15, // Evaluation interval: 15 seconds
    );

    let mut rule = AlertRule::new(
        name,
        format!("Availability alert for < {:.1}% uptime", min_availability_percent),
        AlertType::Availability,
        AlertLevel::Emergency,
        vec![threshold],
        notification_channels,
    );

    rule.add_tag("category".to_string(), "availability".to_string());
    rule.add_tag("metric_type".to_string(), "uptime".to_string());

    rule
}

/// Create a security-related alert rule
pub fn create_security_rule(
    name: String,
    metric_name: String,
    max_failed_attempts: f64,
    notification_channels: Vec<String>,
) -> AlertRule {
    let threshold = MetricThreshold::new(
        metric_name,
        AlertCondition::GreaterThan(max_failed_attempts),
        60, // Duration: 1 minute
        30, // Evaluation interval: 30 seconds
    );

    let mut rule = AlertRule::new(
        name,
        format!("Security alert for > {:.0} failed attempts", max_failed_attempts),
        AlertType::Security,
        AlertLevel::Critical,
        vec![threshold],
        notification_channels,
    );

    rule.add_tag("category".to_string(), "security".to_string());
    rule.add_tag("metric_type".to_string(), "failed_attempts".to_string());

    rule
}

/// Create a resource usage alert rule
pub fn create_resource_rule(
    name: String,
    metric_name: String,
    max_usage_percent: f64,
    level: AlertLevel,
    notification_channels: Vec<String>,
) -> AlertRule {
    let threshold = MetricThreshold::new(
        metric_name,
        AlertCondition::GreaterThan(max_usage_percent),
        300, // Duration: 5 minutes
        60,  // Evaluation interval: 1 minute
    );

    let mut rule = AlertRule::new(
        name,
        format!("Resource usage alert for > {:.1}% utilization", max_usage_percent),
        AlertType::Resource,
        level,
        vec![threshold],
        notification_channels,
    );

    rule.add_tag("category".to_string(), "resources".to_string());
    rule.add_tag("metric_type".to_string(), "utilization".to_string());

    rule
}

/// Create a business logic alert rule
pub fn create_business_rule(
    name: String,
    metric_name: String,
    condition: AlertCondition,
    level: AlertLevel,
    notification_channels: Vec<String>,
) -> AlertRule {
    let threshold = MetricThreshold::new(
        metric_name,
        condition,
        180, // Duration: 3 minutes
        60,  // Evaluation interval: 1 minute
    );

    let mut rule = AlertRule::new(
        name,
        "Business logic alert".to_string(),
        AlertType::Business,
        level,
        vec![threshold],
        notification_channels,
    );

    rule.add_tag("category".to_string(), "business".to_string());

    rule
}

/// Create default T-Bank monitoring rules
pub fn create_default_tbank_rules() -> Vec<AlertRule> {
    let channels = vec!["slack".to_string(), "log".to_string()];
    
    vec![
        // Performance rules
        create_performance_rule(
            "T-Bank API Response Time".to_string(),
            "tbank_api_response_time_ms".to_string(),
            5000.0, // 5 seconds
            channels.clone(),
        ),
        create_performance_rule(
            "T-Bank Transaction Processing Time".to_string(),
            "tbank_transaction_time_ms".to_string(),
            10000.0, // 10 seconds
            channels.clone(),
        ),
        
        // Error rate rules
        create_error_rate_rule(
            "T-Bank API Error Rate".to_string(),
            "tbank_api_error_rate_percent".to_string(),
            5.0, // 5%
            channels.clone(),
        ),
        create_error_rate_rule(
            "T-Bank Transaction Failure Rate".to_string(),
            "tbank_transaction_failure_rate_percent".to_string(),
            2.0, // 2%
            channels.clone(),
        ),
        
        // Availability rules
        create_availability_rule(
            "T-Bank Service Availability".to_string(),
            "tbank_service_availability_percent".to_string(),
            99.0, // 99%
            channels.clone(),
        ),
        
        // Security rules
        create_security_rule(
            "T-Bank Authentication Failures".to_string(),
            "tbank_auth_failures_per_minute".to_string(),
            10.0, // 10 failures per minute
            channels.clone(),
        ),
        
        // Resource rules
        create_resource_rule(
            "T-Bank CPU Usage".to_string(),
            "tbank_cpu_usage_percent".to_string(),
            80.0, // 80%
            AlertLevel::Warning,
            channels.clone(),
        ),
        create_resource_rule(
            "T-Bank Memory Usage".to_string(),
            "tbank_memory_usage_percent".to_string(),
            85.0, // 85%
            AlertLevel::Warning,
            channels.clone(),
        ),
        
        // Business rules
        create_business_rule(
            "T-Bank Daily Transaction Volume".to_string(),
            "tbank_daily_transactions".to_string(),
            AlertCondition::LessThan(100.0), // Less than 100 transactions per day
            AlertLevel::Warning,
            channels.clone(),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_performance_rule() {
        let rule = create_performance_rule(
            "Test Performance".to_string(),
            "response_time".to_string(),
            1000.0,
            vec!["test".to_string()],
        );

        assert_eq!(rule.name, "Test Performance");
        assert_eq!(rule.alert_type, AlertType::Performance);
        assert_eq!(rule.level, AlertLevel::Warning);
        assert_eq!(rule.thresholds.len(), 1);
        assert!(rule.enabled);
    }

    #[test]
    fn test_evaluate_threshold() {
        let threshold = MetricThreshold::new(
            "test_metric".to_string(),
            AlertCondition::GreaterThan(100.0),
            60,
            30,
        );

        assert!(threshold.evaluate(150.0));
        assert!(!threshold.evaluate(50.0));
        assert!(!threshold.evaluate(100.0));
    }

    #[test]
    fn test_describe_condition() {
        assert_eq!(
            describe_condition(&AlertCondition::GreaterThan(100.0)),
            "exceeded threshold of 100.00"
        );
        assert_eq!(
            describe_condition(&AlertCondition::LessThan(50.0)),
            "fallen below threshold of 50.00"
        );
    }
}