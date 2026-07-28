use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// B2B invoice item for legal entities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct B2BInvoiceItem {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub name: String,
    pub price: Decimal,
    pub unit: String,
    pub vat_rate: String,
    pub amount: i32,
    pub total_price: Decimal,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new B2B invoice item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceItemRequest {
    pub name: String,
    pub price: Decimal,
    pub unit: String,
    pub vat_rate: String,
    pub amount: i32,
}

impl CreateInvoiceItemRequest {
    /// Validate the invoice item request
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Item name cannot be empty".to_string());
        }

        if self.name.len() > 255 {
            return Err("Item name cannot exceed 255 characters".to_string());
        }

        if self.price <= Decimal::ZERO {
            return Err("Item price must be positive".to_string());
        }

        if self.unit.trim().is_empty() {
            return Err("Item unit cannot be empty".to_string());
        }

        if self.unit.len() > 50 {
            return Err("Item unit cannot exceed 50 characters".to_string());
        }

        if self.amount <= 0 {
            return Err("Item amount must be positive".to_string());
        }

        // Validate VAT rate format (e.g., "20%", "10%", "0%", "НДС не облагается")
        if !self.is_valid_vat_rate(&self.vat_rate) {
            return Err("Invalid VAT rate format".to_string());
        }

        Ok(())
    }

    /// Calculate total price for the item
    pub fn calculate_total_price(&self) -> Decimal {
        self.price * Decimal::from(self.amount)
    }

    /// Check if VAT rate is valid
    fn is_valid_vat_rate(&self, vat_rate: &str) -> bool {
        match vat_rate {
            "0%" | "10%" | "20%" | "НДС не облагается" => true,
            _ => false,
        }
    }
}

impl From<CreateInvoiceItemRequest> for B2BInvoiceItem {
    fn from(request: CreateInvoiceItemRequest) -> Self {
        let total_price = request.calculate_total_price();

        Self {
            id: Uuid::new_v4(),
            invoice_id: Uuid::new_v4(), // Will be set when adding to invoice
            name: request.name,
            price: request.price,
            unit: request.unit,
            vat_rate: request.vat_rate,
            amount: request.amount,
            total_price,
            created_at: Utc::now(),
        }
    }
}

impl B2BInvoiceItem {
    /// Create new B2B invoice item
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
            id: Uuid::new_v4(),
            invoice_id,
            name,
            price,
            unit,
            vat_rate,
            amount,
            total_price,
            created_at: Utc::now(),
        }
    }

    /// Update item amount and recalculate total price
    pub fn update_amount(&mut self, new_amount: i32) -> Result<(), String> {
        if new_amount <= 0 {
            return Err("Amount must be positive".to_string());
        }

        self.amount = new_amount;
        self.total_price = self.price * Decimal::from(new_amount);
        Ok(())
    }

    /// Update item price and recalculate total price
    pub fn update_price(&mut self, new_price: Decimal) -> Result<(), String> {
        if new_price <= Decimal::ZERO {
            return Err("Price must be positive".to_string());
        }

        self.price = new_price;
        self.total_price = new_price * Decimal::from(self.amount);
        Ok(())
    }

    /// Get VAT amount for this item
    pub fn get_vat_amount(&self) -> Decimal {
        match self.vat_rate.as_str() {
            "20%" => self.total_price * Decimal::from_str_exact("0.2").unwrap(),
            "10%" => self.total_price * Decimal::from_str_exact("0.1").unwrap(),
            "0%" | "НДС не облагается" => Decimal::ZERO,
            _ => Decimal::ZERO,
        }
    }

    /// Get total price including VAT
    pub fn get_total_with_vat(&self) -> Decimal {
        self.total_price + self.get_vat_amount()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_invoice_item_request_validation() {
        let valid_request = CreateInvoiceItemRequest {
            name: "Test Item".to_string(),
            price: Decimal::from(100),
            unit: "шт".to_string(),
            vat_rate: "20%".to_string(),
            amount: 5,
        };

        assert!(valid_request.validate().is_ok());

        // Test empty name
        let invalid_request = CreateInvoiceItemRequest {
            name: "".to_string(),
            ..valid_request.clone()
        };
        assert!(invalid_request.validate().is_err());

        // Test negative price
        let invalid_request = CreateInvoiceItemRequest {
            price: Decimal::from(-100),
            ..valid_request.clone()
        };
        assert!(invalid_request.validate().is_err());

        // Test zero amount
        let invalid_request = CreateInvoiceItemRequest {
            amount: 0,
            ..valid_request.clone()
        };
        assert!(invalid_request.validate().is_err());
    }

    #[test]
    fn test_calculate_total_price() {
        let request = CreateInvoiceItemRequest {
            name: "Test Item".to_string(),
            price: Decimal::from(100),
            unit: "шт".to_string(),
            vat_rate: "20%".to_string(),
            amount: 5,
        };

        assert_eq!(request.calculate_total_price(), Decimal::from(500));
    }

    #[test]
    fn test_vat_calculations() {
        let item = B2BInvoiceItem::new(
            Uuid::new_v4(),
            "Test Item".to_string(),
            Decimal::from(100),
            "шт".to_string(),
            "20%".to_string(),
            5,
        );

        assert_eq!(item.get_vat_amount(), Decimal::from(100)); // 20% of 500
        assert_eq!(item.get_total_with_vat(), Decimal::from(600)); // 500 + 100
    }
}
