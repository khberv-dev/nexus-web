use chrono::{DateTime, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use self::events::{
    InternalWebhookEvent, WebhookEvent, WebhookEventType, WebhookProcessingStatus, WebhookType,
};
use self::retry::WebhookRetryExecutor;
use self::signature::WebhookSignatureValidator;
use crate::acquiring::AcquiringPaymentProcessor;
use crate::b2b::B2BInvoiceManager;
use crate::database::common_queries::CommonQueries;
use crate::types::{TBankError, TBankResult};

pub mod events;
pub mod retry;
pub mod signature;

/// Webhook handler for processing T-Bank webhook notifications
pub struct WebhookHandler {
    b2b_invoice_manager: Arc<B2BInvoiceManager>,
    acquiring_payment_processor: Arc<AcquiringPaymentProcessor>,
    db_pool: Arc<PgPool>,
    signature_validator: WebhookSignatureValidator,
    retry_executor: Arc<WebhookRetryExecutor>,
}

impl WebhookHandler {
    /// Create new webhook handler
    pub fn new(
        b2b_invoice_manager: Arc<B2BInvoiceManager>,
        acquiring_payment_processor: Arc<AcquiringPaymentProcessor>,
        db_pool: Arc<PgPool>,
        webhook_secret: String,
    ) -> Self {
        info!("Initializing WebhookHandler");

        let signature_validator = WebhookSignatureValidator::new(webhook_secret);
        let retry_executor = Arc::new(WebhookRetryExecutor::new());

        Self {
            b2b_invoice_manager,
            acquiring_payment_processor,
            db_pool,
            signature_validator,
            retry_executor,
        }
    }

    /// Process incoming webhook with signature validation
    pub async fn process_webhook(
        &self,
        payload: &str,
        signature: &str,
        webhook_type: WebhookType,
    ) -> TBankResult<()> {
        info!(
            webhook_type = ?webhook_type,
            payload_size = payload.len(),
            "Processing incoming webhook"
        );

        // Validate webhook signature
        self.signature_validator.validate(payload, signature)?;

        // Parse webhook event
        let webhook_event: WebhookEvent = serde_json::from_str(payload).map_err(|e| {
            error!(
                error = %e,
                payload = %payload,
                "Failed to parse webhook payload"
            );
            TBankError::SerializationError(e)
        })?;

        // Validate event structure
        webhook_event.validate()?;

        // Check for duplicate events
        if self.is_duplicate_event(&webhook_event.event_id).await? {
            warn!(
                event_id = %webhook_event.event_id,
                "Duplicate webhook event received, skipping"
            );
            return Err(TBankError::DuplicateWebhookEvent {
                event_id: webhook_event.event_id,
            });
        }

        // Store webhook event for audit
        let mut internal_event = webhook_event.to_internal();
        self.store_webhook_event(&internal_event).await?;

        // Process the webhook event
        let result = self.process_webhook_event(&webhook_event).await;

        // Update processing status
        match result {
            Ok(_) => {
                internal_event.mark_completed();
                info!(
                    event_id = %webhook_event.event_id,
                    event_type = ?webhook_event.event_type,
                    "Webhook event processed successfully"
                );
            }
            Err(ref e) => {
                internal_event.mark_failed();
                error!(
                    error = %e,
                    event_id = %webhook_event.event_id,
                    event_type = ?webhook_event.event_type,
                    "Failed to process webhook event"
                );
            }
        }

        // Update event status in database
        self.update_webhook_event_status(&internal_event).await?;

        result
    }

    /// Process webhook event based on type
    async fn process_webhook_event(&self, event: &WebhookEvent) -> TBankResult<()> {
        debug!(
            event_id = %event.event_id,
            event_type = ?event.event_type,
            entity_id = %event.entity_id,
            "Processing webhook event"
        );

        match event.event_type.webhook_type() {
            WebhookType::B2B => self.process_b2b_webhook_event(event).await,
            WebhookType::Acquiring => self.process_acquiring_webhook_event(event).await,
        }
    }

    /// Process B2B invoice webhook event
    async fn process_b2b_webhook_event(&self, event: &WebhookEvent) -> TBankResult<()> {
        debug!(
            event_id = %event.event_id,
            event_type = ?event.event_type,
            entity_id = %event.entity_id,
            "Processing B2B invoice webhook event"
        );

        // Parse B2B invoice payload
        let payload = event.parse_b2b_invoice_payload()?;

        // Get the new status from event type
        let new_status = event.event_type.to_b2b_invoice_status().ok_or_else(|| {
            TBankError::ValidationError(format!(
                "Event type {:?} is not a B2B invoice event",
                event.event_type
            ))
        })?;

        // Find invoice by T-Bank invoice ID
        let invoice_id = self.find_invoice_by_tbank_id(&payload.invoice_id).await?;

        // Update invoice status using state machine validation
        self.b2b_invoice_manager
            .update_invoice_status(invoice_id, new_status)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    tbank_invoice_id = %payload.invoice_id,
                    new_status = ?new_status,
                    "Failed to update B2B invoice status from webhook"
                );
                TBankError::WebhookProcessingFailed {
                    reason: format!("Failed to update invoice status: {}", e),
                    event_id: Some(event.event_id.clone()),
                }
            })?;

        info!(
            event_id = %event.event_id,
            invoice_id = ?invoice_id,
            tbank_invoice_id = %payload.invoice_id,
            new_status = ?new_status,
            "B2B invoice status updated from webhook"
        );

        Ok(())
    }

    /// Process acquiring payment webhook event
    async fn process_acquiring_webhook_event(&self, event: &WebhookEvent) -> TBankResult<()> {
        debug!(
            event_id = %event.event_id,
            event_type = ?event.event_type,
            entity_id = %event.entity_id,
            "Processing acquiring payment webhook event"
        );

        // Parse acquiring payment payload
        let payload = event.parse_acquiring_payment_payload()?;

        // Get the new status from event type
        let new_status = event
            .event_type
            .to_acquiring_payment_status()
            .ok_or_else(|| {
                TBankError::ValidationError(format!(
                    "Event type {:?} is not an acquiring payment event",
                    event.event_type
                ))
            })?;

        // Find payment by T-Bank payment ID
        let payment_id = self.find_payment_by_tbank_id(&payload.payment_id).await?;

        // Update payment status
        self.acquiring_payment_processor
            .update_payment_status(payment_id, new_status)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    payment_id = ?payment_id,
                    tbank_payment_id = %payload.payment_id,
                    new_status = ?new_status,
                    "Failed to update acquiring payment status from webhook"
                );
                TBankError::WebhookProcessingFailed {
                    reason: format!("Failed to update payment status: {}", e),
                    event_id: Some(event.event_id.clone()),
                }
            })?;

        info!(
            event_id = %event.event_id,
            payment_id = ?payment_id,
            tbank_payment_id = %payload.payment_id,
            new_status = ?new_status,
            "Acquiring payment status updated from webhook"
        );

        Ok(())
    }

    /// Check if webhook event is duplicate
    async fn is_duplicate_event(&self, event_id: &str) -> TBankResult<bool> {
        debug!(event_id = %event_id, "Checking for duplicate webhook event");

        CommonQueries::webhook_event_exists(&self.db_pool, event_id).await
    }

    /// Store webhook event for audit
    async fn store_webhook_event(&self, event: &InternalWebhookEvent) -> TBankResult<()> {
        debug!(
            event_id = %event.event_id,
            event_type = ?event.event_type,
            "Storing webhook event for audit"
        );

        CommonQueries::insert_webhook_event(&self.db_pool, event).await
    }

    /// Update webhook event processing status
    async fn update_webhook_event_status(&self, event: &InternalWebhookEvent) -> TBankResult<()> {
        debug!(
            event_id = %event.event_id,
            processing_status = ?event.processing_status,
            "Updating webhook event processing status"
        );

        CommonQueries::update_webhook_event_status(
            &self.db_pool,
            &event.event_id,
            event.processing_status.clone(),
            event.retry_count,
            event.processed_at,
        )
        .await
    }

    /// Find invoice by T-Bank invoice ID
    async fn find_invoice_by_tbank_id(&self, tbank_invoice_id: &str) -> TBankResult<Uuid> {
        debug!(tbank_invoice_id = %tbank_invoice_id, "Finding invoice by T-Bank ID");

        // This would typically query the database to find the invoice
        // For now, we'll use a placeholder implementation
        CommonQueries::find_invoice_by_tbank_id(&self.db_pool, tbank_invoice_id).await
    }

    /// Find payment by T-Bank payment ID
    async fn find_payment_by_tbank_id(&self, tbank_payment_id: &str) -> TBankResult<Uuid> {
        debug!(tbank_payment_id = %tbank_payment_id, "Finding payment by T-Bank ID");

        // This would typically query the database to find the payment
        // For now, we'll use a placeholder implementation
        CommonQueries::find_payment_by_tbank_id(&self.db_pool, tbank_payment_id).await
    }

    /// Retry failed webhook events
    pub async fn retry_failed_events(&self) -> TBankResult<u32> {
        info!("Retrying failed webhook events");

        let failed_events = CommonQueries::get_failed_webhook_events(&self.db_pool, 10).await?;
        let mut retry_count = 0;

        for mut event in failed_events {
            if !event.can_retry() {
                debug!(
                    event_id = %event.event_id,
                    retry_count = event.retry_count,
                    "Webhook event exceeded max retry attempts, skipping"
                );
                continue;
            }

            info!(
                event_id = %event.event_id,
                retry_count = event.retry_count,
                "Retrying failed webhook event"
            );

            // Create webhook event from stored data
            let webhook_event = WebhookEvent {
                event_id: event.event_id.clone(),
                event_type: event.event_type.clone(),
                entity_id: event.entity_id.clone(),
                status: event.status.clone(),
                timestamp: event.created_at.unwrap_or_else(Utc::now),
                payload: event.payload.clone(),
            };

            // Mark as processing
            event.mark_processing();
            self.update_webhook_event_status(&event).await?;

            // Retry processing
            let result = self.process_webhook_event(&webhook_event).await;

            match result {
                Ok(_) => {
                    event.mark_completed();
                    retry_count += 1;
                    info!(
                        event_id = %event.event_id,
                        "Webhook event retry successful"
                    );
                }
                Err(e) => {
                    event.mark_failed();
                    error!(
                        error = %e,
                        event_id = %event.event_id,
                        "Webhook event retry failed"
                    );
                }
            }

            // Update final status
            self.update_webhook_event_status(&event).await?;
        }

        info!(
            retry_count = retry_count,
            "Completed webhook event retry batch"
        );
        Ok(retry_count)
    }

    /// Get webhook processing statistics
    pub async fn get_processing_stats(&self) -> TBankResult<WebhookProcessingStats> {
        debug!("Getting webhook processing statistics");

        CommonQueries::get_webhook_processing_stats(&self.db_pool).await
    }
}

/// Webhook processing statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebhookProcessingStats {
    pub total_events: u64,
    pub pending_events: u64,
    pub processing_events: u64,
    pub completed_events: u64,
    pub failed_events: u64,
    pub skipped_events: u64,
    pub b2b_events: u64,
    pub acquiring_events: u64,
    pub average_processing_time_ms: f64,
}
