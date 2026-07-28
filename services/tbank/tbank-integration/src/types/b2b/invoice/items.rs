use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::str::FromStr;
use uuid::Uuid;

use crate::types::{TBankError, TBankResult};

/// Invoice item for B2B invoices (up to 100 items per invoice)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvoiceItem {
    pub id: Option<Uuid>,
    pub invoice_id: Uuid,
    pub name: String,
    pub price: Decimal,
    pub unit: String,
    pub vat_rate: String,
    pub amount: i32,
    pub total_price: Decimal,
    pub created_at: Option<DateTime<Utc>>,
}

/// Type alias for backward compatibility
pub type B2BInvoiceItem = InvoiceItem;

impl InvoiceItem {
    /// Create a new invoice item
    pub fn new(
        invoice_id: Uuid,
        name: String,
        price: Decimal,
        unit: String,
        vat_rate: String,
        amount: i32,
    ) -> Self {
        let total_price = price * Decimal::from(amount);
        Self {
            id: None,
            invoice_id,
            name,
            price,
            unit,
            vat_rate,
            amount,
            total_price,
            created_at: Some(Utc::now()),
        }
    }

    /// Validate invoice item
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Item name is required".to_string());
        }

        if self.price <= Decimal::ZERO {
            return Err("Item price must be positive".to_string());
        }

        if self.amount <= 0 {
            return Err("Item amount must be positive".to_string());
        }

        if self.unit.trim().is_empty() {
            return Err("Item unit is required".to_string());
        }

        if self.vat_rate.trim().is_empty() {
            return Err("VAT rate is required".to_string());
        }

        // Validate that total_price matches price * amount
        let expected_total = self.price * Decimal::from(self.amount);
        if (self.total_price - expected_total).abs() > Decimal::from_str("0.01").unwrap() {
            return Err("Total price doesn't match price * amount".to_string());
        }

        Ok(())
    }

    /// Create InvoiceItem from database row
    pub fn from_row(row: &sqlx::postgres::PgRow) -> TBankResult<Self> {
        Ok(InvoiceItem {
            id: row
                .try_get("id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            invoice_id: row
                .try_get("invoice_id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            name: row
                .try_get("name")
                .map_err(|e| TBankError::DatabaseError(e))?,
            price: row
                .try_get("price")
                .map_err(|e| TBankError::DatabaseError(e))?,
            unit: row
                .try_get("unit")
                .map_err(|e| TBankError::DatabaseError(e))?,
            vat_rate: row
                .try_get("vat_rate")
                .map_err(|e| TBankError::DatabaseError(e))?,
            amount: row
                .try_get("amount")
                .map_err(|e| TBankError::DatabaseError(e))?,
            total_price: row
                .try_get("total_price")
                .map_err(|e| TBankError::DatabaseError(e))?,
            created_at: row
                .try_get("created_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invoice_item_creation() {
        let invoice_id = Uuid::new_v4();
        let item = InvoiceItem::new(
            invoice_id,
            "Test Item".to_string(),
            Decimal::from(100),
            "шт".to_string(),
            "20%".to_string(),
            5,
        );

        assert_eq!(item.total_price, Decimal::from(500));
        assert!(item.validate().is_ok());
    }

    #[test]
    fn test_invoice_item_validation() {
        let invoice_id = Uuid::new_v4();

        // Test empty name
        let mut item = InvoiceItem::new(
            invoice_id,
            "".to_string(),
            Decimal::from(100),
            "шт".to_string(),
            "20%".to_string(),
            5,
        );
        assert!(item.validate().is_err());

        // Test negative price
        item.name = "Test Item".to_string();
        item.price = Decimal::from(-100);
        assert!(item.validate().is_err());

        // Test zero amount
        item.price = Decimal::from(100);
        item.amount = 0;
        assert!(item.validate().is_err());

        // Test valid item
        item.amount = 5;
        item.total_price = item.price * Decimal::from(item.amount);
        assert!(item.validate().is_ok());
    }
}
