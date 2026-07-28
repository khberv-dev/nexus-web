use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::str::FromStr;
use uuid::Uuid;

use crate::types::{TBankError, TBankResult};

/// B2B Invoice data structure for legal entities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct B2BInvoice {
    pub id: Option<Uuid>,
    pub invoice_number: String,
    pub tbank_invoice_id: Option<String>,
    pub counterparty_inn: String,
    pub counterparty_kpp: Option<String>,
    pub counterparty_name: String,
    pub due_date: NaiveDate,
    pub invoice_date: Option<NaiveDate>,
    pub account_number: Option<String>,
    pub total_amount: Decimal,
    pub status: B2BInvoiceStatus,
    pub pdf_url: Option<String>,
    pub incoming_invoice_url: Option<String>,
    pub comment: Option<String>,
    pub custom_payment_purpose: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// B2B Invoice status following the state machine
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum B2BInvoiceStatus {
    Draft,
    Sent,
    Viewed,
    Paid,
    Overdue,
    Cancelled,
    Refunded,
}

impl B2BInvoice {
    /// Create B2BInvoice from database row
    pub fn from_row(row: &sqlx::postgres::PgRow) -> TBankResult<Self> {
        let status_str: String = row
            .try_get("status")
            .map_err(|e| TBankError::DatabaseError(e))?;

        let status = status_str
            .parse()
            .map_err(|e| TBankError::ValidationError(format!("Invalid status: {}", e)))?;

        Ok(B2BInvoice {
            id: row
                .try_get("id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            invoice_number: row
                .try_get("invoice_number")
                .map_err(|e| TBankError::DatabaseError(e))?,
            tbank_invoice_id: row
                .try_get("tbank_invoice_id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            counterparty_inn: row
                .try_get("counterparty_inn")
                .map_err(|e| TBankError::DatabaseError(e))?,
            counterparty_kpp: row
                .try_get("counterparty_kpp")
                .map_err(|e| TBankError::DatabaseError(e))?,
            counterparty_name: row
                .try_get("counterparty_name")
                .map_err(|e| TBankError::DatabaseError(e))?,
            due_date: row
                .try_get("due_date")
                .map_err(|e| TBankError::DatabaseError(e))?,
            invoice_date: row
                .try_get("invoice_date")
                .map_err(|e| TBankError::DatabaseError(e))?,
            account_number: row
                .try_get("account_number")
                .map_err(|e| TBankError::DatabaseError(e))?,
            total_amount: row
                .try_get("total_amount")
                .map_err(|e| TBankError::DatabaseError(e))?,
            status,
            pdf_url: row
                .try_get("pdf_url")
                .map_err(|e| TBankError::DatabaseError(e))?,
            incoming_invoice_url: row
                .try_get("incoming_invoice_url")
                .map_err(|e| TBankError::DatabaseError(e))?,
            comment: row
                .try_get("comment")
                .map_err(|e| TBankError::DatabaseError(e))?,
            custom_payment_purpose: row
                .try_get("custom_payment_purpose")
                .map_err(|e| TBankError::DatabaseError(e))?,
            created_at: row
                .try_get("created_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
            updated_at: row
                .try_get("updated_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
        })
    }

    /// Create a new B2B invoice
    pub fn new(
        counterparty_inn: String,
        counterparty_kpp: Option<String>,
        counterparty_name: String,
        total_amount: Decimal,
        due_date: NaiveDate,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            invoice_number: Self::generate_invoice_number(),
            tbank_invoice_id: None,
            counterparty_inn,
            counterparty_kpp,
            counterparty_name,
            due_date,
            invoice_date: Some(now.date_naive()),
            account_number: None,
            total_amount,
            status: B2BInvoiceStatus::Draft,
            pdf_url: None,
            incoming_invoice_url: None,
            comment: None,
            custom_payment_purpose: None,
            created_at: Some(now),
            updated_at: Some(now),
        }
    }

    /// Generate invoice number in format ^\d{1,15}$
    pub fn generate_invoice_number() -> String {
        // Deprecated: Use InvoiceNumberGenerator instead
        // This method is kept for backward compatibility
        let timestamp = Utc::now().timestamp();
        let sequence = rand::random::<u16>() % 1000;
        format!("{}{:03}", timestamp % 1000000000000, sequence)
    }

    /// Generate invoice number using new numbering system
    /// This is the recommended method for new code
    pub async fn generate_invoice_number_v2(
        generator: &crate::numbering::InvoiceNumberGenerator,
    ) -> crate::types::TBankResult<String> {
        let invoice_number = generator.generate_b2b_invoice_number().await?;
        Ok(invoice_number.for_tbank().to_string())
    }

    /// Validate B2B invoice data
    pub fn validate(&self) -> Result<(), String> {
        // Validate invoice number format
        if !self.invoice_number.chars().all(|c| c.is_ascii_digit())
            || self.invoice_number.len() == 0
            || self.invoice_number.len() > 15
        {
            return Err("Invoice number must be 1-15 digits".to_string());
        }

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

        Ok(())
    }

    /// Check if status transition is valid
    pub fn can_transition_to(&self, new_status: &B2BInvoiceStatus) -> bool {
        use B2BInvoiceStatus::*;

        match (&self.status, new_status) {
            (Draft, Sent) => true,
            (Sent, Viewed) => true,
            (Viewed, Paid) => true,
            (Viewed, Overdue) => true,
            (Sent, Overdue) => true,
            (Draft, Cancelled) => true,
            (Sent, Cancelled) => true,
            (Viewed, Cancelled) => true,
            (Paid, Refunded) => true,
            _ => false,
        }
    }

    /// Update status with validation
    pub fn update_status(&mut self, new_status: B2BInvoiceStatus) -> Result<(), String> {
        if !self.can_transition_to(&new_status) {
            return Err(format!(
                "Invalid status transition from {:?} to {:?}",
                self.status, new_status
            ));
        }

        self.status = new_status;
        self.updated_at = Some(Utc::now());
        Ok(())
    }

    /// Check if invoice is overdue
    pub fn is_overdue(&self) -> bool {
        matches!(self.status, B2BInvoiceStatus::Overdue)
            || (matches!(
                self.status,
                B2BInvoiceStatus::Sent | B2BInvoiceStatus::Viewed
            ) && self.due_date < Utc::now().date_naive())
    }

    /// Check if invoice is paid
    pub fn is_paid(&self) -> bool {
        matches!(self.status, B2BInvoiceStatus::Paid)
    }
}

impl std::fmt::Display for B2BInvoiceStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            B2BInvoiceStatus::Draft => write!(f, "Draft"),
            B2BInvoiceStatus::Sent => write!(f, "Sent"),
            B2BInvoiceStatus::Viewed => write!(f, "Viewed"),
            B2BInvoiceStatus::Paid => write!(f, "Paid"),
            B2BInvoiceStatus::Overdue => write!(f, "Overdue"),
            B2BInvoiceStatus::Cancelled => write!(f, "Cancelled"),
            B2BInvoiceStatus::Refunded => write!(f, "Refunded"),
        }
    }
}

impl std::str::FromStr for B2BInvoiceStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Draft" => Ok(B2BInvoiceStatus::Draft),
            "Sent" => Ok(B2BInvoiceStatus::Sent),
            "Viewed" => Ok(B2BInvoiceStatus::Viewed),
            "Paid" => Ok(B2BInvoiceStatus::Paid),
            "Overdue" => Ok(B2BInvoiceStatus::Overdue),
            "Cancelled" => Ok(B2BInvoiceStatus::Cancelled),
            "Refunded" => Ok(B2BInvoiceStatus::Refunded),
            _ => Err(format!("Invalid B2B invoice status: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_b2b_invoice_creation() {
        let invoice = B2BInvoice::new(
            "7707083893".to_string(),
            Some("770701001".to_string()),
            "Test Company LLC".to_string(),
            Decimal::from(1000),
            chrono::Utc::now().date_naive() + chrono::Duration::days(30),
        );

        assert_eq!(invoice.status, B2BInvoiceStatus::Draft);
        assert!(invoice.invoice_number.chars().all(|c| c.is_ascii_digit()));
        assert!(invoice.created_at.is_some());
    }

    #[test]
    fn test_b2b_status_transitions() {
        let mut invoice = B2BInvoice::new(
            "7707083893".to_string(),
            Some("770701001".to_string()),
            "Test Company LLC".to_string(),
            Decimal::from(1000),
            chrono::Utc::now().date_naive() + chrono::Duration::days(30),
        );

        assert!(invoice.update_status(B2BInvoiceStatus::Sent).is_ok());
        assert!(invoice.update_status(B2BInvoiceStatus::Viewed).is_ok());
        assert!(invoice.update_status(B2BInvoiceStatus::Paid).is_ok());
        assert!(invoice.update_status(B2BInvoiceStatus::Draft).is_err());
    }

    #[test]
    fn test_b2b_status_parsing() {
        assert_eq!(
            B2BInvoiceStatus::from_str("Draft").unwrap(),
            B2BInvoiceStatus::Draft
        );
        assert_eq!(
            B2BInvoiceStatus::from_str("Paid").unwrap(),
            B2BInvoiceStatus::Paid
        );
        assert!(B2BInvoiceStatus::from_str("Invalid").is_err());
    }
}
