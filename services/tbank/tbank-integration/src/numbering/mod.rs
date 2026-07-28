pub mod generator;
pub mod sequence;
pub mod validator;

pub use generator::{InvoiceNumberGenerator, GeneratorPresets, NumberFormat, FormatBuilder};
pub use sequence::{NumberSequence, SequenceType};
pub use validator::{InvoiceNumberValidator, InvoiceNumberPattern};

use crate::types::{TBankError, TBankResult};
use chrono::{DateTime, Datelike, Utc};

/// Invoice numbering configuration
#[derive(Debug, Clone)]
pub struct NumberingConfig {
    /// Company prefix (e.g., "АД" for АдКвест)
    pub company_prefix: String,
    /// Prefix for different invoice types (encoded as digits)
    pub invoice_type_prefix: u8,
    /// Year component (2 digits: 24, 25, etc.)
    pub include_year: bool,
    /// Month component (2 digits: 01-12)
    pub include_month: bool,
    /// Day component (2 digits: 01-31)
    pub include_day: bool,
    /// Sequential number length (remaining digits)
    pub sequence_length: usize,
    /// Maximum total length (T-Bank limit: 15 digits)
    pub max_total_length: usize,
    /// Use human-readable format (АД/2026/01/26-00)
    pub use_readable_format: bool,
}

impl Default for NumberingConfig {
    fn default() -> Self {
        Self {
            company_prefix: "АД".to_string(),
            invoice_type_prefix: 1, // 1 = B2B invoices
            include_year: true,
            include_month: true,
            include_day: true,
            sequence_length: 2,
            max_total_length: 15,
            use_readable_format: true,
        }
    }
}

impl NumberingConfig {
    /// Create config for B2B invoices with readable format
    pub fn b2b_invoices() -> Self {
        Self {
            company_prefix: "АД".to_string(),
            invoice_type_prefix: 1,
            include_year: true,
            include_month: true,
            include_day: true,
            sequence_length: 2,
            max_total_length: 15,
            use_readable_format: true,
        }
    }

    /// Create config for test invoices with readable format
    pub fn test_invoices() -> Self {
        Self {
            company_prefix: "ТС".to_string(), // ТС = Тест
            invoice_type_prefix: 9,
            include_year: true,
            include_month: true,
            include_day: true,
            sequence_length: 2,
            max_total_length: 15,
            use_readable_format: true,
        }
    }

    /// Create config for simple sequential numbering (digits only)
    pub fn simple_sequential() -> Self {
        Self {
            company_prefix: "".to_string(),
            invoice_type_prefix: 0,
            include_year: false,
            include_month: false,
            include_day: false,
            sequence_length: 12,
            max_total_length: 15,
            use_readable_format: false,
        }
    }

    /// Validate configuration
    pub fn validate(&self) -> TBankResult<()> {
        if self.use_readable_format {
            // Для читаемого формата проверяем общую длину
            let sample = self.format_sample();
            if sample.len() > 50 {
                return Err(TBankError::ConfigurationError(format!(
                    "Readable invoice number length {} exceeds reasonable maximum of 50 characters",
                    sample.len()
                )));
            }
        } else {
            // Для цифрового формата проверяем T-Bank лимиты
            let mut total_length = 0;

            if self.invoice_type_prefix > 0 {
                total_length += 1; // Type prefix
            }

            if self.include_year {
                total_length += 2; // YY
            }

            if self.include_month {
                total_length += 2; // MM
            }

            if self.include_day {
                total_length += 2; // DD
            }

            total_length += self.sequence_length;

            if total_length > self.max_total_length {
                return Err(TBankError::ConfigurationError(format!(
                    "Total invoice number length {} exceeds T-Bank maximum {}",
                    total_length, self.max_total_length
                )));
            }
        }

        if self.sequence_length == 0 {
            return Err(TBankError::ConfigurationError(
                "Sequence length must be greater than 0".to_string(),
            ));
        }

        Ok(())
    }

    /// Generate sample format for validation
    fn format_sample(&self) -> String {
        if self.use_readable_format {
            format!("{}/2026/01/26-{:0width$}", 
                    self.company_prefix, 
                    99, 
                    width = self.sequence_length)
        } else {
            let mut length = 0;
            if self.invoice_type_prefix > 0 { length += 1; }
            if self.include_year { length += 2; }
            if self.include_month { length += 2; }
            if self.include_day { length += 2; }
            length += self.sequence_length;
            "1".repeat(length)
        }
    }

    /// Calculate expected number length
    pub fn expected_length(&self) -> usize {
        if self.use_readable_format {
            // АД/2026/01/26-00 = примерно 15-20 символов
            self.company_prefix.len() + 1 + 4 + 1 + 2 + 1 + 2 + 1 + self.sequence_length
        } else {
            let mut length = 0;

            if self.invoice_type_prefix > 0 {
                length += 1;
            }

            if self.include_year {
                length += 2;
            }

            if self.include_month {
                length += 2;
            }

            if self.include_day {
                length += 2;
            }

            length += self.sequence_length;
            length
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_numbering_config_validation() {
        let config = NumberingConfig::b2b_invoices();
        assert!(config.validate().is_ok());

        let invalid_config = NumberingConfig {
            sequence_length: 20,
            ..NumberingConfig::default()
        };
        assert!(invalid_config.validate().is_err());
    }

    #[test]
    fn test_expected_length_calculation() {
        let config = NumberingConfig::b2b_invoices();
        // 1 (type) + 2 (year) + 2 (month) + 8 (sequence) = 13
        assert_eq!(config.expected_length(), 13);

        let simple_config = NumberingConfig::simple_sequential();
        // 12 (sequence only)
        assert_eq!(simple_config.expected_length(), 12);
    }
}

/// Структура для работы с двойной нумерацией счетов
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvoiceNumber {
    /// Читаемый номер для документооборота (АД/2026/01/26-00)
    pub readable: String,
    /// Цифровой номер для T-Bank API (1260126000)
    pub tbank_format: String,
    /// Исходная последовательность
    pub sequence_number: i64,
    /// Дата создания
    pub created_date: chrono::DateTime<chrono::Utc>,
}

impl InvoiceNumber {
    /// Создать новый номер счета
    pub fn new(
        config: &NumberingConfig,
        sequence_number: i64,
        date: chrono::DateTime<chrono::Utc>,
    ) -> TBankResult<Self> {
        let readable = if config.use_readable_format {
            Self::format_readable(config, sequence_number, date)?
        } else {
            Self::format_digital(config, sequence_number, date)?
        };

        let tbank_format = Self::format_digital(config, sequence_number, date)?;

        Ok(Self {
            readable,
            tbank_format,
            sequence_number,
            created_date: date,
        })
    }

    /// Форматировать читаемый номер (АД/2026/01/26-00)
    fn format_readable(
        config: &NumberingConfig,
        sequence_number: i64,
        date: chrono::DateTime<chrono::Utc>,
    ) -> TBankResult<String> {
        let mut parts = Vec::new();

        // Префикс компании
        if !config.company_prefix.is_empty() {
            parts.push(config.company_prefix.clone());
        }

        // Год
        if config.include_year {
            parts.push(format!("{:04}", date.year()));
        }

        // Месяц
        if config.include_month {
            parts.push(format!("{:02}", date.month()));
        }

        // День
        if config.include_day {
            parts.push(format!("{:02}", date.day()));
        }

        let date_part = parts.join("/");
        let sequence_part = format!("{:0width$}", sequence_number, width = config.sequence_length);

        Ok(format!("{}-{}", date_part, sequence_part))
    }

    /// Форматировать цифровой номер для T-Bank (1260126000)
    fn format_digital(
        config: &NumberingConfig,
        sequence_number: i64,
        date: chrono::DateTime<chrono::Utc>,
    ) -> TBankResult<String> {
        let mut result = String::new();

        // Тип счета
        if config.invoice_type_prefix > 0 {
            result.push_str(&config.invoice_type_prefix.to_string());
        }

        // Год (2 цифры)
        if config.include_year {
            result.push_str(&format!("{:02}", date.year() % 100));
        }

        // Месяц
        if config.include_month {
            result.push_str(&format!("{:02}", date.month()));
        }

        // День
        if config.include_day {
            result.push_str(&format!("{:02}", date.day()));
        }

        // Последовательность
        let sequence_str = format!("{:0width$}", sequence_number, width = config.sequence_length);
        result.push_str(&sequence_str);

        // Проверка длины для T-Bank
        if result.len() > config.max_total_length {
            return Err(TBankError::ConfigurationError(format!(
                "Generated T-Bank number length {} exceeds maximum {}",
                result.len(), config.max_total_length
            )));
        }

        Ok(result)
    }

    /// Получить номер для отправки в T-Bank
    pub fn for_tbank(&self) -> &str {
        &self.tbank_format
    }

    /// Получить читаемый номер для документов
    pub fn for_documents(&self) -> &str {
        &self.readable
    }
}

impl std::fmt::Display for InvoiceNumber {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.readable)
    }
}