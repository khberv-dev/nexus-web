pub mod acquiring;
pub mod api;
pub mod app;
pub mod audit;
pub mod b2b;
pub mod balance;
pub mod client;
pub mod config;
pub mod counterparty;
pub mod database;
pub mod email;
pub mod middleware;
pub mod monitoring;
pub mod numbering;
pub mod reconciliation;
pub mod services;
pub mod types;
pub mod webhook;

// Re-export main types
pub use config::TBankConfig;
pub use services::{TBankServiceFactory, TBankServices};
pub use types::{
    AccountBalance,
    // Acquiring types
    AcquiringPayment,
    AcquiringPaymentMethod,
    AcquiringPaymentStatus,
    AuditEvent,
    // B2B types
    B2BInvoice,
    B2BInvoiceContact,
    B2BInvoiceItem,
    B2BInvoiceStatus,
    Currency,
    FinancialAudit,
    OperationType,
    ReconciliationStatus,
    TBankError,
    TBankResult,
    Transaction,
    // Common types
    WebhookEvent,
    WebhookEventType,
    WebhookType,
};

// Re-export shared types for convenience
pub use shared::auth::InMemoryRateLimiter;
pub use shared::{
    ADQuestError, AuthMiddlewareState, CacheManager, DatabaseManager, EncryptionService,
    HealthChecker, ZitadelValidator,
};

// Re-export API router for main.rs
pub use api::{create_app_router, create_app_with_state};
