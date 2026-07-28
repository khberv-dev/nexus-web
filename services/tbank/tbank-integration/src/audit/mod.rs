pub mod export;
pub mod logger;
pub mod retention;
pub mod search;

// Re-export the main audit logger and traits
pub use export::{AuditExporter, ExportFilter, ExportFormat, ExportStatistics, ExportableAuditLog};
pub use logger::{
    new as new_audit_logger, AcquiringAuditEvents, AuditContext, AuditIntegrity, AuditLogger,
    B2BAuditEvents, ComplianceAuditEvents, ComplianceType, EntityType, RiskLevel,
    SecurityAuditEvents,
};
pub use retention::{
    RetentionManager, RetentionPolicies, RetentionPolicy, RetentionResult, RetentionStatistics,
    TableRetentionStats,
};
pub use search::{
    AuditSearchCriteria, AuditSearchResult, AuditSearchService, SearchStatistics, SortField,
    SortOrder,
};
