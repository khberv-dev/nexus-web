//! Models module for ADQuest Rust Performance Engine
//!
//! This module provides comprehensive data models including:
//! - Challenge and validation models
//! - Billing and transaction models
//! - ERIR integration models
//! - System health and monitoring models
//! - Rate limiting and failure handling models

pub mod challenge;
pub mod billing;
pub mod erir;
pub mod health;
pub mod rate_limit;
pub mod observability;
pub mod targeting;
pub mod organization;
pub mod metrics;

// Re-export all models for convenience
pub use challenge::*;
pub use billing::*;
pub use erir::*;
pub use health::*;
pub use rate_limit::*;
pub use observability::*;
pub use targeting::*;
pub use organization::*;
pub use metrics::*;