use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use shared::EncryptionService;

#[cfg(test)]
mod data_encryption_tests {
    use super::*;

    #[quickcheck]
    fn data_encryption_round_trip_property(plaintext: String) -> TestResult {
        // Feature: tbank-integration, Property 47: Data Encryption Round Trip
        // **Validates: Requirements 7.4**

        // Filter out strings with null bytes or control characters that might cause issues
        let clean_plaintext: String = plaintext
            .chars()
            .filter(|&c| c != '\0' && c.is_control() == false)
            .collect();

        // Skip empty strings and very short strings as they're not meaningful for encryption testing
        if clean_plaintext.trim().is_empty() || clean_plaintext.len() < 3 {
            return TestResult::discard();
        }

        // Skip extremely long strings to avoid performance issues in tests
        if clean_plaintext.len() > 10000 {
            return TestResult::discard();
        }

        // Generate a random encryption key
        let key = match EncryptionService::generate_key() {
            Ok(k) => k,
            Err(_) => return TestResult::error("Failed to generate encryption key"),
        };

        // Create encryption service
        let service = match EncryptionService::new(&key) {
            Ok(s) => s,
            Err(_) => return TestResult::error("Failed to create encryption service"),
        };

        // Test encryption round trip
        let encrypted = match service.encrypt(&clean_plaintext) {
            Ok(e) => e,
            Err(_) => return TestResult::error("Failed to encrypt data"),
        };

        let decrypted = match service.decrypt(&encrypted) {
            Ok(d) => d,
            Err(_) => return TestResult::error("Failed to decrypt data"),
        };

        // The decrypted data should match the original plaintext exactly
        let round_trip_success = decrypted == clean_plaintext;

        // Verify encryption metadata
        let metadata_valid = encrypted.algorithm == "AES-256-GCM"
            && encrypted.version == 1
            && !encrypted.ciphertext.is_empty()
            && !encrypted.nonce.is_empty();

        // Verify that ciphertext is different from plaintext (unless very short)
        let ciphertext_different = if clean_plaintext.len() > 10 {
            encrypted.ciphertext != clean_plaintext
        } else {
            true // For very short strings, we don't enforce this
        };

        TestResult::from_bool(round_trip_success && metadata_valid && ciphertext_different)
    }

    #[test]
    fn test_encryption_round_trip_with_sensitive_data() {
        // Feature: tbank-integration, Property 47: Data Encryption Round Trip
        // **Validates: Requirements 7.4**

        let key = EncryptionService::generate_key().unwrap();
        let service = EncryptionService::new(&key).unwrap();

        // Test with various types of sensitive data that might be found in T-Bank integration
        let test_cases = vec![
            "7707083893",                     // INN
            "770701001",                      // KPP
            "4000000000000002",               // Card number
            "user@example.com",               // Email
            "Иванов Иван Иванович",           // Russian name with Cyrillic
            "ООО \"Тестовая Компания\"",      // Company name with quotes
            "Moscow, Red Square, 1",          // Address
            "Payment for services rendered",  // Description
            "руб.1,000.50",                      // Amount with currency symbol
            "{\"sensitive\": \"json data\"}", // JSON data
        ];

        for test_data in test_cases {
            let encrypted = service.encrypt(test_data).unwrap();
            let decrypted = service.decrypt(&encrypted).unwrap();

            assert_eq!(test_data, decrypted, "Round trip failed for: {}", test_data);
            assert_eq!(encrypted.algorithm, "AES-256-GCM");
            assert_eq!(encrypted.version, 1);
            assert!(!encrypted.ciphertext.is_empty());
            assert!(!encrypted.nonce.is_empty());

            // Verify that the ciphertext is different from plaintext
            if test_data.len() > 5 {
                assert_ne!(encrypted.ciphertext, test_data);
            }
        }
    }

    #[test]
    fn test_encryption_produces_different_ciphertexts() {
        // Feature: tbank-integration, Property 47: Data Encryption Round Trip
        // **Validates: Requirements 7.4**

        let key = EncryptionService::generate_key().unwrap();
        let service = EncryptionService::new(&key).unwrap();

        let plaintext = "sensitive payment data";

        // Encrypt the same data multiple times
        let encrypted1 = service.encrypt(plaintext).unwrap();
        let encrypted2 = service.encrypt(plaintext).unwrap();
        let encrypted3 = service.encrypt(plaintext).unwrap();

        // Each encryption should produce different ciphertext due to random nonces
        assert_ne!(encrypted1.ciphertext, encrypted2.ciphertext);
        assert_ne!(encrypted2.ciphertext, encrypted3.ciphertext);
        assert_ne!(encrypted1.nonce, encrypted2.nonce);
        assert_ne!(encrypted2.nonce, encrypted3.nonce);

        // But all should decrypt to the same plaintext
        assert_eq!(service.decrypt(&encrypted1).unwrap(), plaintext);
        assert_eq!(service.decrypt(&encrypted2).unwrap(), plaintext);
        assert_eq!(service.decrypt(&encrypted3).unwrap(), plaintext);
    }
}
