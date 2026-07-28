//! Metrics collection module for monitoring and observability

pub mod collector;
pub mod percentiles;

// Re-export main types
pub use collector::{MetricsCollector, PerformanceMonitor};
pub use percentiles::LatencyPercentiles;
