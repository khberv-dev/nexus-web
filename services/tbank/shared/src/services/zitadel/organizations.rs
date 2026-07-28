use anyhow::Result;
use tracing::{error, info};

use super::types::*;
use super::ZitadelOrganizationService;

impl ZitadelOrganizationService {
    /// Create organization in Zitadel
    pub(super) async fn create_organization(&self, name: &str) -> Result<ZitadelOrgResponse> {
        let url = format!("{}/management/v1/orgs", self.base_url);
        
        let request = CreateZitadelOrgRequest {
            name: name.to_string(),
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_token))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("Failed to create Zitadel organization: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to create organization: {}", status));
        }

        // Добавляем логирование ответа для отладки
        let response_text = response.text().await?;
        info!("Zitadel organization response: {}", response_text);
        
        let org: ZitadelOrgResponse = serde_json::from_str(&response_text)?;
        Ok(org)
    }

    /// Add domain to organization
    pub(super) async fn add_organization_domain(
        &self,
        org_id: &str,
        domain: &str,
    ) -> Result<()> {
        let url = format!("{}/management/v1/orgs/me/domains", self.base_url);
        
        let request = serde_json::json!({
            "domain": domain
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
            error!("Failed to add organization domain: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to add domain: {}", status));
        }

        info!("Domain {} added to organization {}", domain, org_id);
        Ok(())
    }

    /// Set domain as primary for organization
    pub(super) async fn set_primary_domain(
        &self,
        org_id: &str,
        domain: &str,
    ) -> Result<()> {
        let url = format!("{}/management/v1/orgs/me/domains/{}/primary", self.base_url, domain);
        
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_token))
            .header("Content-Type", "application/json")
            .header("x-zitadel-orgid", org_id)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("Failed to set primary domain: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to set primary domain: {}", status));
        }

        info!("Domain {} set as primary for organization {}", domain, org_id);
        Ok(())
    }

    /// Setup organization with first user using Zitadel Setup API
    pub(super) async fn setup_organization(
        &self,
        org_name: &str,
        owner_email: &str,
        owner_first_name: &str,
        owner_last_name: &str,
    ) -> Result<SetupResult> {
        let url = format!("{}/admin/v1/orgs/_setup", self.base_url);
        
        // Генерируем временный пароль
        let temp_password = format!("TempPass{}!", chrono::Utc::now().timestamp());
        
        let request = SetupOrganizationRequest {
            org: SetupOrgData {
                name: org_name.to_string(),
            },
            human: SetupHumanData {
                user_name: owner_email.to_string(),
                profile: ZitadelUserProfile {
                    first_name: owner_first_name.to_string(),
                    last_name: owner_last_name.to_string(),
                    display_name: format!("{} {}", owner_first_name, owner_last_name),
                    preferred_language: "ru".to_string(),
                },
                email: ZitadelUserEmail {
                    email: owner_email.to_string(),
                    is_email_verified: true,
                },
                password: temp_password,
            },
            roles: vec!["ORG_OWNER".to_string()], // Автоматически назначаем роль владельца
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_token))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!("Failed to setup organization: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to setup organization: {}", status));
        }

        let setup_response: SetupOrganizationResponse = response.json().await?;
        
        Ok(SetupResult {
            org_id: setup_response.org_id,
            user_id: setup_response.user_id,
        })
    }
}