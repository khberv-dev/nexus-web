//! Cloud.ru Secret Management integration
//! 
//! This module provides secure secret loading from Cloud.ru Secret Management service.
//! Secrets are loaded at application startup and injected into environment variables.

mod client;
mod config;
mod loader;

pub use client::CloudRuClient;
pub use config::CloudRuConfig;
pub use loader::{init_secrets, SecretMapping};
