use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::types::{TBankError, TBankResult};

/// Invoice contact for B2B invoices (up to 10 contacts per invoice)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvoiceContact {
    pub id: Option<Uuid>,
    pub invoice_id: Uuid,
    pub email: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Type alias for backward compatibility
pub type B2BInvoiceContact = InvoiceContact;

impl InvoiceContact {
    /// Create InvoiceContact from database row
    pub fn from_row(row: &sqlx::postgres::PgRow) -> TBankResult<Self> {
        Ok(InvoiceContact {
            id: row
                .try_get("id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            invoice_id: row
                .try_get("invoice_id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            email: row
                .try_get("email")
                .map_err(|e| TBankError::DatabaseError(e))?,
            created_at: row
                .try_get("created_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
        })
    }

    /// Create a new invoice contact
    pub fn new(invoice_id: Uuid, email: Option<String>) -> Self {
        Self {
            id: None,
            invoice_id,
            email,
            created_at: Some(Utc::now()),
        }
    }

    /// Validate invoice contact
    pub fn validate(&self) -> Result<(), String> {
        if let Some(ref email) = self.email {
            if !email.contains('@') || email.trim().is_empty() {
                return Err("Invalid email format".to_string());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invoice_contact_validation() {
        let invoice_id = Uuid::new_v4();
        let contact = InvoiceContact::new(invoice_id, Some("test@example.com".to_string()));
        assert!(contact.validate().is_ok());

        let invalid_contact = InvoiceContact::new(invoice_id, Some("invalid-email".to_string()));
        assert!(invalid_contact.validate().is_err());

        let no_email_contact = InvoiceContact::new(invoice_id, None);
        assert!(no_email_contact.validate().is_ok());
    }

    #[test]
    fn test_invoice_contact_creation() {
        let invoice_id = Uuid::new_v4();
        let contact = InvoiceContact::new(invoice_id, Some("test@example.com".to_string()));

        assert_eq!(contact.invoice_id, invoice_id);
        assert_eq!(contact.email, Some("test@example.com".to_string()));
        assert!(contact.created_at.is_some());
        assert!(contact.id.is_none());
    }
}
