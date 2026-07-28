use anyhow::Result;
use tracing::{error};

use super::types::*;
use super::ZitadelOrganizationService;

impl ZitadelOrganizationService {
    /// Create user in Zitadel organization
    pub(super) async fn create_user_in_organization(
        &self,
        org_id: &str,
        email: &str,
        first_name: &str,
        last_name: &str,
    ) -> Result<ZitadelUserResponse> {
        let url = format!("{}/management/v1/users/human", self.base_url);
        
        // Генерируем временный пароль
        let temp_password = format!("TempPass{}!", chrono::Utc::now().timestamp());
        
        let request = CreateZitadelUserRequest {
            user_name: email.to_string(),
            profile: ZitadelUserProfile {
                first_name: first_name.to_string(),
                last_name: last_name.to_string(),
                display_name: format!("{} {}", first_name, last_name),
                preferred_language: "ru".to_string(),
            },
            email: ZitadelUserEmail {
                email: email.to_string(),
                is_email_verified: true, // Считаем email проверенным
            },
            initial_password: temp_password,
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_token))
            .header("Content-Type", "application/json")
            .header("x-zitadel-orgid", org_id)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("Failed to create Zitadel user: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to create user: {}", status));
        }

        let user: ZitadelUserResponse = response.json().await?;
        Ok(user)
    }

    /// Grant user access to organization as member
    pub(super) async fn add_user_to_organization(
        &self,
        org_id: &str,
        user_id: &str,
    ) -> Result<()> {
        let url = format!("{}/management/v1/orgs/me/members", self.base_url);
        
        let request = serde_json::json!({
            "user_id": user_id,
            "roles": ["ORG_USER_SELF_MANAGER"]
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_token))
            .header("Content-Type", "application/json")
            .header("x-zitadel-orgid", org_id)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("Failed to add user to organization: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to add user to org: {}", status));
        }

        Ok(())
    }

    /// Make user organization owner
    pub(super) async fn make_user_organization_owner(
        &self,
        org_id: &str,
        user_id: &str,
    ) -> Result<()> {
        let url = format!("{}/management/v1/orgs/me/members", self.base_url);
        
        let request = serde_json::json!({
            "user_id": user_id,
            "roles": ["ORG_OWNER"]
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_token))
            .header("Content-Type", "application/json")
            .header("x-zitadel-orgid", org_id)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("Failed to make user organization owner: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to make user org owner: {}", status));
        }

        Ok(())
    }
}