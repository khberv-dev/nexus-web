use anyhow::Result;
use serde_json;
use tracing::{info, warn, error};

use super::ZitadelOrganizationService;

impl ZitadelOrganizationService {
    /// Create project roles for organization
    pub async fn create_project_roles(
        &self,
        org_id: &str,
        project_id: &str,
    ) -> Result<()> {
        info!("Creating project roles for organization {}", org_id);

        let roles = vec![
            ("adquest.admin", "ADQuest Administrator", "Full access to all ADQuest features"),
            ("adquest.advertiser", "Advertiser", "Can generate challenges and manage advertising campaigns"),
            ("adquest.publisher", "Publisher", "Can validate challenges and manage ad placements"),
            ("adquest.moderator", "Moderator", "Read-only access for moderation purposes"),
        ];

        for (key, display_name, description) in roles {
            if let Err(e) = self.create_project_role(org_id, project_id, key, display_name, description).await {
                warn!("Failed to create role {}: {}", key, e);
                // Продолжаем создание других ролей
            } else {
                info!("✅ Created role: {}", key);
            }
        }

        Ok(())
    }

    /// Create a single project role
    async fn create_project_role(
        &self,
        org_id: &str,
        project_id: &str,
        role_key: &str,
        display_name: &str,
        description: &str,
    ) -> Result<()> {
        let url = format!("{}/management/v1/projects/{}/roles", self.base_url, project_id);
        
        let request = serde_json::json!({
            "roleKey": role_key,
            "displayName": display_name,
            "group": "ADQuest",
            "description": description
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
            error!("Failed to create project role {}: {} - {}", role_key, status, text);
            return Err(anyhow::anyhow!("Failed to create role: {}", status));
        }

        Ok(())
    }
}