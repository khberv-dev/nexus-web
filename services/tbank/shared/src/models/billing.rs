use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

// CQRS Models for Billing
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct BillingCommand {
    pub command_id: Uuid,
    pub command_type: BillingCommandType,
    pub aggregate_id: Uuid, // advertiser_id or publisher_id
    #[ts(type = "any")]
    pub payload: serde_json::Value,
    pub trace_id: String,
    pub created_at: DateTime<Utc>,
    pub idempotency_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum BillingCommandType {
    ProcessCPVTransaction,
    RefundTransaction,
    AdjustBalance,
    FreezeAccount,
    UnfreezeAccount,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct BillingEvent {
    pub event_id: Uuid,
    pub event_type: BillingEventType,
    pub aggregate_id: Uuid,
    #[ts(type = "any")]
    pub payload: serde_json::Value,
    pub trace_id: String,
    pub created_at: DateTime<Utc>,
    pub sequence_number: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum BillingEventType {
    CPVTransactionProcessed,
    TransactionRefunded,
    BalanceAdjusted,
    AccountFrozen,
    AccountUnfrozen,
    TransactionFailed,
}

// Enhanced Billing Models with CQRS
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct CPVTransaction {
    pub id: Uuid,
    pub challenge_id: Uuid,
    pub advertiser_id: Uuid,
    pub publisher_id: Uuid,
    pub site_id: Uuid,
    #[ts(type = "string")]
    pub base_cpv_rate: Decimal,
    #[ts(type = "string")]
    pub quality_coefficient: Decimal,
    #[ts(type = "string")]
    pub final_amount: Decimal,
    #[ts(type = "string")]
    pub platform_fee: Decimal,
    #[ts(type = "string")]
    pub antifraud_fee: Decimal,
    #[ts(type = "string")]
    pub publisher_payout: Decimal,
    pub created_at: DateTime<Utc>,
    pub trace_id: String,
    pub idempotency_key: String,
    pub status: TransactionStatus,
    pub audit_trail: Vec<AuditEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum TransactionStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Refunded,
    Disputed,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct AuditEntry {
    pub entry_id: Uuid,
    pub action: String,
    pub actor: String, // system, user_id, etc.
    #[ts(type = "any")]
    pub details: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    pub trace_id: String,
}