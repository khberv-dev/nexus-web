use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, error};
use uuid::Uuid;

use crate::types::b2b::invoice::{
    B2BInvoice as Invoice, B2BInvoiceStatus as InvoiceStatus, CreateInvoiceContactRequest,
    CreateInvoiceItemRequest,
};
use crate::types::{TBankError, TBankResult};

/// Database queries for B2B invoices
pub struct B2BQueries;

impl B2BQueries {
    /// Insert new B2B invoice with items and contacts in a transaction
    pub async fn insert_invoice_with_items_and_contacts(
        pool: &PgPool,
        invoice: &Invoice,
        items: &[CreateInvoiceItemRequest],
        contacts: &[CreateInvoiceContactRequest],
    ) -> TBankResult<()> {
        debug!(
            invoice_id = ?invoice.id,
            invoice_number = %invoice.invoice_number,
            items_count = items.len(),
            contacts_count = contacts.len(),
            "Inserting B2B invoice with items and contacts"
        );

        // Start transaction
        let mut tx = pool.begin().await.map_err(|e| {
            error!(error = %e, "Failed to start transaction for B2B invoice insertion");
            TBankError::DatabaseError(e)
        })?;

        // Insert main invoice record
        let invoice_query = r#"
            INSERT INTO b2b_invoices (
                id, invoice_number, tbank_invoice_id, counterparty_inn, counterparty_kpp,
                counterparty_name, due_date, invoice_date, account_number, total_amount,
                status, pdf_url, incoming_invoice_url, comment, custom_payment_purpose,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        "#;

        sqlx::query(invoice_query)
            .bind(invoice.id)
            .bind(&invoice.invoice_number)
            .bind(&invoice.tbank_invoice_id)
            .bind(&invoice.counterparty_inn)
            .bind(&invoice.counterparty_kpp)
            .bind(&invoice.counterparty_name)
            .bind(invoice.due_date)
            .bind(invoice.invoice_date)
            .bind(&invoice.account_number)
            .bind(invoice.total_amount)
            .bind(invoice.status.to_string())
            .bind(&invoice.pdf_url)
            .bind(&invoice.incoming_invoice_url)
            .bind(&invoice.comment)
            .bind(&invoice.custom_payment_purpose)
            .bind(invoice.created_at)
            .bind(invoice.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice.id,
                    "Failed to insert B2B invoice"
                );
                TBankError::DatabaseError(e)
            })?;

        // Insert invoice items
        if !items.is_empty() {
            let items_query = r#"
                INSERT INTO b2b_invoice_items (
                    id, invoice_id, name, price, unit, vat_rate, amount, total_price, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#;

            for item in items {
                let item_id = Uuid::new_v4();
                let total_price = item.price * rust_decimal::Decimal::from(item.amount);
                let created_at = Utc::now();

                sqlx::query(items_query)
                    .bind(item_id)
                    .bind(invoice.id)
                    .bind(&item.name)
                    .bind(item.price)
                    .bind(&item.unit)
                    .bind(&item.vat_rate)
                    .bind(item.amount)
                    .bind(total_price)
                    .bind(created_at)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| {
                        error!(
                            error = %e,
                            item_id = ?item_id,
                            invoice_id = ?invoice.id,
                            "Failed to insert B2B invoice item"
                        );
                        TBankError::DatabaseError(e)
                    })?;
            }
        }

        // Insert invoice contacts
        if !contacts.is_empty() {
            let contacts_query = r#"
                INSERT INTO b2b_invoice_contacts (
                    id, invoice_id, email, created_at
                ) VALUES ($1, $2, $3, $4)
            "#;

            for contact in contacts {
                if contact.email.is_some() {
                    let contact_id = Uuid::new_v4();
                    let created_at = Utc::now();

                    sqlx::query(contacts_query)
                        .bind(contact_id)
                        .bind(invoice.id)
                        .bind(&contact.email)
                        .bind(created_at)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| {
                            error!(
                                error = %e,
                                contact_id = ?contact_id,
                                invoice_id = ?invoice.id,
                                "Failed to insert B2B invoice contact"
                            );
                            TBankError::DatabaseError(e)
                        })?;
                }
            }
        }

        // Commit transaction
        tx.commit().await.map_err(|e| {
            error!(
                error = %e,
                invoice_id = ?invoice.id,
                "Failed to commit B2B invoice transaction"
            );
            TBankError::DatabaseError(e)
        })?;

        debug!(
            invoice_id = ?invoice.id,
            invoice_number = %invoice.invoice_number,
            items_count = items.len(),
            contacts_count = contacts.len(),
            "B2B invoice with items and contacts inserted successfully"
        );

        Ok(())
    }

    /// Insert new B2B invoice (legacy method for backward compatibility)
    pub async fn insert_invoice(pool: &PgPool, invoice: &Invoice) -> TBankResult<()> {
        Self::insert_invoice_with_items_and_contacts(pool, invoice, &[], &[]).await
    }

    /// Get B2B invoice by ID
    pub async fn get_invoice_by_id(
        pool: &PgPool,
        invoice_id: Uuid,
    ) -> TBankResult<Option<Invoice>> {
        debug!(invoice_id = ?invoice_id, "Getting B2B invoice by ID");

        let query = r#"
            SELECT id, invoice_number, counterparty_inn, amount, currency,
                   description, due_date, status, payment_url, tbank_invoice_id,
                   created_at, updated_at
            FROM b2b_invoices 
            WHERE id = $1
        "#;

        let row = sqlx::query(query)
            .bind(invoice_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    "Failed to get B2B invoice by ID"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let invoice = Invoice::from_row(&row)?;
            debug!(
                invoice_id = ?invoice_id,
                invoice_number = %invoice.invoice_number,
                "B2B invoice found"
            );
            Ok(Some(invoice))
        } else {
            debug!(invoice_id = ?invoice_id, "B2B invoice not found");
            Ok(None)
        }
    }

    /// Update B2B invoice status
    pub async fn update_invoice_status(
        pool: &PgPool,
        invoice_id: Uuid,
        status: InvoiceStatus,
    ) -> TBankResult<()> {
        debug!(
            invoice_id = ?invoice_id,
            status = ?status,
            "Updating B2B invoice status"
        );

        let query = r#"
            UPDATE b2b_invoices 
            SET status = $1, updated_at = $2
            WHERE id = $3
        "#;

        let result = sqlx::query(query)
            .bind(status.to_string())
            .bind(Utc::now())
            .bind(invoice_id)
            .execute(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    "Failed to update B2B invoice status"
                );
                TBankError::DatabaseError(e)
            })?;

        if result.rows_affected() == 0 {
            return Err(TBankError::InvoiceNotFound { id: invoice_id });
        }

        debug!(
            invoice_id = ?invoice_id,
            status = ?status,
            "B2B invoice status updated successfully"
        );

        Ok(())
    }

    /// List B2B invoices with filtering
    pub async fn list_invoices(
        pool: &PgPool,
        counterparty_inn: Option<&str>,
        status: Option<InvoiceStatus>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> TBankResult<Vec<Invoice>> {
        debug!(
            counterparty_inn = ?counterparty_inn,
            status = ?status,
            limit = ?limit,
            offset = ?offset,
            "Listing B2B invoices"
        );

        let mut query = String::from(
            r#"
            SELECT id, invoice_number, counterparty_inn, amount, currency,
                   description, due_date, status, payment_url, tbank_invoice_id,
                   created_at, updated_at
            FROM b2b_invoices 
            WHERE 1=1
        "#,
        );

        let mut bind_count = 0;

        if counterparty_inn.is_some() {
            bind_count += 1;
            query.push_str(&format!(" AND counterparty_inn = ${}", bind_count));
        }

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

        if let Some(inn) = counterparty_inn {
            sql_query = sql_query.bind(inn);
        }

        if let Some(s) = status {
            sql_query = sql_query.bind(format!("{:?}", s));
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
                "Failed to list B2B invoices"
            );
            TBankError::DatabaseError(e)
        })?;

        let mut invoices = Vec::new();
        for row in rows {
            invoices.push(Invoice::from_row(&row)?);
        }

        debug!(count = invoices.len(), "B2B invoices listed successfully");
        Ok(invoices)
    }

    /// Check if B2B invoice number exists
    pub async fn invoice_number_exists(pool: &PgPool, invoice_number: &str) -> TBankResult<bool> {
        debug!(invoice_number = %invoice_number, "Checking if B2B invoice number exists");

        let query = "SELECT EXISTS(SELECT 1 FROM b2b_invoices WHERE invoice_number = $1)";

        let exists: (bool,) = sqlx::query_as(query)
            .bind(invoice_number)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_number = %invoice_number,
                    "Failed to check B2B invoice number existence"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            invoice_number = %invoice_number,
            exists = exists.0,
            "B2B invoice number existence check completed"
        );

        Ok(exists.0)
    }
}

// Convenience functions for billing integration
pub async fn create_b2b_invoice(pool: &PgPool, invoice: &Invoice) -> TBankResult<Invoice> {
    B2BQueries::insert_invoice(pool, invoice).await?;
    Ok(invoice.clone())
}

pub async fn update_b2b_invoice_tbank_data(
    pool: &PgPool,
    invoice_id: Uuid,
    tbank_invoice_id: Option<&str>,
    pdf_url: Option<&str>,
    payment_url: Option<&str>,
    status: InvoiceStatus,
) -> TBankResult<()> {
    debug!(
        invoice_id = ?invoice_id,
        tbank_invoice_id = ?tbank_invoice_id,
        status = ?status,
        "Updating B2B invoice with T-Bank data"
    );

    let query = r#"
        UPDATE b2b_invoices 
        SET tbank_invoice_id = $1, pdf_url = $2, incoming_invoice_url = $3, 
            status = $4, updated_at = $5
        WHERE id = $6
    "#;

    let result = sqlx::query(query)
        .bind(tbank_invoice_id)
        .bind(pdf_url)
        .bind(payment_url)
        .bind(status.to_string())
        .bind(Utc::now())
        .bind(invoice_id)
        .execute(pool)
        .await
        .map_err(|e| {
            error!(
                error = %e,
                invoice_id = ?invoice_id,
                "Failed to update B2B invoice with T-Bank data"
            );
            TBankError::DatabaseError(e)
        })?;

    if result.rows_affected() == 0 {
        return Err(TBankError::InvoiceNotFound { id: invoice_id });
    }

    debug!(
        invoice_id = ?invoice_id,
        "B2B invoice updated with T-Bank data successfully"
    );

    Ok(())
}
