use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tracing::{debug, error, info};
use uuid::Uuid;

use crate::types::{TBankError, TBankResult};

/// Types of number sequences
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum SequenceType {
    /// B2B invoices for legal entities
    B2BInvoice,
    /// Test invoices for development
    TestInvoice,
    /// Acquiring payment orders
    AcquiringOrder,
    /// Audit log entries
    AuditEntry,
}

impl SequenceType {
    /// Get sequence type as string for database storage
    pub fn as_str(&self) -> &'static str {
        match self {
            SequenceType::B2BInvoice => "b2b_invoice",
            SequenceType::TestInvoice => "test_invoice",
            SequenceType::AcquiringOrder => "acquiring_order",
            SequenceType::AuditEntry => "audit_entry",
        }
    }

    /// Parse sequence type from string
    pub fn from_str(s: &str) -> TBankResult<Self> {
        match s {
            "b2b_invoice" => Ok(SequenceType::B2BInvoice),
            "test_invoice" => Ok(SequenceType::TestInvoice),
            "acquiring_order" => Ok(SequenceType::AcquiringOrder),
            "audit_entry" => Ok(SequenceType::AuditEntry),
            _ => Err(TBankError::ConfigurationError(format!(
                "Unknown sequence type: {}",
                s
            ))),
        }
    }

    /// Get numeric prefix for this sequence type
    pub fn numeric_prefix(&self) -> u8 {
        match self {
            SequenceType::B2BInvoice => 1,
            SequenceType::TestInvoice => 9,
            SequenceType::AcquiringOrder => 2,
            SequenceType::AuditEntry => 8,
        }
    }
}

/// Number sequence for generating unique sequential numbers
#[derive(Debug, Clone)]
pub struct NumberSequence {
    pub id: Uuid,
    pub sequence_type: SequenceType,
    pub year: Option<i32>,
    pub month: Option<u32>,
    pub current_value: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl NumberSequence {
    /// Create new number sequence
    pub fn new(sequence_type: SequenceType, year: Option<i32>, month: Option<u32>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            sequence_type,
            year,
            month,
            current_value: 0,
            created_at: now,
            updated_at: now,
        }
    }

    /// Get next number in sequence (atomic operation)
    pub async fn next_number(&mut self, pool: &PgPool) -> TBankResult<i64> {
        debug!(
            sequence_type = ?self.sequence_type,
            year = ?self.year,
            month = ?self.month,
            current_value = self.current_value,
            "Getting next number from sequence"
        );

        // Use PostgreSQL's atomic increment to ensure uniqueness
        let query = r#"
            UPDATE number_sequences 
            SET current_value = current_value + 1, updated_at = NOW()
            WHERE sequence_type = $1 
                AND ($2::int IS NULL OR year = $2)
                AND ($3::int IS NULL OR month = $3)
            RETURNING current_value
        "#;

        let result = sqlx::query_scalar::<_, i64>(query)
            .bind(self.sequence_type.as_str())
            .bind(self.year)
            .bind(self.month.map(|m| m as i32))
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    sequence_type = ?self.sequence_type,
                    "Failed to increment sequence"
                );
                TBankError::DatabaseError(e)
            })?;

        match result {
            Some(new_value) => {
                self.current_value = new_value;
                self.updated_at = Utc::now();
                
                info!(
                    sequence_type = ?self.sequence_type,
                    new_value = new_value,
                    "Generated new sequence number"
                );
                
                Ok(new_value)
            }
            None => {
                // Sequence doesn't exist, create it
                info!(
                    sequence_type = ?self.sequence_type,
                    year = ?self.year,
                    month = ?self.month,
                    "Creating new number sequence"
                );
                
                self.create_sequence(pool).await?;
                Ok(1) // First number in new sequence
            }
        }
    }

    /// Create new sequence in database
    async fn create_sequence(&mut self, pool: &PgPool) -> TBankResult<()> {
        let query = r#"
            INSERT INTO number_sequences (
                id, sequence_type, year, month, current_value, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (sequence_type, year, month) 
            DO UPDATE SET current_value = current_value + 1, updated_at = NOW()
            RETURNING current_value
        "#;

        let new_value = sqlx::query_scalar::<_, i64>(query)
            .bind(self.id)
            .bind(self.sequence_type.as_str())
            .bind(self.year)
            .bind(self.month.map(|m| m as i32))
            .bind(1i64) // Start from 1
            .bind(self.created_at)
            .bind(self.updated_at)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    sequence_type = ?self.sequence_type,
                    "Failed to create sequence"
                );
                TBankError::DatabaseError(e)
            })?;

        self.current_value = new_value;
        Ok(())
    }

    /// Get current sequence value without incrementing
    pub async fn current_number(
        pool: &PgPool,
        sequence_type: SequenceType,
        year: Option<i32>,
        month: Option<u32>,
    ) -> TBankResult<i64> {
        let query = r#"
            SELECT current_value 
            FROM number_sequences 
            WHERE sequence_type = $1 
                AND ($2::int IS NULL OR year = $2)
                AND ($3::int IS NULL OR month = $3)
        "#;

        let result = sqlx::query_scalar::<_, i64>(query)
            .bind(sequence_type.as_str())
            .bind(year)
            .bind(month.map(|m| m as i32))
            .fetch_optional(pool)
            .await
            .map_err(|e| TBankError::DatabaseError(e))?;

        Ok(result.unwrap_or(0))
    }

    /// Reset sequence to specific value (admin operation)
    pub async fn reset_sequence(
        pool: &PgPool,
        sequence_type: SequenceType,
        year: Option<i32>,
        month: Option<u32>,
        new_value: i64,
    ) -> TBankResult<()> {
        let query = r#"
            UPDATE number_sequences 
            SET current_value = $4, updated_at = NOW()
            WHERE sequence_type = $1 
                AND ($2::int IS NULL OR year = $2)
                AND ($3::int IS NULL OR month = $3)
        "#;

        sqlx::query(query)
            .bind(sequence_type.as_str())
            .bind(year)
            .bind(month.map(|m| m as i32))
            .bind(new_value)
            .execute(pool)
            .await
            .map_err(|e| TBankError::DatabaseError(e))?;

        info!(
            sequence_type = ?sequence_type,
            year = ?year,
            month = ?month,
            new_value = new_value,
            "Reset sequence to new value"
        );

        Ok(())
    }

    /// Get sequence statistics
    pub async fn get_statistics(
        pool: &PgPool,
        sequence_type: SequenceType,
    ) -> TBankResult<Vec<SequenceStats>> {
        let query = r#"
            SELECT 
                sequence_type,
                year,
                month,
                current_value,
                created_at,
                updated_at
            FROM number_sequences 
            WHERE sequence_type = $1
            ORDER BY year DESC, month DESC
        "#;

        let rows = sqlx::query(query)
            .bind(sequence_type.as_str())
            .fetch_all(pool)
            .await
            .map_err(|e| TBankError::DatabaseError(e))?;

        let mut stats = Vec::new();
        for row in rows {
            stats.push(SequenceStats {
                sequence_type,
                year: row.try_get("year")?,
                month: row.try_get::<Option<i32>, _>("month")?.map(|m| m as u32),
                current_value: row.try_get("current_value")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            });
        }

        Ok(stats)
    }
}

/// Statistics for number sequences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceStats {
    pub sequence_type: SequenceType,
    pub year: Option<i32>,
    pub month: Option<u32>,
    pub current_value: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sequence_type_conversion() {
        assert_eq!(SequenceType::B2BInvoice.as_str(), "b2b_invoice");
        assert_eq!(SequenceType::from_str("b2b_invoice").unwrap(), SequenceType::B2BInvoice);
        assert!(SequenceType::from_str("invalid").is_err());
    }

    #[test]
    fn test_numeric_prefixes() {
        assert_eq!(SequenceType::B2BInvoice.numeric_prefix(), 1);
        assert_eq!(SequenceType::TestInvoice.numeric_prefix(), 9);
        assert_eq!(SequenceType::AcquiringOrder.numeric_prefix(), 2);
        assert_eq!(SequenceType::AuditEntry.numeric_prefix(), 8);
    }
}