use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::OnceCell;
use uuid::Uuid;

use tbank_integration::types::TBankError;

pub type TBankResult<T> = Result<T, TBankError>;

static DB_POOL: OnceCell<Arc<PgPool>> = OnceCell::const_new();

pub async fn get_test_db_pool() -> Arc<PgPool> {
    DB_POOL
        .get_or_init(|| async {
            let database_url = std::env::var("TEST_DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/tbank_test".to_string());

            let pool = PgPool::connect(&database_url)
                .await
                .expect("Failed to connect to test database");

            Arc::new(pool)
        })
        .await
        .clone()
}

// Define audit-related enums and structs for testing
#[derive(Debug, Clone, PartialEq)]
pub enum OperationType {
    CounterpartyVerification,
    InvoiceCreation,
    PaymentProcessing,
    WebhookProcessing,
    Reconciliation,
    ConfigurationChange,
}

#[derive(Debug, Clone, PartialEq)]
pub enum LogType {
    Financial,
    Security,
    ApiRequest,
    Webhook,
    System,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ExportFormat {
    Json,
    Csv,
}

#[derive(Debug, Clone)]
pub struct AuditRecord {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<Uuid>,
    pub operation_type: OperationType,
    pub entity_id: Uuid,
    pub old_values: Option<Value>,
    pub new_values: Option<Value>,
    pub changed_fields: Vec<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub hash: String,
}

#[derive(Debug, Clone)]
pub struct FinancialAuditRecord {
    pub id: Uuid,
    pub transaction_id: Uuid,
    pub amount: Decimal,
    pub currency: String,
    pub counterparty_id: Option<Uuid>,
    pub operation_type: String,
    pub reconciliation_status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct RetentionPolicy {
    pub log_type: LogType,
    pub retention_period_days: i32,
    pub archive_period_days: i32,
    pub deletion_period_days: i32,
}