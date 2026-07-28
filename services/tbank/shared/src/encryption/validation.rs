use anyhow::Result;

/// Input validation utilities to prevent injection attacks
pub struct InputValidator;

impl InputValidator {
    /// Validate SQL input to prevent SQL injection
    pub fn validate_sql_input(input: &str) -> Result<()> {
        // Check for common SQL injection patterns
        let dangerous_patterns = [
            "';", "--", "/*", "*/", "xp_", "sp_", "exec", "execute", "union", "select", "insert",
            "update", "delete", "drop", "create", "alter", "truncate", "grant", "revoke",
        ];

        let input_lower = input.to_lowercase();
        for pattern in &dangerous_patterns {
            if input_lower.contains(pattern) {
                return Err(anyhow::anyhow!(
                    "Input contains potentially dangerous SQL pattern: {}",
                    pattern
                ));
            }
        }

        Ok(())
    }

    /// Validate email format
    pub fn validate_email(email: &str) -> Result<()> {
        let email_regex = regex::Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
            .map_err(|e| anyhow::anyhow!("Failed to compile email regex: {}", e))?;

        if !email_regex.is_match(email) {
            return Err(anyhow::anyhow!("Invalid email format"));
        }

        // Additional checks
        if email.len() > 254 {
            return Err(anyhow::anyhow!("Email too long"));
        }

        Ok(())
    }

    /// Validate UUID format
    pub fn validate_uuid(uuid_str: &str) -> Result<uuid::Uuid> {
        uuid::Uuid::parse_str(uuid_str).map_err(|e| anyhow::anyhow!("Invalid UUID format: {}", e))
    }

    /// Validate and sanitize HTML input
    pub fn sanitize_html(input: &str) -> String {
        // Remove potentially dangerous HTML tags and attributes
        let dangerous_tags = [
            "<script",
            "</script>",
            "<iframe",
            "</iframe>",
            "<object",
            "</object>",
            "<embed",
            "</embed>",
            "<form",
            "</form>",
            "<input",
            "<button",
            "javascript:",
            "vbscript:",
            "onload=",
            "onerror=",
            "onclick=",
        ];

        let mut sanitized = input.to_string();
        for tag in &dangerous_tags {
            sanitized = sanitized.replace(tag, "");
        }

        sanitized
    }

    /// Validate numeric input within range
    pub fn validate_numeric_range(value: f64, min: f64, max: f64) -> Result<()> {
        if value < min || value > max {
            return Err(anyhow::anyhow!(
                "Value {} is outside allowed range [{}, {}]",
                value,
                min,
                max
            ));
        }
        Ok(())
    }

    /// Validate string length
    pub fn validate_string_length(input: &str, min_len: usize, max_len: usize) -> Result<()> {
        let len = input.len();
        if len < min_len || len > max_len {
            return Err(anyhow::anyhow!(
                "String length {} is outside allowed range [{}, {}]",
                len,
                min_len,
                max_len
            ));
        }
        Ok(())
    }

    /// Validate that input contains only allowed characters
    pub fn validate_alphanumeric(input: &str) -> Result<()> {
        if !input
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
        {
            return Err(anyhow::anyhow!("Input contains invalid characters"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::encryption::{EncryptionService};
    use std::collections::HashMap;

    #[test]
    fn test_encryption_round_trip() {
        let key = EncryptionService::generate_key().unwrap();
        let service = EncryptionService::new(&key).unwrap();

        let plaintext = "sensitive data for 152-ФЗ compliance";
        let encrypted = service.encrypt(plaintext).unwrap();
        let decrypted = service.decrypt(&encrypted).unwrap();

        assert_eq!(plaintext, decrypted);
        assert_eq!(encrypted.algorithm, "AES-256-GCM");
        assert_eq!(encrypted.version, 1);
    }

    #[test]
    fn test_encryption_different_nonces() {
        let key = EncryptionService::generate_key().unwrap();
        let service = EncryptionService::new(&key).unwrap();

        let plaintext = "test data";
        let encrypted1 = service.encrypt(plaintext).unwrap();
        let encrypted2 = service.encrypt(plaintext).unwrap();

        // Same plaintext should produce different ciphertexts due to random nonces
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext);
        assert_ne!(encrypted1.nonce, encrypted2.nonce);

        // But both should decrypt to the same plaintext
        assert_eq!(service.decrypt(&encrypted1).unwrap(), plaintext);
        assert_eq!(service.decrypt(&encrypted2).unwrap(), plaintext);
    }

    #[test]
    fn test_field_encryption() {
        let key = EncryptionService::generate_key().unwrap();
        let service = EncryptionService::new(&key).unwrap();

        let mut data = HashMap::new();
        data.insert("email".to_string(), "user@example.com".to_string());
        data.insert("name".to_string(), "John Doe".to_string());
        data.insert("public_field".to_string(), "public data".to_string());

        let original_email = data["email"].clone();

        // Encrypt sensitive fields
        service
            .encrypt_fields(&mut data, &["email", "name"])
            .unwrap();

        // Encrypted fields should be different
        assert_ne!(data["email"], original_email);
        assert_eq!(data["public_field"], "public data"); // Unchanged

        // Decrypt fields
        service
            .decrypt_fields(&mut data, &["email", "name"])
            .unwrap();

        // Should be back to original
        assert_eq!(data["email"], original_email);
        assert_eq!(data["name"], "John Doe");
    }

    #[test]
    fn test_sql_injection_validation() {
        assert!(InputValidator::validate_sql_input("normal text").is_ok());
        assert!(InputValidator::validate_sql_input("user@example.com").is_ok());

        assert!(InputValidator::validate_sql_input("'; DROP TABLE users; --").is_err());
        assert!(InputValidator::validate_sql_input("1 UNION SELECT * FROM passwords").is_err());
        assert!(InputValidator::validate_sql_input("admin'/**/OR/**/1=1").is_err());
    }

    #[test]
    fn test_email_validation() {
        assert!(InputValidator::validate_email("user@example.com").is_ok());
        assert!(InputValidator::validate_email("test.email+tag@domain.co.uk").is_ok());

        assert!(InputValidator::validate_email("invalid-email").is_err());
        assert!(InputValidator::validate_email("@domain.com").is_err());
        assert!(InputValidator::validate_email("user@").is_err());
    }

    #[test]
    fn test_html_sanitization() {
        let clean = InputValidator::sanitize_html("Hello <b>world</b>");
        assert_eq!(clean, "Hello <b>world</b>");

        let malicious = InputValidator::sanitize_html("<script>alert('xss')</script>Hello");
        assert!(!malicious.contains("<script"));

        let onclick = InputValidator::sanitize_html("<div onclick='alert()'>Click me</div>");
        assert!(!onclick.contains("onclick="));
    }

    #[test]
    fn test_numeric_range_validation() {
        assert!(InputValidator::validate_numeric_range(5.0, 0.0, 10.0).is_ok());
        assert!(InputValidator::validate_numeric_range(-1.0, 0.0, 10.0).is_err());
        assert!(InputValidator::validate_numeric_range(15.0, 0.0, 10.0).is_err());
    }

    #[test]
    fn test_string_length_validation() {
        assert!(InputValidator::validate_string_length("hello", 3, 10).is_ok());
        assert!(InputValidator::validate_string_length("hi", 3, 10).is_err());
        assert!(InputValidator::validate_string_length("this is too long", 3, 10).is_err());
    }

    #[test]
    fn test_alphanumeric_validation() {
        assert!(InputValidator::validate_alphanumeric("user123").is_ok());
        assert!(InputValidator::validate_alphanumeric("test_user-name").is_ok());
        assert!(InputValidator::validate_alphanumeric("user@domain").is_err());
        assert!(InputValidator::validate_alphanumeric("user name").is_err());
    }
}