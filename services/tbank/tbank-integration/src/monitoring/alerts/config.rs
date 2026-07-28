// Alert Configuration
//
// This module handles configuration loading for the alert system.

use crate::monitoring::alerts::{
    channels::{NotificationChannel, SlackChannel, EmailChannel, WebhookChannel, LogChannel},
    manager::AlertManagerConfig,
    rules::create_default_tbank_rules,
    types::AlertRule,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use tracing::{info, warn};

/// Main configuration structure for the alert system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
    /// Alert manager configuration
    pub manager: AlertManagerConfig,
    /// Notification channels configuration
    pub channels: HashMap<String, ChannelConfig>,
    /// Custom alert rules (in addition to defaults)
    pub custom_rules: Vec<AlertRuleConfig>,
    /// Metrics collection configuration
    pub metrics: MetricsConfig,
    /// Whether to load default T-Bank rules
    pub load_default_rules: bool,
}

/// Configuration for notification channels
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChannelConfig {
    #[serde(rename = "slack")]
    Slack {
        webhook_url: String,
        channel: String,
        username: Option<String>,
        icon_emoji: Option<String>,
        enabled: bool,
    },
    #[serde(rename = "email")]
    Email {
        smtp_server: String,
        smtp_port: u16,
        username: String,
        password: String,
        from_address: String,
        to_addresses: Vec<String>,
        enabled: bool,
    },
    #[serde(rename = "webhook")]
    Webhook {
        url: String,
        method: String,
        headers: HashMap<String, String>,
        timeout_seconds: u64,
        retry_attempts: u32,
        enabled: bool,
    },
    #[serde(rename = "log")]
    Log {
        log_level: String,
        enabled: bool,
    },
}

/// Configuration for custom alert rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRuleConfig {
    pub name: String,
    pub description: String,
    pub alert_type: String,
    pub level: String,
    pub metric_name: String,
    pub condition: String,
    pub threshold_value: f64,
    pub duration_seconds: u64,
    pub evaluation_interval_seconds: u64,
    pub notification_channels: Vec<String>,
    pub enabled: bool,
    pub tags: HashMap<String, String>,
}

/// Configuration for metrics collection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    /// Maximum number of historical metrics to keep
    pub max_history_size: usize,
    /// How long to keep metrics in memory (hours)
    pub retention_hours: i64,
    /// Whether to enable metrics collection
    pub enabled: bool,
}

impl Default for AlertConfig {
    fn default() -> Self {
        Self {
            manager: AlertManagerConfig::default(),
            channels: HashMap::new(),
            custom_rules: Vec::new(),
            metrics: MetricsConfig::default(),
            load_default_rules: true,
        }
    }
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            max_history_size: 1440, // 24 hours of minute data
            retention_hours: 24,
            enabled: true,
        }
    }
}

/// Load alert configuration from environment variables
pub fn load_alert_config_from_env() -> AlertConfig {
    let mut config = AlertConfig::default();

    // Manager configuration
    if let Ok(interval) = env::var("TBANK_ALERT_EVALUATION_INTERVAL_SECONDS") {
        if let Ok(val) = interval.parse::<u64>() {
            config.manager.evaluation_interval_seconds = val;
        }
    }

    if let Ok(max_history) = env::var("TBANK_ALERT_MAX_HISTORY_SIZE") {
        if let Ok(val) = max_history.parse::<usize>() {
            config.manager.max_history_size = val;
        }
    }

    if let Ok(retention) = env::var("TBANK_ALERT_HISTORY_RETENTION_HOURS") {
        if let Ok(val) = retention.parse::<i64>() {
            config.manager.history_retention_hours = val;
        }
    }

    if let Ok(max_notifications) = env::var("TBANK_ALERT_MAX_NOTIFICATIONS_PER_HOUR") {
        if let Ok(val) = max_notifications.parse::<u32>() {
            config.manager.max_notifications_per_hour = val;
        }
    }

    if let Ok(dedup) = env::var("TBANK_ALERT_ENABLE_DEDUPLICATION") {
        config.manager.enable_deduplication = dedup.to_lowercase() == "true";
    }

    if let Ok(dedup_window) = env::var("TBANK_ALERT_DEDUPLICATION_WINDOW_MINUTES") {
        if let Ok(val) = dedup_window.parse::<i64>() {
            config.manager.deduplication_window_minutes = val;
        }
    }

    // Load notification channels
    load_slack_channel_config(&mut config);
    load_email_channel_config(&mut config);
    load_webhook_channel_config(&mut config);
    load_log_channel_config(&mut config);

    // Metrics configuration
    if let Ok(metrics_enabled) = env::var("TBANK_METRICS_ENABLED") {
        config.metrics.enabled = metrics_enabled.to_lowercase() == "true";
    }

    if let Ok(metrics_history) = env::var("TBANK_METRICS_MAX_HISTORY_SIZE") {
        if let Ok(val) = metrics_history.parse::<usize>() {
            config.metrics.max_history_size = val;
        }
    }

    if let Ok(metrics_retention) = env::var("TBANK_METRICS_RETENTION_HOURS") {
        if let Ok(val) = metrics_retention.parse::<i64>() {
            config.metrics.retention_hours = val;
        }
    }

    // Load default rules setting
    if let Ok(load_defaults) = env::var("TBANK_ALERT_LOAD_DEFAULT_RULES") {
        config.load_default_rules = load_defaults.to_lowercase() == "true";
    }

    info!("Loaded alert configuration from environment");
    config
}

/// Load Slack channel configuration from environment
fn load_slack_channel_config(config: &mut AlertConfig) {
    if let Ok(webhook_url) = env::var("TBANK_SLACK_WEBHOOK_URL") {
        let channel = env::var("TBANK_SLACK_CHANNEL").unwrap_or_else(|_| "#alerts".to_string());
        let username = env::var("TBANK_SLACK_USERNAME").ok();
        let icon_emoji = env::var("TBANK_SLACK_ICON_EMOJI").ok();
        let enabled = env::var("TBANK_SLACK_ENABLED")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(true);

        config.channels.insert(
            "slack".to_string(),
            ChannelConfig::Slack {
                webhook_url,
                channel,
                username,
                icon_emoji,
                enabled,
            },
        );

        info!("Configured Slack notification channel");
    }
}

/// Load email channel configuration from environment
fn load_email_channel_config(config: &mut AlertConfig) {
    if let (Ok(smtp_server), Ok(username), Ok(password), Ok(from_address)) = (
        env::var("TBANK_EMAIL_SMTP_SERVER"),
        env::var("TBANK_EMAIL_USERNAME"),
        env::var("TBANK_EMAIL_PASSWORD"),
        env::var("TBANK_EMAIL_FROM_ADDRESS"),
    ) {
        let smtp_port = env::var("TBANK_EMAIL_SMTP_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(587);

        let to_addresses = env::var("TBANK_EMAIL_TO_ADDRESSES")
            .map(|addrs| addrs.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|_| vec!["admin@example.com".to_string()]);

        let enabled = env::var("TBANK_EMAIL_ENABLED")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(true);

        config.channels.insert(
            "email".to_string(),
            ChannelConfig::Email {
                smtp_server,
                smtp_port,
                username,
                password,
                from_address,
                to_addresses,
                enabled,
            },
        );

        info!("Configured email notification channel");
    }
}

/// Load webhook channel configuration from environment
fn load_webhook_channel_config(config: &mut AlertConfig) {
    if let Ok(url) = env::var("TBANK_WEBHOOK_URL") {
        let method = env::var("TBANK_WEBHOOK_METHOD").unwrap_or_else(|_| "POST".to_string());
        
        let mut headers = HashMap::new();
        if let Ok(auth_header) = env::var("TBANK_WEBHOOK_AUTH_HEADER") {
            headers.insert("Authorization".to_string(), auth_header);
        }
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        let timeout_seconds = env::var("TBANK_WEBHOOK_TIMEOUT_SECONDS")
            .ok()
            .and_then(|t| t.parse().ok())
            .unwrap_or(30);

        let retry_attempts = env::var("TBANK_WEBHOOK_RETRY_ATTEMPTS")
            .ok()
            .and_then(|r| r.parse().ok())
            .unwrap_or(3);

        let enabled = env::var("TBANK_WEBHOOK_ENABLED")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(true);

        config.channels.insert(
            "webhook".to_string(),
            ChannelConfig::Webhook {
                url,
                method,
                headers,
                timeout_seconds,
                retry_attempts,
                enabled,
            },
        );

        info!("Configured webhook notification channel");
    }
}

/// Load log channel configuration from environment
fn load_log_channel_config(config: &mut AlertConfig) {
    let log_level = env::var("TBANK_LOG_ALERT_LEVEL").unwrap_or_else(|_| "warn".to_string());
    let enabled = env::var("TBANK_LOG_ALERTS_ENABLED")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(true);

    config.channels.insert(
        "log".to_string(),
        ChannelConfig::Log {
            log_level,
            enabled,
        },
    );

    info!("Configured log notification channel");
}

/// Convert channel configuration to notification channel
pub fn create_notification_channel(name: &str, config: &ChannelConfig) -> NotificationChannel {
    match config {
        ChannelConfig::Slack {
            webhook_url,
            channel,
            username,
            icon_emoji,
            enabled,
        } => NotificationChannel::Slack(SlackChannel {
            name: name.to_string(),
            webhook_url: webhook_url.clone(),
            channel: channel.clone(),
            username: username.clone(),
            icon_emoji: icon_emoji.clone(),
            enabled: *enabled,
        }),
        ChannelConfig::Email {
            smtp_server,
            smtp_port,
            username,
            password,
            from_address,
            to_addresses,
            enabled,
        } => NotificationChannel::Email(EmailChannel {
            name: name.to_string(),
            smtp_server: smtp_server.clone(),
            smtp_port: *smtp_port,
            username: username.clone(),
            password: password.clone(),
            from_address: from_address.clone(),
            to_addresses: to_addresses.clone(),
            enabled: *enabled,
        }),
        ChannelConfig::Webhook {
            url,
            method,
            headers,
            timeout_seconds,
            retry_attempts,
            enabled,
        } => NotificationChannel::Webhook(WebhookChannel {
            name: name.to_string(),
            url: url.clone(),
            method: method.clone(),
            headers: headers.clone(),
            timeout_seconds: *timeout_seconds,
            retry_attempts: *retry_attempts,
            enabled: *enabled,
        }),
        ChannelConfig::Log { log_level, enabled } => NotificationChannel::Log(LogChannel {
            name: name.to_string(),
            log_level: log_level.clone(),
            enabled: *enabled,
        }),
    }
}

/// Get all configured notification channels
pub fn get_notification_channels(config: &AlertConfig) -> HashMap<String, NotificationChannel> {
    config
        .channels
        .iter()
        .map(|(name, channel_config)| {
            (name.clone(), create_notification_channel(name, channel_config))
        })
        .collect()
}

/// Get default alert rules plus any custom rules from configuration
pub fn get_alert_rules(config: &AlertConfig) -> Vec<AlertRule> {
    let mut rules = Vec::new();

    // Add default rules if enabled
    if config.load_default_rules {
        rules.extend(create_default_tbank_rules());
        info!("Loaded {} default T-Bank alert rules", rules.len());
    }

    // Add custom rules from configuration
    for rule_config in &config.custom_rules {
        if let Ok(rule) = convert_rule_config_to_alert_rule(rule_config) {
            rules.push(rule);
        } else {
            warn!("Failed to parse custom alert rule: {}", rule_config.name);
        }
    }

    if !config.custom_rules.is_empty() {
        info!("Loaded {} custom alert rules", config.custom_rules.len());
    }

    rules
}

/// Convert rule configuration to AlertRule
fn convert_rule_config_to_alert_rule(config: &AlertRuleConfig) -> Result<AlertRule, String> {
    use crate::monitoring::alerts::types::{AlertCondition, AlertLevel, AlertType, MetricThreshold};

    // Parse alert type
    let alert_type = match config.alert_type.to_lowercase().as_str() {
        "performance" => AlertType::Performance,
        "errorrate" | "error_rate" => AlertType::ErrorRate,
        "availability" => AlertType::Availability,
        "security" => AlertType::Security,
        "resource" => AlertType::Resource,
        "business" => AlertType::Business,
        _ => return Err(format!("Unknown alert type: {}", config.alert_type)),
    };

    // Parse alert level
    let level = match config.level.to_lowercase().as_str() {
        "info" => AlertLevel::Info,
        "warning" | "warn" => AlertLevel::Warning,
        "critical" => AlertLevel::Critical,
        "emergency" => AlertLevel::Emergency,
        _ => return Err(format!("Unknown alert level: {}", config.level)),
    };

    // Parse condition
    let condition = match config.condition.to_lowercase().as_str() {
        "greater_than" | "gt" | ">" => AlertCondition::GreaterThan(config.threshold_value),
        "less_than" | "lt" | "<" => AlertCondition::LessThan(config.threshold_value),
        "equals" | "eq" | "==" => AlertCondition::Equals(config.threshold_value),
        "is_true" => AlertCondition::IsTrue,
        "is_false" => AlertCondition::IsFalse,
        _ => return Err(format!("Unknown condition: {}", config.condition)),
    };

    // Create threshold
    let threshold = MetricThreshold::new(
        config.metric_name.clone(),
        condition,
        config.duration_seconds,
        config.evaluation_interval_seconds,
    );

    // Create rule
    let mut rule = AlertRule::new(
        config.name.clone(),
        config.description.clone(),
        alert_type,
        level,
        vec![threshold],
        config.notification_channels.clone(),
    );

    // Set enabled state
    if !config.enabled {
        rule.disable();
    }

    // Add tags
    for (key, value) in &config.tags {
        rule.add_tag(key.clone(), value.clone());
    }

    Ok(rule)
}

/// Create a sample configuration file content
pub fn create_sample_config() -> String {
    let sample_config = r#"# T-Bank Alert System Configuration
# This file shows example configuration for the alert system

# Manager Configuration
TBANK_ALERT_EVALUATION_INTERVAL_SECONDS=60
TBANK_ALERT_MAX_HISTORY_SIZE=10000
TBANK_ALERT_HISTORY_RETENTION_HOURS=24
TBANK_ALERT_MAX_NOTIFICATIONS_PER_HOUR=10
TBANK_ALERT_ENABLE_DEDUPLICATION=true
TBANK_ALERT_DEDUPLICATION_WINDOW_MINUTES=5

# Slack Notifications
TBANK_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
TBANK_SLACK_CHANNEL=#alerts
TBANK_SLACK_USERNAME=T-Bank Monitor
TBANK_SLACK_ICON_EMOJI=:warning:
TBANK_SLACK_ENABLED=true

# Email Notifications
TBANK_EMAIL_SMTP_SERVER=smtp.gmail.com
TBANK_EMAIL_SMTP_PORT=587
TBANK_EMAIL_USERNAME=alerts@yourcompany.com
TBANK_EMAIL_PASSWORD=your_app_password
TBANK_EMAIL_FROM_ADDRESS=alerts@yourcompany.com
TBANK_EMAIL_TO_ADDRESSES=admin@yourcompany.com,ops@yourcompany.com
TBANK_EMAIL_ENABLED=false

# Webhook Notifications
TBANK_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
TBANK_WEBHOOK_METHOD=POST
TBANK_WEBHOOK_AUTH_HEADER=Bearer your_token_here
TBANK_WEBHOOK_TIMEOUT_SECONDS=30
TBANK_WEBHOOK_RETRY_ATTEMPTS=3
TBANK_WEBHOOK_ENABLED=false

# Log Notifications
TBANK_LOG_ALERT_LEVEL=warn
TBANK_LOG_ALERTS_ENABLED=true

# Metrics Configuration
TBANK_METRICS_ENABLED=true
TBANK_METRICS_MAX_HISTORY_SIZE=1440
TBANK_METRICS_RETENTION_HOURS=24

# Default Rules
TBANK_ALERT_LOAD_DEFAULT_RULES=true
"#;

    sample_config.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_load_alert_config_from_env() {
        // Set some test environment variables
        env::set_var("TBANK_ALERT_EVALUATION_INTERVAL_SECONDS", "30");
        env::set_var("TBANK_ALERT_ENABLE_DEDUPLICATION", "false");
        
        let config = load_alert_config_from_env();
        
        assert_eq!(config.manager.evaluation_interval_seconds, 30);
        assert!(!config.manager.enable_deduplication);
        
        // Clean up
        env::remove_var("TBANK_ALERT_EVALUATION_INTERVAL_SECONDS");
        env::remove_var("TBANK_ALERT_ENABLE_DEDUPLICATION");
    }

    #[test]
    fn test_create_sample_config() {
        let sample = create_sample_config();
        assert!(sample.contains("TBANK_ALERT_EVALUATION_INTERVAL_SECONDS"));
        assert!(sample.contains("TBANK_SLACK_WEBHOOK_URL"));
        assert!(sample.contains("TBANK_METRICS_ENABLED"));
    }
}