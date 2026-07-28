use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

// Rate Limiting Models
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct RateLimitRule {
    pub rule_id: String,
    pub resource: String, // "challenge_generation", "validation", etc.
    pub limit: u32,
    pub window_seconds: u32,
    pub burst_limit: Option<u32>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct RateLimitViolation {
    pub violation_id: Uuid,
    pub rule_id: String,
    pub identifier: String, // IP, user_id, site_key, etc.
    pub current_count: u32,
    pub limit: u32,
    pub window_start: DateTime<Utc>,
    pub trace_id: String,
    pub created_at: DateTime<Utc>,
}

// Dead Letter Queue Models
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct DeadLetterMessage {
    pub message_id: Uuid,
    pub original_topic: String,
    #[ts(type = "any")]
    pub payload: serde_json::Value,
    pub error_reason: String,
    pub retry_count: u32,
    pub max_retries: u32,
    pub first_failed_at: DateTime<Utc>,
    pub last_failed_at: DateTime<Utc>,
    pub trace_id: String,
}