use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::types::acquiring::payment::AcquiringPaymentStatus;
use crate::types::b2b::invoice::B2BInvoiceStatus;
use crate::types::{TBankError, TBankResult};

/// Webhook event types for T-Bank notifications
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEventType {
    // B2B Invoice Events
    #[serde(rename = "invoice.viewed")]
    B2BInvoiceViewed,
    #[serde(rename = "invoice.paid")]
    B2BInvoicePaid,
    #[serde(rename = "invoice.overdue")]
    B2BInvoiceOverdue,
    #[serde(rename = "invoice.cancelled")]
    B2BInvoiceCancelled,
    #[serde(rename = "invoice.refunded")]
    B2BInvoiceRefunded,

    // Acquiring Payment Events
    #[serde(rename = "payment.completed")]
    AcquiringPaymentCompleted,
    #[serde(rename = "payment.failed")]
    AcquiringPaymentFailed,
    #[serde(rename = "payment.cancelled")]
    AcquiringPaymentCancelled,
    #[serde(rename = "payment.expired")]
    AcquiringPaymentExpired,
}

/// Webhook type to distinguish between B2B and Acquiring webhooks
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum WebhookType {
    #[serde(rename = "B2B")]
    B2B,
    #[serde(rename = "ACQUIRING")]
    Acquiring,
}

/// Webhook event structure from T-Bank
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    #[serde(rename = "eventId")]
    pub event_id: String,
    #[serde(rename = "eventType")]
    pub event_type: WebhookEventType,
    #[serde(rename = "entityId")]
    pub entity_id: String,
    pub status: String,
    pub timestamp: DateTime<Utc>,
    #[serde(flatten)]
    pub payload: serde_json::Value,
}

/// Internal webhook event for database storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InternalWebhookEvent {
    pub id: Option<Uuid>,
    pub event_id: String,
    pub event_type: WebhookEventType,
    pub webhook_type: WebhookType,
    pub entity_id: String,
    pub status: String,
    pub payload: serde_json::Value,
    pub processing_status: WebhookProcessingStatus,
    pub retry_count: i32,
    pub processed_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Webhook processing status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum WebhookProcessingStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Skipped,
}

/// B2B Invoice webhook payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B2BInvoiceWebhookPayload {
    #[serde(rename = "invoiceId")]
    pub invoice_id: String,
    #[serde(rename = "invoiceNumber")]
    pub invoice_number: String,
    #[serde(rename = "counterpartyInn")]
    pub counterparty_inn: String,
    pub amount: rust_decimal::Decimal,
    pub currency: String,
    #[serde(rename = "dueDate")]
    pub due_date: String,
    pub status: String,
    #[serde(rename = "paidAt", skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<DateTime<Utc>>,
    #[serde(rename = "viewedAt", skip_serializing_if = "Option::is_none")]
    pub viewed_at: Option<DateTime<Utc>>,
}

/// Acquiring Payment webhook payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcquiringPaymentWebhookPayload {
    #[serde(rename = "paymentId")]
    pub payment_id: String,
    #[serde(rename = "orderId")]
    pub order_id: String,
    pub amount: rust_decimal::Decimal,
    pub currency: String,
    #[serde(rename = "paymentMethod")]
    pub payment_method: String,
    pub status: String,
    #[serde(rename = "completedAt", skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(rename = "failureReason", skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
    #[serde(rename = "errorCode", skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

impl WebhookEventType {
    /// Get the webhook type (B2B or Acquiring) for this event type
    pub fn webhook_type(&self) -> WebhookType {
        match self {
            WebhookEventType::B2BInvoiceViewed
            | WebhookEventType::B2BInvoicePaid
            | WebhookEventType::B2BInvoiceOverdue
            | WebhookEventType::B2BInvoiceCancelled
            | WebhookEventType::B2BInvoiceRefunded => WebhookType::B2B,

            WebhookEventType::AcquiringPaymentCompleted
            | WebhookEventType::AcquiringPaymentFailed
            | WebhookEventType::AcquiringPaymentCancelled
            | WebhookEventType::AcquiringPaymentExpired => WebhookType::Acquiring,
        }
    }

    /// Convert to B2B invoice status if applicable
    pub fn to_b2b_invoice_status(&self) -> Option<B2BInvoiceStatus> {
        match self {
            WebhookEventType::B2BInvoiceViewed => Some(B2BInvoiceStatus::Viewed),
            WebhookEventType::B2BInvoicePaid => Some(B2BInvoiceStatus::Paid),
            WebhookEventType::B2BInvoiceOverdue => Some(B2BInvoiceStatus::Overdue),
            WebhookEventType::B2BInvoiceCancelled => Some(B2BInvoiceStatus::Cancelled),
            WebhookEventType::B2BInvoiceRefunded => Some(B2BInvoiceStatus::Refunded),
            _ => None,
        }
    }

    /// Convert to acquiring payment status if applicable
    pub fn to_acquiring_payment_status(&self) -> Option<AcquiringPaymentStatus> {
        match self {
            WebhookEventType::AcquiringPaymentCompleted => Some(AcquiringPaymentStatus::Completed),
            WebhookEventType::AcquiringPaymentFailed => Some(AcquiringPaymentStatus::Failed),
            WebhookEventType::AcquiringPaymentCancelled => Some(AcquiringPaymentStatus::Cancelled),
            WebhookEventType::AcquiringPaymentExpired => Some(AcquiringPaymentStatus::Expired),
            _ => None,
        }
    }

    /// Check if this event type requires immediate processing
    pub fn requires_immediate_processing(&self) -> bool {
        matches!(
            self,
            WebhookEventType::B2BInvoicePaid
                | WebhookEventType::B2BInvoiceRefunded
                | WebhookEventType::AcquiringPaymentCompleted
                | WebhookEventType::AcquiringPaymentFailed
        )
    }

    /// Get event priority for processing order
    pub fn priority(&self) -> u8 {
        match self {
            // High priority - financial events
            WebhookEventType::B2BInvoicePaid | WebhookEventType::B2BInvoiceRefunded => 1,
            WebhookEventType::AcquiringPaymentCompleted
            | WebhookEventType::AcquiringPaymentFailed => 1,

            // Medium priority - status changes
            WebhookEventType::B2BInvoiceViewed | WebhookEventType::B2BInvoiceOverdue => 2,
            WebhookEventType::AcquiringPaymentCancelled
            | WebhookEventType::AcquiringPaymentExpired => 2,

            // Low priority - cancellations
            WebhookEventType::B2BInvoiceCancelled => 3,
        }
    }
}

impl WebhookEvent {
    /// Parse B2B invoice webhook payload
    pub fn parse_b2b_invoice_payload(&self) -> TBankResult<B2BInvoiceWebhookPayload> {
        if self.event_type.webhook_type() != WebhookType::B2B {
            return Err(TBankError::ValidationError(
                "Event is not a B2B invoice event".to_string(),
            ));
        }

        serde_json::from_value(self.payload.clone()).map_err(|e| {
            error!(
                error = %e,
                event_id = %self.event_id,
                event_type = ?self.event_type,
                "Failed to parse B2B invoice webhook payload"
            );
            TBankError::SerializationError(e)
        })
    }

    /// Parse acquiring payment webhook payload
    pub fn parse_acquiring_payment_payload(&self) -> TBankResult<AcquiringPaymentWebhookPayload> {
        if self.event_type.webhook_type() != WebhookType::Acquiring {
            return Err(TBankError::ValidationError(
                "Event is not an acquiring payment event".to_string(),
            ));
        }

        serde_json::from_value(self.payload.clone()).map_err(|e| {
            error!(
                error = %e,
                event_id = %self.event_id,
                event_type = ?self.event_type,
                "Failed to parse acquiring payment webhook payload"
            );
            TBankError::SerializationError(e)
        })
    }

    /// Validate webhook event structure
    pub fn validate(&self) -> TBankResult<()> {
        if self.event_id.is_empty() {
            return Err(TBankError::ValidationError(
                "Event ID cannot be empty".to_string(),
            ));
        }

        if self.entity_id.is_empty() {
            return Err(TBankError::ValidationError(
                "Entity ID cannot be empty".to_string(),
            ));
        }

        if self.status.is_empty() {
            return Err(TBankError::ValidationError(
                "Status cannot be empty".to_string(),
            ));
        }

        // Validate timestamp is not too old (more than 24 hours)
        let now = Utc::now();
        let age = now.signed_duration_since(self.timestamp);
        if age.num_hours() > 24 {
            warn!(
                event_id = %self.event_id,
                timestamp = %self.timestamp,
                age_hours = age.num_hours(),
                "Webhook event is older than 24 hours"
            );
        }

        debug!(
            event_id = %self.event_id,
            event_type = ?self.event_type,
            entity_id = %self.entity_id,
            "Webhook event validation passed"
        );

        Ok(())
    }

    /// Convert to internal webhook event for storage
    pub fn to_internal(&self) -> InternalWebhookEvent {
        InternalWebhookEvent {
            id: Some(Uuid::new_v4()),
            event_id: self.event_id.clone(),
            event_type: self.event_type.clone(),
            webhook_type: self.event_type.webhook_type(),
            entity_id: self.entity_id.clone(),
            status: self.status.clone(),
            payload: self.payload.clone(),
            processing_status: WebhookProcessingStatus::Pending,
            retry_count: 0,
            processed_at: None,
            created_at: Some(Utc::now()),
        }
    }
}

impl InternalWebhookEvent {
    /// Create InternalWebhookEvent from database row
    pub fn from_row(row: &sqlx::postgres::PgRow) -> TBankResult<Self> {
        use sqlx::Row;

        let event_type_str: String = row
            .try_get("event_type")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let event_type = event_type_str
            .parse::<WebhookEventType>()
            .map_err(|e| TBankError::ValidationError(e))?;

        let webhook_type_str: String = row
            .try_get("webhook_type")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let webhook_type = match webhook_type_str.as_str() {
            "B2B" => WebhookType::B2B,
            "ACQUIRING" => WebhookType::Acquiring,
            _ => {
                return Err(TBankError::ValidationError(format!(
                    "Invalid webhook type: {}",
                    webhook_type_str
                )))
            }
        };

        let processing_status_str: String = row
            .try_get("processing_status")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let processing_status = processing_status_str
            .parse::<WebhookProcessingStatus>()
            .map_err(|e| TBankError::ValidationError(e))?;

        Ok(Self {
            id: row
                .try_get("id")
                .map_err(|e| TBankError::DatabaseError(e))?,
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
            payload: row
                .try_get("payload")
                .map_err(|e| TBankError::DatabaseError(e))?,
            processing_status,
            retry_count: row
                .try_get("retry_count")
                .map_err(|e| TBankError::DatabaseError(e))?,
            processed_at: row
                .try_get("processed_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
            created_at: row
                .try_get("created_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
        })
    }

    /// Check if event can be retried
    pub fn can_retry(&self) -> bool {
        matches!(self.processing_status, WebhookProcessingStatus::Failed) && self.retry_count < 5
    }

    /// Mark as processing
    pub fn mark_processing(&mut self) {
        self.processing_status = WebhookProcessingStatus::Processing;
    }

    /// Mark as completed
    pub fn mark_completed(&mut self) {
        self.processing_status = WebhookProcessingStatus::Completed;
        self.processed_at = Some(Utc::now());
    }

    /// Mark as failed and increment retry count
    pub fn mark_failed(&mut self) {
        self.processing_status = WebhookProcessingStatus::Failed;
        self.retry_count += 1;
    }

    /// Mark as skipped (duplicate or invalid)
    pub fn mark_skipped(&mut self) {
        self.processing_status = WebhookProcessingStatus::Skipped;
        self.processed_at = Some(Utc::now());
    }
}

impl std::fmt::Display for WebhookType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebhookType::B2B => write!(f, "B2B"),
            WebhookType::Acquiring => write!(f, "ACQUIRING"),
        }
    }
}

impl std::str::FromStr for WebhookType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "B2B" => Ok(WebhookType::B2B),
            "ACQUIRING" => Ok(WebhookType::Acquiring),
            _ => Err(format!("Invalid webhook type: {}", s)),
        }
    }
}

impl std::fmt::Display for WebhookEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebhookEventType::B2BInvoiceViewed => write!(f, "invoice.viewed"),
            WebhookEventType::B2BInvoicePaid => write!(f, "invoice.paid"),
            WebhookEventType::B2BInvoiceOverdue => write!(f, "invoice.overdue"),
            WebhookEventType::B2BInvoiceCancelled => write!(f, "invoice.cancelled"),
            WebhookEventType::B2BInvoiceRefunded => write!(f, "invoice.refunded"),
            WebhookEventType::AcquiringPaymentCompleted => write!(f, "payment.completed"),
            WebhookEventType::AcquiringPaymentFailed => write!(f, "payment.failed"),
            WebhookEventType::AcquiringPaymentCancelled => write!(f, "payment.cancelled"),
            WebhookEventType::AcquiringPaymentExpired => write!(f, "payment.expired"),
        }
    }
}

impl std::str::FromStr for WebhookEventType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "invoice.viewed" => Ok(WebhookEventType::B2BInvoiceViewed),
            "invoice.paid" => Ok(WebhookEventType::B2BInvoicePaid),
            "invoice.overdue" => Ok(WebhookEventType::B2BInvoiceOverdue),
            "invoice.cancelled" => Ok(WebhookEventType::B2BInvoiceCancelled),
            "invoice.refunded" => Ok(WebhookEventType::B2BInvoiceRefunded),
            "payment.completed" => Ok(WebhookEventType::AcquiringPaymentCompleted),
            "payment.failed" => Ok(WebhookEventType::AcquiringPaymentFailed),
            "payment.cancelled" => Ok(WebhookEventType::AcquiringPaymentCancelled),
            "payment.expired" => Ok(WebhookEventType::AcquiringPaymentExpired),
            _ => Err(format!("Invalid webhook event type: {}", s)),
        }
    }
}

impl std::fmt::Display for WebhookProcessingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebhookProcessingStatus::Pending => write!(f, "Pending"),
            WebhookProcessingStatus::Processing => write!(f, "Processing"),
            WebhookProcessingStatus::Completed => write!(f, "Completed"),
            WebhookProcessingStatus::Failed => write!(f, "Failed"),
            WebhookProcessingStatus::Skipped => write!(f, "Skipped"),
        }
    }
}

impl std::str::FromStr for WebhookProcessingStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Pending" => Ok(WebhookProcessingStatus::Pending),
            "Processing" => Ok(WebhookProcessingStatus::Processing),
            "Completed" => Ok(WebhookProcessingStatus::Completed),
            "Failed" => Ok(WebhookProcessingStatus::Failed),
            "Skipped" => Ok(WebhookProcessingStatus::Skipped),
            _ => Err(format!("Invalid webhook processing status: {}", s)),
        }
    }
}
