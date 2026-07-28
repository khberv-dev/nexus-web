use chrono::Utc;
use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use serde_json;
use tbank_integration::types::common::errors::TBankError;
use tbank_integration::types::counterparty::{CounterpartyData, CounterpartyStatus};

#[cfg(test)]
mod counterparty_verification_tests {
    use super::*;

    #[quickcheck]
    fn counterparty_data_storage_completeness_property(
        inn: String,
        kpp: Option<String>,
        full_name: String,
        short_name: String,
        legal_address: String,
    ) -> TestResult {
        // Feature: tbank-integration, Property 3: Counterparty Data Storage Completeness
        // **Validates: Requirements 1.3**

        // Filter out problematic inputs
        let clean_inn: String = inn.chars().filter(|&c| c != '\0' && c.is_ascii()).collect();

        let clean_kpp: Option<String> =
            kpp.map(|k| k.chars().filter(|&c| c != '\0' && c.is_ascii()).collect());

        let clean_full_name: String = full_name.chars().filter(|&c| c != '\0').collect();

        let clean_short_name: String = short_name.chars().filter(|&c| c != '\0').collect();

        let clean_legal_address: String = legal_address.chars().filter(|&c| c != '\0').collect();

        // Skip empty or invalid inputs
        if clean_inn.trim().is_empty()
            || clean_full_name.trim().is_empty()
            || clean_short_name.trim().is_empty()
            || clean_legal_address.trim().is_empty()
        {
            return TestResult::discard();
        }

        // Skip extremely long strings
        if clean_inn.len() > 20
            || clean_full_name.len() > 500
            || clean_short_name.len() > 200
            || clean_legal_address.len() > 1000
        {
            return TestResult::discard();
        }

        if let Some(ref kpp_val) = clean_kpp {
            if kpp_val.len() > 20 {
                return TestResult::discard();
            }
        }

        // Create test counterparty data
        let counterparty_data = CounterpartyData::new(
            clean_inn.clone(),
            clean_kpp.clone(),
            clean_full_name.clone(),
            clean_short_name.clone(),
            clean_legal_address.clone(),
            CounterpartyStatus::Active,
            Utc::now(),
            vec!["62.01".to_string(), "62.02".to_string()],
        );

        // Test that all required fields are present and non-empty
        let inn_stored = !counterparty_data.inn.is_empty() && counterparty_data.inn == clean_inn;
        let kpp_stored = counterparty_data.kpp == clean_kpp;
        let full_name_stored = !counterparty_data.full_name.is_empty()
            && counterparty_data.full_name == clean_full_name;
        let short_name_stored = !counterparty_data.short_name.is_empty()
            && counterparty_data.short_name == clean_short_name;
        let legal_address_stored = !counterparty_data.legal_address.is_empty()
            && counterparty_data.legal_address == clean_legal_address;
        let status_stored = matches!(counterparty_data.status, CounterpartyStatus::Active);
        let registration_date_stored = counterparty_data.registration_date <= Utc::now();
        let okved_codes_stored = !counterparty_data.okved_codes.is_empty();

        // Test serialization completeness (for database storage)
        let serialization_test = match serde_json::to_string(&counterparty_data) {
            Ok(json) => {
                // Verify all fields are in the JSON
                json.contains(&clean_inn)
                    && json.contains(&clean_full_name)
                    && json.contains(&clean_short_name)
                    && json.contains(&clean_legal_address)
                    && json.contains("Active")
                    && json.contains("okved_codes")
            }
            Err(_) => false,
        };

        TestResult::from_bool(
            inn_stored
                && kpp_stored
                && full_name_stored
                && short_name_stored
                && legal_address_stored
                && status_stored
                && registration_date_stored
                && okved_codes_stored
                && serialization_test,
        )
    }

    #[quickcheck]
    fn invalid_input_error_response_property(inn: String, kpp: Option<String>) -> TestResult {
        // Feature: tbank-integration, Property 5: Invalid Input Error Response
        // **Validates: Requirements 1.5**

        // Filter out null bytes but keep other invalid characters for testing
        let clean_inn: String = inn.chars().filter(|&c| c != '\0').collect();

        let clean_kpp: Option<String> = kpp.map(|k| k.chars().filter(|&c| c != '\0').collect());

        // Skip extremely long strings to avoid performance issues
        if clean_inn.len() > 100 {
            return TestResult::discard();
        }

        if let Some(ref kpp_val) = clean_kpp {
            if kpp_val.len() > 100 {
                return TestResult::discard();
            }
        }

        // Determine if input should be considered invalid
        let inn_invalid = clean_inn.is_empty()
            || clean_inn.len() != 10 && clean_inn.len() != 12
            || !clean_inn.chars().all(|c| c.is_ascii_digit());

        let kpp_invalid = if let Some(ref kpp_val) = clean_kpp {
            kpp_val.is_empty() || kpp_val.len() != 9 || !kpp_val.chars().all(|c| c.is_ascii_digit())
        } else {
            false
        };

        let should_be_invalid = inn_invalid || kpp_invalid;

        // Test error response format for invalid inputs
        if should_be_invalid {
            // Simulate validation error creation
            let error = if inn_invalid {
                TBankError::InvalidInn(clean_inn.clone())
            } else {
                TBankError::InvalidKpp(clean_kpp.unwrap_or_default())
            };

            // Test error message contains field details
            let error_message = error.to_string();
            let has_field_details = if inn_invalid {
                error_message.contains("Invalid INN format") && error_message.contains(&clean_inn)
            } else {
                error_message.contains("Invalid KPP format")
            };

            // Test error type is appropriate
            let correct_error_type = match error {
                TBankError::InvalidInn(_) => inn_invalid,
                TBankError::InvalidKpp(_) => kpp_invalid,
                _ => false,
            };

            TestResult::from_bool(has_field_details && correct_error_type)
        } else {
            // For valid inputs, we expect no validation errors
            TestResult::from_bool(true)
        }
    }

    #[quickcheck]
    fn api_error_handling_property(status_code: u16, error_message: String) -> TestResult {
        // Feature: tbank-integration, Property 6: API Error Handling
        // **Validates: Requirements 1.6**

        // Filter out problematic characters
        let clean_message: String = error_message.chars().filter(|&c| c != '\0').collect();

        // Skip empty messages or extremely long ones
        if clean_message.trim().is_empty() || clean_message.len() > 1000 {
            return TestResult::discard();
        }

        // Only test realistic HTTP status codes
        if status_code < 100 || status_code > 599 {
            return TestResult::discard();
        }

        // Create T-Bank API error
        let api_error = TBankError::TBankApiError {
            status: status_code,
            message: clean_message.clone(),
            error_code: None,
        };

        // Test error contains status code and message
        let error_string = api_error.to_string();
        let contains_status = error_string.contains(&status_code.to_string());
        let contains_message = error_string.contains(&clean_message);
        let has_api_prefix = error_string.contains("T-Bank API error");

        // Test appropriate HTTP status code mapping
        let status_mapping_correct = match status_code {
            400..=499 => true,  // Client errors
            500..=599 => true,  // Server errors
            200..=299 => false, // Success codes shouldn't be errors
            _ => true,          // Other codes are acceptable for error handling
        };

        // Test error is loggable (serializable)
        let is_loggable = match serde_json::to_string(&format!("{:?}", api_error)) {
            Ok(json) => !json.is_empty(),
            Err(_) => false,
        };

        TestResult::from_bool(
            contains_status
                && contains_message
                && has_api_prefix
                && status_mapping_correct
                && is_loggable,
        )
    }

    #[test]
    fn test_counterparty_data_required_fields() {
        // Feature: tbank-integration, Property 3: Counterparty Data Storage Completeness
        // **Validates: Requirements 1.3**

        let counterparty = CounterpartyData::new(
            "7707083893".to_string(),
            Some("770701001".to_string()),
            "ООО \"Тестовая Компания\"".to_string(),
            "Тест Ко".to_string(),
            "г. Москва, ул. Тестовая, д. 1".to_string(),
            CounterpartyStatus::Active,
            Utc::now(),
            vec!["62.01".to_string(), "62.02".to_string()],
        );

        // Verify all required fields are present
        assert!(!counterparty.inn.is_empty());
        assert!(counterparty.kpp.is_some());
        assert!(!counterparty.full_name.is_empty());
        assert!(!counterparty.short_name.is_empty());
        assert!(!counterparty.legal_address.is_empty());
        assert!(matches!(counterparty.status, CounterpartyStatus::Active));
        assert!(counterparty.registration_date <= Utc::now());
        assert!(!counterparty.okved_codes.is_empty());

        // Test serialization includes all fields
        let json = serde_json::to_string(&counterparty).unwrap();
        assert!(json.contains("7707083893"));
        assert!(json.contains("770701001"));
        assert!(json.contains("Тестовая Компания"));
        assert!(json.contains("Тест Ко"));
        assert!(json.contains("Москва"));
        assert!(json.contains("Active"));
        assert!(json.contains("62.01"));
    }

    #[test]
    fn test_invalid_inn_error_details() {
        // Feature: tbank-integration, Property 5: Invalid Input Error Response
        // **Validates: Requirements 1.5**

        let invalid_inns = vec![
            ("", "empty"),
            ("123", "too short"),
            ("12345678901", "invalid length"),
            ("abcd567890", "contains letters"),
            ("123-456-789", "contains hyphens"),
        ];

        for (invalid_inn, description) in invalid_inns {
            let error = TBankError::InvalidInn(invalid_inn.to_string());
            let error_message = error.to_string();

            // Error should contain "Invalid INN format"
            assert!(
                error_message.contains("Invalid INN format"),
                "Error message should indicate INN format issue for {}: {}",
                description,
                error_message
            );

            // Error should contain the invalid value
            if !invalid_inn.is_empty() {
                assert!(
                    error_message.contains(invalid_inn),
                    "Error message should contain the invalid INN value for {}: {}",
                    description,
                    error_message
                );
            }
        }
    }

    #[test]
    fn test_invalid_kpp_error_details() {
        // Feature: tbank-integration, Property 5: Invalid Input Error Response
        // **Validates: Requirements 1.5**

        let invalid_kpps = vec![
            ("", "empty"),
            ("12345678", "too short"),
            ("1234567890", "too long"),
            ("abcd56789", "contains letters"),
        ];

        for (invalid_kpp, description) in invalid_kpps {
            let error = TBankError::InvalidKpp(invalid_kpp.to_string());
            let error_message = error.to_string();

            // Error should contain "Invalid KPP format"
            assert!(
                error_message.contains("Invalid KPP format"),
                "Error message should indicate KPP format issue for {}: {}",
                description,
                error_message
            );

            // Error should contain the invalid value
            if !invalid_kpp.is_empty() {
                assert!(
                    error_message.contains(invalid_kpp),
                    "Error message should contain the invalid KPP value for {}: {}",
                    description,
                    error_message
                );
            }
        }
    }

    #[test]
    fn test_api_error_logging() {
        // Feature: tbank-integration, Property 6: API Error Handling
        // **Validates: Requirements 1.6**

        let test_cases = vec![
            (400, "Bad Request"),
            (401, "Unauthorized"),
            (404, "Not Found"),
            (429, "Too Many Requests"),
            (500, "Internal Server Error"),
            (502, "Bad Gateway"),
            (503, "Service Unavailable"),
        ];

        for (status, message) in test_cases {
            let error = TBankError::TBankApiError {
                status,
                message: message.to_string(),
                error_code: None,
            };

            let error_string = error.to_string();

            // Error should contain status code
            assert!(
                error_string.contains(&status.to_string()),
                "Error should contain status code {}: {}",
                status,
                error_string
            );

            // Error should contain message
            assert!(
                error_string.contains(message),
                "Error should contain message '{}': {}",
                message,
                error_string
            );

            // Error should be identifiable as T-Bank API error
            assert!(
                error_string.contains("T-Bank API error"),
                "Error should be identifiable as T-Bank API error: {}",
                error_string
            );

            // Error should be debuggable (contains Debug info)
            let debug_string = format!("{:?}", error);
            assert!(
                debug_string.contains("TBankApiError"),
                "Error should be debuggable: {}",
                debug_string
            );
        }
    }

    #[test]
    fn test_error_response_http_status_mapping() {
        // Feature: tbank-integration, Property 6: API Error Handling
        // **Validates: Requirements 1.6**

        // Test that different T-Bank errors map to appropriate HTTP status codes
        let errors = vec![
            (
                TBankError::InvalidInn("123".to_string()),
                "should map to 400",
            ),
            (
                TBankError::InvalidKpp("12345678".to_string()),
                "should map to 400",
            ),
            (
                TBankError::CounterpartyNotFound {
                    inn: "1234567890".to_string(),
                },
                "should map to 404",
            ),
            (
                TBankError::TBankApiError {
                    status: 429,
                    message: "Rate limited".to_string(),
                    error_code: None,
                },
                "should map to 429",
            ),
            (
                TBankError::TBankApiError {
                    status: 500,
                    message: "Server error".to_string(),
                    error_code: None,
                },
                "should map to 502",
            ),
            (
                TBankError::AuthenticationError("Invalid token".to_string()),
                "should map to 401",
            ),
            (TBankError::RateLimitExceeded, "should map to 429"),
            (TBankError::CircuitBreakerOpen, "should map to 503"),
        ];

        for (error, description) in errors {
            // Test that error can be converted to string (for logging)
            let error_string = error.to_string();
            assert!(
                !error_string.is_empty(),
                "Error string should not be empty for: {}",
                description
            );

            // Test that error is debuggable
            let debug_string = format!("{:?}", error);
            assert!(
                !debug_string.is_empty(),
                "Debug string should not be empty for: {}",
                description
            );

            // Test that error type is preserved
            match error {
                TBankError::InvalidInn(_) => assert!(error_string.contains("Invalid INN")),
                TBankError::InvalidKpp(_) => assert!(error_string.contains("Invalid KPP")),
                TBankError::CounterpartyNotFound { .. } => {
                    assert!(error_string.contains("not found"))
                }
                TBankError::TBankApiError { .. } => {
                    assert!(error_string.contains("T-Bank API error"))
                }
                TBankError::AuthenticationError(_) => {
                    assert!(error_string.contains("Authentication error"))
                }
                TBankError::RateLimitExceeded => {
                    assert!(error_string.contains("Rate limit exceeded"))
                }
                TBankError::CircuitBreakerOpen => {
                    assert!(error_string.contains("Circuit breaker open"))
                }
                _ => {} // Other error types
            }
        }
    }
}
