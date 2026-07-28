use chrono::{DateTime, Utc};
use regex::Regex;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::types::b2b::invoice::{
    B2BInvoiceContact, CreateInvoiceContactRequest as CreateB2BInvoiceContactRequest,
    InvoiceContact,
};
use crate::types::{TBankError, TBankResult};

/// Service for managing B2B invoice contacts (up to 10 contacts per invoice)
pub struct B2BInvoiceContactService {
    db_pool: Arc<PgPool>,
    email_regex: Regex,
}

impl B2BInvoiceContactService {
    /// Create new B2B invoice contact service
    pub fn new(db_pool: Arc<PgPool>) -> Self {
        info!("Initializing B2BInvoiceContactService");

        // Compile email regex once
        let email_regex = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
            .expect("Failed to compile email regex");

        Self {
            db_pool,
            email_regex,
        }
    }

    /// Add contact to B2B invoice
    pub async fn add_contact_to_invoice(
        &self,
        invoice_id: Uuid,
        contact_request: CreateB2BInvoiceContactRequest,
    ) -> TBankResult<B2BInvoiceContact> {
        info!(
            invoice_id = ?invoice_id,
            email = ?contact_request.email,
            "Adding contact to B2B invoice"
        );

        // Validate contact request
        self.validate_contact_request(&contact_request)?;

        // Check if invoice exists and get current contact count
        let current_contact_count = self.get_invoice_contact_count(invoice_id).await?;

        if current_contact_count >= 10 {
            return Err(TBankError::ValidationError(
                "Invoice cannot have more than 10 contacts".to_string(),
            ));
        }

        // Check if email already exists for this invoice (if email is provided)
        if let Some(email) = &contact_request.email {
            if self.email_exists_for_invoice(invoice_id, email).await? {
                return Err(TBankError::ValidationError(
                    "Email already exists for this invoice".to_string(),
                ));
            }
        }

        // Create invoice contact
        let contact = B2BInvoiceContact {
            id: Some(Uuid::new_v4()),
            invoice_id,
            email: contact_request.email,
            created_at: Some(Utc::now()),
        };

        // Store in database
        self.insert_contact(&contact).await?;

        info!(
            contact_id = ?contact.id,
            invoice_id = ?invoice_id,
            email = ?contact.email,
            "B2B invoice contact added successfully"
        );

        Ok(contact)
    }

    /// Get all contacts for an invoice
    pub async fn get_invoice_contacts(
        &self,
        invoice_id: Uuid,
    ) -> TBankResult<Vec<B2BInvoiceContact>> {
        debug!(invoice_id = ?invoice_id, "Getting contacts for B2B invoice");

        let query = r#"
            SELECT id, invoice_id, email, created_at
            FROM b2b_invoice_contacts 
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
                    "Failed to get B2B invoice contacts"
                );
                TBankError::DatabaseError(e)
            })?;

        let mut contacts = Vec::new();
        for row in rows {
            contacts.push(B2BInvoiceContact::from_row(&row)?);
        }

        debug!(
            invoice_id = ?invoice_id,
            contact_count = contacts.len(),
            "B2B invoice contacts retrieved successfully"
        );

        Ok(contacts)
    }

    /// Update invoice contact
    pub async fn update_contact(
        &self,
        contact_id: Uuid,
        update_request: CreateB2BInvoiceContactRequest,
    ) -> TBankResult<B2BInvoiceContact> {
        info!(
            contact_id = ?contact_id,
            email = ?update_request.email,
            "Updating B2B invoice contact"
        );

        // Validate contact request
        self.validate_contact_request(&update_request)?;

        // Get current contact to check invoice_id
        let current_contact: Option<InvoiceContact> = self.get_contact_by_id(contact_id).await?;
        let current_contact =
            current_contact.ok_or_else(|| TBankError::InvoiceContactNotFound { id: contact_id })?;

        // Check if new email already exists for this invoice (excluding current contact)
        if update_request.email != current_contact.email {
            if let Some(email) = &update_request.email {
                if self
                    .email_exists_for_invoice(current_contact.invoice_id, email)
                    .await?
                {
                    return Err(TBankError::ValidationError(
                        "Email already exists for this invoice".to_string(),
                    ));
                }
            }
        }

        // Update in database
        let query = r#"
            UPDATE b2b_invoice_contacts 
            SET email = $1
            WHERE id = $2
            RETURNING id, invoice_id, email, created_at
        "#;

        let row = sqlx::query(query)
            .bind(&update_request.email)
            .bind(contact_id)
            .fetch_optional(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    contact_id = ?contact_id,
                    "Failed to update B2B invoice contact"
                );
                TBankError::DatabaseError(e)
            })?;

        let row = row.ok_or_else(|| TBankError::InvoiceContactNotFound { id: contact_id })?;
        let updated_contact = B2BInvoiceContact::from_row(&row)?;

        info!(
            contact_id = ?contact_id,
            email = ?updated_contact.email,
            "B2B invoice contact updated successfully"
        );

        Ok(updated_contact)
    }

    /// Remove contact from invoice
    pub async fn remove_contact(&self, contact_id: Uuid) -> TBankResult<()> {
        info!(contact_id = ?contact_id, "Removing B2B invoice contact");

        let query = "DELETE FROM b2b_invoice_contacts WHERE id = $1";

        let result = sqlx::query(query)
            .bind(contact_id)
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    contact_id = ?contact_id,
                    "Failed to remove B2B invoice contact"
                );
                TBankError::DatabaseError(e)
            })?;

        if result.rows_affected() == 0 {
            return Err(TBankError::InvoiceContactNotFound { id: contact_id });
        }

        info!(contact_id = ?contact_id, "B2B invoice contact removed successfully");
        Ok(())
    }

    /// Get contact by ID
    pub async fn get_contact_by_id(
        &self,
        contact_id: Uuid,
    ) -> TBankResult<Option<B2BInvoiceContact>> {
        debug!(contact_id = ?contact_id, "Getting B2B invoice contact by ID");

        let query = r#"
            SELECT id, invoice_id, email, created_at
            FROM b2b_invoice_contacts 
            WHERE id = $1
        "#;

        let row = sqlx::query(query)
            .bind(contact_id)
            .fetch_optional(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    contact_id = ?contact_id,
                    "Failed to get B2B invoice contact by ID"
                );
                TBankError::DatabaseError(e)
            })?;

        if let Some(row) = row {
            let contact = B2BInvoiceContact::from_row(&row)?;
            debug!(
                contact_id = ?contact_id,
                email = ?contact.email,
                "B2B invoice contact found"
            );
            Ok(Some(contact))
        } else {
            debug!(contact_id = ?contact_id, "B2B invoice contact not found");
            Ok(None)
        }
    }

    /// Validate contact request
    fn validate_contact_request(
        &self,
        request: &CreateB2BInvoiceContactRequest,
    ) -> TBankResult<()> {
        debug!("Validating B2B invoice contact request");

        // Only validate if email is provided
        if let Some(email) = &request.email {
            // Validate email format
            if !self.email_regex.is_match(email) {
                return Err(TBankError::ValidationError(
                    "Invalid email format".to_string(),
                ));
            }

            // Validate email length
            if email.len() > 255 {
                return Err(TBankError::ValidationError(
                    "Email cannot exceed 255 characters".to_string(),
                ));
            }

            // Validate email is not empty
            if email.trim().is_empty() {
                return Err(TBankError::ValidationError(
                    "Email cannot be empty".to_string(),
                ));
            }
        }

        debug!("B2B invoice contact request validation passed");
        Ok(())
    }

    /// Get current contact count for an invoice
    async fn get_invoice_contact_count(&self, invoice_id: Uuid) -> TBankResult<u32> {
        debug!(invoice_id = ?invoice_id, "Getting contact count for B2B invoice");

        let query =
            "SELECT COUNT(*) as contact_count FROM b2b_invoice_contacts WHERE invoice_id = $1";

        let row = sqlx::query(query)
            .bind(invoice_id)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    "Failed to get B2B invoice contact count"
                );
                TBankError::DatabaseError(e)
            })?;

        let count: i64 = row.get("contact_count");

        debug!(
            invoice_id = ?invoice_id,
            contact_count = count,
            "B2B invoice contact count retrieved"
        );

        Ok(count as u32)
    }

    /// Check if email exists for an invoice
    async fn email_exists_for_invoice(&self, invoice_id: Uuid, email: &str) -> TBankResult<bool> {
        debug!(
            invoice_id = ?invoice_id,
            email = %email,
            "Checking if email exists for B2B invoice"
        );

        let query = r#"
            SELECT EXISTS(
                SELECT 1 FROM b2b_invoice_contacts 
                WHERE invoice_id = $1 AND email = $2
            )
        "#;

        let exists: (bool,) = sqlx::query_as(query)
            .bind(invoice_id)
            .bind(email)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    invoice_id = ?invoice_id,
                    email = %email,
                    "Failed to check email existence for B2B invoice"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            invoice_id = ?invoice_id,
            email = %email,
            exists = exists.0,
            "Email existence check completed"
        );

        Ok(exists.0)
    }

    /// Insert contact into database
    async fn insert_contact(&self, contact: &B2BInvoiceContact) -> TBankResult<()> {
        debug!(
            contact_id = ?contact.id,
            invoice_id = ?contact.invoice_id,
            "Inserting B2B invoice contact into database"
        );

        let query = r#"
            INSERT INTO b2b_invoice_contacts (
                id, invoice_id, email, created_at
            ) VALUES ($1, $2, $3, $4)
        "#;

        sqlx::query(query)
            .bind(contact.id)
            .bind(contact.invoice_id)
            .bind(&contact.email)
            .bind(contact.created_at)
            .execute(&*self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    contact_id = ?contact.id,
                    "Failed to insert B2B invoice contact"
                );
                TBankError::DatabaseError(e)
            })?;

        debug!(
            contact_id = ?contact.id,
            "B2B invoice contact inserted successfully"
        );

        Ok(())
    }
}
