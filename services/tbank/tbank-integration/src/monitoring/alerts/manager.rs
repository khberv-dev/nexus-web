// Alert Manager
//
// This module manages the lifecycle of alerts and coordinates monitoring activities.

use crate::monitoring::alerts::{
    channels::{NotificationChannel, send_alert_notification},
    rules::evaluate_alert_rules,
    types::{Alert, AlertRule, AlertContext},
    metrics::collect_tbank_metrics,
};
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tokio::time::{interval, Duration as TokioDuration};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Main alert manager that coordinates all alerting activities
pub struct AlertManager {
    /// Currently registered alert rules
    rules: Arc<RwLock<HashMap<Uuid, AlertRule>>>,
    /// Active alerts (not resolved)
    active_alerts: Arc<RwLock<HashMap<Uuid, Alert>>>,
    /// Alert history (resolved alerts)
    alert_history: Arc<RwLock<Vec<Alert>>>,
    /// Notification channels
    channels: Arc<RwLock<HashMap<String, NotificationChannel>>>,
    /// Control channel for stopping monitoring
    shutdown_tx: Option<mpsc::Sender<()>>,
    /// Monitoring configuration
    config: AlertManagerConfig,
}

/// Configuration for the alert manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertManagerConfig {
    /// How often to evaluate alert rules (seconds)
    pub evaluation_interval_seconds: u64,
    /// Maximum number of alerts to keep in history
    pub max_history_size: usize,
    /// How long to keep resolved alerts in memory (hours)
    pub history_retention_hours: i64,
    /// Maximum number of notifications per alert per hour
    pub max_notifications_per_hour: u32,
    /// Whether to enable alert deduplication
    pub enable_deduplication: bool,
    /// Deduplication window in minutes
    pub deduplication_window_minutes: i64,
}

impl Default for AlertManagerConfig {
    fn default() -> Self {
        Self {
            evaluation_interval_seconds: 60,
            max_history_size: 10000,
            history_retention_hours: 24,
            max_notifications_per_hour: 10,
            enable_deduplication: true,
            deduplication_window_minutes: 5,
        }
    }
}

impl AlertManager {
    /// Create a new alert manager
    pub fn new(config: AlertManagerConfig) -> Self {
        Self {
            rules: Arc::new(RwLock::new(HashMap::new())),
            active_alerts: Arc::new(RwLock::new(HashMap::new())),
            alert_history: Arc::new(RwLock::new(Vec::new())),
            channels: Arc::new(RwLock::new(HashMap::new())),
            shutdown_tx: None,
            config,
        }
    }

    /// Register a new alert rule
    pub async fn register_rule(&mut self, rule: AlertRule) -> Uuid {
        let rule_id = rule.id;
        let mut rules = self.rules.write().await;
        rules.insert(rule_id, rule);
        info!("Registered alert rule: {}", rule_id);
        rule_id
    }

    /// Deregister an alert rule
    pub async fn deregister_rule(&mut self, rule_id: Uuid) -> bool {
        let mut rules = self.rules.write().await;
        if rules.remove(&rule_id).is_some() {
            info!("Deregistered alert rule: {}", rule_id);
            true
        } else {
            warn!("Attempted to deregister non-existent rule: {}", rule_id);
            false
        }
    }

    /// Register a notification channel
    pub async fn register_channel(&mut self, name: String, channel: NotificationChannel) {
        let mut channels = self.channels.write().await;
        channels.insert(name.clone(), channel);
        info!("Registered notification channel: {}", name);
    }

    /// Get all active alerts
    pub async fn get_active_alerts(&self) -> Vec<Alert> {
        let alerts = self.active_alerts.read().await;
        alerts.values().cloned().collect()
    }

    /// Get alert history
    pub async fn get_alert_history(&self, limit: Option<usize>) -> Vec<Alert> {
        let history = self.alert_history.read().await;
        match limit {
            Some(n) => history.iter().rev().take(n).cloned().collect(),
            None => history.iter().rev().cloned().collect(),
        }
    }

    /// Acknowledge an alert
    pub async fn acknowledge_alert(&mut self, alert_id: Uuid, acknowledged_by: String) -> bool {
        let mut alerts = self.active_alerts.write().await;
        if let Some(alert) = alerts.get_mut(&alert_id) {
            alert.acknowledge(acknowledged_by);
            info!("Alert {} acknowledged", alert_id);
            true
        } else {
            warn!("Attempted to acknowledge non-existent alert: {}", alert_id);
            false
        }
    }

    /// Resolve an alert
    pub async fn resolve_alert(&mut self, alert_id: Uuid) -> bool {
        let mut alerts = self.active_alerts.write().await;
        if let Some(mut alert) = alerts.remove(&alert_id) {
            alert.resolve();
            
            // Move to history
            let mut history = self.alert_history.write().await;
            history.push(alert);
            
            info!("Alert {} resolved", alert_id);
            true
        } else {
            warn!("Attempted to resolve non-existent alert: {}", alert_id);
            false
        }
    }

    /// Start monitoring (non-blocking)
    pub async fn start_monitoring(&mut self, context: AlertContext) -> Result<(), AlertManagerError> {
        if self.shutdown_tx.is_some() {
            return Err(AlertManagerError::AlreadyRunning);
        }

        let (shutdown_tx, mut shutdown_rx) = mpsc::channel(1);
        self.shutdown_tx = Some(shutdown_tx);

        let rules = Arc::clone(&self.rules);
        let active_alerts = Arc::clone(&self.active_alerts);
        let alert_history = Arc::clone(&self.alert_history);
        let channels = Arc::clone(&self.channels);
        let config = self.config.clone();

        tokio::spawn(async move {
            let mut interval = interval(TokioDuration::from_secs(config.evaluation_interval_seconds));
            
            info!("Started alert monitoring with {}s interval", config.evaluation_interval_seconds);

            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        if let Err(e) = Self::monitoring_cycle(
                            &rules,
                            &active_alerts,
                            &alert_history,
                            &channels,
                            &context,
                            &config,
                        ).await {
                            error!("Error in monitoring cycle: {}", e);
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        info!("Shutting down alert monitoring");
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Stop monitoring
    pub async fn stop_monitoring(&mut self) -> Result<(), AlertManagerError> {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            shutdown_tx.send(()).await.map_err(|_| AlertManagerError::ShutdownError)?;
            info!("Stopped alert monitoring");
            Ok(())
        } else {
            Err(AlertManagerError::NotRunning)
        }
    }

    /// Single monitoring cycle
    async fn monitoring_cycle(
        rules: &Arc<RwLock<HashMap<Uuid, AlertRule>>>,
        active_alerts: &Arc<RwLock<HashMap<Uuid, Alert>>>,
        alert_history: &Arc<RwLock<Vec<Alert>>>,
        channels: &Arc<RwLock<HashMap<String, NotificationChannel>>>,
        context: &AlertContext,
        config: &AlertManagerConfig,
    ) -> Result<(), AlertManagerError> {
        debug!("Starting monitoring cycle");

        // Collect current metrics
        let metrics = collect_tbank_metrics().await
            .map_err(|e| AlertManagerError::MetricsError(e.to_string()))?;

        // Evaluate rules
        let rules_guard = rules.read().await;
        let rule_list: Vec<AlertRule> = rules_guard.values().cloned().collect();
        drop(rules_guard);

        let new_alerts = evaluate_alert_rules(&rule_list, &metrics, context).await;

        // Process new alerts
        for alert in new_alerts {
            Self::process_new_alert(
                alert,
                active_alerts,
                channels,
                config,
            ).await?;
        }

        // Clean up old alerts
        Self::cleanup_old_alerts(alert_history, config).await;

        debug!("Completed monitoring cycle");
        Ok(())
    }

    /// Process a newly triggered alert
    async fn process_new_alert(
        alert: Alert,
        active_alerts: &Arc<RwLock<HashMap<Uuid, Alert>>>,
        channels: &Arc<RwLock<HashMap<String, NotificationChannel>>>,
        config: &AlertManagerConfig,
    ) -> Result<(), AlertManagerError> {
        let alert_id = alert.id;
        
        // Check for deduplication
        if config.enable_deduplication {
            let alerts_guard = active_alerts.read().await;
            let is_duplicate = alerts_guard.values().any(|existing| {
                existing.rule_id == alert.rule_id &&
                existing.is_active() &&
                (Utc::now() - existing.triggered_at).num_minutes() < config.deduplication_window_minutes
            });
            drop(alerts_guard);

            if is_duplicate {
                debug!("Skipping duplicate alert for rule {}", alert.rule_id);
                return Ok(());
            }
        }

        // Add to active alerts
        {
            let mut alerts_guard = active_alerts.write().await;
            alerts_guard.insert(alert_id, alert.clone());
        }

        info!("New alert triggered: {} - {}", alert.title, alert.message);

        // Send notifications
        Self::send_alert_notifications(&alert, channels).await?;

        Ok(())
    }

    /// Send notifications for an alert
    async fn send_alert_notifications(
        alert: &Alert,
        channels: &Arc<RwLock<HashMap<String, NotificationChannel>>>,
    ) -> Result<(), AlertManagerError> {
        let channels_guard = channels.read().await;
        
        // Get the rule to find notification channels
        // For now, send to all channels - in a real implementation,
        // we'd look up the rule to get specific channels
        for (name, channel) in channels_guard.iter() {
            match send_alert_notification(channel, alert).await {
                Ok(()) => {
                    debug!("Sent alert notification via channel: {}", name);
                }
                Err(e) => {
                    warn!("Failed to send alert notification via {}: {}", name, e);
                }
            }
        }

        Ok(())
    }

    /// Clean up old alerts from history
    async fn cleanup_old_alerts(
        alert_history: &Arc<RwLock<Vec<Alert>>>,
        config: &AlertManagerConfig,
    ) {
        let mut history = alert_history.write().await;
        let cutoff_time = Utc::now() - Duration::hours(config.history_retention_hours);
        
        // Remove old alerts
        history.retain(|alert| {
            alert.resolved_at.map_or(true, |resolved| resolved > cutoff_time)
        });

        // Limit history size
        if history.len() > config.max_history_size {
            let excess = history.len() - config.max_history_size;
            history.drain(0..excess);
        }
    }

    /// Get statistics about the alert manager
    pub async fn get_statistics(&self) -> AlertManagerStats {
        let active_alerts = self.active_alerts.read().await;
        let history = self.alert_history.read().await;
        let rules = self.rules.read().await;
        let channels = self.channels.read().await;

        AlertManagerStats {
            active_alerts_count: active_alerts.len(),
            total_rules_count: rules.len(),
            enabled_rules_count: rules.values().filter(|r| r.enabled).count(),
            channels_count: channels.len(),
            history_size: history.len(),
            oldest_active_alert: active_alerts.values()
                .map(|a| a.triggered_at)
                .min(),
        }
    }
}

/// Statistics about the alert manager
#[derive(Debug)]
pub struct AlertManagerStats {
    pub active_alerts_count: usize,
    pub total_rules_count: usize,
    pub enabled_rules_count: usize,
    pub channels_count: usize,
    pub history_size: usize,
    pub oldest_active_alert: Option<DateTime<Utc>>,
}

/// Errors that can occur in alert management
#[derive(Debug, thiserror::Error)]
pub enum AlertManagerError {
    #[error("Alert manager is already running")]
    AlreadyRunning,
    
    #[error("Alert manager is not running")]
    NotRunning,
    
    #[error("Shutdown error")]
    ShutdownError,
    
    #[error("Metrics collection error: {0}")]
    MetricsError(String),
    
    #[error("Notification error: {0}")]
    NotificationError(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
}

/// Convenience functions for global alert management

static mut GLOBAL_ALERT_MANAGER: Option<AlertManager> = None;
static INIT: std::sync::Once = std::sync::Once::new();

/// Initialize the global alert manager
pub fn init_global_alert_manager(config: AlertManagerConfig) {
    unsafe {
        INIT.call_once(|| {
            GLOBAL_ALERT_MANAGER = Some(AlertManager::new(config));
        });
    }
}

/// Get a reference to the global alert manager
pub fn get_global_alert_manager() -> Option<&'static mut AlertManager> {
    unsafe { GLOBAL_ALERT_MANAGER.as_mut() }
}

/// Start alert monitoring with the global manager
pub async fn start_alert_monitoring(context: AlertContext) -> Result<(), AlertManagerError> {
    if let Some(manager) = get_global_alert_manager() {
        manager.start_monitoring(context).await
    } else {
        Err(AlertManagerError::ConfigurationError(
            "Global alert manager not initialized".to_string()
        ))
    }
}

/// Stop alert monitoring with the global manager
pub async fn stop_alert_monitoring() -> Result<(), AlertManagerError> {
    if let Some(manager) = get_global_alert_manager() {
        manager.stop_monitoring().await
    } else {
        Err(AlertManagerError::ConfigurationError(
            "Global alert manager not initialized".to_string()
        ))
    }
}

/// Register an alert rule with the global manager
pub async fn register_alert_rule(rule: AlertRule) -> Result<Uuid, AlertManagerError> {
    if let Some(manager) = get_global_alert_manager() {
        Ok(manager.register_rule(rule).await)
    } else {
        Err(AlertManagerError::ConfigurationError(
            "Global alert manager not initialized".to_string()
        ))
    }
}

/// Deregister an alert rule with the global manager
pub async fn deregister_alert_rule(rule_id: Uuid) -> Result<bool, AlertManagerError> {
    if let Some(manager) = get_global_alert_manager() {
        Ok(manager.deregister_rule(rule_id).await)
    } else {
        Err(AlertManagerError::ConfigurationError(
            "Global alert manager not initialized".to_string()
        ))
    }
}

/// Get active alerts from the global manager
pub async fn get_active_alerts() -> Result<Vec<Alert>, AlertManagerError> {
    if let Some(manager) = get_global_alert_manager() {
        Ok(manager.get_active_alerts().await)
    } else {
        Err(AlertManagerError::ConfigurationError(
            "Global alert manager not initialized".to_string()
        ))
    }
}