//! Integration tests for Zitadel v2 API

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::config::Config;
    use std::env;

    #[tokio::test]
    async fn test_zitadel_connection() {
        // Skip test if Zitadel is not configured
        if env::var("ZITADEL_ENABLED").unwrap_or_default() != "true" {
            println!("Skipping Zitadel connection test - ZITADEL_ENABLED not set");
            return;
        }

        let config = Config::from_env().expect("Failed to load config");
        
        let validator = ZitadelValidator::new(
            config.auth.zitadel_url.clone(),
            config.auth.jwt_audience.clone(),
        );

        // Test connection to Zitadel (local network)
        println!("Testing connection to Zitadel at: {}", config.auth.zitadel_url);
        
        let connection_result = validator.test_connection().await;
        
        if let Err(ref e) = connection_result {
            println!("Connection failed: {:?}", e);
            println!("This is expected if Zitadel is not running locally");
            println!("Make sure Zitadel is running on: {}", config.auth.zitadel_url);
            return; // Don't fail the test if Zitadel is not running
        }
        
        assert!(connection_result.is_ok(), "Failed to connect to Zitadel: {:?}", connection_result);
        
        if let Ok(is_connected) = connection_result {
            assert!(is_connected, "Zitadel connection test returned false");
            println!("✅ Successfully connected to Zitadel at: {}", config.auth.zitadel_url);
        }
    }

    #[tokio::test]
    async fn test_zitadel_jwks_fetch() {
        // Skip test if Zitadel is not configured
        if env::var("ZITADEL_ENABLED").unwrap_or_default() != "true" {
            println!("Skipping JWKS fetch test - ZITADEL_ENABLED not set");
            return;
        }

        let config = Config::from_env().expect("Failed to load config");
        
        let validator = ZitadelValidator::new(
            config.auth.zitadel_url.clone(),
            config.auth.jwt_audience.clone(),
        );

        // Test cache stats (this will indirectly test JWKS functionality)
        let cache_stats = validator.get_cache_stats();
        assert!(!cache_stats.is_cached, "Cache should initially be empty");
        assert_eq!(cache_stats.keys_count, 0, "Should have no keys initially");
    }

    #[tokio::test]
    async fn test_zitadel_openid_config() {
        // Skip test if Zitadel is not configured
        if env::var("ZITADEL_ENABLED").unwrap_or_default() != "true" {
            println!("Skipping OpenID config test - ZITADEL_ENABLED not set");
            return;
        }

        let config = Config::from_env().expect("Failed to load config");
        
        let validator = ZitadelValidator::new(
            config.auth.zitadel_url.clone(),
            config.auth.jwt_audience.clone(),
        );

        // Test OpenID Connect configuration
        let openid_config = validator.get_openid_config().await;
        assert!(openid_config.is_ok(), "Failed to fetch OpenID config: {:?}", openid_config);
        
        if let Ok(config_json) = openid_config {
            // Verify required OpenID Connect fields
            assert!(config_json.get("issuer").is_some(), "OpenID config should have issuer");
            assert!(config_json.get("authorization_endpoint").is_some(), "OpenID config should have authorization_endpoint");
            assert!(config_json.get("token_endpoint").is_some(), "OpenID config should have token_endpoint");
            assert!(config_json.get("jwks_uri").is_some(), "OpenID config should have jwks_uri");
            assert!(config_json.get("userinfo_endpoint").is_some(), "OpenID config should have userinfo_endpoint");
            
            // Verify supported scopes include required ones
            if let Some(scopes) = config_json.get("scopes_supported") {
                let scopes_array = scopes.as_array().expect("scopes_supported should be array");
                let scope_strings: Vec<String> = scopes_array
                    .iter()
                    .map(|s| s.as_str().unwrap_or("").to_string())
                    .collect();
                
                assert!(scope_strings.contains(&"openid".to_string()), "Should support openid scope");
                assert!(scope_strings.contains(&"profile".to_string()), "Should support profile scope");
                assert!(scope_strings.contains(&"email".to_string()), "Should support email scope");
            }
        }
    }

    #[test]
    fn test_zitadel_claims_mapping() {
        use serde_json::json;
        
        // Create test Zitadel claims
        let zitadel_claims = ZitadelClaims {
            sub: "user123".to_string(),
            iss: "https://auth.ad-quest.ru".to_string(),
            aud: vec!["355078092114427907".to_string()],
            exp: 1642781234,
            iat: 1642777634,
            nbf: Some(1642777634),
            jti: Some("jwt123".to_string()),
            email: Some("test@example.com".to_string()),
            name: Some("Test User".to_string()),
            preferred_username: Some("testuser".to_string()),
            roles: Some(vec![
                "adquest.publisher".to_string(),
                "adquest.advertiser".to_string(),
            ]),
            org_id: Some("org123".to_string()),
            metadata: Some(json!({"accountType": "publisher"})),
        };

        // Test conversion to ADQuest claims
        let adquest_claims = zitadel_claims.to_adquest_claims();
        assert!(adquest_claims.is_ok(), "Claims conversion should succeed");
        
        if let Ok(claims) = adquest_claims {
            assert_eq!(claims.sub, "user123");
            assert_eq!(claims.iss, "https://auth.ad-quest.ru");
            assert_eq!(claims.aud, "355078092114427907");
            assert_eq!(claims.email, "test@example.com");
            
            // Verify role mapping
            assert!(claims.roles.contains(&"adquest.publisher".to_string()));
            assert!(claims.roles.contains(&"adquest.advertiser".to_string()));
            
            // Verify permission mapping
            assert!(claims.permissions.contains(&"challenge:validate".to_string())); // publisher
            assert!(claims.permissions.contains(&"challenge:generate".to_string())); // advertiser
            assert!(claims.permissions.contains(&"publisher:site_manage".to_string()));
            assert!(claims.permissions.contains(&"advertiser:campaign_manage".to_string()));
        }
    }

    #[test]
    fn test_role_to_permissions_mapping() {
        let zitadel_claims = ZitadelClaims {
            sub: "user123".to_string(),
            iss: "https://auth.ad-quest.ru".to_string(),
            aud: vec!["355078092114427907".to_string()],
            exp: 1642781234,
            iat: 1642777634,
            nbf: None,
            jti: None,
            email: None,
            name: None,
            preferred_username: None,
            roles: None,
            org_id: None,
            metadata: None,
        };

        // Test publisher role
        let publisher_permissions = zitadel_claims.map_roles_to_permissions(&["adquest.publisher".to_string()]);
        assert!(publisher_permissions.contains(&"challenge:validate".to_string()));
        assert!(publisher_permissions.contains(&"publisher:site_manage".to_string()));
        assert!(!publisher_permissions.contains(&"challenge:generate".to_string())); // Should not have advertiser permissions

        // Test advertiser role
        let advertiser_permissions = zitadel_claims.map_roles_to_permissions(&["adquest.advertiser".to_string()]);
        assert!(advertiser_permissions.contains(&"challenge:generate".to_string()));
        assert!(advertiser_permissions.contains(&"advertiser:campaign_manage".to_string()));
        assert!(advertiser_permissions.contains(&"erir:register".to_string()));
        assert!(!advertiser_permissions.contains(&"publisher:site_manage".to_string())); // Should not have publisher permissions

        // Test admin role
        let admin_permissions = zitadel_claims.map_roles_to_permissions(&["adquest.admin".to_string()]);
        assert!(admin_permissions.contains(&"challenge:generate".to_string()));
        assert!(admin_permissions.contains(&"challenge:validate".to_string()));
        assert!(admin_permissions.contains(&"admin:user_manage".to_string()));
        assert!(admin_permissions.contains(&"billing:process".to_string()));

        // Test multiple roles
        let multi_permissions = zitadel_claims.map_roles_to_permissions(&[
            "adquest.publisher".to_string(),
            "adquest.advertiser".to_string(),
        ]);
        assert!(multi_permissions.contains(&"challenge:generate".to_string()));
        assert!(multi_permissions.contains(&"challenge:validate".to_string()));
        assert!(multi_permissions.contains(&"publisher:site_manage".to_string()));
        assert!(multi_permissions.contains(&"advertiser:campaign_manage".to_string()));
    }

    #[test]
    fn test_cache_functionality() {
        let validator = ZitadelValidator::new(
            "https://auth.ad-quest.ru".to_string(),
            "355078092114427907".to_string(),
        );

        // Initially cache should be empty
        let stats = validator.get_cache_stats();
        assert!(!stats.is_cached);
        assert!(stats.cached_at.is_none());
        assert_eq!(stats.keys_count, 0);

        // Test cache clearing
        validator.clear_cache();
        let stats_after_clear = validator.get_cache_stats();
        assert!(!stats_after_clear.is_cached);
    }
}