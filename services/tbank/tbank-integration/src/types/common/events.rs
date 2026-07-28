use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::types::{TBankError, TBankResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    pub event_id: String,
    pub event_type: WebhookEventType,
    pub webhook_type: WebhookType,
    pub entity_id: String,
    pub status: String,
    pub timestamp: DateTime<Utc>,
    pub payload: serde_json::Value,
}

impl WebhookEvent {
    /// Create WebhookEvent from database row
    pub fn from_row(row: &sqlx::postgres::PgRow) -> TBankResult<Self> {
        let event_type_str: String = row
            .try_get("event_type")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let webhook_type_str: String = row
            .try_get("webhook_type")
            .map_err(|e| TBankError::DatabaseError(e))?;

        let event_type = match event_type_str.as_str() {
            "PaymentCompleted" => WebhookEventType::PaymentCompleted,
            "PaymentFailed" => WebhookEventType::PaymentFailed,
            "PaymentCancelled" => WebhookEventType::PaymentCancelled,
            "InvoiceViewed" => WebhookEventType::InvoiceViewed,
            "InvoicePaid" => WebhookEventType::InvoicePaid,
            _ => {
                return Err(TBankError::ValidationError(format!(
                    "Invalid event type: {}",
                    event_type_str
                )))
            }
        };

        let webhook_type = match webhook_type_str.as_str() {
            "B2B" => WebhookType::B2B,
            "Acquiring" => WebhookType::Acquiring,
            _ => {
                return Err(TBankError::ValidationError(format!(
                    "Invalid webhook type: {}",
                    webhook_type_str
                )))
            }
        };

        Ok(WebhookEvent {
            event_id: row
                .try_get("event_id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            event_type,
            webhook_type,
            entity_id: row
                .try_get("entity_id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            status: row
                .try_get("status")
                .map_err(|e| TBankError::DatabaseError(e))?,
            timestamp: row
                .try_get("created_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
            payload: row
                .try_get("payload")
                .map_err(|e| TBankError::DatabaseError(e))?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookEventType {
    PaymentCompleted,
    PaymentFailed,
    PaymentCancelled,
    InvoiceViewed,
    InvoicePaid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookType {
    B2B,
    Acquiring,
}

impl std::fmt::Display for WebhookEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebhookEventType::PaymentCompleted => write!(f, "PaymentCompleted"),
            WebhookEventType::PaymentFailed => write!(f, "PaymentFailed"),
            WebhookEventType::PaymentCancelled => write!(f, "PaymentCancelled"),
            WebhookEventType::InvoiceViewed => write!(f, "InvoiceViewed"),
            WebhookEventType::InvoicePaid => write!(f, "InvoicePaid"),
        }
    }
}

impl std::fmt::Display for WebhookType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebhookType::B2B => write!(f, "B2B"),
            WebhookType::Acquiring => write!(f, "Acquiring"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
    pub operation_type: String,
    pub entity_id: String,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
    pub changed_fields: Vec<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}
