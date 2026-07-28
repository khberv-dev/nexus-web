use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ts_rs::TS;
use utoipa::ToSchema;
use uuid::Uuid;

use super::Permission;

/// JWT Claims structure compatible with ADQuest Core
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub struct Claims {
    pub sub: String,                   // Subject (user ID)
    pub iss: String,                   // Issuer
    pub aud: String,                   // Audience
    pub exp: i64,                      // Expiration time
    pub iat: i64,                      // Issued at
    pub nbf: i64,                      // Not before
    pub jti: String,                   // JWT ID
    pub user_id: Uuid,                 // ADQuest user ID
    pub email: String,                 // User email
    pub roles: Vec<String>,            // User roles
    pub permissions: Vec<String>,      // User permissions
    pub organization_id: Option<Uuid>, // Organization ID if applicable
    pub session_id: String,            // Session identifier
}

/// Authentication middleware context
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub claims: Claims,
    pub permissions: HashSet<Permission>,
}

impl AuthContext {
    pub fn new(claims: Claims) -> Self {
        let permissions = claims
            .permissions
            .iter()
            .filter_map(|p| Permission::from_string(p))
            .collect();

        Self {
            claims,
            permissions,
        }
    }

    pub fn user_id(&self) -> Uuid {
        self.claims.user_id
    }

    pub fn email(&self) -> &str {
        &self.claims.email
    }

    pub fn has_permission(&self, permission: Permission) -> bool {
        self.permissions.contains(&permission)
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.claims.roles.contains(&role.to_string())
    }

    pub fn organization_id(&self) -> Option<Uuid> {
        self.claims.organization_id
    }

    pub fn session_id(&self) -> &str {
        &self.claims.session_id
    }

    pub fn roles(&self) -> &[String] {
        &self.claims.roles
    }

    pub fn permissions_list(&self) -> &[String] {
        &self.claims.permissions
    }

    /// Check if user has any of the specified roles
    pub fn has_any_role(&self, roles: &[&str]) -> bool {
        roles.iter().any(|role| self.has_role(role))
    }

    /// Check if user has all of the specified roles
    pub fn has_all_roles(&self, roles: &[&str]) -> bool {
        roles.iter().all(|role| self.has_role(role))
    }

    /// Check if user has any of the specified permissions
    pub fn has_any_permission(&self, permissions: &[Permission]) -> bool {
        permissions
            .iter()
            .any(|perm| self.has_permission(perm.clone()))
    }

    /// Check if user has all of the specified permissions
    pub fn has_all_permissions(&self, permissions: &[Permission]) -> bool {
        permissions
            .iter()
            .all(|perm| self.has_permission(perm.clone()))
    }

    /// Get user's permissions as a set
    pub fn get_permissions(&self) -> &HashSet<Permission> {
        &self.permissions
    }

    /// Check if token is expired
    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        self.claims.exp < now
    }

    /// Check if token is not yet valid
    pub fn is_not_yet_valid(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        self.claims.nbf > now
    }

    /// Check if token is valid (not expired and not before time has passed)
    pub fn is_valid(&self) -> bool {
        !self.is_expired() && !self.is_not_yet_valid()
    }

    /// Get time until token expires (in seconds)
    pub fn time_until_expiry(&self) -> Option<i64> {
        let now = chrono::Utc::now().timestamp();
        if self.claims.exp > now {
            Some(self.claims.exp - now)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_claims() -> Claims {
        Claims {
            sub: "test-user".to_string(),
            iss: "adquest".to_string(),
            aud: "adquest-api".to_string(),
            exp: chrono::Utc::now().timestamp() + 3600, // 1 hour from now
            iat: chrono::Utc::now().timestamp(),
            nbf: chrono::Utc::now().timestamp(),
            jti: "test-jti".to_string(),
            user_id: Uuid::new_v4(),
            email: "test@example.com".to_string(),
            roles: vec!["adquest.advertiser".to_string()],
            permissions: vec![
                "challenge:generate".to_string(),
                "challenge:view".to_string(),
            ],
            organization_id: Some(Uuid::new_v4()),
            session_id: "test-session".to_string(),
        }
    }

    #[test]
    fn test_auth_context_creation() {
        let claims = create_test_claims();
        let auth_context = AuthContext::new(claims.clone());

        assert_eq!(auth_context.user_id(), claims.user_id);
        assert_eq!(auth_context.email(), claims.email);
        assert_eq!(auth_context.session_id(), claims.session_id);
        assert_eq!(auth_context.organization_id(), claims.organization_id);
    }

    #[test]
    fn test_permission_checking() {
        let claims = create_test_claims();
        let auth_context = AuthContext::new(claims);

        assert!(auth_context.has_permission(Permission::ChallengeGenerate));
        assert!(auth_context.has_permission(Permission::ChallengeView));
        assert!(!auth_context.has_permission(Permission::BillingProcess));
    }

    #[test]
    fn test_role_checking() {
        let claims = create_test_claims();
        let auth_context = AuthContext::new(claims);

        assert!(auth_context.has_role("adquest.advertiser"));
        assert!(!auth_context.has_role("adquest.admin"));
    }

    #[test]
    fn test_multiple_role_checking() {
        let claims = create_test_claims();
        let auth_context = AuthContext::new(claims);

        assert!(auth_context.has_any_role(&["adquest.advertiser", "adquest.admin"]));
        assert!(!auth_context.has_any_role(&["adquest.publisher", "adquest.admin"]));
        assert!(!auth_context.has_all_roles(&["adquest.advertiser", "adquest.admin"]));
    }

    #[test]
    fn test_multiple_permission_checking() {
        let claims = create_test_claims();
        let auth_context = AuthContext::new(claims);

        assert!(auth_context
            .has_any_permission(&[Permission::ChallengeGenerate, Permission::BillingProcess]));
        assert!(!auth_context
            .has_any_permission(&[Permission::BillingProcess, Permission::AdminUserManage]));
        assert!(auth_context
            .has_all_permissions(&[Permission::ChallengeGenerate, Permission::ChallengeView]));
        assert!(!auth_context
            .has_all_permissions(&[Permission::ChallengeGenerate, Permission::BillingProcess]));
    }

    #[test]
    fn test_token_validity() {
        let mut claims = create_test_claims();
        let auth_context = AuthContext::new(claims.clone());

        // Token should be valid
        assert!(auth_context.is_valid());
        assert!(!auth_context.is_expired());
        assert!(!auth_context.is_not_yet_valid());

        // Test expired token
        claims.exp = chrono::Utc::now().timestamp() - 3600; // 1 hour ago
        let expired_context = AuthContext::new(claims.clone());
        assert!(!expired_context.is_valid());
        assert!(expired_context.is_expired());

        // Test not yet valid token
        claims.exp = chrono::Utc::now().timestamp() + 3600; // 1 hour from now
        claims.nbf = chrono::Utc::now().timestamp() + 1800; // 30 minutes from now
        let future_context = AuthContext::new(claims);
        assert!(!future_context.is_valid());
        assert!(future_context.is_not_yet_valid());
    }

    #[test]
    fn test_time_until_expiry() {
        let claims = create_test_claims();
        let auth_context = AuthContext::new(claims);

        let time_until_expiry = auth_context.time_until_expiry();
        assert!(time_until_expiry.is_some());
        assert!(time_until_expiry.unwrap() > 3500); // Should be close to 3600 seconds
        assert!(time_until_expiry.unwrap() <= 3600);
    }
}
