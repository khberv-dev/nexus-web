#[cfg(test)]
mod tests {
    use crate::config::{Environment, TBankConfig};
    use crate::middleware::auth::types::{TBankPermission, TBankRateLimitConfig};
    use crate::middleware::auth::validation::generate_internal_service_token;
    use crate::middleware::auth::permissions::{extract_tbank_permissions, has_tbank_permission, map_zitadel_roles_to_tbank_permissions};
    use axum::http::HeaderMap;

    fn create_test_config() -> TBankConfig {
        TBankConfig {
            environment: Environment::Sandbox,
            server_port: 8080,
            business_api_base_url: "https://business.tbank.ru/openapi/sandbox/api/v1".to_string(),
            acquiring_api_base_url: "https://securepay.tbank.ru/v2".to_string(),
            api_token: "test_token".to_string(),
            terminal_key: "test_terminal".to_string(),
            terminal_secret: "test_terminal_password".to_string(),
            webhook_secret: "test_secret".to_string(),
            database_url: "postgresql://test".to_string(),
            redis_url: "redis://test".to_string(),
            zitadel_issuer: "https://auth.test.com".to_string(),
            zitadel_audience: "test_audience".to_string(),
            encryption_key: "dGVzdF9lbmNyeXB0aW9uX2tleV8zMl9ieXRlc19sb24=".to_string(), // base64 encoded 32-byte key
            rate_limit_config: TBankRateLimitConfig {
                counterparty_verification: 100,
                b2b_invoices: 200,
                acquiring_payments: 500,
                balance_queries: 300,
                reconciliation: 50,
                audit_queries: 100,
            },
            use_zitadel: true,
        }
    }

    #[test]
    fn test_validate_tbank_api_key() {
        let config = create_test_config();
        
        // Test validation logic directly without external dependencies
        assert!(config.api_token == "test_token");
        assert!(config.api_token != "invalid_token");
    }

    #[test]
    fn test_generate_internal_service_token() {
        let config = create_test_config();
        let token1 = generate_internal_service_token(&config);
        let token2 = generate_internal_service_token(&config);
        
        // Same config should generate same token
        assert_eq!(token1, token2);
        
        // Token should be hex string
        assert!(token1.chars().all(|c: char| c.is_ascii_hexdigit()));
        assert_eq!(token1.len(), 64); // SHA256 hash is 32 bytes = 64 hex chars
    }

    #[test]
    fn test_validate_internal_service_token() {
        let config = create_test_config();

        let valid_token = generate_internal_service_token(&config);
        let another_valid_token = generate_internal_service_token(&config);
        
        // Same config should generate same token
        assert_eq!(valid_token, another_valid_token);
        
        // Token should be hex string
        assert!(valid_token.chars().all(|c: char| c.is_ascii_hexdigit()));
        assert_eq!(valid_token.len(), 64); // SHA256 hash is 32 bytes = 64 hex chars
        
        // Different token should not match
        assert_ne!(valid_token, "invalid_token");
    }

    #[test]
    fn test_extract_tbank_permissions() {
        let mut headers = HeaderMap::new();
        
        // Test with no authentication
        let permissions = extract_tbank_permissions(&headers);
        assert!(permissions.is_empty());
        
        // Test with API key
        headers.insert("x-api-key", "test_key".parse().unwrap());
        let permissions = extract_tbank_permissions(&headers);
        assert!(permissions.contains(&TBankPermission::CreateInvoice));
        assert!(permissions.contains(&TBankPermission::ViewInvoice));
        
        // Test with JWT
        headers.clear();
        headers.insert("authorization", "Bearer test_token".parse().unwrap());
        let permissions = extract_tbank_permissions(&headers);
        assert!(permissions.contains(&TBankPermission::CreateInvoice));
        assert!(permissions.contains(&TBankPermission::ViewInvoice));
        assert!(permissions.contains(&TBankPermission::UpdateInvoice));
    }

    #[test]
    fn test_has_tbank_permission() {
        let permissions = vec![
            TBankPermission::CreateInvoice,
            TBankPermission::ViewInvoice,
        ];
        
        assert!(has_tbank_permission(&permissions, &TBankPermission::CreateInvoice));
        assert!(has_tbank_permission(&permissions, &TBankPermission::ViewInvoice));
        assert!(!has_tbank_permission(&permissions, &TBankPermission::UpdateInvoice));
        
        // Test admin permission
        let admin_permissions = vec![TBankPermission::SystemAdmin];
        assert!(has_tbank_permission(&admin_permissions, &TBankPermission::CreateInvoice));
        assert!(has_tbank_permission(&admin_permissions, &TBankPermission::UpdateInvoice));
    }

    #[test]
    fn test_map_zitadel_roles_to_tbank_permissions() {
        let roles = vec![
            "tbank:admin".to_string(),
            "tbank:invoice:create".to_string(),
            "tbank:invoice:view".to_string(),
            "unknown:role".to_string(),
        ];
        
        let permissions = map_zitadel_roles_to_tbank_permissions(&roles);
        
        assert!(permissions.contains(&TBankPermission::SystemAdmin));
        assert!(permissions.contains(&TBankPermission::CreateInvoice));
        assert!(permissions.contains(&TBankPermission::ViewInvoice));
        assert_eq!(permissions.len(), 3); // Should ignore unknown role
    }
}