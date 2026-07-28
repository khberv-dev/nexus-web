use sqlx::PgPool;
use std::sync::Arc;
use tracing::info;

use crate::types::TBankResult;
use shared::EncryptionService;

pub use self::acquiring_events::AcquiringAuditEvents;
pub use self::b2b_events::B2BAuditEvents;
pub use self::compliance_events::ComplianceAuditEvents;
pub use self::core::AuditLogger;
pub use self::integrity::AuditIntegrity;
pub use self::security_events::SecurityAuditEvents;
pub use self::types::{AuditContext, ComplianceType, EntityType, RiskLevel};

mod acquiring_events;
mod b2b_events;
mod compliance_events;
mod core;
mod integrity;
mod security_events;
mod types;

/// Create new audit logger instance
pub fn new(db_pool: Arc<PgPool>, encryption_service: Arc<EncryptionService>) -> AuditLogger {
    info!("Initializing AuditLogger with cryptographic integrity protection");
    AuditLogger::new(db_pool, encryption_service)
}
