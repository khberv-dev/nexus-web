//! Payment completion module for T-Bank Acquiring API
//! 
//! This module handles payment status updates, completion processing,
//! and related operations for the T-Bank Acquiring API.

pub mod initialization;
pub mod processing;
pub mod service;
pub mod status;
pub mod types;

pub use initialization::*;
pub use processing::*;
pub use service::*;
pub use status::*;
pub use types::*;