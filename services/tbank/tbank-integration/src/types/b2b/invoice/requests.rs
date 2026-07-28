use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::contacts::InvoiceContact;
use super::core::B2BInvoice;
use super::items::InvoiceItem;

/// Request structure for creating a B2B invoice
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateB2BInvoiceRequest {
    pub counterparty_inn: String,
    pub counterparty_kpp: Option<String>,
    pub counterparty_name: String,
    pub total_amount: Decimal,
    pub due_date: NaiveDate,
    pub invoice_date: Option<NaiveDate>,
    pub account_number: Option<String>,
    pub invoice_number: String,
    pub comment: Option<String>,
    pub custom_payment_purpose: Option<String>,
    pub items: Vec<CreateInvoiceItemRequest>,
    pub contacts: Vec<CreateInvoiceContactRequest>,
}

/// Request structure for creating an invoice item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceItemRequest {
    pub name: String,
    pub price: Decimal,
    pub unit: String,
    pub vat_rate: String,
    pub amount: i32,
}

/// Request structure for creating an invoice contact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceContactRequest {
    pub email: Option<String>,
}

/// Type alias for backward compatibility
pub type CreateB2BInvoiceItemRequest = CreateInvoiceItemRequest;

impl CreateB2BInvoiceRequest {
    /// Validate the request
    pub fn validate(&self) -> Result<(), String> {
        if self.total_amount <= Decimal::ZERO {
            return Err("Total amount must be positive".to_string());
        }

        if self.counterparty_inn.is_empty() {
            return Err("Counterparty INN is required".to_string());
        }

        if self.counterparty_name.trim().is_empty() {
            return Err("Counterparty name is required".to_string());
        }

        if self.due_date <= chrono::Utc::now().date_naive() {
            return Err("Due date must be in the future".to_string());
        }

        // Validate items (max 100)
        if self.items.len() > 100 {
            return Err("Maximum 100 items allowed per invoice".to_string());
        }

        for item in &self.items {
            item.validate()?;
        }

        // Validate contacts (max 10)
        if self.contacts.len() > 10 {
            return Err("Maximum 10 contacts allowed per invoice".to_string());
        }

        for contact in &self.contacts {
            contact.validate()?;
        }

        Ok(())
    }

    /// Convert to B2BInvoice
    pub fn into_invoice(self) -> B2BInvoice {
        B2BInvoice::new(
            self.counterparty_inn,
            self.counterparty_kpp,
            self.counterparty_name,
            self.total_amount,
            self.due_date,
        )
    }
}

impl CreateInvoiceItemRequest {
    /// Validate the item request
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

        Ok(())
    }

    /// Convert to InvoiceItem
    pub fn into_item(self, invoice_id: Uuid) -> InvoiceItem {
        InvoiceItem::new(
            invoice_id,
            self.name,
            self.price,
            self.unit,
            self.vat_rate,
            self.amount,
        )
    }
}

impl CreateInvoiceContactRequest {
    /// Validate the contact request
    pub fn validate(&self) -> Result<(), String> {
        if let Some(ref email) = self.email {
            if !email.contains('@') || email.trim().is_empty() {
                return Err("Invalid email format".to_string());
            }
        }
        Ok(())
    }

    /// Convert to InvoiceContact
    pub fn into_contact(self, invoice_id: Uuid) -> InvoiceContact {
        InvoiceContact::new(invoice_id, self.email)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_b2b_invoice_request_validation() {
        let request = CreateB2BInvoiceRequest {
            counterparty_inn: "7707083893".to_string(),
            counterparty_kpp: Some("770701001".to_string()),
            counterparty_name: "Test Company".to_string(),
            total_amount: Decimal::from(1000),
            due_date: chrono::Utc::now().date_naive() + chrono::Duration::days(30),
            invoice_date: Some(chrono::Utc::now().date_naive()),
            account_number: Some("40702810110011000000".to_string()),
            invoice_number: "123456789".to_string(),
            comment: None,
            custom_payment_purpose: None,
            items: vec![CreateInvoiceItemRequest {
                name: "Test Item".to_string(),
                price: Decimal::from(100),
                unit: "шт".to_string(),
                vat_rate: "20%".to_string(),
                amount: 10,
            }],
            contacts: vec![CreateInvoiceContactRequest {
                email: Some("test@example.com".to_string()),
            }],
        };

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_create_invoice_item_request_validation() {
        let item_request = CreateInvoiceItemRequest {
            name: "Test Item".to_string(),
            price: Decimal::from(100),
            unit: "шт".to_string(),
            vat_rate: "20%".to_string(),
            amount: 5,
        };

        assert!(item_request.validate().is_ok());

        // Test invalid item
        let invalid_item = CreateInvoiceItemRequest {
            name: "".to_string(),
            price: Decimal::from(-100),
            unit: "".to_string(),
            vat_rate: "".to_string(),
            amount: 0,
        };

        assert!(invalid_item.validate().is_err());
    }

    #[test]
    fn test_create_invoice_contact_request_validation() {
        let contact_request = CreateInvoiceContactRequest {
            email: Some("test@example.com".to_string()),
        };

        assert!(contact_request.validate().is_ok());

        let invalid_contact = CreateInvoiceContactRequest {
            email: Some("invalid-email".to_string()),
        };

        assert!(invalid_contact.validate().is_err());
    }
}
