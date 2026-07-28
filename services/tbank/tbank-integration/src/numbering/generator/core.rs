use chrono::{DateTime, Datelike, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, info, warn};

use super::formats::{NumberFormat, FormatBuilder};
use crate::numbering::sequence::{NumberSequence, SequenceType};
use crate::numbering::validator::InvoiceNumberValidator;
use crate::numbering::{NumberingConfig, InvoiceNumber};
use crate::types::{TBankError, TBankResult};

/// Invoice number generator with database-backed sequences
pub struct InvoiceNumberGenerator {
    db_pool: Arc<PgPool>,
    config: NumberingConfig,
    validator: InvoiceNumberValidator,
}

impl InvoiceNumberGenerator {
    /// Create new invoice number generator
    pub fn new(db_pool: Arc<PgPool>, config: NumberingConfig) -> TBankResult<Self> {
        config.validate()?;
        
        Ok(Self {
            db_pool,
            config,
            validator: InvoiceNumberValidator::new(),
        })
    }

    /// Generate unique invoice number for B2B invoices
    pub async fn generate_b2b_invoice_number(&self) -> TBankResult<InvoiceNumber> {
        self.generate_invoice_number(SequenceType::B2BInvoice).await
    }

    /// Generate unique invoice number for test invoices
    pub async fn generate_test_invoice_number(&self) -> TBankResult<InvoiceNumber> {
        self.generate_invoice_number(SequenceType::TestInvoice).await
    }

    /// Generate unique number for acquiring orders
    pub async fn generate_acquiring_order_number(&self) -> TBankResult<InvoiceNumber> {
        self.generate_invoice_number(SequenceType::AcquiringOrder).await
    }

    /// Generate invoice number for specific sequence type
    pub async fn generate_invoice_number(&self, sequence_type: SequenceType) -> TBankResult<InvoiceNumber> {
        let now = Utc::now();
        let year = if self.config.include_year {
            Some(now.year())
        } else {
            None
        };
        let month = if self.config.include_month {
            Some(now.month())
        } else {
            None
        };
        let day = if self.config.include_day {
            Some(now.day())
        } else {
            None
        };

        debug!(
            sequence_type = ?sequence_type,
            year = ?year,
            month = ?month,
            day = ?day,
            "Generating invoice number"
        );

        // Get next sequence number
        let mut sequence = NumberSequence::new(sequence_type, year, month);
        let sequence_number = sequence.next_number(&self.db_pool).await?;

        // Create invoice number with both formats
        let invoice_number = InvoiceNumber::new(&self.config, sequence_number, now)?;

        // Validate T-Bank format
        self.validator.validate(invoice_number.for_tbank())?;

        info!(
            sequence_type = ?sequence_type,
            readable = %invoice_number.for_documents(),
            tbank_format = %invoice_number.for_tbank(),
            sequence_number = sequence_number,
            "Generated invoice number"
        );

        Ok(invoice_number)
    }

    /// Generate number for specific sequence type (legacy method, returns T-Bank format)
    pub async fn generate_number(&self, sequence_type: SequenceType) -> TBankResult<String> {
        let invoice_number = self.generate_invoice_number(sequence_type).await?;
        Ok(invoice_number.tbank_format)
    }

    /// Build invoice number according to config (legacy method)
    fn build_invoice_number(
        &self,
        sequence_type: SequenceType,
        year: Option<i32>,
        month: Option<u32>,
        sequence_number: i64,
    ) -> TBankResult<String> {
        let format = NumberFormat::from_config(&self.config, sequence_type);
        format.build(year, month, sequence_number)
    }

    /// Generate simple sequential number (no date components)
    pub async fn generate_simple_sequential(&self, sequence_type: SequenceType) -> TBankResult<InvoiceNumber> {
        let now = Utc::now();
        let mut sequence = NumberSequence::new(sequence_type, None, None);
        let sequence_number = sequence.next_number(&self.db_pool).await?;

        // Create simple config for sequential numbering
        let simple_config = NumberingConfig {
            company_prefix: "".to_string(),
            invoice_type_prefix: 0,
            include_year: false,
            include_month: false,
            include_day: false,
            sequence_length: 12,
            max_total_length: 15,
            use_readable_format: false,
        };

        let invoice_number = InvoiceNumber::new(&simple_config, sequence_number, now)?;
        self.validator.validate(invoice_number.for_tbank())?;

        info!(
            sequence_type = ?sequence_type,
            readable = %invoice_number.for_documents(),
            tbank_format = %invoice_number.for_tbank(),
            sequence_number = sequence_number,
            "Generated simple sequential number"
        );

        Ok(invoice_number)
    }

    /// Generate number with custom format (returns T-Bank compatible format)
    pub async fn generate_custom_format(
        &self,
        sequence_type: SequenceType,
        format_template: &str,
    ) -> TBankResult<String> {
        let now = Utc::now();
        let mut sequence = NumberSequence::new(sequence_type, Some(now.year()), Some(now.month()));
        let sequence_number = sequence.next_number(&self.db_pool).await?;

        let format = FormatBuilder::new(format_template)
            .with_type(sequence_type.numeric_prefix())
            .with_year(now.year())
            .with_month(now.month())
            .with_day(now.day())
            .with_sequence(sequence_number)
            .build()?;

        let invoice_number = format.generate()?;
        self.validator.validate(&invoice_number)?;

        info!(
            sequence_type = ?sequence_type,
            template = format_template,
            invoice_number = %invoice_number,
            "Generated custom format number"
        );

        Ok(invoice_number)
    }

    /// Check if invoice number already exists (checks T-Bank format)
    pub async fn number_exists(&self, invoice_number: &InvoiceNumber) -> TBankResult<bool> {
        self.tbank_number_exists(invoice_number.for_tbank()).await
    }

    /// Check if T-Bank format number exists
    pub async fn tbank_number_exists(&self, tbank_number: &str) -> TBankResult<bool> {
        let query = "SELECT EXISTS(SELECT 1 FROM b2b_invoices WHERE invoice_number = $1)";
        
        let exists = sqlx::query_scalar::<_, bool>(query)
            .bind(tbank_number)
            .fetch_one(&*self.db_pool)
            .await
            .map_err(|e| TBankError::DatabaseError(e))?;

        Ok(exists)
    }

    /// Generate guaranteed unique number (with retry logic)
    pub async fn generate_unique_number(&self, sequence_type: SequenceType) -> TBankResult<InvoiceNumber> {
        const MAX_RETRIES: u32 = 10;
        
        for attempt in 1..=MAX_RETRIES {
            let invoice_number = self.generate_invoice_number(sequence_type).await?;
            
            // Check if number already exists
            if !self.number_exists(&invoice_number).await? {
                return Ok(invoice_number);
            }
            
            warn!(
                attempt = attempt,
                readable = %invoice_number.for_documents(),
                tbank_format = %invoice_number.for_tbank(),
                "Generated invoice number already exists, retrying"
            );
        }
        
        Err(TBankError::ConfigurationError(format!(
            "Failed to generate unique invoice number after {} attempts",
            MAX_RETRIES
        )))
    }

    /// Get sequence statistics
    pub async fn get_sequence_stats(&self, sequence_type: SequenceType) -> TBankResult<Vec<crate::numbering::sequence::SequenceStats>> {
        NumberSequence::get_statistics(&self.db_pool, sequence_type).await
    }

    /// Reset sequence (admin operation)
    pub async fn reset_sequence(
        &self,
        sequence_type: SequenceType,
        year: Option<i32>,
        month: Option<u32>,
        new_value: i64,
    ) -> TBankResult<()> {
        NumberSequence::reset_sequence(&self.db_pool, sequence_type, year, month, new_value).await
    }
}