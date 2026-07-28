use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error};
use uuid::Uuid;

use crate::types::common::events::{WebhookEvent, WebhookType};
use crate::types::counterparty::CounterpartyData;
use crate::types::{TBankError, TBankResult};

/// Common database queries shared across B2B and acquiring modules
pub struct CommonQueries;

impl CommonQueries {
    /// Insert audit log entry
    pub async fn insert_audit_log(
        pool: &PgPool,
        user_id: Option<&str>,
        operation_type: &str,
        entity_type: &str,
        entity_id: &str,
        old_values: Option<&serde_json::Value>,
        new_values: Option<&serde_json::Value>,
        changed_fields: &[String],
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        hash: &str,
    ) -> TBankResult<()> {
        debug!(
            operation_type = %operation_type,
            entity_type = %entity_type,
            entity_id = %entity_id,
            "Inserting audit log entry"
        );

        let query = r#"
            INSERT INTO audit_logs (
                id, timestamp, user_id, operation_type, entity_type, entity_id,
                old_values, new_values, changed_fields, ip_address, user_agent, hash,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        "#;

        sqlx::query(query)
            .bind(Uuid::new_v4())
            .bind(Utc::now())
            .bind(user_id)
            .bind(operation_type)
            .bind(entity_type)
            .bind(entity_id)
            .bind(old_values)
            .bind(new_values)
            .bind(changed_fields)
            .bind(ip_address)
            .bind(user_agent)
            .bind(hash)
            .bind(Utc::now())
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    operation_type = %operation_type,
                    entity_id = %entity_id,
                    "Failed to insert audit log entry"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            operation_type = %operation_type,
            entity_id = %entity_id,
            "Audit log entry inserted successfully"
        );

        Ok(())
    }

    /// Insert financial audit record
    pub async fn insert_financial_audit(
        pool: &PgPool,
        transaction_id: &str,
        transaction_type: &str,
        amount: rust_decimal::Decimal,
        currency: &str,
        counterparty_inn: Option<&str>,
        operation_date: DateTime<Utc>,
        status: &str,
    ) -> TBankResult<()> {
        debug!(
            transaction_id = %transaction_id,
            transaction_type = %transaction_type,
            amount = %amount,
            "Inserting financial audit record"
        );

        let query = r#"
            INSERT INTO financial_audit (
                id, transaction_id, transaction_type, amount, currency,
                counterparty_inn, operation_date, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#;

        sqlx::query(query)
            .bind(Uuid::new_v4())
            .bind(transaction_id)
            .bind(transaction_type)
            .bind(amount)
            .bind(currency)
            .bind(counterparty_inn)
            .bind(operation_date)
            .bind(status)
            .bind(Utc::now())
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    transaction_id = %transaction_id,
                    "Failed to insert financial audit record"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            transaction_id = %transaction_id,
            "Financial audit record inserted successfully"
        );

        Ok(())
    }

    /// Insert webhook event (updated for InternalWebhookEvent)
    pub async fn insert_webhook_event(
        pool: &PgPool,
        event: &crate::webhook::events::InternalWebhookEvent,
    ) -> TBankResult<()> {
        debug!(
            event_id = %event.event_id,
            event_type = ?event.event_type,
            webhook_type = ?event.webhook_type,
            "Inserting webhook event"
        );

        let query = r#"
            INSERT INTO webhook_events (
                id, event_id, event_type, webhook_type, entity_id, status,
                payload, processing_status, retry_count, processed_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#;

        sqlx::query(query)
            .bind(event.id)
            .bind(&event.event_id)
            .bind(event.event_type.to_string())
            .bind(event.webhook_type.to_string())
            .bind(&event.entity_id)
            .bind(&event.status)
            .bind(&event.payload)
            .bind(event.processing_status.to_string())
            .bind(event.retry_count)
            .bind(event.processed_at)
            .bind(event.created_at)
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    event_id = %event.event_id,
                    "Failed to insert webhook event"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            event_id = %event.event_id,
            "Webhook event inserted successfully"
        );

        Ok(())
    }

    /// Check if webhook event exists (for idempotency)
    pub async fn webhook_event_exists(pool: &PgPool, event_id: &str) -> TBankResult<bool> {
        debug!(event_id = %event_id, "Checking if webhook event exists");

        let query = "SELECT EXISTS(SELECT 1 FROM webhook_events WHERE event_id = $1)";

        let exists: (bool,) = sqlx::query_as(query)
            .bind(event_id)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    event_id = %event_id,
                    "Failed to check webhook event existence"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            event_id = %event_id,
            exists = exists.0,
            "Webhook event existence check completed"
        );

        Ok(exists.0)
    }

    /// Update webhook event processing status (updated for WebhookProcessingStatus)
    pub async fn update_webhook_event_status(
        pool: &PgPool,
        event_id: &str,
        processing_status: crate::webhook::events::WebhookProcessingStatus,
        retry_count: i32,
        processed_at: Option<DateTime<Utc>>,
    ) -> TBankResult<()> {
        debug!(
            event_id = %event_id,
            processing_status = ?processing_status,
            retry_count = retry_count,
            "Updating webhook event status"
        );

        let query = r#"
            UPDATE webhook_events 
            SET processing_status = $1, retry_count = $2, processed_at = $3
            WHERE event_id = $4
        "#;

        let result = sqlx::query(query)
            .bind(processing_status.to_string())
            .bind(retry_count)
            .bind(processed_at)
            .bind(event_id)
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    event_id = %event_id,
                    "Failed to update webhook event status"
                );
                TBankError::DatabaseError(e)
            })?;

        if result.rows_affected() == 0 {
            return Err(TBankError::WebhookEventNotFound {
                event_id: event_id.to_string(),
            });
        }

        debug!(
            event_id = %event_id,
            processing_status = ?processing_status,
            "Webhook event status updated successfully"
        );

        Ok(())
    }

    /// Get webhook events for retry processing (updated for InternalWebhookEvent)
    pub async fn get_failed_webhook_events(
        pool: &PgPool,
        limit: u32,
    ) -> TBankResult<Vec<crate::webhook::events::InternalWebhookEvent>> {
        debug!(limit = limit, "Getting failed webhook events for retry");

        let query = r#"
            SELECT id, event_id, event_type, webhook_type, entity_id, status,
                   payload, processing_status, retry_count, processed_at, created_at
            FROM webhook_events 
            WHERE processing_status = 'Failed' 
              AND retry_count < 5
            ORDER BY created_at ASC
            LIMIT $1
        "#;

        let rows = sqlx::query(query)
            .bind(limit as i64)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    "Failed to get failed webhook events"
                );
                TBankError::DatabaseError(e)
            })?;

        let mut events = Vec::new();
        for row in rows {
            events.push(crate::webhook::events::InternalWebhookEvent::from_row(
                &row,
            )?);
        }

        debug!(
            count = events.len(),
            "Failed webhook events retrieved successfully"
        );
        Ok(events)
    }

    /// Find invoice by T-Bank invoice ID
    pub async fn find_invoice_by_tbank_id(
        pool: &PgPool,
        tbank_invoice_id: &str,
    ) -> TBankResult<Uuid> {
        debug!(tbank_invoice_id = %tbank_invoice_id, "Finding invoice by T-Bank ID");

        let query = "SELECT id FROM b2b_invoices WHERE tbank_invoice_id = $1";

        let row = sqlx::query(query)
            .bind(tbank_invoice_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    tbank_invoice_id = %tbank_invoice_id,
                    "Failed to find invoice by T-Bank ID"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let invoice_id: Uuid = row
                .try_get("id")
                .map_err(|e| TBankError::DatabaseError(e))?;

            debug!(
                tbank_invoice_id = %tbank_invoice_id,
                invoice_id = ?invoice_id,
                "Invoice found by T-Bank ID"
            );

            Ok(invoice_id)
        } else {
            error!(
                tbank_invoice_id = %tbank_invoice_id,
                "Invoice not found by T-Bank ID"
            );
            Err(TBankError::InvoiceNotFound {
                id: Uuid::nil(), // We don't have the UUID, so use nil
            })
        }
    }

    /// Find payment by T-Bank payment ID
    pub async fn find_payment_by_tbank_id(
        pool: &PgPool,
        tbank_payment_id: &str,
    ) -> TBankResult<Uuid> {
        debug!(tbank_payment_id = %tbank_payment_id, "Finding payment by T-Bank ID");

        let query = "SELECT id FROM acquiring_payments WHERE tbank_payment_id = $1";

        let row = sqlx::query(query)
            .bind(tbank_payment_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    tbank_payment_id = %tbank_payment_id,
                    "Failed to find payment by T-Bank ID"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let payment_id: Uuid = row
                .try_get("id")
                .map_err(|e| TBankError::DatabaseError(e))?;

            debug!(
                tbank_payment_id = %tbank_payment_id,
                payment_id = ?payment_id,
                "Payment found by T-Bank ID"
            );

            Ok(payment_id)
        } else {
            error!(
                tbank_payment_id = %tbank_payment_id,
                "Payment not found by T-Bank ID"
            );
            Err(TBankError::PaymentNotFound {
                id: Uuid::nil(), // We don't have the UUID, so use nil
            })
        }
    }

    /// Get webhook processing statistics
    pub async fn get_webhook_processing_stats(
        pool: &PgPool,
    ) -> TBankResult<crate::webhook::WebhookProcessingStats> {
        debug!("Getting webhook processing statistics");

        let query = r#"
            SELECT 
                COUNT(*) as total_events,
                COUNT(CASE WHEN processing_status = 'Pending' THEN 1 END) as pending_events,
                COUNT(CASE WHEN processing_status = 'Processing' THEN 1 END) as processing_events,
                COUNT(CASE WHEN processing_status = 'Completed' THEN 1 END) as completed_events,
                COUNT(CASE WHEN processing_status = 'Failed' THEN 1 END) as failed_events,
                COUNT(CASE WHEN processing_status = 'Skipped' THEN 1 END) as skipped_events,
                COUNT(CASE WHEN webhook_type = 'B2B' THEN 1 END) as b2b_events,
                COUNT(CASE WHEN webhook_type = 'ACQUIRING' THEN 1 END) as acquiring_events,
                COALESCE(AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000), 0) as avg_processing_time_ms
            FROM webhook_events
        "#;

        let row = sqlx::query(query).fetch_one(pool).await.map_err(|e| {
            error!(
                error = %e,
                "Failed to get webhook processing statistics"
            );
            TBankError::DatabaseError(e)
        })?;

        let stats = crate::webhook::WebhookProcessingStats {
            total_events: row.try_get::<i64, _>("total_events").unwrap_or(0) as u64,
            pending_events: row.try_get::<i64, _>("pending_events").unwrap_or(0) as u64,
            processing_events: row.try_get::<i64, _>("processing_events").unwrap_or(0) as u64,
            completed_events: row.try_get::<i64, _>("completed_events").unwrap_or(0) as u64,
            failed_events: row.try_get::<i64, _>("failed_events").unwrap_or(0) as u64,
            skipped_events: row.try_get::<i64, _>("skipped_events").unwrap_or(0) as u64,
            b2b_events: row.try_get::<i64, _>("b2b_events").unwrap_or(0) as u64,
            acquiring_events: row.try_get::<i64, _>("acquiring_events").unwrap_or(0) as u64,
            average_processing_time_ms: row
                .try_get::<f64, _>("avg_processing_time_ms")
                .unwrap_or(0.0),
        };

        debug!(?stats, "Webhook processing statistics retrieved");
        Ok(stats)
    }

    /// Insert counterparty data
    pub async fn insert_counterparty(pool: &PgPool, data: &CounterpartyData) -> TBankResult<()> {
        debug!(inn = %data.inn, "Inserting counterparty into database");

        let query = r#"
            INSERT INTO counterparties (
                id, inn, kpp, full_name, short_name, legal_address, status,
                registration_date, okved_codes, verified_at, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (inn) DO UPDATE SET
                kpp = EXCLUDED.kpp,
                full_name = EXCLUDED.full_name,
                short_name = EXCLUDED.short_name,
                legal_address = EXCLUDED.legal_address,
                status = EXCLUDED.status,
                registration_date = EXCLUDED.registration_date,
                okved_codes = EXCLUDED.okved_codes,
                verified_at = EXCLUDED.verified_at,
                updated_at = EXCLUDED.updated_at
        "#;

        sqlx::query(query)
            .bind(Uuid::new_v4())
            .bind(&data.inn)
            .bind(&data.kpp)
            .bind(&data.full_name)
            .bind(&data.short_name)
            .bind(&data.legal_address)
            .bind(&data.status.to_string())
            .bind(data.registration_date)
            .bind(&data.okved_codes)
            .bind(data.verified_at)
            .bind(data.created_at)
            .bind(data.updated_at)
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    inn = %data.inn,
                    "Failed to insert counterparty"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(inn = %data.inn, "Counterparty inserted successfully");
        Ok(())
    }

    /// Get counterparty by INN
    pub async fn get_counterparty_by_inn(
        pool: &PgPool,
        inn: &str,
    ) -> TBankResult<Option<CounterpartyData>> {
        debug!(inn = %inn, "Getting counterparty by INN");

        let query = r#"
            SELECT id, inn, kpp, full_name, short_name, legal_address, status,
                   registration_date, okved_codes, verified_at, created_at, updated_at
            FROM counterparties 
            WHERE inn = $1
        "#;

        let row = sqlx::query(query)
            .bind(inn)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    inn = %inn,
                    "Failed to get counterparty by INN"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let counterparty = CounterpartyData::from_row(&row)?;
            debug!(
                inn = %inn,
                full_name = %counterparty.full_name,
                "Counterparty found"
            );
            Ok(Some(counterparty))
        } else {
            debug!(inn = %inn, "Counterparty not found");
            Ok(None)
        }
    }

    /// Check if counterparty exists by INN
    pub async fn counterparty_exists(pool: &PgPool, inn: &str) -> TBankResult<bool> {
        debug!(inn = %inn, "Checking if counterparty exists");

        let query = "SELECT EXISTS(SELECT 1 FROM counterparties WHERE inn = $1)";

        let exists: (bool,) = sqlx::query_as(query)
            .bind(inn)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    inn = %inn,
                    "Failed to check counterparty existence"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            inn = %inn,
            exists = exists.0,
            "Counterparty existence check completed"
        );

        Ok(exists.0)
    }

    /// List counterparties with filtering
    pub async fn list_counterparties(
        pool: &PgPool,
        status: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> TBankResult<Vec<CounterpartyData>> {
        debug!(
            status = ?status,
            limit = ?limit,
            offset = ?offset,
            "Listing counterparties"
        );

        let mut query = String::from(
            r#"
            SELECT id, inn, kpp, full_name, short_name, legal_address, status,
                   registration_date, okved_codes, verified_at, created_at, updated_at
            FROM counterparties 
            WHERE 1=1
        "#,
        );

        let mut bind_count = 0;

        if status.is_some() {
            bind_count += 1;
            query.push_str(&format!(" AND status = ${}", bind_count));
        }

        query.push_str(" ORDER BY created_at DESC");

        if let Some(limit) = limit {
            bind_count += 1;
            query.push_str(&format!(" LIMIT ${}", bind_count));
        }

        if let Some(offset) = offset {
            bind_count += 1;
            query.push_str(&format!(" OFFSET ${}", bind_count));
        }

        let mut sql_query = sqlx::query(&query);

        if let Some(s) = status {
            sql_query = sql_query.bind(s);
        }

        if let Some(l) = limit {
            sql_query = sql_query.bind(l as i64);
        }

        if let Some(o) = offset {
            sql_query = sql_query.bind(o as i64);
        }

        let rows = sql_query.fetch_all(pool).await.map_err(|e| {
            error!(
                error = %e,
                "Failed to list counterparties"
            );
            TBankError::DatabaseError(e)
        })?;

        let mut counterparties = Vec::new();
        for row in rows {
            counterparties.push(CounterpartyData::from_row(&row)?);
        }

        debug!(
            count = counterparties.len(),
            "Counterparties listed successfully"
        );
        Ok(counterparties)
    }
}
