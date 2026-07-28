use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

// ERIR Integration Models (Enhanced)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct ERIDRequest {
    pub request_id: Uuid,
    pub advertiser_inn: String,
    pub advertiser_name: String,
    pub creative_name: String,
    pub creative_form: String,
    pub creative_text: String,
    pub platform_url: String,
    pub contract_number: Option<String>,
    pub contract_date: Option<chrono::NaiveDate>,
    pub trace_id: String,
    pub created_at: DateTime<Utc>,
    pub idempotency_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct ERIDResponse {
    pub request_id: Uuid,
    pub erid: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub trace_id: String,
    pub response_time_ms: u64,
}