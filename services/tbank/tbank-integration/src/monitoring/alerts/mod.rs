// T-Bank Monitoring Alerts Module
//
// This module provides comprehensive alerting functionality for T-Bank integration monitoring.
// It includes various alert types, notification channels, and alert management.

pub mod types;
pub mod channels;
pub mod rules;
pub mod manager;
pub mod metrics;
pub mod config;

#[cfg(test)]
pub mod tests;

// Re-export commonly used types and functions for backward compatibility
pub use types::{
    Alert, AlertLevel, AlertType, AlertStatus, AlertRule, AlertCondition,
    MetricThreshold, AlertContext, AlertMetadata,
};
pub use channels::{
    AlertChannel, NotificationChannel, SlackChannel, EmailChannel, WebhookChannel,
    send_alert_notification, format_alert_message,
};
pub use rules::{
    evaluate_alert_rules, create_performance_rule, create_error_rate_rule,
    create_availability_rule, create_security_rule,
};
pub use manager::{
    AlertManager, start_alert_monitoring, stop_alert_monitoring,
    register_alert_rule, deregister_alert_rule, get_active_alerts,
};
pub use metrics::{
    collect_tbank_metrics, calculate_error_rate, calculate_response_time,
    check_service_availability, TBankMetrics,
};
pub use config::{AlertConfig, load_alert_config_from_env};