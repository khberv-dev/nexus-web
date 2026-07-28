use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

// Observability Models
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct TraceContext {
    pub trace_id: String,
    pub span_id: String,
    pub parent_span_id: Option<String>,
    pub baggage: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct PerformanceMetrics {
    pub service: String,
    pub endpoint: String,
    pub method: String,
    pub status_code: u16,
    pub duration_ms: u64,
    pub memory_usage_mb: Option<u64>,
    pub cpu_usage_percent: Option<f64>,
    pub trace_id: String,
    pub timestamp: DateTime<Utc>,
}