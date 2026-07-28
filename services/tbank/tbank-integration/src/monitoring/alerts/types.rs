// Alert Types and Data Structures
//
// This module defines all the core types used in the T-Bank alerting system.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Alert severity levels
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertLevel {
    /// Informational alerts - no immediate action required
    Info,
    /// Warning alerts - attention needed but not critical
    Warning,
    /// Critical alerts - immediate action required
    Critical,
    /// Emergency alerts - system is down or severely impacted
    Emergency,
}

/// Types of alerts that can be triggered
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertType {
    /// Performance-related alerts (response time, throughput)
    Performance,
    /// Error rate alerts
    ErrorRate,
    /// Service availability alerts
    Availability,
    /// Security-related alerts
    Security,
    /// Resource usage alerts (CPU, memory, disk)
    Resource,
    /// Business logic alerts (transaction failures, etc.)
    Business,
}

/// Current status of an alert
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertStatus {
    /// Alert is currently active/firing
    Active,
    /// Alert condition has been resolved
    Resolved,
    /// Alert has been acknowledged by operator
    Acknowledged,
    /// Alert has been suppressed/silenced
    Suppressed,
}

/// Conditions that can trigger an alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertCondition {
    /// Metric exceeds threshold
    GreaterThan(f64),
    /// Metric is below threshold
    LessThan(f64),
    /// Metric equals specific value
    Equals(f64),
    /// Metric is within range
    Between(f64, f64),
    /// Metric is outside range
    NotBetween(f64, f64),
    /// String metric matches pattern
    Matches(String),
    /// Boolean condition
    IsTrue,
    /// Boolean condition
    IsFalse,
}

/// Metric threshold configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricThreshold {
    /// Name of the metric to monitor
    pub metric_name: String,
    /// Condition that triggers the alert
    pub condition: AlertCondition,
    /// Duration the condition must persist before triggering
    pub duration_seconds: u64,
    /// How often to evaluate the condition
    pub evaluation_interval_seconds: u64,
}

/// Alert rule definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    /// Unique identifier for the rule
    pub id: Uuid,
    /// Human-readable name for the rule
    pub name: String,
    /// Description of what this rule monitors
    pub description: String,
    /// Type of alert this rule generates
    pub alert_type: AlertType,
    /// Severity level for alerts from this rule
    pub level: AlertLevel,
    /// Metric thresholds that trigger this rule
    pub thresholds: Vec<MetricThreshold>,
    /// Whether this rule is currently enabled
    pub enabled: bool,
    /// Tags for categorizing and filtering alerts
    pub tags: HashMap<String, String>,
    /// Notification channels to use for this rule
    pub notification_channels: Vec<String>,
    /// When this rule was created
    pub created_at: DateTime<Utc>,
    /// When this rule was last modified
    pub updated_at: DateTime<Utc>,
}

/// Context information for an alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertContext {
    /// Service or component that triggered the alert
    pub service: String,
    /// Environment (dev, staging, prod)
    pub environment: String,
    /// Instance or node identifier
    pub instance: Option<String>,
    /// Additional context data
    pub metadata: HashMap<String, String>,
    /// Related request ID if applicable
    pub request_id: Option<String>,
    /// User ID if applicable
    pub user_id: Option<String>,
}

/// Additional metadata for alerts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertMetadata {
    /// Current metric value that triggered the alert
    pub current_value: f64,
    /// Threshold value that was exceeded
    pub threshold_value: f64,
    /// Previous metric value for comparison
    pub previous_value: Option<f64>,
    /// Trend direction (increasing, decreasing, stable)
    pub trend: Option<String>,
    /// Related metrics for context
    pub related_metrics: HashMap<String, f64>,
}

/// Main alert structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    /// Unique identifier for this alert instance
    pub id: Uuid,
    /// ID of the rule that generated this alert
    pub rule_id: Uuid,
    /// Alert title/summary
    pub title: String,
    /// Detailed alert message
    pub message: String,
    /// Alert type
    pub alert_type: AlertType,
    /// Alert severity level
    pub level: AlertLevel,
    /// Current status of the alert
    pub status: AlertStatus,
    /// Context information
    pub context: AlertContext,
    /// Additional metadata
    pub metadata: AlertMetadata,
    /// When the alert was first triggered
    pub triggered_at: DateTime<Utc>,
    /// When the alert was last updated
    pub updated_at: DateTime<Utc>,
    /// When the alert was resolved (if applicable)
    pub resolved_at: Option<DateTime<Utc>>,
    /// Who acknowledged the alert (if applicable)
    pub acknowledged_by: Option<String>,
    /// When the alert was acknowledged (if applicable)
    pub acknowledged_at: Option<DateTime<Utc>>,
    /// Number of times this alert has been triggered
    pub occurrence_count: u32,
    /// Tags inherited from the rule plus any additional tags
    pub tags: HashMap<String, String>,
}

impl Alert {
    /// Create a new alert instance
    pub fn new(
        rule_id: Uuid,
        title: String,
        message: String,
        alert_type: AlertType,
        level: AlertLevel,
        context: AlertContext,
        metadata: AlertMetadata,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            rule_id,
            title,
            message,
            alert_type,
            level,
            status: AlertStatus::Active,
            context,
            metadata,
            triggered_at: now,
            updated_at: now,
            resolved_at: None,
            acknowledged_by: None,
            acknowledged_at: None,
            occurrence_count: 1,
            tags: HashMap::new(),
        }
    }

    /// Mark the alert as resolved
    pub fn resolve(&mut self) {
        self.status = AlertStatus::Resolved;
        self.resolved_at = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    /// Acknowledge the alert
    pub fn acknowledge(&mut self, acknowledged_by: String) {
        self.status = AlertStatus::Acknowledged;
        self.acknowledged_by = Some(acknowledged_by);
        self.acknowledged_at = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    /// Suppress the alert
    pub fn suppress(&mut self) {
        self.status = AlertStatus::Suppressed;
        self.updated_at = Utc::now();
    }

    /// Increment occurrence count for repeated alerts
    pub fn increment_occurrence(&mut self) {
        self.occurrence_count += 1;
        self.updated_at = Utc::now();
    }

    /// Check if the alert is currently active
    pub fn is_active(&self) -> bool {
        matches!(self.status, AlertStatus::Active)
    }

    /// Check if the alert is resolved
    pub fn is_resolved(&self) -> bool {
        matches!(self.status, AlertStatus::Resolved)
    }

    /// Get the duration since the alert was triggered
    pub fn duration_since_triggered(&self) -> chrono::Duration {
        Utc::now() - self.triggered_at
    }
}

impl AlertRule {
    /// Create a new alert rule
    pub fn new(
        name: String,
        description: String,
        alert_type: AlertType,
        level: AlertLevel,
        thresholds: Vec<MetricThreshold>,
        notification_channels: Vec<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            alert_type,
            level,
            thresholds,
            enabled: true,
            tags: HashMap::new(),
            notification_channels,
            created_at: now,
            updated_at: now,
        }
    }

    /// Enable the alert rule
    pub fn enable(&mut self) {
        self.enabled = true;
        self.updated_at = Utc::now();
    }

    /// Disable the alert rule
    pub fn disable(&mut self) {
        self.enabled = false;
        self.updated_at = Utc::now();
    }

    /// Add a tag to the rule
    pub fn add_tag(&mut self, key: String, value: String) {
        self.tags.insert(key, value);
        self.updated_at = Utc::now();
    }

    /// Remove a tag from the rule
    pub fn remove_tag(&mut self, key: &str) {
        self.tags.remove(key);
        self.updated_at = Utc::now();
    }
}

impl MetricThreshold {
    /// Create a new metric threshold
    pub fn new(
        metric_name: String,
        condition: AlertCondition,
        duration_seconds: u64,
        evaluation_interval_seconds: u64,
    ) -> Self {
        Self {
            metric_name,
            condition,
            duration_seconds,
            evaluation_interval_seconds,
        }
    }

    /// Check if a metric value meets the threshold condition
    pub fn evaluate(&self, value: f64) -> bool {
        match &self.condition {
            AlertCondition::GreaterThan(threshold) => value > *threshold,
            AlertCondition::LessThan(threshold) => value < *threshold,
            AlertCondition::Equals(threshold) => (value - threshold).abs() < f64::EPSILON,
            AlertCondition::Between(min, max) => value >= *min && value <= *max,
            AlertCondition::NotBetween(min, max) => value < *min || value > *max,
            AlertCondition::IsTrue => value > 0.5,
            AlertCondition::IsFalse => value < 0.5,
            AlertCondition::Matches(_) => false, // String matching not applicable to f64
        }
    }
}