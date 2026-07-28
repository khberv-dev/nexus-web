use serde_json::Value;

/// Audit context for enhanced logging of sensitive operations
#[derive(Debug, Clone)]
pub struct AuditContext {
    pub user_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub session_id: Option<String>,
    pub risk_level: RiskLevel,
    pub additional_context: Option<Value>,
}

/// Risk level for audit operations
#[derive(Debug, Clone)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl RiskLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            RiskLevel::Low => "LOW",
            RiskLevel::Medium => "MEDIUM",
            RiskLevel::High => "HIGH",
            RiskLevel::Critical => "CRITICAL",
        }
    }
}

/// Compliance type for audit logging
#[derive(Debug, Clone)]
pub enum ComplianceType {
    PciDss,
    Gdpr,
    Russian152FZ,
}

impl ComplianceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ComplianceType::PciDss => "PCI_DSS",
            ComplianceType::Gdpr => "GDPR",
            ComplianceType::Russian152FZ => "RUSSIAN_152FZ",
        }
    }
}

/// Entity type for audit logging
#[derive(Debug, Clone)]
pub enum EntityType {
    B2BInvoice,
    AcquiringPayment,
    Counterparty,
    FinancialAudit,
    WebhookEvent,
}

impl EntityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntityType::B2BInvoice => "B2B_INVOICE",
            EntityType::AcquiringPayment => "ACQUIRING_PAYMENT",
            EntityType::Counterparty => "COUNTERPARTY",
            EntityType::FinancialAudit => "FINANCIAL_AUDIT",
            EntityType::WebhookEvent => "WEBHOOK_EVENT",
        }
    }
}
