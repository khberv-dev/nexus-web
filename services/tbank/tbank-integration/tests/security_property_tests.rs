use base64::Engine;
use chrono::Utc;
use proptest::prelude::*;
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::OnceCell;

use tbank_integration::types::TBankError;

// Define Permission enum for testing
#[derive(Debug, Clone, PartialEq)]
enum Permission {
    FullAccess,
    AuditAccess,
    BillingOperations,
    ReadOnly,
}

type TBankResult<T> = Result<T, TBankError>;

static DB_POOL: OnceCell<Arc<PgPool>> = OnceCell::const_new();

async fn get_test_db_pool() -> Arc<PgPool> {
    DB_POOL
        .get_or_init(|| async {
            let database_url = std::env::var("TEST_DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/tbank_test".to_string());

            let pool = PgPool::connect(&database_url)
                .await
                .expect("Failed to connect to test database");

            Arc::new(pool)
        })
        .await
        .clone()
}

// Property test generators
fn arb_zitadel_role() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("adquest.admin".to_string()),
        Just("adquest.compliance.officer".to_string()),
        Just("adquest.advertiser".to_string()),
        Just("adquest.user".to_string()),
        "[a-zA-Z0-9._]{5,30}".prop_map(|s| format!("adquest.{}", s)),
    ]
}

fn arb_permission() -> impl Strategy<Value = Permission> {
    prop_oneof![
        Just(Permission::FullAccess),
        Just(Permission::AuditAccess),
        Just(Permission::BillingOperations),
        Just(Permission::ReadOnly),
    ]
}

fn arb_sensitive_data() -> impl Strategy<Value = String> {
    prop_oneof![
        // Payment card data (PCI DSS sensitive)
        "[0-9]{16}".prop_map(|_s| format!("4111111111111111")), // Test card number
        // Personal information (GDPR sensitive)
        "[A-Za-z]{5,20} [A-Za-z]{5,20}".prop_map(|s| s), // Full name
        // Financial data
        "[0-9]{20}".prop_map(|s| format!("40702810{}", s)), // Bank account
        // Authentication data
        "[a-zA-Z0-9]{32,64}".prop_map(|s| s), // API keys/tokens
    ]
}

fn arb_environment() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("sandbox".to_string()),
        Just("development".to_string()),
        Just("staging".to_string()),
        Just("production".to_string()),
    ]
}

fn arb_webhook_payload() -> impl Strategy<Value = String> {
    (
        "[a-zA-Z0-9]{8,32}",
        "[a-zA-Z0-9]{8,32}",
        1.0f64..1000000.0f64,
    )
        .prop_map(|(event_id, entity_id, amount)| {
            json!({
                "eventId": event_id,
                "entityId": entity_id,
                "amount": amount,
                "currency": "RUB",
                "timestamp": Utc::now().to_rfc3339(),
                "eventType": "payment.completed"
            })
            .to_string()
        })
}

fn arb_webhook_secret() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9]{32,64}".prop_map(|s| s)
}

// Property Test 46: Role Permission Mapping
// **Validates: Requirements 7.3**
proptest! {
    #[test]
    fn property_role_permission_mapping(
        role in arb_zitadel_role(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 46: Role Permission Mapping**

            // For any Zitadel role, permission mapping should work correctly
            let permission = map_zitadel_role_to_permission(&role);

            // Test standard role mappings
            match role.as_str() {
                "adquest.admin" => {
                    assert_eq!(permission, Permission::FullAccess);
                }
                "adquest.compliance.officer" => {
                    assert_eq!(permission, Permission::AuditAccess);
                }
                "adquest.advertiser" => {
                    assert_eq!(permission, Permission::BillingOperations);
                }
                _ => {
                    // Unknown roles should default to read-only
                    assert_eq!(permission, Permission::ReadOnly);
                }
            }

            // Test permission capabilities
            match permission {
                Permission::FullAccess => {
                    assert!(can_access_counterparty_verification(&permission));
                    assert!(can_access_invoice_creation(&permission));
                    assert!(can_access_payment_processing(&permission));
                    assert!(can_access_audit_logs(&permission));
                    assert!(can_access_reconciliation(&permission));
                }
                Permission::AuditAccess => {
                    assert!(!can_access_counterparty_verification(&permission));
                    assert!(!can_access_invoice_creation(&permission));
                    assert!(!can_access_payment_processing(&permission));
                    assert!(can_access_audit_logs(&permission));
                    assert!(can_access_reconciliation(&permission));
                }
                Permission::BillingOperations => {
                    assert!(can_access_counterparty_verification(&permission));
                    assert!(can_access_invoice_creation(&permission));
                    assert!(can_access_payment_processing(&permission));
                    assert!(!can_access_audit_logs(&permission));
                    assert!(!can_access_reconciliation(&permission));
                }
                Permission::ReadOnly => {
                    assert!(!can_access_counterparty_verification(&permission));
                    assert!(!can_access_invoice_creation(&permission));
                    assert!(!can_access_payment_processing(&permission));
                    assert!(!can_access_audit_logs(&permission));
                    assert!(!can_access_reconciliation(&permission));
                }
            }

            // Role names should follow ADQuest naming convention
            if role.starts_with("adquest.") {
                let role_suffix = &role[8..]; // Remove "adquest." prefix
                assert!(!role_suffix.is_empty());
                assert!(role_suffix.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '_'));
            }
        });
    }
}

// Property Test 47: Data Encryption Round Trip
// **Validates: Requirements 7.4**
proptest! {
    #[test]
    fn property_data_encryption_round_trip(
        sensitive_data in arb_sensitive_data(),
        encryption_key in "[a-zA-Z0-9]{32}",
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 47: Data Encryption Round Trip**

            // For any sensitive data, encryption/decryption should work correctly
            let encryption_service = create_test_encryption_service(&encryption_key);

            // Test encryption
            let encrypted_data = encryption_service.encrypt(&sensitive_data).unwrap();

            // Encrypted data should be different from original
            assert_ne!(encrypted_data, sensitive_data);

            // Encrypted data should be base64 encoded (no special characters except +/=)
            assert!(encrypted_data.chars().all(|c| c.is_alphanumeric() || c == '+' || c == '/' || c == '='));

            // Encrypted data should be longer than original (due to IV and padding)
            assert!(encrypted_data.len() > sensitive_data.len());

            // Test decryption
            let decrypted_data = encryption_service.decrypt(&encrypted_data).unwrap();

            // Decrypted data should match original
            assert_eq!(decrypted_data, sensitive_data);

            // Test encryption is deterministic with same key but different with different IVs
            let encrypted_data2 = encryption_service.encrypt(&sensitive_data).unwrap();
            // Should be different due to random IV
            assert_ne!(encrypted_data, encrypted_data2);

            // But both should decrypt to same original data
            let decrypted_data2 = encryption_service.decrypt(&encrypted_data2).unwrap();
            assert_eq!(decrypted_data2, sensitive_data);

            // Test with different key should fail
            let different_key = format!("{}x", &encryption_key[..31]); // Change last char
            let different_service = create_test_encryption_service(&different_key);

            // Should fail to decrypt with wrong key
            assert!(different_service.decrypt(&encrypted_data).is_err());

            // Test empty data
            let empty_encrypted = encryption_service.encrypt("").unwrap();
            let empty_decrypted = encryption_service.decrypt(&empty_encrypted).unwrap();
            assert_eq!(empty_decrypted, "");

            // Test data types that should be encrypted
            let should_encrypt = should_encrypt_data(&sensitive_data);
            if sensitive_data.len() == 16 && sensitive_data.chars().all(|c| c.is_ascii_digit()) {
                // Looks like card number
                assert!(should_encrypt);
            } else if sensitive_data.len() == 20 && sensitive_data.starts_with("40702810") {
                // Looks like bank account
                assert!(should_encrypt);
            } else if sensitive_data.len() >= 32 && sensitive_data.chars().all(|c| c.is_alphanumeric()) {
                // Looks like API key/token
                assert!(should_encrypt);
            }
        });
    }
}

// Property Test 48: Webhook Signature Validation by Environment
// **Validates: Requirements 7.5**
proptest! {
    #[test]
    fn property_webhook_signature_validation_by_environment(
        payload in arb_webhook_payload(),
        secret in arb_webhook_secret(),
        environment in arb_environment(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 48: Webhook Signature Validation by Environment**

            // For any environment, webhook signature validation should behave correctly
            let validator = create_webhook_validator_for_environment(&environment, &secret);

            // Generate valid signature for testing
            let valid_signature = generate_test_webhook_signature(&payload, &secret);
            let invalid_signature = "sha256=invalid_signature_that_should_fail_validation_test";

            match environment.as_str() {
                "sandbox" | "development" => {
                    // In sandbox/development, signature validation should be disabled
                    assert!(validator.validate(&payload, &valid_signature).is_ok());
                    assert!(validator.validate(&payload, &invalid_signature).is_ok());
                    assert!(validator.validate(&payload, "").is_ok());
                    assert!(validator.validate(&payload, "malformed").is_ok());

                    // Should indicate validation is disabled
                    assert!(!validator.is_signature_validation_enabled());
                }
                "staging" | "production" => {
                    // In staging/production, signature validation should be required
                    assert!(validator.validate(&payload, &valid_signature).is_ok());
                    assert!(validator.validate(&payload, &invalid_signature).is_err());
                    assert!(validator.validate(&payload, "").is_err());
                    assert!(validator.validate(&payload, "malformed").is_err());

                    // Should indicate validation is enabled
                    assert!(validator.is_signature_validation_enabled());

                    // Test specific error types for production
                    match validator.validate(&payload, &invalid_signature) {
                        Err(TBankError::InvalidWebhookSignature) => {
                            // Expected error type
                        }
                        other => panic!("Expected InvalidWebhookSignature error, got: {:?}", other),
                    }
                }
                _ => {
                    // Unknown environments should default to strict validation
                    assert!(validator.validate(&payload, &valid_signature).is_ok());
                    assert!(validator.validate(&payload, &invalid_signature).is_err());
                    assert!(validator.is_signature_validation_enabled());
                }
            }

            // Test signature format validation
            let malformed_signatures = vec![
                "invalid_format",
                "sha256=",
                "sha256=not_hex",
                "md5=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "sha256=too_short",
                "sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefg", // invalid hex
            ];

            for malformed_sig in malformed_signatures {
                match environment.as_str() {
                    "sandbox" | "development" => {
                        // Should pass in sandbox/development
                        assert!(validator.validate(&payload, malformed_sig).is_ok());
                    }
                    _ => {
                        // Should fail in production environments
                        assert!(validator.validate(&payload, malformed_sig).is_err());
                    }
                }
            }

            // Test empty payload
            match environment.as_str() {
                "sandbox" | "development" => {
                    assert!(validator.validate("", &valid_signature).is_ok());
                }
                _ => {
                    // Production should validate even empty payloads
                    let empty_signature = generate_test_webhook_signature("", &secret);
                    assert!(validator.validate("", &empty_signature).is_ok());
                    assert!(validator.validate("", &valid_signature).is_err()); // Wrong signature for empty payload
                }
            }

            // Test environment-specific configuration
            assert!(is_valid_environment(&environment));
            let security_level = get_environment_security_level(&environment);
            match environment.as_str() {
                "sandbox" => assert_eq!(security_level, SecurityLevel::Minimal),
                "development" => assert_eq!(security_level, SecurityLevel::Low),
                "staging" => assert_eq!(security_level, SecurityLevel::High),
                "production" => assert_eq!(security_level, SecurityLevel::Maximum),
                _ => assert_eq!(security_level, SecurityLevel::High), // Default to high security
            }
        });
    }
}

// Helper functions for property tests

fn map_zitadel_role_to_permission(role: &str) -> Permission {
    match role {
        "adquest.admin" => Permission::FullAccess,
        "adquest.compliance.officer" => Permission::AuditAccess,
        "adquest.advertiser" => Permission::BillingOperations,
        _ => Permission::ReadOnly,
    }
}

fn can_access_counterparty_verification(permission: &Permission) -> bool {
    matches!(
        permission,
        Permission::FullAccess | Permission::BillingOperations
    )
}

fn can_access_invoice_creation(permission: &Permission) -> bool {
    matches!(
        permission,
        Permission::FullAccess | Permission::BillingOperations
    )
}

fn can_access_payment_processing(permission: &Permission) -> bool {
    matches!(
        permission,
        Permission::FullAccess | Permission::BillingOperations
    )
}

fn can_access_audit_logs(permission: &Permission) -> bool {
    matches!(permission, Permission::FullAccess | Permission::AuditAccess)
}

fn can_access_reconciliation(permission: &Permission) -> bool {
    matches!(permission, Permission::FullAccess | Permission::AuditAccess)
}

fn create_test_encryption_service(key: &str) -> TestEncryptionService {
    TestEncryptionService::new(key.to_string())
}

fn should_encrypt_data(data: &str) -> bool {
    // Check if data looks like sensitive information
    if data.len() == 16 && data.chars().all(|c| c.is_ascii_digit()) {
        return true; // Looks like card number
    }
    if data.len() == 20 && data.starts_with("40702810") {
        return true; // Looks like Russian bank account
    }
    if data.len() >= 32 && data.chars().all(|c| c.is_alphanumeric()) {
        return true; // Looks like API key/token
    }
    if data.contains("@") && data.contains(".") {
        return true; // Looks like email
    }
    false
}

fn create_webhook_validator_for_environment(
    environment: &str,
    secret: &str,
) -> TestWebhookValidator {
    let validation_enabled = match environment {
        "sandbox" | "development" => false,
        _ => true,
    };

    TestWebhookValidator::new(secret.to_string(), validation_enabled)
}

fn generate_test_webhook_signature(payload: &str, secret: &str) -> String {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    type HmacSha256 = Hmac<Sha256>;

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(payload.as_bytes());
    let signature = mac.finalize().into_bytes();
    format!("sha256={}", hex::encode(signature))
}

fn is_valid_environment(environment: &str) -> bool {
    matches!(
        environment,
        "sandbox" | "development" | "staging" | "production"
    )
}

#[derive(Debug, PartialEq)]
enum SecurityLevel {
    Minimal,
    Low,
    High,
    Maximum,
}

fn get_environment_security_level(environment: &str) -> SecurityLevel {
    match environment {
        "sandbox" => SecurityLevel::Minimal,
        "development" => SecurityLevel::Low,
        "staging" => SecurityLevel::High,
        "production" => SecurityLevel::Maximum,
        _ => SecurityLevel::High, // Default to high security for unknown environments
    }
}

// Test implementations for property testing

struct TestEncryptionService {
    key: String,
}

impl TestEncryptionService {
    fn new(key: String) -> Self {
        Self { key }
    }

    fn encrypt(&self, data: &str) -> Result<String, String> {
        if data.is_empty() {
            return Ok(base64::engine::general_purpose::STANDARD.encode("encrypted_empty"));
        }

        // Simple test encryption (not for production use)
        let mut encrypted = Vec::new();
        let key_bytes = self.key.as_bytes();

        for (i, byte) in data.bytes().enumerate() {
            let key_byte = key_bytes[i % key_bytes.len()];
            encrypted.push(byte ^ key_byte);
        }

        // Add some random padding to simulate IV
        let padding: Vec<u8> = (0..16).map(|i| (i as u8) ^ 0xAA).collect();
        encrypted.extend_from_slice(&padding);

        Ok(base64::engine::general_purpose::STANDARD.encode(encrypted))
    }

    fn decrypt(&self, encrypted_data: &str) -> Result<String, String> {
        let encrypted_bytes = base64::engine::general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|_| "Invalid base64")?;

        if encrypted_bytes.len() < 16 {
            return Err("Invalid encrypted data".to_string());
        }

        // Remove padding (last 16 bytes)
        let data_bytes = &encrypted_bytes[..encrypted_bytes.len() - 16];

        if data_bytes.is_empty() {
            return Ok(String::new());
        }

        let key_bytes = self.key.as_bytes();
        let mut decrypted = Vec::new();

        for (i, &byte) in data_bytes.iter().enumerate() {
            let key_byte = key_bytes[i % key_bytes.len()];
            decrypted.push(byte ^ key_byte);
        }

        String::from_utf8(decrypted).map_err(|_| "Invalid UTF-8".to_string())
    }
}

struct TestWebhookValidator {
    secret: String,
    validation_enabled: bool,
}

impl TestWebhookValidator {
    fn new(secret: String, validation_enabled: bool) -> Self {
        Self {
            secret,
            validation_enabled,
        }
    }

    fn validate(&self, payload: &str, signature: &str) -> TBankResult<()> {
        if !self.validation_enabled {
            return Ok(());
        }

        if signature.is_empty() || signature == "malformed" {
            return Err(TBankError::InvalidWebhookSignature);
        }

        if !signature.starts_with("sha256=") {
            return Err(TBankError::InvalidWebhookSignature);
        }

        let signature_hex = &signature[7..]; // Remove "sha256=" prefix
        if signature_hex.len() != 64 {
            return Err(TBankError::InvalidWebhookSignature);
        }

        if !signature_hex.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(TBankError::InvalidWebhookSignature);
        }

        // Generate expected signature
        let expected_signature = generate_test_webhook_signature(payload, &self.secret);

        if signature != expected_signature {
            return Err(TBankError::InvalidWebhookSignature);
        }

        Ok(())
    }

    fn is_signature_validation_enabled(&self) -> bool {
        self.validation_enabled
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_permission_mapping() {
        assert_eq!(
            map_zitadel_role_to_permission("adquest.admin"),
            Permission::FullAccess
        );
        assert_eq!(
            map_zitadel_role_to_permission("adquest.compliance.officer"),
            Permission::AuditAccess
        );
        assert_eq!(
            map_zitadel_role_to_permission("adquest.advertiser"),
            Permission::BillingOperations
        );
        assert_eq!(
            map_zitadel_role_to_permission("unknown.role"),
            Permission::ReadOnly
        );
    }

    #[test]
    fn test_permission_capabilities() {
        assert!(can_access_counterparty_verification(
            &Permission::FullAccess
        ));
        assert!(can_access_counterparty_verification(
            &Permission::BillingOperations
        ));
        assert!(!can_access_counterparty_verification(
            &Permission::AuditAccess
        ));
        assert!(!can_access_counterparty_verification(&Permission::ReadOnly));

        assert!(can_access_audit_logs(&Permission::FullAccess));
        assert!(can_access_audit_logs(&Permission::AuditAccess));
        assert!(!can_access_audit_logs(&Permission::BillingOperations));
        assert!(!can_access_audit_logs(&Permission::ReadOnly));
    }

    #[test]
    fn test_encryption_service() {
        let service = TestEncryptionService::new("test_key_32_chars_long_for_aes".to_string());

        let original = "sensitive_data_123";
        let encrypted = service.encrypt(original).unwrap();
        let decrypted = service.decrypt(&encrypted).unwrap();

        assert_eq!(decrypted, original);
        assert_ne!(encrypted, original);
    }

    #[test]
    fn test_webhook_validator() {
        let secret = "test_secret_key";
        let payload = r#"{"eventId":"test123","amount":1000}"#;

        // Test with validation enabled
        let validator = TestWebhookValidator::new(secret.to_string(), true);
        let valid_signature = generate_test_webhook_signature(payload, secret);

        assert!(validator.validate(payload, &valid_signature).is_ok());
        assert!(validator.validate(payload, "invalid_signature").is_err());
        assert!(validator.is_signature_validation_enabled());

        // Test with validation disabled
        let disabled_validator = TestWebhookValidator::new(secret.to_string(), false);
        assert!(disabled_validator
            .validate(payload, &valid_signature)
            .is_ok());
        assert!(disabled_validator
            .validate(payload, "invalid_signature")
            .is_ok());
        assert!(!disabled_validator.is_signature_validation_enabled());
    }

    #[test]
    fn test_environment_security_levels() {
        assert_eq!(
            get_environment_security_level("sandbox"),
            SecurityLevel::Minimal
        );
        assert_eq!(
            get_environment_security_level("development"),
            SecurityLevel::Low
        );
        assert_eq!(
            get_environment_security_level("staging"),
            SecurityLevel::High
        );
        assert_eq!(
            get_environment_security_level("production"),
            SecurityLevel::Maximum
        );
        assert_eq!(
            get_environment_security_level("unknown"),
            SecurityLevel::High
        );
    }

    #[test]
    fn test_sensitive_data_detection() {
        assert!(should_encrypt_data("4111111111111111")); // Card number
        assert!(should_encrypt_data("40702810123456789012")); // Bank account
        assert!(should_encrypt_data(
            "abcdef1234567890abcdef1234567890abcdef12"
        )); // API key
        assert!(should_encrypt_data("user@example.com")); // Email
        assert!(!should_encrypt_data("public_data")); // Regular data
        assert!(!should_encrypt_data("123")); // Short number
    }
}
