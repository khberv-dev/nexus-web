#[cfg(test)]
mod tests {
    use super::super::{ZitadelCacheStats, ZitadelClaims, ZitadelValidator};
    use chrono::Utc;

    #[test]
    fn test_zitadel_claims_conversion() {
        let zitadel_claims = ZitadelClaims {
            sub: "123e4567-e89b-12d3-a456-426614174000".to_string(),
            iss: "http://localhost:8080".to_string(),
            aud: vec!["test-audience".to_string()],
            exp: chrono::Utc::now().timestamp() + 3600,
            iat: chrono::Utc::now().timestamp(),
            nbf: Some(chrono::Utc::now().timestamp()),
            jti: Some("test-jti".to_string()),
            email: Some("test@example.com".to_string()),
            name: Some("Test User".to_string()),
            preferred_username: Some("testuser".to_string()),
            roles: Some(vec!["adquest.advertiser".to_string()]),
            org_id: Some("456e7890-e89b-12d3-a456-426614174001".to_string()),
            metadata: None,
        };

        let adquest_claims = zitadel_claims.to_adquest_claims().unwrap();

        assert_eq!(adquest_claims.sub, zitadel_claims.sub);
        assert_eq!(adquest_claims.email, "test@example.com");
        assert_eq!(adquest_claims.roles, vec!["adquest.advertiser"]);
        assert!(adquest_claims
            .permissions
            .contains(&"challenge:generate".to_string()));
        assert!(adquest_claims
            .permissions
            .contains(&"advertiser:campaign_manage".to_string()));
    }

    #[test]
    fn test_zitadel_claims_role_mapping() {
        let zitadel_claims = ZitadelClaims {
            sub: "test-user".to_string(),
            iss: "http://localhost:8080".to_string(),
            aud: vec!["test-audience".to_string()],
            exp: chrono::Utc::now().timestamp() + 3600,
            iat: chrono::Utc::now().timestamp(),
            nbf: None,
            jti: None,
            email: None,
            name: None,
            preferred_username: None,
            roles: Some(vec![
                "adquest.admin".to_string(),
                "adquest.compliance.officer".to_string(),
            ]),
            org_id: None,
            metadata: None,
        };

        let permissions =
            zitadel_claims.map_roles_to_permissions(&zitadel_claims.roles.as_ref().unwrap());

        // Should have admin permissions
        assert!(permissions.contains(&"admin:user_manage".to_string()));
        assert!(permissions.contains(&"billing:process".to_string()));

        // Should have compliance permissions
        assert!(permissions.contains(&"compliance:manage".to_string()));
        assert!(permissions.contains(&"personal_data:access".to_string()));

        // Should not have duplicates
        let unique_permissions: std::collections::HashSet<_> = permissions.iter().collect();
        assert_eq!(permissions.len(), unique_permissions.len());
    }

    #[test]
    fn test_zitadel_claims_validity() {
        let now = chrono::Utc::now().timestamp();

        // Valid token
        let valid_claims = ZitadelClaims {
            sub: "test-user".to_string(),
            iss: "http://localhost:8080".to_string(),
            aud: vec!["test-audience".to_string()],
            exp: now + 3600, // 1 hour from now
            iat: now,
            nbf: Some(now),
            jti: None,
            email: None,
            name: None,
            preferred_username: None,
            roles: None,
            org_id: None,
            metadata: None,
        };

        assert!(valid_claims.is_valid());
        assert!(!valid_claims.is_expired());
        assert!(!valid_claims.is_not_yet_valid());

        // Expired token
        let expired_claims = ZitadelClaims {
            exp: now - 3600, // 1 hour ago
            ..valid_claims.clone()
        };

        assert!(!expired_claims.is_valid());
        assert!(expired_claims.is_expired());

        // Not yet valid token
        let future_claims = ZitadelClaims {
            nbf: Some(now + 3600), // 1 hour from now
            ..valid_claims.clone()
        };

        assert!(!future_claims.is_valid());
        assert!(future_claims.is_not_yet_valid());
    }

    #[test]
    fn test_zitadel_claims_display_name() {
        // Test with name
        let claims_with_name = ZitadelClaims {
            sub: "test-user".to_string(),
            iss: "http://localhost:8080".to_string(),
            aud: vec!["test-audience".to_string()],
            exp: chrono::Utc::now().timestamp() + 3600,
            iat: chrono::Utc::now().timestamp(),
            nbf: None,
            jti: None,
            email: Some("test@example.com".to_string()),
            name: Some("Test User".to_string()),
            preferred_username: Some("testuser".to_string()),
            roles: None,
            org_id: None,
            metadata: None,
        };

        assert_eq!(claims_with_name.display_name(), "Test User");

        // Test without name, with username
        let claims_with_username = ZitadelClaims {
            name: None,
            ..claims_with_name.clone()
        };

        assert_eq!(claims_with_username.display_name(), "testuser");

        // Test without name and username, with email
        let claims_with_email = ZitadelClaims {
            name: None,
            preferred_username: None,
            ..claims_with_name.clone()
        };

        assert_eq!(claims_with_email.display_name(), "test@example.com");

        // Test with only sub
        let claims_with_sub_only = ZitadelClaims {
            name: None,
            preferred_username: None,
            email: None,
            ..claims_with_name.clone()
        };

        assert_eq!(claims_with_sub_only.display_name(), "test-user");
    }

    #[test]
    fn test_zitadel_validator_creation() {
        let validator = ZitadelValidator::new(
            "http://localhost:8080".to_string(),
            "test-audience".to_string(),
        );

        assert_eq!(validator.issuer(), "http://localhost:8080");
        assert_eq!(validator.audience(), "test-audience");
        assert_eq!(
            validator.jwks_uri(),
            "http://localhost:8080/.well-known/openid_configuration/jwks"
        );
        assert_eq!(validator.cache_duration_minutes, 60);
    }

    #[test]
    fn test_zitadel_cache_stats() {
        let stats = ZitadelCacheStats {
            is_cached: true,
            cached_at: Some(Utc::now() - chrono::Duration::minutes(30)),
            keys_count: 2,
            cache_expiry: Some(Utc::now() + chrono::Duration::minutes(30)),
            is_expired: false,
        };

        assert!(stats.cache_age_seconds().unwrap() > 1700); // ~30 minutes
        assert!(stats.time_until_expiry_seconds().unwrap() > 1700); // ~30 minutes
        assert_eq!(stats.cache_utilization(), 1.0);

        let expired_stats = ZitadelCacheStats {
            is_expired: true,
            ..stats
        };

        assert_eq!(expired_stats.cache_utilization(), 0.0);
    }
}
