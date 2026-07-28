//! Permissions module for ADQuest RBAC system
//!
//! This module provides comprehensive permission management including:
//! - Permission definitions and categories
//! - Role-based permission mapping
//! - Compliance and audit requirements
//! - Permission validation and conversion

pub mod core;
pub mod roles;
pub mod categories;
pub mod compliance;

#[cfg(test)]
mod tests;

// Re-export main types and functions for convenience
pub use core::Permission;
pub use categories::PermissionCategory;
pub use roles::RolePermissions;
pub use compliance::CompliancePermissions;