mod types;
mod token;
mod refresh;
mod validation;

pub use types::JwtAuth;

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use crate::auth::Permission;

    #[test]
    fn test_jwt_token_generation_and_validation() {
        let jwt_auth = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();

        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let roles = vec!["publisher".to_string()];
        let permissions = vec![
            "challenge:generate".to_string(),
            "challenge:validate".to_string(),
        ];

        let token = jwt_auth
            .generate_token(
                user_id,
                email.clone(),
                roles.clone(),
                permissions.clone(),
                None,
            )
            .unwrap();
        let claims = jwt_auth.validate_token(&token).unwrap();

        assert_eq!(claims.user_id, user_id);
        assert_eq!(claims.email, email);
        assert_eq!(claims.roles, roles);
        assert_eq!(claims.permissions, permissions);
    }

    #[test]
    fn test_permission_checking() {
        let jwt_auth = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();

        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let roles = vec!["publisher".to_string()];
        let permissions = vec!["challenge:generate".to_string()];

        let token = jwt_auth
            .generate_token(user_id, email, roles, permissions, None)
            .unwrap();
        let claims = jwt_auth.validate_token(&token).unwrap();

        assert!(jwt_auth.has_permission(&claims, Permission::ChallengeGenerate));
        assert!(!jwt_auth.has_permission(&claims, Permission::BillingProcess));
    }

    #[test]
    fn test_role_checking() {
        let jwt_auth = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();

        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let roles = vec!["publisher".to_string(), "advertiser".to_string()];
        let permissions = vec![];

        let token = jwt_auth
            .generate_token(user_id, email, roles, permissions, None)
            .unwrap();
        let claims = jwt_auth.validate_token(&token).unwrap();

        assert!(jwt_auth.has_role(&claims, &["publisher"]));
        assert!(jwt_auth.has_role(&claims, &["advertiser", "admin"]));
        assert!(!jwt_auth.has_role(&claims, &["admin"]));
    }

    #[test]
    fn test_refresh_token() {
        let jwt_auth = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();

        let user_id = Uuid::new_v4();

        let refresh_token = jwt_auth.generate_refresh_token(user_id).unwrap();
        let validated_user_id = jwt_auth.validate_refresh_token(&refresh_token).unwrap();

        assert_eq!(user_id, validated_user_id);
    }

    #[test]
    fn test_token_expiration() {
        let jwt_auth = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();

        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let roles = vec!["publisher".to_string()];
        let permissions = vec!["challenge:generate".to_string()];

        let token = jwt_auth
            .generate_token(user_id, email, roles, permissions, None)
            .unwrap();

        assert!(!jwt_auth.is_token_expired(&token));

        let exp = jwt_auth.get_token_expiration(&token).unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        assert!(exp > now);
    }

    #[test]
    fn test_invalid_token() {
        let jwt_auth = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();

        let result = jwt_auth.validate_token("invalid.token.here");
        assert!(result.is_err());

        let other_jwt = JwtAuth::new(
            "other_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();
        let user_id = Uuid::new_v4();
        let token = other_jwt
            .generate_token(
                user_id,
                "test@example.com".to_string(),
                vec![],
                vec![],
                None,
            )
            .unwrap();

        let result = jwt_auth.validate_token(&token);
        assert!(result.is_err());
    }

    #[test]
    fn test_audience_validation() {
        let jwt_auth = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "adquest-api".to_string(),
        )
        .unwrap();
        let other_jwt = JwtAuth::new(
            "test_secret",
            "adquest".to_string(),
            "other-api".to_string(),
        )
        .unwrap();

        let user_id = Uuid::new_v4();
        let token = other_jwt
            .generate_token(
                user_id,
                "test@example.com".to_string(),
                vec![],
                vec![],
                None,
            )
            .unwrap();

        let result = jwt_auth.validate_token(&token);
        assert!(result.is_err());
    }
}
