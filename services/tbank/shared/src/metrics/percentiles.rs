use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct LatencyPercentiles {
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub p999: f64,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

pub type LatencyPercentilesMap = Arc<RwLock<HashMap<String, LatencyPercentiles>>>;
