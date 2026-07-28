mod types;
mod roles;
mod conversion;
mod validation;

pub use types::{RoleValue, ZitadelClaims};

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_roles_from_legacy_format() {
        let claims_json = json!({
            "sub": "123456",
            "iss": "https://auth.ad-quest.ru",
            "aud": ["test-audience"],
            "exp": 9999999999i64,
            "iat": 1000000000i64,
            "urn:zitadel:iam:org:project:roles": ["adquest.publisher", "adquest.admin"]
        });

        let claims: ZitadelClaims = serde_json::from_value(claims_json).unwrap();
        let roles = claims.extract_roles();

        assert_eq!(roles.len(), 2);
        assert!(roles.contains(&"adquest.publisher".to_string()));
        assert!(roles.contains(&"adquest.admin".to_string()));
    }

    #[test]
    fn test_extract_roles_from_map_format() {
        let claims_json = json!({
            "sub": "359203576544755715",
            "iss": "https://auth.ad-quest.ru",
            "aud": ["357819109053890564", "357819108869275652"],
            "exp": 9999999999i64,
            "iat": 1770599076i64,
            "client_id": "357819109053890564",
            "urn:zitadel:iam:org:project:357819108869275652:roles": {
                "adquest.publisher": {
                    "359203576460869635": "fowugep.auth.ad-quest.ru"
                }
            }
        });

        let claims: ZitadelClaims = serde_json::from_value(claims_json).unwrap();
        let roles = claims.extract_roles();

        assert_eq!(roles.len(), 1);
        assert!(roles.contains(&"adquest.publisher".to_string()));
    }

    #[test]
    fn test_extract_roles_from_multiple_projects() {
        let claims_json = json!({
            "sub": "123456",
            "iss": "https://auth.ad-quest.ru",
            "aud": ["test-audience"],
            "exp": 9999999999i64,
            "iat": 1000000000i64,
            "urn:zitadel:iam:org:project:111111:roles": {
                "adquest.publisher": {
                    "org1": "domain1.com"
                }
            },
            "urn:zitadel:iam:org:project:222222:roles": {
                "adquest.admin": {
                    "org2": "domain2.com"
                }
            }
        });

        let claims: ZitadelClaims = serde_json::from_value(claims_json).unwrap();
        let roles = claims.extract_roles();

        assert_eq!(roles.len(), 2);
        assert!(roles.contains(&"adquest.publisher".to_string()));
        assert!(roles.contains(&"adquest.admin".to_string()));
    }

    #[test]
    fn test_extract_roles_mixed_format() {
        let claims_json = json!({
            "sub": "123456",
            "iss": "https://auth.ad-quest.ru",
            "aud": ["test-audience"],
            "exp": 9999999999i64,
            "iat": 1000000000i64,
            "urn:zitadel:iam:org:project:roles": ["adquest.moderator"],
            "urn:zitadel:iam:org:project:357819108869275652:roles": {
                "adquest.publisher": {
                    "359203576460869635": "fowugep.auth.ad-quest.ru"
                }
            }
        });

        let claims: ZitadelClaims = serde_json::from_value(claims_json).unwrap();
        let roles = claims.extract_roles();

        assert_eq!(roles.len(), 2);
        assert!(roles.contains(&"adquest.publisher".to_string()));
        assert!(roles.contains(&"adquest.moderator".to_string()));
    }

    #[test]
    fn test_extract_roles_no_duplicates() {
        let claims_json = json!({
            "sub": "123456",
            "iss": "https://auth.ad-quest.ru",
            "aud": ["test-audience"],
            "exp": 9999999999i64,
            "iat": 1000000000i64,
            "urn:zitadel:iam:org:project:roles": ["adquest.publisher"],
            "urn:zitadel:iam:org:project:357819108869275652:roles": {
                "adquest.publisher": {
                    "359203576460869635": "fowugep.auth.ad-quest.ru"
                }
            }
        });

        let claims: ZitadelClaims = serde_json::from_value(claims_json).unwrap();
        let roles = claims.extract_roles();

        assert_eq!(roles.len(), 1);
        assert_eq!(roles[0], "adquest.publisher");
    }

    #[test]
    fn test_to_adquest_claims_with_map_roles() {
        let claims_json = json!({
            "sub": "359203576544755715",
            "iss": "https://auth.ad-quest.ru",
            "aud": ["357819109053890564"],
            "exp": 9999999999i64,
            "iat": 1770599076i64,
            "email": "test@example.com",
            "urn:zitadel:iam:org:project:357819108869275652:roles": {
                "adquest.publisher": {
                    "359203576460869635": "fowugep.auth.ad-quest.ru"
                }
            }
        });

        let zitadel_claims: ZitadelClaims = serde_json::from_value(claims_json).unwrap();
        let adquest_claims = zitadel_claims.to_adquest_claims().unwrap();

        assert_eq!(adquest_claims.roles.len(), 1);
        assert!(adquest_claims.roles.contains(&"adquest.publisher".to_string()));

        assert!(adquest_claims.permissions.contains(&"publisher:site_manage".to_string()));
        assert!(adquest_claims.permissions.contains(&"challenge:validate".to_string()));
    }
}
