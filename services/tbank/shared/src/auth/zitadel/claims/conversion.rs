use anyhow::Result;
use uuid::Uuid;

use crate::auth::Claims;
use super::types::ZitadelClaims;

impl ZitadelClaims {
    /// Convert Zitadel claims to ADQuest claims
    pub fn to_adquest_claims(&self) -> Result<Claims> {
        let user_id = Uuid::parse_str(&self.sub).or_else(|_| {
            // If sub is not a UUID, generate one based on sub
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            use std::hash::{Hash, Hasher};
            self.sub.hash(&mut hasher);
            let hash = hasher.finish();
            Ok::<Uuid, uuid::Error>(Uuid::from_u128(hash as u128))
        })?;

        let email = self.email.clone().unwrap_or_default();
        let roles = self.extract_roles();

        // Map Zitadel roles to ADQuest permissions
        let permissions = self.map_roles_to_permissions(&roles);

        let organization_id = self.org_id.as_ref().and_then(|id| Uuid::parse_str(id).ok());

        Ok(Claims {
            sub: self.sub.clone(),
            iss: self.iss.clone(),
            aud: self.aud.first().cloned().unwrap_or_default(),
            exp: self.exp,
            iat: self.iat,
            nbf: self.nbf.unwrap_or(self.iat),
            jti: self
                .jti
                .clone()
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
            user_id,
            email,
            roles,
            permissions,
            organization_id,
            session_id: format!("zitadel_{}", self.sub),
        })
    }

    /// Map Zitadel roles to ADQuest permissions
    pub fn map_roles_to_permissions(&self, roles: &[String]) -> Vec<String> {
        let mut permissions = Vec::new();

        for role in roles {
            match role.as_str() {
                "adquest.advertiser" => {
                    permissions.extend_from_slice(&[
                        "challenge:generate",
                        "challenge:view",
                        "advertiser:campaign_manage",
                        "advertiser:stats_view",
                        "advertiser:billing_view",
                        "erir:register",
                        "erir:view",
                    ]);
                }
                "adquest.publisher" => {
                    permissions.extend_from_slice(&[
                        "challenge:validate",
                        "challenge:view",
                        "publisher:site_manage",
                        "publisher:stats_view",
                        "publisher:payout_view",
                    ]);
                }
                "adquest.admin" => {
                    permissions.extend_from_slice(&[
                        "challenge:generate",
                        "challenge:validate",
                        "challenge:view",
                        "erir:register",
                        "erir:view",
                        "erir:audit",
                        "billing:process",
                        "billing:view",
                        "billing:audit",
                        "billing:refund",
                        "admin:user_manage",
                        "admin:system_config",
                        "admin:metrics_view",
                        "publisher:site_manage",
                        "publisher:stats_view",
                        "publisher:payout_view",
                        "advertiser:campaign_manage",
                        "advertiser:stats_view",
                        "advertiser:billing_view",
                    ]);
                }
                "adquest.moderator" => {
                    permissions.extend_from_slice(&[
                        "challenge:view",
                        "erir:view",
                        "erir:audit",
                        "billing:view",
                        "billing:audit",
                        "admin:metrics_view",
                    ]);
                }
                "adquest.compliance.officer" => {
                    permissions.extend_from_slice(&[
                        "erir:register",
                        "erir:view",
                        "erir:audit",
                        "billing:audit",
                        "admin:metrics_view",
                        "personal_data:access",
                        "personal_data:export",
                        "audit:view",
                        "audit:export",
                        "compliance:manage",
                        "compliance:report",
                    ]);
                }
                "adquest.data.processor" => {
                    permissions.extend_from_slice(&[
                        "personal_data:access",
                        "personal_data:modify",
                        "personal_data:delete",
                        "audit:view",
                        "data:process",
                        "data:anonymize",
                    ]);
                }
                "adquest.audit.viewer" => {
                    permissions.extend_from_slice(&[
                        "audit:view",
                        "audit:export",
                        "billing:audit",
                        "erir:audit",
                        "compliance:view",
                    ]);
                }
                "adquest.erir.manager" => {
                    permissions.extend_from_slice(&[
                        "erir:register",
                        "erir:validate",
                        "erir:report",
                        "erir:manage",
                        "erir:view",
                        "erir:audit",
                        "erir:delete",
                        "erir:update",
                    ]);
                }
                _ => {
                    // Unknown role, skip
                }
            }
        }

        // Remove duplicates
        permissions.sort();
        permissions.dedup();
        permissions.into_iter().map(|s| s.to_string()).collect()
    }
}
