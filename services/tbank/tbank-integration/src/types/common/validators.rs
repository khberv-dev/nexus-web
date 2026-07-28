use crate::types::{TBankError, TBankResult};
use regex::Regex;
use std::sync::OnceLock;
use tracing::{debug, warn};

/// Email format validator with comprehensive validation rules
pub struct EmailValidator;

impl EmailValidator {
    /// Validate email format according to RFC 5322 basic rules
    pub fn validate(email: &str) -> TBankResult<()> {
        debug!(email = %email, "Validating email format");

        // Basic checks
        if email.trim().is_empty() {
            warn!("Empty email provided");
            return Err(TBankError::ValidationError(
                "Email cannot be empty".to_string(),
            ));
        }

        if email.len() > 254 {
            warn!(email_length = email.len(), "Email too long");
            return Err(TBankError::ValidationError(
                "Email address too long (max 254 characters)".to_string(),
            ));
        }

        // Must contain exactly one @
        let at_count = email.matches('@').count();
        if at_count != 1 {
            warn!(at_count = at_count, "Invalid @ count in email");
            return Err(TBankError::ValidationError(
                "Email must contain exactly one @ symbol".to_string(),
            ));
        }

        // Split into local and domain parts
        let parts: Vec<&str> = email.split('@').collect();
        let local_part = parts[0];
        let domain_part = parts[1];

        // Validate local part
        Self::validate_local_part(local_part)?;
        
        // Validate domain part
        Self::validate_domain_part(domain_part)?;

        debug!(email = %email, "Email validation passed");
        Ok(())
    }

    /// Validate the local part (before @)
    fn validate_local_part(local: &str) -> TBankResult<()> {
        if local.is_empty() {
            return Err(TBankError::ValidationError(
                "Email local part cannot be empty".to_string(),
            ));
        }

        if local.len() > 64 {
            return Err(TBankError::ValidationError(
                "Email local part too long (max 64 characters)".to_string(),
            ));
        }

        // Cannot start or end with dot
        if local.starts_with('.') || local.ends_with('.') {
            return Err(TBankError::ValidationError(
                "Email local part cannot start or end with dot".to_string(),
            ));
        }

        // Cannot have consecutive dots
        if local.contains("..") {
            return Err(TBankError::ValidationError(
                "Email local part cannot contain consecutive dots".to_string(),
            ));
        }

        // Basic character validation (simplified)
        let valid_chars = local.chars().all(|c| {
            c.is_ascii_alphanumeric() || "!#$%&'*+-/=?^_`{|}~.".contains(c)
        });

        if !valid_chars {
            return Err(TBankError::ValidationError(
                "Email local part contains invalid characters".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate the domain part (after @)
    fn validate_domain_part(domain: &str) -> TBankResult<()> {
        if domain.is_empty() {
            return Err(TBankError::ValidationError(
                "Email domain part cannot be empty".to_string(),
            ));
        }

        if domain.len() > 253 {
            return Err(TBankError::ValidationError(
                "Email domain part too long (max 253 characters)".to_string(),
            ));
        }

        // Must contain at least one dot
        if !domain.contains('.') {
            return Err(TBankError::ValidationError(
                "Email domain must contain at least one dot".to_string(),
            ));
        }

        // Cannot start or end with dot or hyphen
        if domain.starts_with('.') || domain.ends_with('.') || 
           domain.starts_with('-') || domain.ends_with('-') {
            return Err(TBankError::ValidationError(
                "Email domain cannot start or end with dot or hyphen".to_string(),
            ));
        }

        // Validate domain labels
        let labels: Vec<&str> = domain.split('.').collect();
        for label in labels {
            if label.is_empty() {
                return Err(TBankError::ValidationError(
                    "Email domain cannot have empty labels".to_string(),
                ));
            }

            if label.len() > 63 {
                return Err(TBankError::ValidationError(
                    "Email domain label too long (max 63 characters)".to_string(),
                ));
            }

            // Label must start and end with alphanumeric
            let first_char = label.chars().next().unwrap();
            let last_char = label.chars().last().unwrap();
            
            if !first_char.is_ascii_alphanumeric() || !last_char.is_ascii_alphanumeric() {
                return Err(TBankError::ValidationError(
                    "Email domain labels must start and end with alphanumeric characters".to_string(),
                ));
            }

            // Label can only contain alphanumeric and hyphens
            let valid_chars = label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
            if !valid_chars {
                return Err(TBankError::ValidationError(
                    "Email domain labels can only contain alphanumeric characters and hyphens".to_string(),
                ));
            }
        }

        Ok(())
    }

    /// Quick validation for simple cases (less strict)
    pub fn validate_simple(email: &str) -> bool {
        if email.trim().is_empty() || email.len() > 254 {
            return false;
        }

        let at_count = email.matches('@').count();
        if at_count != 1 {
            return false;
        }

        let parts: Vec<&str> = email.split('@').collect();
        let local_part = parts[0];
        let domain_part = parts[1];

        !local_part.is_empty() && 
        !domain_part.is_empty() && 
        domain_part.contains('.') &&
        local_part.len() <= 64 &&
        domain_part.len() <= 253
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_emails() {
        let valid_emails = vec![
            "test@example.com",
            "user.name@domain.co.uk",
            "user+tag@example.org",
            "user_name@example-domain.com",
            "123@example.com",
            "test.email.with+symbol@example.com",
        ];

        for email in valid_emails {
            assert!(EmailValidator::validate(email).is_ok(), "Should be valid: {}", email);
            assert!(EmailValidator::validate_simple(email), "Should be valid (simple): {}", email);
        }
    }

    #[test]
    fn test_invalid_emails() {
        let invalid_emails = vec![
            "",                           // Empty
            "invalid",                    // No @
            "@domain.com",               // No local part
            "user@",                     // No domain
            "user@@domain.com",          // Multiple @
            "user@domain",               // No TLD
            ".user@domain.com",          // Starts with dot
            "user.@domain.com",          // Ends with dot
            "us..er@domain.com",         // Consecutive dots
            "user@.domain.com",          // Domain starts with dot
            "user@domain.com.",          // Domain ends with dot
            "user@domain..com",          // Consecutive dots in domain
        ];

        for email in invalid_emails {
            assert!(EmailValidator::validate(email).is_err(), "Should be invalid: {}", email);
            assert!(!EmailValidator::validate_simple(email), "Should be invalid (simple): {}", email);
        }
    }

    #[test]
    fn test_email_length_limits() {
        // Test local part length limit (64 characters)
        let long_local = "a".repeat(65);
        let email = format!("{}@example.com", long_local);
        assert!(EmailValidator::validate(&email).is_err());

        // Test domain part length limit (253 characters)
        let long_domain = format!("{}.com", "a".repeat(249));
        let email = format!("user@{}", long_domain);
        assert!(EmailValidator::validate(&email).is_err());

        // Test total email length limit (254 characters)
        let long_email = format!("{}@{}", "a".repeat(100), "b".repeat(150));
        assert!(EmailValidator::validate(&long_email).is_err());
    }
}