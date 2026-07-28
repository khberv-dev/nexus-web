use regex::Regex;
use std::sync::OnceLock;

use crate::types::{TBankError, TBankResult};

/// Validator for invoice numbers according to T-Bank API requirements
pub struct InvoiceNumberValidator {
    tbank_regex: &'static Regex,
}

impl InvoiceNumberValidator {
    /// Create new validator
    pub fn new() -> Self {
        static TBANK_REGEX: OnceLock<Regex> = OnceLock::new();
        let tbank_regex = TBANK_REGEX.get_or_init(|| {
            Regex::new(r"^\d{1,15}$").expect("Invalid T-Bank regex pattern")
        });

        Self { tbank_regex }
    }

    /// Validate invoice number for T-Bank API compatibility
    pub fn validate(&self, invoice_number: &str) -> TBankResult<()> {
        // Check T-Bank format: 1-15 digits only
        if !self.tbank_regex.is_match(invoice_number) {
            return Err(TBankError::ValidationError(format!(
                "Invoice number '{}' must be 1-15 digits only (T-Bank requirement)",
                invoice_number
            )));
        }

        // Additional validations
        self.validate_length(invoice_number)?;
        self.validate_content(invoice_number)?;
        self.validate_business_rules(invoice_number)?;

        Ok(())
    }

    /// Validate invoice number length
    fn validate_length(&self, invoice_number: &str) -> TBankResult<()> {
        let len = invoice_number.len();
        
        if len == 0 {
            return Err(TBankError::ValidationError(
                "Invoice number cannot be empty".to_string(),
            ));
        }

        if len > 15 {
            return Err(TBankError::ValidationError(format!(
                "Invoice number length {} exceeds T-Bank maximum of 15 digits",
                len
            )));
        }

        Ok(())
    }

    /// Validate invoice number content
    fn validate_content(&self, invoice_number: &str) -> TBankResult<()> {
        // Check for only ASCII digits
        if !invoice_number.chars().all(|c| c.is_ascii_digit()) {
            return Err(TBankError::ValidationError(
                "Invoice number must contain only digits (0-9)".to_string(),
            ));
        }

        // Check for leading zeros (business rule)
        if invoice_number.len() > 1 && invoice_number.starts_with('0') {
            // Allow leading zeros only for specific patterns
            if !self.is_valid_zero_pattern(invoice_number) {
                return Err(TBankError::ValidationError(
                    "Invoice number should not have unnecessary leading zeros".to_string(),
                ));
            }
        }

        Ok(())
    }

    /// Check if zero pattern is valid (e.g., padded sequences)
    fn is_valid_zero_pattern(&self, invoice_number: &str) -> bool {
        // Allow patterns like 000000000001, 001234567890, etc.
        // These are valid for sequential numbering systems
        invoice_number.len() >= 10 // Assume padded if 10+ digits
    }

    /// Validate business rules
    fn validate_business_rules(&self, invoice_number: &str) -> TBankResult<()> {
        // Check for obviously invalid patterns
        if invoice_number == "0" {
            return Err(TBankError::ValidationError(
                "Invoice number cannot be just '0'".to_string(),
            ));
        }

        // Check for repeating patterns that might indicate errors
        if self.is_suspicious_pattern(invoice_number) {
            return Err(TBankError::ValidationError(format!(
                "Invoice number '{}' contains suspicious repeating pattern",
                invoice_number
            )));
        }

        Ok(())
    }

    /// Check for suspicious repeating patterns
    fn is_suspicious_pattern(&self, invoice_number: &str) -> bool {
        if invoice_number.len() < 4 {
            return false;
        }

        // Check for all same digits (except valid cases like 000000000001)
        let first_char = invoice_number.chars().next().unwrap();
        let all_same = invoice_number.chars().all(|c| c == first_char);
        
        if all_same {
            // Allow all zeros if it's a padded format
            if first_char == '0' && invoice_number.len() >= 10 {
                return false;
            }
            // Reject other all-same patterns like 1111111, 9999999
            return first_char != '0';
        }

        // Check for simple repeating patterns like 123123123
        if invoice_number.len() >= 6 {
            let pattern_len = invoice_number.len() / 3;
            if pattern_len >= 2 {
                let pattern = &invoice_number[..pattern_len];
                let repeated = pattern.repeat(3);
                if repeated == invoice_number {
                    return true;
                }
            }
        }

        false
    }

    /// Validate and suggest corrections
    pub fn validate_with_suggestions(&self, invoice_number: &str) -> Result<(), (TBankError, Vec<String>)> {
        match self.validate(invoice_number) {
            Ok(()) => Ok(()),
            Err(error) => {
                let suggestions = self.generate_suggestions(invoice_number);
                Err((error, suggestions))
            }
        }
    }

    /// Generate suggestions for invalid invoice numbers
    fn generate_suggestions(&self, invoice_number: &str) -> Vec<String> {
        let mut suggestions = Vec::new();

        // If too long, suggest truncation
        if invoice_number.len() > 15 {
            suggestions.push(format!(
                "Truncate to 15 digits: {}",
                &invoice_number[..15]
            ));
        }

        // If contains non-digits, suggest digit-only version
        if !invoice_number.chars().all(|c| c.is_ascii_digit()) {
            let digits_only: String = invoice_number.chars().filter(|c| c.is_ascii_digit()).collect();
            if !digits_only.is_empty() && digits_only.len() <= 15 {
                suggestions.push(format!("Use digits only: {}", digits_only));
            }
        }

        // If empty or invalid, suggest timestamp-based
        if invoice_number.is_empty() || suggestions.is_empty() {
            let timestamp = chrono::Utc::now().timestamp();
            suggestions.push(format!("Use timestamp-based: {}", timestamp % 1000000000000));
        }

        suggestions
    }

    /// Check if invoice number format matches expected pattern
    pub fn matches_pattern(&self, invoice_number: &str, pattern: &InvoiceNumberPattern) -> bool {
        match pattern {
            InvoiceNumberPattern::TBankCompliant => self.tbank_regex.is_match(invoice_number),
            InvoiceNumberPattern::Sequential => {
                invoice_number.len() >= 8 && invoice_number.chars().all(|c| c.is_ascii_digit())
            }
            InvoiceNumberPattern::Timestamped => {
                invoice_number.len() >= 10 && invoice_number.chars().all(|c| c.is_ascii_digit())
            }
            InvoiceNumberPattern::TypePrefixed => {
                invoice_number.len() >= 5 
                    && invoice_number.chars().all(|c| c.is_ascii_digit())
                    && matches!(invoice_number.chars().next(), Some('1'..='9'))
            }
        }
    }
}

/// Patterns for invoice number validation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvoiceNumberPattern {
    /// T-Bank compliant: 1-15 digits
    TBankCompliant,
    /// Sequential: 8+ digits, padded
    Sequential,
    /// Timestamp-based: 10+ digits
    Timestamped,
    /// Type-prefixed: starts with 1-9, 5+ digits
    TypePrefixed,
}

impl Default for InvoiceNumberValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_invoice_numbers() {
        let validator = InvoiceNumberValidator::new();

        // Valid T-Bank format numbers
        let valid_numbers = vec![
            "1",
            "123",
            "1234567890",
            "123456789012345", // 15 digits (max)
            "000000000001",    // Padded sequence
            "126010000001",    // Type-prefixed with date
        ];

        for number in valid_numbers {
            assert!(validator.validate(number).is_ok(), "Should be valid: {}", number);
        }
    }

    #[test]
    fn test_invalid_invoice_numbers() {
        let validator = InvoiceNumberValidator::new();

        // Invalid numbers
        let invalid_numbers = vec![
            "",                    // Empty
            "1234567890123456",    // Too long (16 digits)
            "12345abc",            // Contains letters
            "12-345",              // Contains hyphen
            "0",                   // Just zero
            "1111111111",          // Suspicious pattern
        ];

        for number in invalid_numbers {
            assert!(validator.validate(number).is_err(), "Should be invalid: {}", number);
        }
    }

    #[test]
    fn test_pattern_matching() {
        let validator = InvoiceNumberValidator::new();

        assert!(validator.matches_pattern("123456789", &InvoiceNumberPattern::TBankCompliant));
        assert!(validator.matches_pattern("000000001", &InvoiceNumberPattern::Sequential));
        assert!(validator.matches_pattern("1234567890", &InvoiceNumberPattern::Timestamped));
        assert!(validator.matches_pattern("12345", &InvoiceNumberPattern::TypePrefixed));
        
        assert!(!validator.matches_pattern("0123", &InvoiceNumberPattern::TypePrefixed)); // Starts with 0
    }

    #[test]
    fn test_suggestions() {
        let validator = InvoiceNumberValidator::new();

        let (_, suggestions) = validator.validate_with_suggestions("INV-2024-001").unwrap_err();
        assert!(!suggestions.is_empty());
        assert!(suggestions[0].contains("2024001"));
    }

    #[test]
    fn test_suspicious_patterns() {
        let validator = InvoiceNumberValidator::new();

        assert!(validator.is_suspicious_pattern("1111111"));
        assert!(validator.is_suspicious_pattern("123123123"));
        assert!(!validator.is_suspicious_pattern("000000001")); // Valid padded
        assert!(!validator.is_suspicious_pattern("1234567890")); // No pattern
    }
}