// Alert Notification Channels
//
// This module handles different notification channels for sending alerts.

use crate::monitoring::alerts::types::{Alert, AlertLevel};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

/// Configuration for different notification channels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationChannel {
    Slack(SlackChannel),
    Email(EmailChannel),
    Webhook(WebhookChannel),
    Log(LogChannel),
}

/// Slack notification channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackChannel {
    pub name: String,
    pub webhook_url: String,
    pub channel: String,
    pub username: Option<String>,
    pub icon_emoji: Option<String>,
    pub enabled: bool,
}

/// Email notification channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailChannel {
    pub name: String,
    pub smtp_server: String,
    pub smtp_port: u16,
    pub username: String,
    pub password: String,
    pub from_address: String,
    pub to_addresses: Vec<String>,
    pub enabled: bool,
}

/// Webhook notification channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookChannel {
    pub name: String,
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub timeout_seconds: u64,
    pub retry_attempts: u32,
    pub enabled: bool,
}

/// Log-based notification channel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogChannel {
    pub name: String,
    pub log_level: String,
    pub enabled: bool,
}

/// Generic alert channel trait
pub trait AlertChannel {
    /// Send an alert notification
    async fn send_notification(&self, alert: &Alert) -> Result<(), AlertChannelError>;
    
    /// Check if the channel is enabled
    fn is_enabled(&self) -> bool;
    
    /// Get the channel name
    fn get_name(&self) -> &str;
    
    /// Test the channel connectivity
    async fn test_connection(&self) -> Result<(), AlertChannelError>;
}

/// Errors that can occur when sending notifications
#[derive(Debug, thiserror::Error)]
pub enum AlertChannelError {
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Authentication error: {0}")]
    AuthenticationError(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Timeout error: {0}")]
    TimeoutError(String),
    
    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),
    
    #[error("Channel disabled: {0}")]
    ChannelDisabled(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl AlertChannel for SlackChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<(), AlertChannelError> {
        if !self.enabled {
            return Err(AlertChannelError::ChannelDisabled(self.name.clone()));
        }

        let message = format_slack_message(alert);
        let payload = serde_json::json!({
            "channel": self.channel,
            "username": self.username.as_deref().unwrap_or("T-Bank Monitor"),
            "icon_emoji": self.icon_emoji.as_deref().unwrap_or(":warning:"),
            "attachments": [message]
        });

        send_webhook_request(&self.webhook_url, &payload, 30).await
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn get_name(&self) -> &str {
        &self.name
    }

    async fn test_connection(&self) -> Result<(), AlertChannelError> {
        let test_payload = serde_json::json!({
            "channel": self.channel,
            "username": "T-Bank Monitor Test",
            "text": "Test connection - please ignore"
        });

        send_webhook_request(&self.webhook_url, &test_payload, 10).await
    }
}

impl AlertChannel for WebhookChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<(), AlertChannelError> {
        if !self.enabled {
            return Err(AlertChannelError::ChannelDisabled(self.name.clone()));
        }

        let payload = serde_json::to_value(alert)
            .map_err(|e| AlertChannelError::SerializationError(e.to_string()))?;

        send_webhook_request(&self.url, &payload, self.timeout_seconds).await
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn get_name(&self) -> &str {
        &self.name
    }

    async fn test_connection(&self) -> Result<(), AlertChannelError> {
        let test_payload = serde_json::json!({
            "test": true,
            "timestamp": Utc::now().to_rfc3339(),
            "message": "T-Bank monitoring test"
        });

        send_webhook_request(&self.url, &test_payload, 10).await
    }
}

impl AlertChannel for LogChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<(), AlertChannelError> {
        if !self.enabled {
            return Err(AlertChannelError::ChannelDisabled(self.name.clone()));
        }

        let message = format_log_message(alert);
        
        match self.log_level.to_lowercase().as_str() {
            "error" => error!("{}", message),
            "warn" | "warning" => warn!("{}", message),
            "info" => info!("{}", message),
            _ => info!("{}", message),
        }

        Ok(())
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn get_name(&self) -> &str {
        &self.name
    }

    async fn test_connection(&self) -> Result<(), AlertChannelError> {
        info!("T-Bank monitoring log channel test - connection OK");
        Ok(())
    }
}

/// Send an alert notification through the specified channel
pub async fn send_alert_notification(
    channel: &NotificationChannel,
    alert: &Alert,
) -> Result<(), AlertChannelError> {
    match channel {
        NotificationChannel::Slack(slack) => slack.send_notification(alert).await,
        NotificationChannel::Email(email) => email.send_notification(alert).await,
        NotificationChannel::Webhook(webhook) => webhook.send_notification(alert).await,
        NotificationChannel::Log(log) => log.send_notification(alert).await,
    }
}

/// Format an alert message for display
pub fn format_alert_message(alert: &Alert) -> String {
    format!(
        "[{}] {} - {}\n\nService: {}\nEnvironment: {}\nTriggered: {}\nCurrent Value: {}\nThreshold: {}",
        alert.level.to_string().to_uppercase(),
        alert.title,
        alert.message,
        alert.context.service,
        alert.context.environment,
        alert.triggered_at.format("%Y-%m-%d %H:%M:%S UTC"),
        alert.metadata.current_value,
        alert.metadata.threshold_value
    )
}

/// Format alert message specifically for Slack
fn format_slack_message(alert: &Alert) -> serde_json::Value {
    let color = match alert.level {
        AlertLevel::Emergency => "danger",
        AlertLevel::Critical => "danger", 
        AlertLevel::Warning => "warning",
        AlertLevel::Info => "good",
    };

    let emoji = match alert.level {
        AlertLevel::Emergency => ":rotating_light:",
        AlertLevel::Critical => ":exclamation:",
        AlertLevel::Warning => ":warning:",
        AlertLevel::Info => ":information_source:",
    };

    serde_json::json!({
        "color": color,
        "title": format!("{} {}", emoji, alert.title),
        "text": alert.message,
        "fields": [
            {
                "title": "Service",
                "value": alert.context.service,
                "short": true
            },
            {
                "title": "Environment", 
                "value": alert.context.environment,
                "short": true
            },
            {
                "title": "Current Value",
                "value": alert.metadata.current_value.to_string(),
                "short": true
            },
            {
                "title": "Threshold",
                "value": alert.metadata.threshold_value.to_string(),
                "short": true
            },
            {
                "title": "Triggered At",
                "value": alert.triggered_at.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
                "short": false
            }
        ],
        "footer": "T-Bank Monitoring",
        "ts": alert.triggered_at.timestamp()
    })
}

/// Format alert message for log output
fn format_log_message(alert: &Alert) -> String {
    format!(
        "ALERT [{}] {} | Service: {} | Env: {} | Value: {} | Threshold: {} | ID: {}",
        alert.level.to_string().to_uppercase(),
        alert.title,
        alert.context.service,
        alert.context.environment,
        alert.metadata.current_value,
        alert.metadata.threshold_value,
        alert.id
    )
}

/// Send a webhook request with retry logic
async fn send_webhook_request(
    url: &str,
    payload: &serde_json::Value,
    timeout_seconds: u64,
) -> Result<(), AlertChannelError> {
    let client = reqwest::Client::new();
    let mut attempts = 0;
    const MAX_RETRIES: u32 = 3;

    while attempts < MAX_RETRIES {
        match client
            .post(url)
            .json(payload)
            .timeout(Duration::from_secs(timeout_seconds))
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    return Ok(());
                } else if response.status().as_u16() == 429 {
                    // Rate limited, wait and retry
                    let wait_time = 2_u64.pow(attempts);
                    sleep(Duration::from_secs(wait_time)).await;
                    attempts += 1;
                    continue;
                } else {
                    return Err(AlertChannelError::NetworkError(
                        format!("HTTP {}: {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown"))
                    ));
                }
            }
            Err(e) => {
                if e.is_timeout() {
                    return Err(AlertChannelError::TimeoutError(e.to_string()));
                } else if attempts < MAX_RETRIES - 1 {
                    let wait_time = 2_u64.pow(attempts);
                    sleep(Duration::from_secs(wait_time)).await;
                    attempts += 1;
                    continue;
                } else {
                    return Err(AlertChannelError::NetworkError(e.to_string()));
                }
            }
        }
    }

    Err(AlertChannelError::NetworkError(
        "Max retries exceeded".to_string()
    ))
}

/// Email implementation (placeholder - would need actual SMTP implementation)
impl AlertChannel for EmailChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<(), AlertChannelError> {
        if !self.enabled {
            return Err(AlertChannelError::ChannelDisabled(self.name.clone()));
        }

        // TODO: Implement actual SMTP email sending
        // For now, just log that we would send an email
        info!(
            "Would send email alert to {:?}: {}",
            self.to_addresses,
            format_alert_message(alert)
        );

        Ok(())
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn get_name(&self) -> &str {
        &self.name
    }

    async fn test_connection(&self) -> Result<(), AlertChannelError> {
        // TODO: Implement actual SMTP connection test
        info!("Email channel test - would test SMTP connection to {}", self.smtp_server);
        Ok(())
    }
}

impl std::fmt::Display for AlertLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AlertLevel::Info => write!(f, "info"),
            AlertLevel::Warning => write!(f, "warning"),
            AlertLevel::Critical => write!(f, "critical"),
            AlertLevel::Emergency => write!(f, "emergency"),
        }
    }
}