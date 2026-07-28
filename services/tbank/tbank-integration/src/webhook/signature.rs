use hmac::{Hmac, Mac};
use sha2::Sha256;
use tracing::{debug, error, warn};

use crate::types::{TBankError, TBankResult};

type HmacSha256 = Hmac<Sha256>;

/// Webhook signature validator for T-Bank webhooks
pub struct WebhookSignatureValidator {
    secret: String,
    enabled: bool,
}

impl WebhookSignatureValidator {
    /// Create new webhook signature validator
    pub fn new(secret: String) -> Self {
        let enabled = !secret.is_empty();

        if !enabled {
            warn!("Webhook signature validation is disabled (empty secret)");
        } else {
            debug!("Webhook signature validation enabled");
        }

        Self { secret, enabled }
    }

    /// Create validator with signature validation disabled (for sandbox)
    pub fn disabled() -> Self {
        Self {
            secret: String::new(),
            enabled: false,
        }
    }

    /// Validate webhook signature using HMAC-SHA256
    pub fn validate(&self, payload: &str, signature: &str) -> TBankResult<()> {
        if !self.enabled {
            debug!("Webhook signature validation is disabled, skipping");
            return Ok(());
        }

        debug!(
            payload_size = payload.len(),
            signature_length = signature.len(),
            "Validating webhook signature"
        );

        // Parse signature (expected format: "sha256=<hex_signature>")
        let signature_hex = self.parse_signature(signature)?;

        // Create HMAC
        let mut mac = HmacSha256::new_from_slice(self.secret.as_bytes()).map_err(|e| {
            error!(error = %e, "Failed to create HMAC instance");
            TBankError::SecurityError("Invalid webhook secret".to_string())
        })?;

        // Update HMAC with payload
        mac.update(payload.as_bytes());

        // Compute expected signature
        let expected_signature = mac.finalize().into_bytes();
        let expected_hex = hex::encode(expected_signature);

        // Compare signatures using constant-time comparison
        if self.constant_time_compare(&signature_hex, &expected_hex) {
            debug!("Webhook signature validation successful");
            Ok(())
        } else {
            error!(
                provided_signature = %signature_hex,
                expected_signature = %expected_hex,
                "Webhook signature validation failed"
            );
            Err(TBankError::InvalidWebhookSignature)
        }
    }

    /// Parse signature from header value
    fn parse_signature(&self, signature: &str) -> TBankResult<String> {
        // Expected format: "sha256=<hex_signature>"
        if let Some(hex_part) = signature.strip_prefix("sha256=") {
            if hex_part.len() == 64 && hex_part.chars().all(|c| c.is_ascii_hexdigit()) {
                Ok(hex_part.to_lowercase())
            } else {
                error!(
                    signature = %signature,
                    hex_part = %hex_part,
                    "Invalid signature format: hex part is not 64 hex characters"
                );
                Err(TBankError::InvalidWebhookSignature)
            }
        } else {
            error!(
                signature = %signature,
                "Invalid signature format: missing 'sha256=' prefix"
            );
            Err(TBankError::InvalidWebhookSignature)
        }
    }

    /// Constant-time string comparison to prevent timing attacks
    fn constant_time_compare(&self, a: &str, b: &str) -> bool {
        if a.len() != b.len() {
            return false;
        }

        let mut result = 0u8;
        for (byte_a, byte_b) in a.bytes().zip(b.bytes()) {
            result |= byte_a ^ byte_b;
        }

        result == 0
    }

    /// Check if signature validation is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Generate signature for testing purposes
    #[cfg(test)]
    pub fn generate_signature(&self, payload: &str) -> TBankResult<String> {
        if !self.enabled {
            return Err(TBankError::SecurityError(
                "Signature validation is disabled".to_string(),
            ));
        }

        let mut mac = HmacSha256::new_from_slice(self.secret.as_bytes()).map_err(|e| {
            error!(error = %e, "Failed to create HMAC instance for signature generation");
            TBankError::SecurityError("Invalid webhook secret".to_string())
        })?;

        mac.update(payload.as_bytes());
        let signature = mac.finalize().into_bytes();
        let hex_signature = hex::encode(signature);

        Ok(format!("sha256={}", hex_signature))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signature_validation_success() {
        let secret = "test_secret_key";
        let validator = WebhookSignatureValidator::new(secret.to_string());
        let payload = r#"{"eventId":"test123","eventType":"invoice.paid"}"#;

        // Generate valid signature
        let signature = validator.generate_signature(payload).unwrap();

        // Validate signature
        assert!(validator.validate(payload, &signature).is_ok());
    }

    #[test]
    fn test_signature_validation_failure() {
        let secret = "test_secret_key";
        let validator = WebhookSignatureValidator::new(secret.to_string());
        let payload = r#"{"eventId":"test123","eventType":"invoice.paid"}"#;

        // Use invalid signature
        let invalid_signature = "sha256=invalid_signature_hex_value_that_is_exactly_64_chars_long";

        // Validate signature should fail
        assert!(validator.validate(payload, invalid_signature).is_err());
    }

    #[test]
    fn test_signature_validation_disabled() {
        let validator = WebhookSignatureValidator::disabled();
        let payload = r#"{"eventId":"test123","eventType":"invoice.paid"}"#;
        let signature = "any_invalid_signature";

        // Should succeed when disabled
        assert!(validator.validate(payload, signature).is_ok());
    }

    #[test]
    fn test_parse_signature_valid() {
        let validator = WebhookSignatureValidator::new("secret".to_string());
        let signature = "sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

        let result = validator.parse_signature(signature);
        assert!(result.is_ok());
        assert_eq!(
            result.unwrap(),
            "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        );
    }

    #[test]
    fn test_parse_signature_invalid_format() {
        let validator = WebhookSignatureValidator::new("secret".to_string());

        // Missing prefix
        let signature1 = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        assert!(validator.parse_signature(signature1).is_err());

        // Wrong prefix
        let signature2 = "md5=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        assert!(validator.parse_signature(signature2).is_err());

        // Wrong length
        let signature3 = "sha256=abcdef123456";
        assert!(validator.parse_signature(signature3).is_err());

        // Non-hex characters
        let signature4 = "sha256=ghijkl1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        assert!(validator.parse_signature(signature4).is_err());
    }

    #[test]
    fn test_constant_time_compare() {
        let validator = WebhookSignatureValidator::new("secret".to_string());

        // Same strings
        assert!(validator.constant_time_compare("abc123", "abc123"));

        // Different strings same length
        assert!(!validator.constant_time_compare("abc123", "def456"));

        // Different lengths
        assert!(!validator.constant_time_compare("abc", "abcdef"));
        assert!(!validator.constant_time_compare("abcdef", "abc"));
    }
}
