//! Metrics collector module for ADQuest Rust Performance Engine
//!
//! This module provides comprehensive metrics collection functionality including:
//! - HTTP request metrics
//! - Challenge engine metrics  
//! - ERIR integration metrics
//! - Billing engine metrics
//! - System metrics
//! - Performance monitoring

pub mod core;
pub mod http;
pub mod challenge;
pub mod erir;
pub mod billing;
pub mod system;
pub mod performance;

// Re-export main types and functions for convenience
pub use core::{MetricsCollector, PerformanceMonitor};