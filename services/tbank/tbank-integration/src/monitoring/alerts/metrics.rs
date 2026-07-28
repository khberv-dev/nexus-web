// Metrics Collection for T-Bank Monitoring
//
// This module handles collection of various metrics used for alerting.

use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, warn};

/// T-Bank specific metrics structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TBankMetrics {
    /// API response time metrics
    pub api_response_time_ms: f64,
    pub api_response_time_p95_ms: f64,
    pub api_response_time_p99_ms: f64,
    
    /// Error rate metrics
    pub api_error_rate_percent: f64,
    pub transaction_failure_rate_percent: f64,
    pub auth_failure_rate_percent: f64,
    
    /// Throughput metrics
    pub requests_per_second: f64,
    pub transactions_per_minute: f64,
    pub successful_transactions_per_minute: f64,
    
    /// Availability metrics
    pub service_availability_percent: f64,
    pub database_availability_percent: f64,
    
    /// Resource usage metrics
    pub cpu_usage_percent: f64,
    pub memory_usage_percent: f64,
    pub disk_usage_percent: f64,
    
    /// Business metrics
    pub daily_transaction_count: f64,
    pub daily_revenue: f64,
    pub active_users_count: f64,
    
    /// Security metrics
    pub auth_failures_per_minute: f64,
    pub suspicious_activity_count: f64,
    pub rate_limit_violations_per_minute: f64,
    
    /// When these metrics were collected
    pub timestamp: DateTime<Utc>,
}

/// Metrics collector that aggregates data from various sources
pub struct MetricsCollector {
    /// Historical metrics for trend analysis
    history: Arc<RwLock<Vec<TBankMetrics>>>,
    /// Maximum number of historical entries to keep
    max_history_size: usize,
    /// How long to keep metrics in memory (hours)
    retention_hours: i64,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self {
            history: Arc::new(RwLock::new(Vec::new())),
            max_history_size: 1440, // 24 hours of minute-by-minute data
            retention_hours: 24,
        }
    }
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new(max_history_size: usize, retention_hours: i64) -> Self {
        Self {
            history: Arc::new(RwLock::new(Vec::new())),
            max_history_size,
            retention_hours,
        }
    }

    /// Collect current metrics from all sources
    pub async fn collect_metrics(&self) -> Result<TBankMetrics, MetricsError> {
        let timestamp = Utc::now();
        
        // Collect metrics from various sources
        let api_metrics = self.collect_api_metrics().await?;
        let resource_metrics = self.collect_resource_metrics().await?;
        let business_metrics = self.collect_business_metrics().await?;
        let security_metrics = self.collect_security_metrics().await?;
        
        let metrics = TBankMetrics {
            // API metrics
            api_response_time_ms: api_metrics.avg_response_time,
            api_response_time_p95_ms: api_metrics.p95_response_time,
            api_response_time_p99_ms: api_metrics.p99_response_time,
            api_error_rate_percent: api_metrics.error_rate,
            
            // Transaction metrics
            transaction_failure_rate_percent: api_metrics.transaction_failure_rate,
            transactions_per_minute: api_metrics.transactions_per_minute,
            successful_transactions_per_minute: api_metrics.successful_transactions_per_minute,
            
            // Throughput
            requests_per_second: api_metrics.requests_per_second,
            
            // Availability
            service_availability_percent: api_metrics.service_availability,
            database_availability_percent: resource_metrics.database_availability,
            
            // Resources
            cpu_usage_percent: resource_metrics.cpu_usage,
            memory_usage_percent: resource_metrics.memory_usage,
            disk_usage_percent: resource_metrics.disk_usage,
            
            // Business
            daily_transaction_count: business_metrics.daily_transactions,
            daily_revenue: business_metrics.daily_revenue,
            active_users_count: business_metrics.active_users,
            
            // Security
            auth_failures_per_minute: security_metrics.auth_failures_per_minute,
            auth_failure_rate_percent: security_metrics.auth_failure_rate,
            suspicious_activity_count: security_metrics.suspicious_activity,
            rate_limit_violations_per_minute: security_metrics.rate_limit_violations,
            
            timestamp,
        };

        // Store in history
        self.store_metrics(&metrics).await;
        
        Ok(metrics)
    }

    /// Store metrics in history and clean up old entries
    async fn store_metrics(&self, metrics: &TBankMetrics) {
        let mut history = self.history.write().await;
        
        // Add new metrics
        history.push(metrics.clone());
        
        // Clean up old entries
        let cutoff_time = Utc::now() - Duration::hours(self.retention_hours);
        history.retain(|m| m.timestamp > cutoff_time);
        
        // Limit size
        if history.len() > self.max_history_size {
            let excess = history.len() - self.max_history_size;
            history.drain(0..excess);
        }
    }

    /// Get historical metrics
    pub async fn get_history(&self, limit: Option<usize>) -> Vec<TBankMetrics> {
        let history = self.history.read().await;
        match limit {
            Some(n) => history.iter().rev().take(n).cloned().collect(),
            None => history.iter().rev().cloned().collect(),
        }
    }

    /// Collect API-related metrics
    async fn collect_api_metrics(&self) -> Result<ApiMetrics, MetricsError> {
        // In a real implementation, this would collect from:
        // - Application metrics (Prometheus, etc.)
        // - Load balancer metrics
        // - Database query logs
        // - Application logs
        
        // For now, return mock data
        Ok(ApiMetrics {
            avg_response_time: 250.0,
            p95_response_time: 800.0,
            p99_response_time: 1500.0,
            error_rate: 2.5,
            transaction_failure_rate: 1.2,
            requests_per_second: 45.0,
            transactions_per_minute: 120.0,
            successful_transactions_per_minute: 118.0,
            service_availability: 99.8,
        })
    }

    /// Collect resource usage metrics
    async fn collect_resource_metrics(&self) -> Result<ResourceMetrics, MetricsError> {
        // In a real implementation, this would collect from:
        // - System monitoring (htop, iostat, etc.)
        // - Container metrics (Docker stats, Kubernetes metrics)
        // - Cloud provider metrics (AWS CloudWatch, etc.)
        
        Ok(ResourceMetrics {
            cpu_usage: 45.2,
            memory_usage: 67.8,
            disk_usage: 23.1,
            database_availability: 99.9,
        })
    }

    /// Collect business metrics
    async fn collect_business_metrics(&self) -> Result<BusinessMetrics, MetricsError> {
        // In a real implementation, this would query:
        // - Database for transaction counts
        // - Analytics systems
        // - Business intelligence tools
        
        Ok(BusinessMetrics {
            daily_transactions: 2847.0,
            daily_revenue: 125430.50,
            active_users: 1234.0,
        })
    }

    /// Collect security metrics
    async fn collect_security_metrics(&self) -> Result<SecurityMetrics, MetricsError> {
        // In a real implementation, this would collect from:
        // - Authentication logs
        // - Security monitoring systems
        // - Rate limiting systems
        // - Intrusion detection systems
        
        Ok(SecurityMetrics {
            auth_failures_per_minute: 3.2,
            auth_failure_rate: 0.8,
            suspicious_activity: 0.0,
            rate_limit_violations: 1.1,
        })
    }
}

/// API-related metrics
#[derive(Debug)]
struct ApiMetrics {
    avg_response_time: f64,
    p95_response_time: f64,
    p99_response_time: f64,
    error_rate: f64,
    transaction_failure_rate: f64,
    requests_per_second: f64,
    transactions_per_minute: f64,
    successful_transactions_per_minute: f64,
    service_availability: f64,
}

/// Resource usage metrics
#[derive(Debug)]
struct ResourceMetrics {
    cpu_usage: f64,
    memory_usage: f64,
    disk_usage: f64,
    database_availability: f64,
}

/// Business metrics
#[derive(Debug)]
struct BusinessMetrics {
    daily_transactions: f64,
    daily_revenue: f64,
    active_users: f64,
}

/// Security metrics
#[derive(Debug)]
struct SecurityMetrics {
    auth_failures_per_minute: f64,
    auth_failure_rate: f64,
    suspicious_activity: f64,
    rate_limit_violations: f64,
}

/// Errors that can occur during metrics collection
#[derive(Debug, thiserror::Error)]
pub enum MetricsError {
    #[error("Data source unavailable: {0}")]
    DataSourceUnavailable(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Authentication error: {0}")]
    AuthenticationError(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Timeout error: {0}")]
    TimeoutError(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
}

/// Global metrics collector instance
static mut GLOBAL_METRICS_COLLECTOR: Option<MetricsCollector> = None;
static INIT: std::sync::Once = std::sync::Once::new();

/// Initialize the global metrics collector
pub fn init_global_metrics_collector(max_history_size: usize, retention_hours: i64) {
    unsafe {
        INIT.call_once(|| {
            GLOBAL_METRICS_COLLECTOR = Some(MetricsCollector::new(max_history_size, retention_hours));
        });
    }
}

/// Get a reference to the global metrics collector
pub fn get_global_metrics_collector() -> Option<&'static MetricsCollector> {
    unsafe { GLOBAL_METRICS_COLLECTOR.as_ref() }
}

/// Collect T-Bank metrics using the global collector
pub async fn collect_tbank_metrics() -> Result<HashMap<String, f64>, MetricsError> {
    let collector = get_global_metrics_collector()
        .ok_or_else(|| MetricsError::ConfigurationError(
            "Global metrics collector not initialized".to_string()
        ))?;

    let metrics = collector.collect_metrics().await?;
    
    // Convert to HashMap for alert evaluation
    let mut metric_map = HashMap::new();
    
    // API metrics
    metric_map.insert("tbank_api_response_time_ms".to_string(), metrics.api_response_time_ms);
    metric_map.insert("tbank_api_response_time_p95_ms".to_string(), metrics.api_response_time_p95_ms);
    metric_map.insert("tbank_api_response_time_p99_ms".to_string(), metrics.api_response_time_p99_ms);
    metric_map.insert("tbank_api_error_rate_percent".to_string(), metrics.api_error_rate_percent);
    
    // Transaction metrics
    metric_map.insert("tbank_transaction_failure_rate_percent".to_string(), metrics.transaction_failure_rate_percent);
    metric_map.insert("tbank_transactions_per_minute".to_string(), metrics.transactions_per_minute);
    metric_map.insert("tbank_successful_transactions_per_minute".to_string(), metrics.successful_transactions_per_minute);
    
    // Throughput
    metric_map.insert("tbank_requests_per_second".to_string(), metrics.requests_per_second);
    
    // Availability
    metric_map.insert("tbank_service_availability_percent".to_string(), metrics.service_availability_percent);
    metric_map.insert("tbank_database_availability_percent".to_string(), metrics.database_availability_percent);
    
    // Resources
    metric_map.insert("tbank_cpu_usage_percent".to_string(), metrics.cpu_usage_percent);
    metric_map.insert("tbank_memory_usage_percent".to_string(), metrics.memory_usage_percent);
    metric_map.insert("tbank_disk_usage_percent".to_string(), metrics.disk_usage_percent);
    
    // Business
    metric_map.insert("tbank_daily_transactions".to_string(), metrics.daily_transaction_count);
    metric_map.insert("tbank_daily_revenue".to_string(), metrics.daily_revenue);
    metric_map.insert("tbank_active_users".to_string(), metrics.active_users_count);
    
    // Security
    metric_map.insert("tbank_auth_failures_per_minute".to_string(), metrics.auth_failures_per_minute);
    metric_map.insert("tbank_auth_failure_rate_percent".to_string(), metrics.auth_failure_rate_percent);
    metric_map.insert("tbank_suspicious_activity_count".to_string(), metrics.suspicious_activity_count);
    metric_map.insert("tbank_rate_limit_violations_per_minute".to_string(), metrics.rate_limit_violations_per_minute);
    
    Ok(metric_map)
}

/// Calculate error rate from success and failure counts
pub fn calculate_error_rate(total_requests: f64, failed_requests: f64) -> f64 {
    if total_requests == 0.0 {
        0.0
    } else {
        (failed_requests / total_requests) * 100.0
    }
}

/// Calculate average response time from a list of response times
pub fn calculate_response_time(response_times: &[f64]) -> f64 {
    if response_times.is_empty() {
        0.0
    } else {
        response_times.iter().sum::<f64>() / response_times.len() as f64
    }
}

/// Check service availability based on successful health checks
pub fn check_service_availability(successful_checks: u32, total_checks: u32) -> f64 {
    if total_checks == 0 {
        0.0
    } else {
        (successful_checks as f64 / total_checks as f64) * 100.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_error_rate() {
        assert_eq!(calculate_error_rate(100.0, 5.0), 5.0);
        assert_eq!(calculate_error_rate(0.0, 0.0), 0.0);
        assert_eq!(calculate_error_rate(50.0, 0.0), 0.0);
    }

    #[test]
    fn test_calculate_response_time() {
        let times = vec![100.0, 200.0, 300.0];
        assert_eq!(calculate_response_time(&times), 200.0);
        assert_eq!(calculate_response_time(&[]), 0.0);
    }

    #[test]
    fn test_check_service_availability() {
        assert_eq!(check_service_availability(95, 100), 95.0);
        assert_eq!(check_service_availability(0, 0), 0.0);
        assert_eq!(check_service_availability(100, 100), 100.0);
    }

    #[tokio::test]
    async fn test_metrics_collector() {
        let collector = MetricsCollector::default();
        let metrics = collector.collect_metrics().await.unwrap();
        
        assert!(metrics.api_response_time_ms > 0.0);
        assert!(metrics.service_availability_percent > 0.0);
        assert!(metrics.timestamp <= Utc::now());
    }
}