//! Rate limiting module for API protection

pub mod config;
pub mod distributed;
pub mod limiter;
pub mod stats;
pub mod tests;

// Re-export main types
pub use config::RateLimitConfig;
pub use limiter::InMemoryRateLimiter;
pub use stats::{RateLimitInfo, RateLimitStats};
