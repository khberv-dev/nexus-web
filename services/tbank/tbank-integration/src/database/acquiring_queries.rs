use chrono::{DateTime, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, error};
use uuid::Uuid;

use crate::types::acquiring::methods::AcquiringPaymentMethod;
use crate::types::acquiring::payment::{AcquiringPayment, AcquiringPaymentStatus};
use crate::types::{TBankError, TBankResult};

/// Database queries for acquiring payments
pub struct AcquiringQueries;

impl AcquiringQueries {
    /// Insert new acquiring payment
    pub async fn insert_payment(pool: &PgPool, payment: &AcquiringPayment) -> TBankResult<()> {
        debug!(
            payment_id = ?payment.id,
            order_id = %payment.order_id,
            "Inserting acquiring payment into database"
        );

        let query = r#"
            INSERT INTO acquiring_payments (
                id, order_id, tbank_payment_id, amount, currency, payment_method,
                status, description, customer_email, customer_phone, payment_url,
                qr_code, expires_at, commission_amount, completed_at,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        "#;

        sqlx::query(query)
            .bind(payment.id)
            .bind(&payment.order_id)
            .bind(&payment.tbank_payment_id)
            .bind(payment.amount)
            .bind(payment.currency.to_string())
            .bind(payment.payment_method.to_string())
            .bind(payment.status.to_string())
            .bind(&payment.description)
            .bind(&payment.customer_email)
            .bind(&payment.customer_phone)
            .bind(&payment.payment_url)
            .bind(&payment.qr_code)
            .bind(payment.expires_at)
            .bind(payment.commission_amount)
            .bind(payment.completed_at)
            .bind(payment.created_at)
            .bind(payment.updated_at)
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    payment_id = ?payment.id,
                    "Failed to insert acquiring payment"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            payment_id = ?payment.id,
            "Acquiring payment inserted successfully"
        );

        Ok(())
    }

    /// Get acquiring payment by ID
    pub async fn get_payment_by_id(
        pool: &PgPool,
        payment_id: Uuid,
    ) -> TBankResult<Option<AcquiringPayment>> {
        debug!(payment_id = ?payment_id, "Getting acquiring payment by ID");

        let query = r#"
            SELECT id, order_id, tbank_payment_id, amount, currency, payment_method,
                   status, description, customer_email, customer_phone, payment_url,
                   qr_code, expires_at, commission_amount, completed_at,
                   created_at, updated_at
            FROM acquiring_payments 
            WHERE id = $1
        "#;

        let row = sqlx::query(query)
            .bind(payment_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    payment_id = ?payment_id,
                    "Failed to get acquiring payment by ID"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let payment = AcquiringPayment::from_row(&row)?;
            debug!(
                payment_id = ?payment_id,
                order_id = %payment.order_id,
                "Acquiring payment found"
            );
            Ok(Some(payment))
        } else {
            debug!(payment_id = ?payment_id, "Acquiring payment not found");
            Ok(None)
        }
    }

    /// Get acquiring payment by order ID
    pub async fn get_payment_by_order_id(
        pool: &PgPool,
        order_id: &str,
    ) -> TBankResult<Option<AcquiringPayment>> {
        debug!(order_id = %order_id, "Getting acquiring payment by order ID");

        let query = r#"
            SELECT id, order_id, tbank_payment_id, amount, currency, payment_method,
                   status, description, customer_email, customer_phone, payment_url,
                   qr_code, expires_at, commission_amount, completed_at,
                   created_at, updated_at
            FROM acquiring_payments 
            WHERE order_id = $1
        "#;

        let row = sqlx::query(query)
            .bind(order_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    order_id = %order_id,
                    "Failed to get acquiring payment by order ID"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let payment = AcquiringPayment::from_row(&row)?;
            debug!(
                order_id = %order_id,
                payment_id = ?payment.id,
                "Acquiring payment found"
            );
            Ok(Some(payment))
        } else {
            debug!(order_id = %order_id, "Acquiring payment not found");
            Ok(None)
        }
    }

    /// Update acquiring payment status
    pub async fn update_payment_status(
        pool: &PgPool,
        payment_id: Uuid,
        status: AcquiringPaymentStatus,
        commission_amount: Option<rust_decimal::Decimal>,
        completed_at: Option<DateTime<Utc>>,
    ) -> TBankResult<()> {
        debug!(
            payment_id = ?payment_id,
            status = ?status,
            "Updating acquiring payment status"
        );

        let query = r#"
            UPDATE acquiring_payments 
            SET status = $1, commission_amount = $2, completed_at = $3, updated_at = $4
            WHERE id = $5
        "#;

        let result = sqlx::query(query)
            .bind(status.to_string())
            .bind(commission_amount)
            .bind(completed_at)
            .bind(Utc::now())
            .bind(payment_id)
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    payment_id = ?payment_id,
                    "Failed to update acquiring payment status"
                );
                TBankError::DatabaseError(e)
            })?;

        if result.rows_affected() == 0 {
            return Err(TBankError::PaymentNotFound { id: payment_id });
        }

        debug!(
            payment_id = ?payment_id,
            status = ?status,
            "Acquiring payment status updated successfully"
        );

        Ok(())
    }

    /// List acquiring payments with filtering
    pub async fn list_payments(
        pool: &PgPool,
        status: Option<AcquiringPaymentStatus>,
        payment_method: Option<AcquiringPaymentMethod>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> TBankResult<Vec<AcquiringPayment>> {
        debug!(
            status = ?status,
            payment_method = ?payment_method,
            limit = ?limit,
            offset = ?offset,
            "Listing acquiring payments"
        );

        let mut query = String::from(
            r#"
            SELECT id, order_id, tbank_payment_id, amount, currency, payment_method,
                   status, description, customer_email, customer_phone, payment_url,
                   qr_code, expires_at, commission_amount, completed_at,
                   created_at, updated_at
            FROM acquiring_payments 
            WHERE 1=1
        "#,
        );

        let mut bind_count = 0;

        if status.is_some() {
            bind_count += 1;
            query.push_str(&format!(" AND status = ${}", bind_count));
        }

        if payment_method.is_some() {
            bind_count += 1;
            query.push_str(&format!(" AND payment_method = ${}", bind_count));
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
            sql_query = sql_query.bind(format!("{:?}", s));
        }

        if let Some(pm) = payment_method {
            sql_query = sql_query.bind(format!("{:?}", pm));
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
                "Failed to list acquiring payments"
            );
            TBankError::DatabaseError(e)
        })?;

        let mut payments = Vec::new();
        for row in rows {
            payments.push(AcquiringPayment::from_row(&row)?);
        }

        debug!(
            count = payments.len(),
            "Acquiring payments listed successfully"
        );
        Ok(payments)
    }

    /// Check if order ID exists
    pub async fn order_id_exists(pool: &PgPool, order_id: &str) -> TBankResult<bool> {
        debug!(order_id = %order_id, "Checking if order ID exists");

        let query = "SELECT EXISTS(SELECT 1 FROM acquiring_payments WHERE order_id = $1)";

        let exists: (bool,) = sqlx::query_as(query)
            .bind(order_id)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    order_id = %order_id,
                    "Failed to check order ID existence"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            order_id = %order_id,
            exists = exists.0,
            "Order ID existence check completed"
        );

        Ok(exists.0)
    }
}
