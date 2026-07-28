use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

// Health Check Models (Enhanced)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct SystemHealth {
    pub overall_status: HealthStatus,
    pub services: std::collections::HashMap<String, ServiceHealth>,
    pub dependencies: std::collections::HashMap<String, DependencyHealth>,
    pub performance_metrics: PerformanceSnapshot,
    pub timestamp: DateTime<Utc>,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct ServiceHealth {
    pub status: HealthStatus,
    pub version: String,
    pub last_check: DateTime<Utc>,
    pub response_time_ms: u64,
    pub error_rate_percent: f64,
    pub throughput_rps: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct DependencyHealth {
    pub status: HealthStatus,
    pub last_check: DateTime<Utc>,
    pub response_time_ms: u64,
    pub circuit_breaker_state: CircuitState,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct PerformanceSnapshot {
    pub cpu_usage_percent: f64,
    pub memory_usage_mb: u64,
    pub memory_usage_percent: f64,
    pub active_connections: u32,
    pub request_queue_size: u32,
    pub avg_response_time_ms: f64,
    pub p95_response_time_ms: f64,
    pub p99_response_time_ms: f64,
    pub p999_response_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum HealthStatus {
    #[serde(rename = "healthy")]
    Healthy,
    #[serde(rename = "degraded")]
    Degraded,
    #[serde(rename = "unhealthy")]
    Unhealthy,
    #[serde(rename = "unknown")]
    Unknown,
}

// Circuit Breaker Models
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct CircuitBreakerState {
    pub service_name: String,
    pub state: CircuitState,
    pub failure_count: u32,
    pub success_count: u32,
    pub last_failure_time: Option<DateTime<Utc>>,
    pub next_attempt_time: Option<DateTime<Utc>>,
    pub failure_threshold: u32,
    pub recovery_timeout_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum CircuitState {
    Closed,   // Normal operation
    Open,     // Failing, rejecting requests
    HalfOpen, // Testing if service recovered
}

// Failure Mode Models
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct FailureMode {
    pub component: String,
    pub failure_type: FailureType,
    pub severity: FailureSeverity,
    pub fallback_strategy: FallbackStrategy,
    pub auto_recovery: bool,
    pub max_degradation_time_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum FailureType {
    DatabaseUnavailable,
    RedisUnavailable,
    ERIRUnavailable,
    HighLatency,
    MemoryPressure,
    CPUPressure,
    NetworkPartition,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum FailureSeverity {
    Low,      // Degraded performance
    Medium,   // Partial functionality loss
    High,     // Service unavailable
    Critical, // Data integrity at risk
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum FallbackStrategy {
    ReturnCached,
    ReturnDefault,
    ReturnError,
    Redirect,
    QueueForLater,
    SkipOperation,
}