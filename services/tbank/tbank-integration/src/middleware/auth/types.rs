use serde::{Deserialize, Serialize};
use shared::{AuthMiddlewareState, EncryptionService};

/// T-Bank specific authentication state
#[derive(Clone)]
pub struct TBankAuthState {
    pub auth_middleware_state: AuthMiddlewareState,
    pub encryption_service: EncryptionService,
}

impl TBankAuthState {
    pub fn new(auth_middleware_state: AuthMiddlewareState, encryption_service: EncryptionService) -> Self {
        Self {
            auth_middleware_state,
            encryption_service,
        }
    }
}

/// T-Bank specific permissions for role-based access control
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TBankPermission {
    // B2B Invoice permissions
    CreateInvoice,
    ViewInvoice,
    UpdateInvoice,
    CancelInvoice,
    
    // Counterparty permissions
    VerifyCounterparty,
    ViewCounterparty,
    
    // Payment permissions
    InitiatePayment,
    ViewPayment,
    CancelPayment,
    
    // Balance permissions
    ViewBalance,
    ViewStatement,
    
    // Admin permissions
    ViewAuditLogs,
    ManageWebhooks,
    SystemAdmin,
}

/// T-Bank rate limiting configuration
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TBankRateLimitConfig {
    pub counterparty_verification: u32,
    pub b2b_invoices: u32,
    pub acquiring_payments: u32,
    pub balance_queries: u32,
    pub reconciliation: u32,
    pub audit_queries: u32,
}

impl Default for TBankRateLimitConfig {
    fn default() -> Self {
        Self {
            counterparty_verification: 100,
            b2b_invoices: 200,
            acquiring_payments: 500,
            balance_queries: 300,
            reconciliation: 50,
            audit_queries: 100,
        }
    }
}