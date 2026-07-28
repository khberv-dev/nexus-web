use anyhow::Result;
use tracing::error;

use super::types::*;
use super::ZitadelOrganizationService;

impl ZitadelOrganizationService {
    /// Create project in Zitadel organization
    pub(super) async fn create_project(&self, org_id: &str, project_name: &str) -> Result<ZitadelProjectResponse> {
        let url = format!("{}/management/v1/projects", self.base_url);
        
        let request = CreateZitadelProjectRequest {
            name: project_name.to_string(),
            project_role_assertion: true,
            project_role_check: true,
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
            error!("Failed to create Zitadel project: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to create project: {}", status));
        }

        let project: ZitadelProjectResponse = response.json().await?;
        Ok(project)
    }

    /// Grant user access to project
    pub(super) async fn grant_user_project_access(
        &self,
        org_id: &str,
        project_id: &str,
        user_id: &str,
    ) -> Result<()> {
        let url = format!("{}/management/v1/users/{}/grants", self.base_url, user_id);
        
        let request = CreateUserGrantRequest {
            project_id: project_id.to_string(),
            role_keys: vec!["adquest.admin".to_string()], // Даем полные права администратора
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
            error!("Failed to grant user project access: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to grant project access: {}", status));
        }

        Ok(())
    }
}