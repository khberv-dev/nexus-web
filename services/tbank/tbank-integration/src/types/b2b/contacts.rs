use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::common::validators::EmailValidator;

/// B2B invoice contact for legal entities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct B2BInvoiceContact {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub email: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Request to create a new B2B invoice contact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceContactRequest {
    pub email: Option<String>,
}

impl CreateInvoiceContactRequest {
    /// Validate the invoice contact request
    pub fn validate(&self) -> Result<(), String> {
        if let Some(ref email) = self.email {
            if email.trim().is_empty() {
                return Err("Email cannot be empty if provided".to_string());
            }

            if email.len() > 255 {
                return Err("Email cannot exceed 255 characters".to_string());
            }

            EmailValidator::validate(email)
                .map_err(|e| format!("Invalid email format: {}", e))?;
        }

        Ok(())
    }
}

impl From<CreateInvoiceContactRequest> for B2BInvoiceContact {
    fn from(request: CreateInvoiceContactRequest) -> Self {
        Self {
            id: Uuid::new_v4(),
            invoice_id: Uuid::new_v4(), // Will be set when adding to invoice
            email: request.email,
            created_at: Utc::now(),
        }
    }
}

impl B2BInvoiceContact {
    /// Create new B2B invoice contact
    pub fn new(invoice_id: Uuid, email: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            invoice_id,
            email,
            created_at: Utc::now(),
        }
    }

    /// Update contact email
    pub fn update_email(&mut self, new_email: Option<String>) -> Result<(), String> {
        if let Some(ref email) = new_email {
            if email.trim().is_empty() {
                return Err("Email cannot be empty if provided".to_string());
            }

            if email.len() > 255 {
                return Err("Email cannot exceed 255 characters".to_string());
            }

            EmailValidator::validate(email)
                .map_err(|e| format!("Invalid email format: {}", e))?;
        }

        self.email = new_email;
        Ok(())
    }

    /// Check if contact has email
    pub fn has_email(&self) -> bool {
        self.email.is_some()
    }

    /// Get email or default
    pub fn get_email_or_default(&self, default: &str) -> String {
        self.email.clone().unwrap_or_else(|| default.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_invoice_contact_request_validation() {
        // Valid request with email
        let valid_request = CreateInvoiceContactRequest {
            email: Some("test@example.com".to_string()),
        };
        assert!(valid_request.validate().is_ok());

        // Valid request without email
        let valid_request = CreateInvoiceContactRequest { email: None };
        assert!(valid_request.validate().is_ok());

        // Invalid email format
        let invalid_request = CreateInvoiceContactRequest {
            email: Some("invalid-email".to_string()),
        };
        assert!(invalid_request.validate().is_err());

        // Empty email
        let invalid_request = CreateInvoiceContactRequest {
            email: Some("".to_string()),
        };
        assert!(invalid_request.validate().is_err());
    }

    #[test]
    fn test_email_validation() {
        // Test using the centralized validator
        assert!(EmailValidator::validate("test@example.com").is_ok());
        assert!(EmailValidator::validate("user.name@domain.co.uk").is_ok());
        assert!(EmailValidator::validate("invalid").is_err());
        assert!(EmailValidator::validate("@domain.com").is_err());
        assert!(EmailValidator::validate("user@").is_err());
    }

    #[test]
    fn test_contact_methods() {
        let mut contact = B2BInvoiceContact::new(Uuid::new_v4(), None);

        assert!(!contact.has_email());
        assert_eq!(
            contact.get_email_or_default("default@test.com"),
            "default@test.com"
        );

        contact
            .update_email(Some("new@example.com".to_string()))
            .unwrap();
        assert!(contact.has_email());
        assert_eq!(
            contact.get_email_or_default("default@test.com"),
            "new@example.com"
        );
    }
}
