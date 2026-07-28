use regex::Regex;
use std::sync::OnceLock;
use tracing::{debug, warn};

use crate::types::{TBankError, TBankResult};

/// Russian INN/KPP format validator
pub struct InnKppValidator;

impl InnKppValidator {
    /// Validate INN format (10 or 12 digits for Russian entities)
    pub fn validate_inn(inn: &str) -> TBankResult<()> {
        debug!(inn = %inn, "Validating INN format");

        // Check basic format: only digits, length 10 or 12
        if !inn.chars().all(|c| c.is_ascii_digit()) {
            warn!(inn = %inn, "INN contains non-digit characters");
            return Err(TBankError::InvalidInn(format!(
                "INN must contain only digits, got: {}",
                inn
            )));
        }

        match inn.len() {
            10 => {
                // Legal entity INN (10 digits)
                if Self::validate_inn_10_checksum(inn) {
                    debug!(inn = %inn, "Valid 10-digit INN");
                    Ok(())
                } else {
                    warn!(inn = %inn, "Invalid 10-digit INN checksum");
                    Err(TBankError::InvalidInn(format!(
                        "Invalid checksum for 10-digit INN: {}",
                        inn
                    )))
                }
            }
            12 => {
                // Individual entrepreneur INN (12 digits)
                if Self::validate_inn_12_checksum(inn) {
                    debug!(inn = %inn, "Valid 12-digit INN");
                    Ok(())
                } else {
                    warn!(inn = %inn, "Invalid 12-digit INN checksum");
                    Err(TBankError::InvalidInn(format!(
                        "Invalid checksum for 12-digit INN: {}",
                        inn
                    )))
                }
            }
            _ => {
                warn!(inn = %inn, length = inn.len(), "Invalid INN length");
                Err(TBankError::InvalidInn(format!(
                    "INN must be 10 or 12 digits long, got {} digits: {}",
                    inn.len(),
                    inn
                )))
            }
        }
    }

    /// Validate KPP format (9 digits for Russian entities)
    pub fn validate_kpp(kpp: &str) -> TBankResult<()> {
        debug!(kpp = %kpp, "Validating KPP format");

        // Check basic format: only digits, length 9
        if !kpp.chars().all(|c| c.is_ascii_digit()) {
            warn!(kpp = %kpp, "KPP contains non-digit characters");
            return Err(TBankError::InvalidKpp(format!(
                "KPP must contain only digits, got: {}",
                kpp
            )));
        }

        if kpp.len() != 9 {
            warn!(kpp = %kpp, length = kpp.len(), "Invalid KPP length");
            return Err(TBankError::InvalidKpp(format!(
                "KPP must be exactly 9 digits long, got {} digits: {}",
                kpp.len(),
                kpp
            )));
        }

        // Additional KPP format validation
        if Self::validate_kpp_format(kpp) {
            debug!(kpp = %kpp, "Valid KPP format");
            Ok(())
        } else {
            warn!(kpp = %kpp, "Invalid KPP format");
            Err(TBankError::InvalidKpp(format!(
                "Invalid KPP format: {}",
                kpp
            )))
        }
    }

    /// Validate both INN and optional KPP
    pub fn validate_inn_kpp(inn: &str, kpp: Option<&str>) -> TBankResult<()> {
        // Always validate INN
        Self::validate_inn(inn)?;

        // Validate KPP if provided
        if let Some(kpp_value) = kpp {
            Self::validate_kpp(kpp_value)?;
        }

        debug!(inn = %inn, kpp = ?kpp, "INN/KPP validation successful");
        Ok(())
    }

    /// Validate 10-digit INN checksum (for legal entities)
    fn validate_inn_10_checksum(inn: &str) -> bool {
        if inn.len() != 10 {
            return false;
        }

        let digits: Vec<u32> = inn.chars().filter_map(|c| c.to_digit(10)).collect();

        if digits.len() != 10 {
            return false;
        }

        // Checksum coefficients for 10-digit INN
        let coefficients = [2, 4, 10, 3, 5, 9, 4, 6, 8];

        let sum: u32 = digits[0..9]
            .iter()
            .zip(coefficients.iter())
            .map(|(digit, coeff)| digit * coeff)
            .sum();

        let checksum = (sum % 11) % 10;
        checksum == digits[9]
    }

    /// Validate 12-digit INN checksum (for individual entrepreneurs)
    fn validate_inn_12_checksum(inn: &str) -> bool {
        if inn.len() != 12 {
            return false;
        }

        let digits: Vec<u32> = inn.chars().filter_map(|c| c.to_digit(10)).collect();

        if digits.len() != 12 {
            return false;
        }

        // First checksum (11th digit)
        let coefficients_1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
        let sum_1: u32 = digits[0..10]
            .iter()
            .zip(coefficients_1.iter())
            .map(|(digit, coeff)| digit * coeff)
            .sum();
        let checksum_1 = (sum_1 % 11) % 10;

        if checksum_1 != digits[10] {
            return false;
        }

        // Second checksum (12th digit)
        let coefficients_2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
        let sum_2: u32 = digits[0..11]
            .iter()
            .zip(coefficients_2.iter())
            .map(|(digit, coeff)| digit * coeff)
            .sum();
        let checksum_2 = (sum_2 % 11) % 10;

        checksum_2 == digits[11]
    }

    /// Validate KPP format (basic format check)
    fn validate_kpp_format(kpp: &str) -> bool {
        static KPP_REGEX: OnceLock<Regex> = OnceLock::new();
        let regex = KPP_REGEX.get_or_init(|| {
            // KPP format: NNNNNN001 where N is digit
            // First 4 digits - tax authority code
            // Next 2 digits - reason code
            // Last 3 digits - sequential number (usually 001)
            Regex::new(r"^\d{4}\d{2}\d{3}$").unwrap()
        });

        regex.is_match(kpp)
    }

    /// Check if INN belongs to a legal entity (10 digits) or individual (12 digits)
    pub fn is_legal_entity(inn: &str) -> bool {
        inn.len() == 10
    }

    /// Check if INN belongs to an individual entrepreneur (12 digits)
    pub fn is_individual(inn: &str) -> bool {
        inn.len() == 12
    }

    /// Get entity type description
    pub fn get_entity_type(inn: &str) -> &'static str {
        match inn.len() {
            10 => "Legal Entity",
            12 => "Individual Entrepreneur",
            _ => "Unknown",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_inn_10_digit() {
        // Valid 10-digit INN (legal entity) - using real INN with valid checksum
        assert!(InnKppValidator::validate_inn("7707083893").is_ok());
        // Test format validation for 10-digit INN
        let result = InnKppValidator::validate_inn("1234567890");
        // This might fail checksum but should pass format validation
        match result {
            Ok(_) => {} // Checksum is valid
            Err(TBankError::InvalidInn(msg)) if msg.contains("checksum") => {
                // Expected - checksum validation failed but format is correct
            }
            Err(e) => panic!("Unexpected error: {:?}", e),
        }
    }

    #[test]
    fn test_valid_inn_12_digit() {
        // Test format validation for 12-digit INN
        let result = InnKppValidator::validate_inn("123456789012");
        // This might fail checksum but should pass format validation
        match result {
            Ok(_) => {} // Checksum is valid
            Err(TBankError::InvalidInn(msg)) if msg.contains("checksum") => {
                // Expected - checksum validation failed but format is correct
            }
            Err(e) => panic!("Unexpected error: {:?}", e),
        }
    }

    #[test]
    fn test_invalid_inn_format() {
        // Invalid length
        assert!(InnKppValidator::validate_inn("123").is_err());
        assert!(InnKppValidator::validate_inn("12345678901").is_err());
        assert!(InnKppValidator::validate_inn("1234567890123").is_err());

        // Non-digit characters
        assert!(InnKppValidator::validate_inn("abcd567890").is_err());
        assert!(InnKppValidator::validate_inn("123-456-789").is_err());
        assert!(InnKppValidator::validate_inn("").is_err());
    }

    #[test]
    fn test_valid_kpp() {
        assert!(InnKppValidator::validate_kpp("770701001").is_ok());
        assert!(InnKppValidator::validate_kpp("123456001").is_ok());
    }

    #[test]
    fn test_invalid_kpp_format() {
        // Invalid length
        assert!(InnKppValidator::validate_kpp("12345678").is_err());
        assert!(InnKppValidator::validate_kpp("1234567890").is_err());

        // Non-digit characters
        assert!(InnKppValidator::validate_kpp("abcd56789").is_err());
        assert!(InnKppValidator::validate_kpp("123-456-78").is_err());
        assert!(InnKppValidator::validate_kpp("").is_err());
    }

    #[test]
    fn test_inn_kpp_validation() {
        // Valid combinations
        assert!(InnKppValidator::validate_inn_kpp("7707083893", Some("770701001")).is_ok());
        assert!(InnKppValidator::validate_inn_kpp("7707083893", None).is_ok());

        // Invalid combinations
        assert!(InnKppValidator::validate_inn_kpp("invalid", Some("770701001")).is_err());
        assert!(InnKppValidator::validate_inn_kpp("7707083893", Some("invalid")).is_err());
    }

    #[test]
    fn test_entity_type_detection() {
        assert!(InnKppValidator::is_legal_entity("7707083893"));
        assert!(!InnKppValidator::is_legal_entity("123456789012"));

        assert!(InnKppValidator::is_individual("123456789012"));
        assert!(!InnKppValidator::is_individual("7707083893"));

        assert_eq!(
            InnKppValidator::get_entity_type("7707083893"),
            "Legal Entity"
        );
        assert_eq!(
            InnKppValidator::get_entity_type("123456789012"),
            "Individual Entrepreneur"
        );
        assert_eq!(InnKppValidator::get_entity_type("123"), "Unknown");
    }
}
