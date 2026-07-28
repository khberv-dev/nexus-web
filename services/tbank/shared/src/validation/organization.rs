use crate::errors::ADQuestError;

/// Common organization validation functions
pub struct OrganizationValidator;

impl OrganizationValidator {
    /// Validate organization name
    pub fn validate_name(name: &str) -> Result<(), ADQuestError> {
        if name.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "Organization name cannot be empty".to_string(),
            ));
        }

        if name.len() < 3 {
            return Err(ADQuestError::Validation(
                "Organization name must be at least 3 characters".to_string(),
            ));
        }

        if name.len() > 100 {
            return Err(ADQuestError::Validation(
                "Organization name must not exceed 100 characters".to_string(),
            ));
        }

        // Check for invalid characters
        if name.chars().any(|c| c.is_control() || c == '\0') {
            return Err(ADQuestError::Validation(
                "Organization name contains invalid characters".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate organization email
    pub fn validate_email(email: &str) -> Result<(), ADQuestError> {
        if email.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "Email cannot be empty".to_string(),
            ));
        }

        let email_regex = regex::Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
            .map_err(|e| ADQuestError::Internal(format!("Failed to compile email regex: {}", e)))?;

        if !email_regex.is_match(email) {
            return Err(ADQuestError::Validation(
                "Invalid email format".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate owner name
    pub fn validate_owner_name(first_name: &str, last_name: &str) -> Result<(), ADQuestError> {
        if first_name.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "First name cannot be empty".to_string(),
            ));
        }

        if last_name.trim().is_empty() {
            return Err(ADQuestError::Validation(
                "Last name cannot be empty".to_string(),
            ));
        }

        if first_name.len() > 50 {
            return Err(ADQuestError::Validation(
                "First name must not exceed 50 characters".to_string(),
            ));
        }

        if last_name.len() > 50 {
            return Err(ADQuestError::Validation(
                "Last name must not exceed 50 characters".to_string(),
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name_success() {
        assert!(OrganizationValidator::validate_name("Valid Name").is_ok());
        assert!(OrganizationValidator::validate_name("ABC").is_ok());
        assert!(OrganizationValidator::validate_name("A".repeat(100).as_str()).is_ok());
    }

    #[test]
    fn test_validate_name_failures() {
        assert!(OrganizationValidator::validate_name("").is_err());
        assert!(OrganizationValidator::validate_name("  ").is_err());
        assert!(OrganizationValidator::validate_name("AB").is_err());
        assert!(OrganizationValidator::validate_name(&"A".repeat(101)).is_err());
    }

    #[test]
    fn test_validate_email_success() {
        assert!(OrganizationValidator::validate_email("test@example.com").is_ok());
        assert!(OrganizationValidator::validate_email("user.name+tag@domain.co.uk").is_ok());
    }

    #[test]
    fn test_validate_email_failures() {
        assert!(OrganizationValidator::validate_email("").is_err());
        assert!(OrganizationValidator::validate_email("invalid-email").is_err());
        assert!(OrganizationValidator::validate_email("@domain.com").is_err());
        assert!(OrganizationValidator::validate_email("user@").is_err());
    }

    #[test]
    fn test_validate_owner_name_success() {
        assert!(OrganizationValidator::validate_owner_name("John", "Doe").is_ok());
    }

    #[test]
    fn test_validate_owner_name_failures() {
        assert!(OrganizationValidator::validate_owner_name("", "Doe").is_err());
        assert!(OrganizationValidator::validate_owner_name("John", "").is_err());
        assert!(OrganizationValidator::validate_owner_name(&"A".repeat(51), "Doe").is_err());
    }
}