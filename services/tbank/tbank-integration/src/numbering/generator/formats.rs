use crate::numbering::sequence::SequenceType;
use crate::numbering::NumberingConfig;
use crate::types::{TBankError, TBankResult};

/// Number format builder for creating invoice numbers
pub struct NumberFormat {
    parts: Vec<FormatPart>,
    max_length: usize,
}

#[derive(Debug, Clone)]
enum FormatPart {
    TypePrefix(u8),
    Year(YearFormat),
    Month,
    Day,
    Sequence(usize), // padding length
    Literal(String),
}

#[derive(Debug, Clone)]
enum YearFormat {
    Full,    // YYYY
    Short,   // YY
}

impl NumberFormat {
    /// Create format from configuration
    pub fn from_config(config: &NumberingConfig, sequence_type: SequenceType) -> Self {
        let mut parts = Vec::new();

        // Add type prefix if configured
        if config.invoice_type_prefix > 0 {
            parts.push(FormatPart::TypePrefix(sequence_type.numeric_prefix()));
        }

        // Add year component
        if config.include_year {
            parts.push(FormatPart::Year(YearFormat::Short));
        }

        // Add month component
        if config.include_month {
            parts.push(FormatPart::Month);
        }

        // Add sequence number
        parts.push(FormatPart::Sequence(config.sequence_length));

        Self {
            parts,
            max_length: config.max_total_length,
        }
    }

    /// Build invoice number from components
    pub fn build(
        &self,
        year: Option<i32>,
        month: Option<u32>,
        sequence_number: i64,
    ) -> TBankResult<String> {
        let mut result = String::new();

        for part in &self.parts {
            match part {
                FormatPart::TypePrefix(prefix) => {
                    result.push_str(&prefix.to_string());
                }
                FormatPart::Year(format) => {
                    if let Some(year) = year {
                        match format {
                            YearFormat::Full => result.push_str(&format!("{:04}", year)),
                            YearFormat::Short => result.push_str(&format!("{:02}", year % 100)),
                        }
                    }
                }
                FormatPart::Month => {
                    if let Some(month) = month {
                        result.push_str(&format!("{:02}", month));
                    }
                }
                FormatPart::Day => {
                    // Day is not typically used in invoice numbers, but supported
                    result.push_str("01"); // Default to 01
                }
                FormatPart::Sequence(padding) => {
                    let sequence_str = format!("{:0width$}", sequence_number, width = padding);
                    if sequence_str.len() > *padding {
                        return Err(TBankError::ConfigurationError(format!(
                            "Sequence number {} exceeds padding length {}",
                            sequence_number, padding
                        )));
                    }
                    result.push_str(&sequence_str);
                }
                FormatPart::Literal(text) => {
                    result.push_str(text);
                }
            }
        }

        // Final length check
        if result.len() > self.max_length {
            return Err(TBankError::ConfigurationError(format!(
                "Generated invoice number length {} exceeds maximum {}",
                result.len(), self.max_length
            )));
        }

        Ok(result)
    }
}

/// Builder for custom format templates
pub struct FormatBuilder {
    template: String,
    type_prefix: Option<u8>,
    year: Option<i32>,
    month: Option<u32>,
    day: Option<u32>,
    sequence: Option<i64>,
}

impl FormatBuilder {
    /// Create new format builder with template
    pub fn new(template: &str) -> Self {
        Self {
            template: template.to_string(),
            type_prefix: None,
            year: None,
            month: None,
            day: None,
            sequence: None,
        }
    }

    /// Set type prefix
    pub fn with_type(mut self, type_prefix: u8) -> Self {
        self.type_prefix = Some(type_prefix);
        self
    }

    /// Set year
    pub fn with_year(mut self, year: i32) -> Self {
        self.year = Some(year);
        self
    }

    /// Set month
    pub fn with_month(mut self, month: u32) -> Self {
        self.month = Some(month);
        self
    }

    /// Set day
    pub fn with_day(mut self, day: u32) -> Self {
        self.day = Some(day);
        self
    }

    /// Set sequence number
    pub fn with_sequence(mut self, sequence: i64) -> Self {
        self.sequence = Some(sequence);
        self
    }

    /// Build the format
    pub fn build(self) -> TBankResult<CustomFormat> {
        Ok(CustomFormat {
            template: self.template,
            type_prefix: self.type_prefix,
            year: self.year,
            month: self.month,
            day: self.day,
            sequence: self.sequence,
        })
    }
}

/// Custom format for generating invoice numbers
pub struct CustomFormat {
    template: String,
    type_prefix: Option<u8>,
    year: Option<i32>,
    month: Option<u32>,
    day: Option<u32>,
    sequence: Option<i64>,
}

impl CustomFormat {
    /// Generate invoice number from template
    pub fn generate(&self) -> TBankResult<String> {
        let mut result = self.template.clone();

        // Replace placeholders
        if let Some(type_prefix) = self.type_prefix {
            result = result.replace("{type}", &type_prefix.to_string());
        }

        if let Some(year) = self.year {
            result = result.replace("{year}", &format!("{:02}", year % 100));
            result = result.replace("{year4}", &format!("{:04}", year));
        }

        if let Some(month) = self.month {
            result = result.replace("{month}", &format!("{:02}", month));
        }

        if let Some(day) = self.day {
            result = result.replace("{day}", &format!("{:02}", day));
        }

        if let Some(sequence) = self.sequence {
            result = result.replace("{seq}", &format!("{:06}", sequence));
            result = result.replace("{seq8}", &format!("{:08}", sequence));
            result = result.replace("{seq10}", &format!("{:010}", sequence));
        }

        // Ensure only digits
        if !result.chars().all(|c| c.is_ascii_digit()) {
            return Err(TBankError::ConfigurationError(
                "Custom format must result in digits-only number".to_string(),
            ));
        }

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::numbering::NumberingConfig;

    #[test]
    fn test_number_format_build() {
        let config = NumberingConfig::b2b_invoices();
        let format = NumberFormat::from_config(&config, SequenceType::B2BInvoice);

        let result = format.build(Some(2026), Some(1), 123).unwrap();
        // Expected: 1 (type) + 26 (year) + 01 (month) + 00000123 (sequence)
        assert_eq!(result, "12601000000123");
    }

    #[test]
    fn test_custom_format() {
        let format = FormatBuilder::new("{type}{year}{month}{seq8}")
            .with_type(1)
            .with_year(2026)
            .with_month(1)
            .with_sequence(123)
            .build()
            .unwrap();

        let result = format.generate().unwrap();
        assert_eq!(result, "126010000000123");
    }
}