use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use serde::{Deserialize, Serialize};
use tbank_integration::middleware::auth::{
    map_zitadel_roles_to_tbank_permissions, TBankPermission,
};

#[cfg(test)]
mod jwt_validation_tests {
    use super::*;

    #[derive(Debug, Serialize, Deserialize)]
    struct TestClaims {
        sub: String,
        exp: i64,
        iat: i64,
        roles: Vec<String>,
        aud: String,
        iss: String,
    }

    #[quickcheck]
    fn jwt_token_validation_property(
        user_id: String,
        roles: Vec<String>,
        issuer: String,
        audience: String,
        secret_key: String,
    ) -> TestResult {
        // Feature: tbank-integration, Property 45: JWT Token Validation
        // **Validates: Requirements 7.2**

        // Filter out invalid inputs
        let clean_user_id: String = user_id
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect();
        let clean_issuer: String = issuer
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect();
        let clean_audience: String = audience
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect();
        let clean_secret: String = secret_key
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii_graphic())
            .collect();

        // Skip invalid inputs
        if clean_user_id.trim().is_empty() || clean_user_id.len() < 3 {
            return TestResult::discard();
        }
        if clean_issuer.trim().is_empty() || clean_issuer.len() < 10 {
            return TestResult::discard();
        }
        if clean_audience.trim().is_empty() || clean_audience.len() < 3 {
            return TestResult::discard();
        }
        if clean_secret.trim().is_empty() || clean_secret.len() < 32 {
            return TestResult::discard();
        }

        // Skip extremely long inputs
        if clean_user_id.len() > 100
            || clean_issuer.len() > 200
            || clean_audience.len() > 100
            || clean_secret.len() > 500
        {
            return TestResult::discard();
        }

        // Filter roles
        let clean_roles: Vec<String> = roles
            .into_iter()
            .map(|role| {
                role.chars()
                    .filter(|&c| c != '\0' && c.is_ascii_graphic())
                    .collect()
            })
            .filter(|role: &String| !role.trim().is_empty() && role.len() <= 50)
            .take(10) // Limit number of roles
            .collect();

        // Test JWT token creation and validation
        let now = Utc::now();
        let claims = TestClaims {
            sub: clean_user_id.clone(),
            exp: (now + Duration::hours(1)).timestamp(),
            iat: now.timestamp(),
            roles: clean_roles.clone(),
            aud: clean_audience.clone(),
            iss: clean_issuer.clone(),
        };

        // Create JWT token
        let encoding_key = EncodingKey::from_secret(clean_secret.as_bytes());
        let token = match encode(&Header::default(), &claims, &encoding_key) {
            Ok(t) => t,
            Err(_) => return TestResult::error("Failed to create JWT token"),
        };

        // Test token validation
        let decoding_key = DecodingKey::from_secret(clean_secret.as_bytes());
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_audience(&[clean_audience.clone()]);
        validation.set_issuer(&[clean_issuer.clone()]);

        let decoded = match decode::<TestClaims>(&token, &decoding_key, &validation) {
            Ok(d) => d,
            Err(_) => return TestResult::failed(),
        };

        // Verify claims
        let token_valid = decoded.claims.sub == clean_user_id
            && decoded.claims.aud == clean_audience
            && decoded.claims.iss == clean_issuer
            && decoded.claims.roles == clean_roles;

        // Test role to permission mapping
        let tbank_permissions = map_zitadel_roles_to_tbank_permissions(&clean_roles);
        let mapping_works = if clean_roles.contains(&"adquest.admin".to_string()) {
            tbank_permissions.contains(&TBankPermission::SystemAdmin)
        } else if clean_roles.contains(&"adquest.compliance.officer".to_string()) {
            tbank_permissions.contains(&TBankPermission::ComplianceOfficer)
        } else if clean_roles.contains(&"adquest.advertiser".to_string()) {
            tbank_permissions.contains(&TBankPermission::AcquiringPaymentInit)
        } else {
            // For unknown roles, should return empty permissions
            tbank_permissions.is_empty()
        };

        // Test token expiration handling
        let expired_claims = TestClaims {
            sub: clean_user_id.clone(),
            exp: (now - Duration::hours(1)).timestamp(), // Expired
            iat: (now - Duration::hours(2)).timestamp(),
            roles: clean_roles.clone(),
            aud: clean_audience.clone(),
            iss: clean_issuer.clone(),
        };

        let expired_token = match encode(&Header::default(), &expired_claims, &encoding_key) {
            Ok(t) => t,
            Err(_) => return TestResult::error("Failed to create expired JWT token"),
        };

        let expired_validation_fails =
            decode::<TestClaims>(&expired_token, &decoding_key, &validation).is_err();

        // Test invalid signature handling
        let wrong_key = EncodingKey::from_secret(b"wrong_secret_key_for_testing_purposes");
        let invalid_token = match encode(&Header::default(), &claims, &wrong_key) {
            Ok(t) => t,
            Err(_) => return TestResult::error("Failed to create invalid JWT token"),
        };

        let invalid_signature_fails =
            decode::<TestClaims>(&invalid_token, &decoding_key, &validation).is_err();

        TestResult::from_bool(
            token_valid && mapping_works && expired_validation_fails && invalid_signature_fails,
        )
    }

    #[test]
    fn test_jwt_validation_with_known_good_tokens() {
        // Feature: tbank-integration, Property 45: JWT Token Validation
        // **Validates: Requirements 7.2**

        let secret = "test_secret_key_with_sufficient_length_for_hs256";
        let issuer = "https://auth.ad-quest.ru";
        let audience = "352242948684972035";

        // Test valid admin token
        let admin_claims = TestClaims {
            sub: "admin_user_123".to_string(),
            exp: (Utc::now() + Duration::hours(1)).timestamp(),
            iat: Utc::now().timestamp(),
            roles: vec!["adquest.admin".to_string()],
            aud: audience.to_string(),
            iss: issuer.to_string(),
        };

        let encoding_key = EncodingKey::from_secret(secret.as_bytes());
        let admin_token = encode(&Header::default(), &admin_claims, &encoding_key).unwrap();

        let decoding_key = DecodingKey::from_secret(secret.as_bytes());
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_audience(&[audience]);
        validation.set_issuer(&[issuer]);

        let decoded = decode::<TestClaims>(&admin_token, &decoding_key, &validation).unwrap();
        assert_eq!(decoded.claims.sub, "admin_user_123");
        assert_eq!(decoded.claims.roles, vec!["adquest.admin"]);

        // Test permission mapping
        let permissions = map_zitadel_roles_to_tbank_permissions(&decoded.claims.roles);
        assert!(permissions.contains(&TBankPermission::SystemAdmin));
        assert!(permissions.contains(&TBankPermission::B2BInvoiceCreate));
        assert!(permissions.contains(&TBankPermission::AuditExport));
    }

    #[test]
    fn test_jwt_validation_with_invalid_tokens() {
        // Feature: tbank-integration, Property 45: JWT Token Validation
        // **Validates: Requirements 7.2**

        let secret = "test_secret_key_with_sufficient_length_for_hs256";
        let issuer = "https://auth.ad-quest.ru";
        let audience = "352242948684972035";

        let decoding_key = DecodingKey::from_secret(secret.as_bytes());
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_audience(&[audience]);
        validation.set_issuer(&[issuer]);

        // Test malformed token
        let malformed_token = "invalid.jwt.token";
        assert!(decode::<TestClaims>(malformed_token, &decoding_key, &validation).is_err());

        // Test token with wrong audience
        let wrong_audience_claims = TestClaims {
            sub: "user_123".to_string(),
            exp: (Utc::now() + Duration::hours(1)).timestamp(),
            iat: Utc::now().timestamp(),
            roles: vec!["adquest.advertiser".to_string()],
            aud: "wrong_audience".to_string(),
            iss: issuer.to_string(),
        };

        let encoding_key = EncodingKey::from_secret(secret.as_bytes());
        let wrong_audience_token =
            encode(&Header::default(), &wrong_audience_claims, &encoding_key).unwrap();
        assert!(decode::<TestClaims>(&wrong_audience_token, &decoding_key, &validation).is_err());

        // Test token with wrong issuer
        let wrong_issuer_claims = TestClaims {
            sub: "user_123".to_string(),
            exp: (Utc::now() + Duration::hours(1)).timestamp(),
            iat: Utc::now().timestamp(),
            roles: vec!["adquest.advertiser".to_string()],
            aud: audience.to_string(),
            iss: "https://wrong.issuer.com".to_string(),
        };

        let wrong_issuer_token =
            encode(&Header::default(), &wrong_issuer_claims, &encoding_key).unwrap();
        assert!(decode::<TestClaims>(&wrong_issuer_token, &decoding_key, &validation).is_err());
    }

    #[test]
    fn test_role_to_permission_mapping_comprehensive() {
        // Feature: tbank-integration, Property 45: JWT Token Validation
        // **Validates: Requirements 7.2**

        // Test all role mappings
        let test_cases = vec![
            (
                vec!["adquest.admin".to_string()],
                vec![
                    TBankPermission::SystemAdmin,
                    TBankPermission::B2BInvoiceCreate,
                    TBankPermission::AuditExport,
                ],
            ),
            (
                vec!["adquest.compliance.officer".to_string()],
                vec![
                    TBankPermission::ComplianceOfficer,
                    TBankPermission::AuditView,
                    TBankPermission::AuditExport,
                ],
            ),
            (
                vec!["adquest.advertiser".to_string()],
                vec![
                    TBankPermission::B2BInvoiceView,
                    TBankPermission::AcquiringPaymentInit,
                    TBankPermission::CounterpartyVerify,
                ],
            ),
            (
                vec!["adquest.finance".to_string()],
                vec![
                    TBankPermission::B2BInvoiceCreate,
                    TBankPermission::ReconciliationRun,
                    TBankPermission::BalanceView,
                ],
            ),
            (
                vec!["adquest.support".to_string()],
                vec![
                    TBankPermission::B2BInvoiceView,
                    TBankPermission::AcquiringPaymentView,
                    TBankPermission::ReconciliationView,
                ],
            ),
        ];

        for (roles, expected_permissions) in test_cases {
            let actual_permissions = map_zitadel_roles_to_tbank_permissions(&roles);

            for expected_permission in expected_permissions {
                assert!(
                    actual_permissions.contains(&expected_permission),
                    "Role {:?} should have permission {:?}, but got {:?}",
                    roles,
                    expected_permission,
                    actual_permissions
                );
            }
        }
    }

    #[test]
    fn test_multiple_roles_permission_aggregation() {
        // Feature: tbank-integration, Property 45: JWT Token Validation
        // **Validates: Requirements 7.2**

        let multiple_roles = vec![
            "adquest.advertiser".to_string(),
            "adquest.support".to_string(),
        ];

        let permissions = map_zitadel_roles_to_tbank_permissions(&multiple_roles);

        // Should have permissions from both roles
        assert!(permissions.contains(&TBankPermission::B2BInvoiceView));
        assert!(permissions.contains(&TBankPermission::AcquiringPaymentInit)); // From advertiser
        assert!(permissions.contains(&TBankPermission::AcquiringPaymentView)); // From support

        // Should not have admin permissions
        assert!(!permissions.contains(&TBankPermission::SystemAdmin));

        // Should not have duplicates
        let view_count = permissions
            .iter()
            .filter(|&p| *p == TBankPermission::B2BInvoiceView)
            .count();
        assert_eq!(view_count, 1);
    }
}
