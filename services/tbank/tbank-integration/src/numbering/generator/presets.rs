use sqlx::PgPool;
use std::sync::Arc;

use super::core::InvoiceNumberGenerator;
use crate::numbering::NumberingConfig;
use crate::types::TBankResult;

/// Predefined generator configurations for common use cases
pub struct GeneratorPresets;

impl GeneratorPresets {
    /// Create generator for production B2B invoices
    /// Format: 1YYMM00000001 (13 digits)
    /// Example: 1260100000001 (Type=1, Year=26, Month=01, Sequence=1)
    pub fn production_b2b(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig::b2b_invoices();
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator for test invoices
    /// Format: 9YYMM00000001 (13 digits)
    /// Example: 9260100000001 (Type=9, Year=26, Month=01, Sequence=1)
    pub fn test_invoices(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig::test_invoices();
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator for simple sequential numbering
    /// Format: 000000000001 (12 digits)
    /// Example: 000000000001, 000000000002, etc.
    pub fn simple_sequential(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig::simple_sequential();
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator for acquiring orders
    /// Format: 2YYMM00000001 (13 digits)
    /// Example: 2260100000001 (Type=2, Year=26, Month=01, Sequence=1)
    pub fn acquiring_orders(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig {
            company_prefix: "АК".to_string(), // АК = АдКвест
            invoice_type_prefix: 2,
            include_year: true,
            include_month: true,
            include_day: false,
            sequence_length: 8,
            max_total_length: 15,
            use_readable_format: false,
        };
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator for audit entries
    /// Format: 8YY0000000001 (12 digits)
    /// Example: 8260000000001 (Type=8, Year=26, Sequence=1)
    pub fn audit_entries(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig {
            company_prefix: "АУД".to_string(), // АУД = Аудит
            invoice_type_prefix: 8,
            include_year: true,
            include_month: false,
            include_day: false,
            sequence_length: 9,
            max_total_length: 15,
            use_readable_format: false,
        };
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator with custom configuration
    pub fn custom(db_pool: Arc<PgPool>, config: NumberingConfig) -> TBankResult<InvoiceNumberGenerator> {
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator for development/staging environment
    /// Format: 7YYMM00000001 (13 digits)
    /// Example: 7260100000001 (Type=7, Year=26, Month=01, Sequence=1)
    pub fn development(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig {
            company_prefix: "ДЕВ".to_string(), // ДЕВ = Разработка
            invoice_type_prefix: 7,
            include_year: true,
            include_month: true,
            include_day: false,
            sequence_length: 8,
            max_total_length: 15,
            use_readable_format: false,
        };
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator for migration/import scenarios
    /// Format: 000000000001 (12 digits, no type prefix)
    /// Example: 000000000001, 000000000002, etc.
    pub fn migration_import(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig {
            company_prefix: "".to_string(), // No prefix
            invoice_type_prefix: 0, // No prefix
            include_year: false,
            include_month: false,
            include_day: false,
            sequence_length: 12,
            max_total_length: 15,
            use_readable_format: false,
        };
        InvoiceNumberGenerator::new(db_pool, config)
    }

    /// Create generator for high-volume scenarios
    /// Format: 3YY000000001 (11 digits, shorter sequence for more volume)
    /// Example: 3260000000001 (Type=3, Year=26, Sequence=1)
    pub fn high_volume(db_pool: Arc<PgPool>) -> TBankResult<InvoiceNumberGenerator> {
        let config = NumberingConfig {
            company_prefix: "ВОЛ".to_string(), // ВОЛ = Высокий объем
            invoice_type_prefix: 3,
            include_year: true,
            include_month: false, // No month to allow more sequences per year
            include_day: false,
            sequence_length: 8,
            max_total_length: 15,
            use_readable_format: false,
        };
        InvoiceNumberGenerator::new(db_pool, config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests would require a real database connection
    // In practice, you'd use a test database or mock

    #[tokio::test]
    #[ignore] // Ignore by default since it requires DB
    async fn test_preset_configurations() {
        // This would test with a real database
        // let db_pool = Arc::new(PgPool::connect("test_db_url").await.unwrap());
        
        // Test that all presets can be created without errors
        // let _b2b_gen = GeneratorPresets::production_b2b(db_pool.clone()).unwrap();
        // let _test_gen = GeneratorPresets::test_invoices(db_pool.clone()).unwrap();
        // let _simple_gen = GeneratorPresets::simple_sequential(db_pool.clone()).unwrap();
    }
}