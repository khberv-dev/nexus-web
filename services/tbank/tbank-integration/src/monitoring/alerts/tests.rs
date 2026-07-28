// Tests for the Alert System
//
// This module contains comprehensive tests for all alert system components.

#[cfg(test)]
mod tests {
    use super::super::{
        channels::*,
        config::*,
        manager::*,
        metrics::*,
        rules::*,
        types::*,
    };
    use chrono::Utc;
    use std::collections::HashMap;
    use tokio::time::{sleep, Duration};
    use uuid::Uuid;

    #[test]
    fn test_alert_creation() {
        let context = AlertContext {
            service: "tbank-api".to_string(),
            environment: "test".to_string(),
            instance: Some("instance-1".to_string()),
            metadata: HashMap::new(),
            request_id: Some("req-123".to_string()),
            user_id: None,
        };

        let metadata = AlertMetadata {
            current_value: 150.0,
            threshold_value: 100.0,
            previous_value: Some(90.0),
            trend: Some("increasing".to_string()),
            related_metrics: HashMap::new(),
        };

        let alert = Alert::new(
            Uuid::new_v4(),
            "Test Alert".to_string(),
            "This is a test alert".to_string(),
            AlertType::Performance,
            AlertLevel::Warning,
            context,
            metadata,
        );

        assert_eq!(alert.title, "Test Alert");
        assert_eq!(alert.message, "This is a test alert");
        assert_eq!(alert.alert_type, AlertType::Performance);
        assert_eq!(alert.level, AlertLevel::Warning);
        assert_eq!(alert.status, AlertStatus::Active);
        assert!(alert.is_active());
        assert!(!alert.is_resolved());
        assert_eq!(alert.occurrence_count, 1);
    }

    #[test]
    fn test_alert_lifecycle() {
        let context = AlertContext {
            service: "tbank-api".to_string(),
            environment: "test".to_string(),
            instance: None,
            metadata: HashMap::new(),
            request_id: None,
            user_id: None,
        };

        let metadata = AlertMetadata {
            current_value: 200.0,
            threshold_value: 100.0,
            previous_value: None,
            trend: None,
            related_metrics: HashMap::new(),
        };

        let mut alert = Alert::new(
            Uuid::new_v4(),
            "Lifecycle Test".to_string(),
            "Testing alert lifecycle".to_string(),
            AlertType::ErrorRate,
            AlertLevel::Critical,
            context,
            metadata,
        );

        // Test acknowledgment
        alert.acknowledge("test-user".to_string());
        assert_eq!(alert.status, AlertStatus::Acknowledged);
        assert_eq!(alert.acknowledged_by, Some("test-user".to_string()));
        assert!(alert.acknowledged_at.is_some());

        // Test resolution
        alert.resolve();
        assert_eq!(alert.status, AlertStatus::Resolved);
        assert!(alert.resolved_at.is_some());
        assert!(alert.is_resolved());

        // Test occurrence increment
        alert.increment_occurrence();
        assert_eq!(alert.occurrence_count, 2);
    }

    #[test]
    fn test_alert_rule_creation() {
        let threshold = MetricThreshold::new(
            "response_time".to_string(),
            AlertCondition::GreaterThan(1000.0),
            60,
            30,
        );

        let rule = AlertRule::new(
            "Response Time Alert".to_string(),
            "Alert when response time exceeds 1 second".to_string(),
            AlertType::Performance,
            AlertLevel::Warning,
            vec![threshold],
            vec!["slack".to_string()],
        );

        assert_eq!(rule.name, "Response Time Alert");
        assert_eq!(rule.alert_type, AlertType::Performance);
        assert_eq!(rule.level, AlertLevel::Warning);
        assert!(rule.enabled);
        assert_eq!(rule.thresholds.len(), 1);
        assert_eq!(rule.notification_channels.len(), 1);
    }

    #[test]
    fn test_metric_threshold_evaluation() {
        let threshold = MetricThreshold::new(
            "cpu_usage".to_string(),
            AlertCondition::GreaterThan(80.0),
            300,
            60,
        );

        assert!(threshold.evaluate(85.0));
        assert!(threshold.evaluate(90.0));
        assert!(!threshold.evaluate(75.0));
        assert!(!threshold.evaluate(80.0));

        let threshold_lt = MetricThreshold::new(
            "availability".to_string(),
            AlertCondition::LessThan(99.0),
            60,
            30,
        );

        assert!(threshold_lt.evaluate(98.5));
        assert!(!threshold_lt.evaluate(99.5));
    }

    #[test]
    fn test_alert_condition_evaluation() {
        let conditions = vec![
            (AlertCondition::GreaterThan(100.0), 150.0, true),
            (AlertCondition::GreaterThan(100.0), 50.0, false),
            (AlertCondition::LessThan(50.0), 30.0, true),
            (AlertCondition::LessThan(50.0), 70.0, false),
            (AlertCondition::Equals(100.0), 100.0, true),
            (AlertCondition::Between(50.0, 100.0), 75.0, true),
            (AlertCondition::Between(50.0, 100.0), 150.0, false),
            (AlertCondition::NotBetween(50.0, 100.0), 150.0, true),
            (AlertCondition::NotBetween(50.0, 100.0), 75.0, false),
            (AlertCondition::IsTrue, 1.0, true),
            (AlertCondition::IsTrue, 0.0, false),
            (AlertCondition::IsFalse, 0.0, true),
            (AlertCondition::IsFalse, 1.0, false),
        ];

        for (condition, value, expected) in conditions {
            let threshold = MetricThreshold::new(
                "test_metric".to_string(),
                condition,
                60,
                30,
            );
            assert_eq!(threshold.evaluate(value), expected);
        }
    }

    #[tokio::test]
    async fn test_alert_manager_basic_operations() {
        let config = AlertManagerConfig::default();
        let mut manager = AlertManager::new(config);

        // Test rule registration
        let rule = create_performance_rule(
            "Test Rule".to_string(),
            "test_metric".to_string(),
            1000.0,
            vec!["log".to_string()],
        );
        let rule_id = rule.id;
        
        let registered_id = manager.register_rule(rule).await;
        assert_eq!(registered_id, rule_id);

        // Test getting active alerts (should be empty initially)
        let active_alerts = manager.get_active_alerts().await;
        assert!(active_alerts.is_empty());

        // Test rule deregistration
        let deregistered = manager.deregister_rule(rule_id).await;
        assert!(deregistered);

        // Test deregistering non-existent rule
        let not_deregistered = manager.deregister_rule(Uuid::new_v4()).await;
        assert!(!not_deregistered);
    }

    #[tokio::test]
    async fn test_notification_channels() {
        // Test log channel
        let log_channel = LogChannel {
            name: "test-log".to_string(),
            log_level: "info".to_string(),
            enabled: true,
        };

        assert!(log_channel.is_enabled());
        assert_eq!(log_channel.get_name(), "test-log");

        // Test connection
        let result = log_channel.test_connection().await;
        assert!(result.is_ok());

        // Test disabled channel
        let disabled_channel = LogChannel {
            name: "disabled".to_string(),
            log_level: "info".to_string(),
            enabled: false,
        };

        let context = AlertContext {
            service: "test".to_string(),
            environment: "test".to_string(),
            instance: None,
            metadata: HashMap::new(),
            request_id: None,
            user_id: None,
        };

        let metadata = AlertMetadata {
            current_value: 100.0,
            threshold_value: 50.0,
            previous_value: None,
            trend: None,
            related_metrics: HashMap::new(),
        };

        let alert = Alert::new(
            Uuid::new_v4(),
            "Test Alert".to_string(),
            "Test message".to_string(),
            AlertType::Performance,
            AlertLevel::Info,
            context,
            metadata,
        );

        let result = disabled_channel.send_notification(&alert).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_alert_message_formatting() {
        let context = AlertContext {
            service: "tbank-api".to_string(),
            environment: "production".to_string(),
            instance: Some("api-1".to_string()),
            metadata: HashMap::new(),
            request_id: Some("req-456".to_string()),
            user_id: None,
        };

        let metadata = AlertMetadata {
            current_value: 1500.0,
            threshold_value: 1000.0,
            previous_value: Some(800.0),
            trend: Some("increasing".to_string()),
            related_metrics: HashMap::new(),
        };

        let alert = Alert::new(
            Uuid::new_v4(),
            "High Response Time".to_string(),
            "API response time is too high".to_string(),
            AlertType::Performance,
            AlertLevel::Warning,
            context,
            metadata,
        );

        let message = format_alert_message(&alert);
        
        assert!(message.contains("WARNING"));
        assert!(message.contains("High Response Time"));
        assert!(message.contains("tbank-api"));
        assert!(message.contains("production"));
        assert!(message.contains("1500"));
        assert!(message.contains("1000"));
    }

    #[tokio::test]
    async fn test_metrics_collection() {
        let collector = MetricsCollector::default();
        
        // Test metrics collection
        let metrics = collector.collect_metrics().await;
        assert!(metrics.is_ok());
        
        let metrics = metrics.unwrap();
        assert!(metrics.api_response_time_ms > 0.0);
        assert!(metrics.service_availability_percent > 0.0);
        assert!(metrics.timestamp <= Utc::now());

        // Test history storage
        let history = collector.get_history(Some(10)).await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].timestamp, metrics.timestamp);
    }

    #[test]
    fn test_metrics_calculations() {
        // Test error rate calculation
        assert_eq!(calculate_error_rate(100.0, 5.0), 5.0);
        assert_eq!(calculate_error_rate(0.0, 0.0), 0.0);
        assert_eq!(calculate_error_rate(200.0, 10.0), 5.0);

        // Test response time calculation
        let response_times = vec![100.0, 200.0, 300.0, 400.0];
        assert_eq!(calculate_response_time(&response_times), 250.0);
        assert_eq!(calculate_response_time(&[]), 0.0);

        // Test availability calculation
        assert_eq!(check_service_availability(99, 100), 99.0);
        assert_eq!(check_service_availability(0, 0), 0.0);
        assert_eq!(check_service_availability(100, 100), 100.0);
    }

    #[tokio::test]
    async fn test_rule_evaluation() {
        let context = AlertContext {
            service: "test-service".to_string(),
            environment: "test".to_string(),
            instance: None,
            metadata: HashMap::new(),
            request_id: None,
            user_id: None,
        };

        // Create test rules
        let rules = vec![
            create_performance_rule(
                "High Response Time".to_string(),
                "response_time_ms".to_string(),
                1000.0,
                vec!["log".to_string()],
            ),
            create_error_rate_rule(
                "High Error Rate".to_string(),
                "error_rate_percent".to_string(),
                5.0,
                vec!["log".to_string()],
            ),
        ];

        // Create test metrics that should trigger alerts
        let mut metrics = HashMap::new();
        metrics.insert("response_time_ms".to_string(), 1500.0); // Should trigger
        metrics.insert("error_rate_percent".to_string(), 7.0);  // Should trigger

        let alerts = evaluate_alert_rules(&rules, &metrics, &context).await;
        
        assert_eq!(alerts.len(), 2);
        assert!(alerts.iter().any(|a| a.title.contains("High Response Time")));
        assert!(alerts.iter().any(|a| a.title.contains("High Error Rate")));

        // Test with metrics that don't trigger alerts
        let mut safe_metrics = HashMap::new();
        safe_metrics.insert("response_time_ms".to_string(), 500.0);  // Below threshold
        safe_metrics.insert("error_rate_percent".to_string(), 2.0); // Below threshold

        let no_alerts = evaluate_alert_rules(&rules, &safe_metrics, &context).await;
        assert!(no_alerts.is_empty());
    }

    #[test]
    fn test_default_rules_creation() {
        let rules = create_default_tbank_rules();
        
        assert!(!rules.is_empty());
        assert!(rules.iter().any(|r| r.name.contains("Response Time")));
        assert!(rules.iter().any(|r| r.name.contains("Error Rate")));
        assert!(rules.iter().any(|r| r.name.contains("Availability")));
        assert!(rules.iter().any(|r| r.name.contains("Authentication")));
        
        // Check that all rules are enabled by default
        assert!(rules.iter().all(|r| r.enabled));
        
        // Check that all rules have notification channels
        assert!(rules.iter().all(|r| !r.notification_channels.is_empty()));
    }

    #[test]
    fn test_config_loading() {
        use std::env;
        
        // Set test environment variables
        env::set_var("TBANK_ALERT_EVALUATION_INTERVAL_SECONDS", "30");
        env::set_var("TBANK_ALERT_ENABLE_DEDUPLICATION", "false");
        env::set_var("TBANK_METRICS_ENABLED", "true");
        
        let config = load_alert_config_from_env();
        
        assert_eq!(config.manager.evaluation_interval_seconds, 30);
        assert!(!config.manager.enable_deduplication);
        assert!(config.metrics.enabled);
        
        // Clean up
        env::remove_var("TBANK_ALERT_EVALUATION_INTERVAL_SECONDS");
        env::remove_var("TBANK_ALERT_ENABLE_DEDUPLICATION");
        env::remove_var("TBANK_METRICS_ENABLED");
    }

    #[test]
    fn test_alert_level_display() {
        assert_eq!(AlertLevel::Info.to_string(), "info");
        assert_eq!(AlertLevel::Warning.to_string(), "warning");
        assert_eq!(AlertLevel::Critical.to_string(), "critical");
        assert_eq!(AlertLevel::Emergency.to_string(), "emergency");
    }

    #[tokio::test]
    async fn test_alert_manager_statistics() {
        let config = AlertManagerConfig::default();
        let mut manager = AlertManager::new(config);

        // Register some rules
        let rule1 = create_performance_rule(
            "Rule 1".to_string(),
            "metric1".to_string(),
            100.0,
            vec!["log".to_string()],
        );
        let rule2 = create_error_rate_rule(
            "Rule 2".to_string(),
            "metric2".to_string(),
            5.0,
            vec!["log".to_string()],
        );

        manager.register_rule(rule1).await;
        manager.register_rule(rule2).await;

        // Register a notification channel
        let log_channel = NotificationChannel::Log(LogChannel {
            name: "test-log".to_string(),
            log_level: "info".to_string(),
            enabled: true,
        });
        manager.register_channel("log".to_string(), log_channel).await;

        let stats = manager.get_statistics().await;
        
        assert_eq!(stats.total_rules_count, 2);
        assert_eq!(stats.enabled_rules_count, 2);
        assert_eq!(stats.channels_count, 1);
        assert_eq!(stats.active_alerts_count, 0);
        assert_eq!(stats.history_size, 0);
        assert!(stats.oldest_active_alert.is_none());
    }

    #[test]
    fn test_sample_config_generation() {
        let sample = create_sample_config();
        
        assert!(sample.contains("TBANK_ALERT_EVALUATION_INTERVAL_SECONDS"));
        assert!(sample.contains("TBANK_SLACK_WEBHOOK_URL"));
        assert!(sample.contains("TBANK_EMAIL_SMTP_SERVER"));
        assert!(sample.contains("TBANK_WEBHOOK_URL"));
        assert!(sample.contains("TBANK_METRICS_ENABLED"));
        assert!(sample.contains("# T-Bank Alert System Configuration"));
    }
}