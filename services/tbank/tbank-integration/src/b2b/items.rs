use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::types::b2b::invoice::{B2BInvoiceItem, CreateB2BInvoiceItemRequest};
use crate::types::{TBankError, TBankResult};

/// Service for managing B2B invoice items (up to 100 items per invoice)
pub struct B2BInvoiceItemService {
    db_pool: Arc<PgPool>,
}

impl B2BInvoiceItemService {
    /// Create new B2B invoice item service
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        info!("Initializing B2BInvoiceItemService");
        Self { db_pool }
    }

    /// Add item to B2B invoice
    pub async fn add_item_to_invoice(
        &self,
        invoice_id: Uuid,
        item_request: CreateB2BInvoiceItemRequest,
    ) -> TBankResult<B2BInvoiceItem> {
        info!(
            invoice_id = ?invoice_id,
            item_name = %item_request.name,
            price = %item_request.price,
            amount = item_request.amount,
            "Adding item to B2B invoice"
        );

        // Validate item request
        self.validate_item_request(&item_request)?;

        // Check if invoice exists and get current item count
        let current_item_count = self.get_invoice_item_count(invoice_id).await?;

        if current_item_count >= 100 {
            return Err(TBankError::ValidationError(
                "Invoice cannot have more than 100 items".to_string(),
            ));
        }

        // Calculate total price
        let total_price = item_request.price * rust_decimal::Decimal::from(item_request.amount);

        // Create invoice item
        let item = B2BInvoiceItem {
            id: Some(Uuid::new_v4()),
            invoice_id,
            name: item_request.name,
            price: item_request.price,
            unit: item_request.unit,
            vat_rate: item_request.vat_rate,
            amount: item_request.amount,
            total_price,
            created_at: Some(Utc::now()),
        };

        // Store in database
        self.insert_item(&item).await?;

        info!(
            item_id = ?item.id,
            invoice_id = ?invoice_id,
            total_price = %total_price,
            "B2B invoice item added successfully"
        );

        Ok(item)
    }

    /// Get all items for an invoice
    pub async fn get_invoice_items(&self, invoice_id: Uuid) -> TBankResult<Vec<B2BInvoiceItem>> {
        debug!(invoice_id = ?invoice_id, "Getting items for B2B invoice");

        let query = r#"
            SELECT id, invoice_id, name, price, unit, vat_rate, amount, total_price, created_at
            FROM b2b_invoice_items 
            WHERE invoice_id = $1
            ORDER BY created_at ASC
        "#;

        let rows = sqlx::query(query)
            .bind(invoice_id)
            .fetch_all(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    "Failed to get B2B invoice items"
                );
                TBankError::DatabaseError(e)
            })?;

        let mut items = Vec::new();
        for row in rows {
            items.push(B2BInvoiceItem::from_row(&row)?);
        }

        debug!(
            invoice_id = ?invoice_id,
            item_count = items.len(),
            "B2B invoice items retrieved successfully"
        );

        Ok(items)
    }

    /// Update invoice item
    pub async fn update_item(
        &self,
        item_id: Uuid,
        update_request: CreateB2BInvoiceItemRequest,
    ) -> TBankResult<B2BInvoiceItem> {
        info!(
            item_id = ?item_id,
            item_name = %update_request.name,
            "Updating B2B invoice item"
        );

        // Validate item request
        self.validate_item_request(&update_request)?;

        // Calculate total price
        let total_price = update_request.price * rust_decimal::Decimal::from(update_request.amount);

        // Update in database
        let query = r#"
            UPDATE b2b_invoice_items 
            SET name = $1, price = $2, unit = $3, vat_rate = $4, amount = $5, total_price = $6
            WHERE id = $7
            RETURNING id, invoice_id, name, price, unit, vat_rate, amount, total_price, created_at
        "#;

        let row = sqlx::query(query)
            .bind(&update_request.name)
            .bind(update_request.price)
            .bind(&update_request.unit)
            .bind(&update_request.vat_rate)
            .bind(update_request.amount)
            .bind(total_price)
            .bind(item_id)
            .fetch_optional(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    item_id = ?item_id,
                    "Failed to update B2B invoice item"
                );
                TBankError::DatabaseError(e)
            })?;

        let row = row.ok_or_else(|| TBankError::InvoiceItemNotFound { id: item_id })?;
        let updated_item = B2BInvoiceItem::from_row(&row)?;

        info!(
            item_id = ?item_id,
            total_price = %total_price,
            "B2B invoice item updated successfully"
        );

        Ok(updated_item)
    }

    /// Remove item from invoice
    pub async fn remove_item(&self, item_id: Uuid) -> TBankResult<()> {
        info!(item_id = ?item_id, "Removing B2B invoice item");

        let query = "DELETE FROM b2b_invoice_items WHERE id = $1";

        let result = sqlx::query(query)
            .bind(item_id)
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    item_id = ?item_id,
                    "Failed to remove B2B invoice item"
                );
                TBankError::DatabaseError(e)
            })?;

        if result.rows_affected() == 0 {
            return Err(TBankError::InvoiceItemNotFound { id: item_id });
        }

        info!(item_id = ?item_id, "B2B invoice item removed successfully");
        Ok(())
    }

    /// Get total amount for all items in an invoice
    pub async fn get_invoice_total_amount(
        &self,
        invoice_id: Uuid,
    ) -> TBankResult<rust_decimal::Decimal> {
        debug!(invoice_id = ?invoice_id, "Calculating total amount for B2B invoice items");

        let query = r#"
            SELECT COALESCE(SUM(total_price), 0) as total_amount
            FROM b2b_invoice_items 
            WHERE invoice_id = $1
        "#;

        let row = sqlx::query(query)
            .bind(invoice_id)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    "Failed to calculate B2B invoice total amount"
                );
                TBankError::DatabaseError(e)
            })?;

        let total_amount: rust_decimal::Decimal = row.get("total_amount");

        debug!(
            invoice_id = ?invoice_id,
            total_amount = %total_amount,
            "B2B invoice total amount calculated"
        );

        Ok(total_amount)
    }

    /// Validate item request
    fn validate_item_request(&self, request: &CreateB2BInvoiceItemRequest) -> TBankResult<()> {
        debug!("Validating B2B invoice item request");

        // Validate name
        if request.name.trim().is_empty() {
            return Err(TBankError::ValidationError(
                "Item name cannot be empty".to_string(),
            ));
        }

        if request.name.len() > 255 {
            return Err(TBankError::ValidationError(
                "Item name cannot exceed 255 characters".to_string(),
            ));
        }

        // Validate price
        if request.price.is_sign_negative() || request.price.is_zero() {
            return Err(TBankError::ValidationError(
                "Item price must be positive".to_string(),
            ));
        }

        // Validate amount
        if request.amount <= 0 {
            return Err(TBankError::ValidationError(
                "Item amount must be positive".to_string(),
            ));
        }

        // Validate unit
        if request.unit.trim().is_empty() {
            return Err(TBankError::ValidationError(
                "Item unit cannot be empty".to_string(),
            ));
        }

        if request.unit.len() > 50 {
            return Err(TBankError::ValidationError(
                "Item unit cannot exceed 50 characters".to_string(),
            ));
        }

        // Validate VAT rate
        let valid_vat_rates = ["0%", "10%", "20%", "НДС не облагается"];
        if !valid_vat_rates.contains(&request.vat_rate.as_str()) {
            return Err(TBankError::ValidationError(
                "VAT rate must be one of: 0%, 10%, 20%, НДС не облагается".to_string(),
            ));
        }

        debug!("B2B invoice item request validation passed");
        Ok(())
    }

    /// Get current item count for an invoice
    async fn get_invoice_item_count(&self, invoice_id: Uuid) -> TBankResult<u32> {
        debug!(invoice_id = ?invoice_id, "Getting item count for B2B invoice");

        let query = "SELECT COUNT(*) as item_count FROM b2b_invoice_items WHERE invoice_id = $1";

        let row = sqlx::query(query)
            .bind(invoice_id)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    "Failed to get B2B invoice item count"
                );
                TBankError::DatabaseError(e)
            })?;

        let count: i64 = row.get("item_count");

        debug!(
            invoice_id = ?invoice_id,
            item_count = count,
            "B2B invoice item count retrieved"
        );

        Ok(count as u32)
    }

    /// Insert item into database
    async fn insert_item(&self, item: &B2BInvoiceItem) -> TBankResult<()> {
        debug!(
            item_id = ?item.id,
            invoice_id = ?item.invoice_id,
            "Inserting B2B invoice item into database"
        );

        let query = r#"
            INSERT INTO b2b_invoice_items (
                id, invoice_id, name, price, unit, vat_rate, amount, total_price, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#;

        sqlx::query(query)
            .bind(item.id)
            .bind(item.invoice_id)
            .bind(&item.name)
            .bind(item.price)
            .bind(&item.unit)
            .bind(&item.vat_rate)
            .bind(item.amount)
            .bind(item.total_price)
            .bind(item.created_at)
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    item_id = ?item.id,
                    "Failed to insert B2B invoice item"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            item_id = ?item.id,
            "B2B invoice item inserted successfully"
        );

        Ok(())
    }
}
