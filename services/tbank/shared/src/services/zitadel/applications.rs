use anyhow::Result;
use tracing::{error};

use super::types::*;
use super::ZitadelOrganizationService;

impl ZitadelOrganizationService {
    /// Create OIDC application in Zitadel project
    pub(super) async fn create_oidc_app(
        &self,
        org_id: &str,
        project_id: &str,
        app_name: &str,
    ) -> Result<ZitadelAppResponse> {
        let url = format!("{}/management/v1/projects/{}/apps/oidc", self.base_url, project_id);
        
        let request = CreateZitadelAppRequest {
            name: format!("{} Dashboard", app_name),
            redirect_uris: vec![
                self.admin_redirect_uri.clone(),
                self.localhost_redirect_uri.clone(),
            ],
            post_logout_redirect_uris: vec![
                self.admin_redirect_uri.replace("/callback", "/login"),
                self.localhost_redirect_uri.replace("/callback", "/login"),
            ],
            response_types: vec!["OIDC_RESPONSE_TYPE_CODE".to_string()],
            grant_types: vec![
                "OIDC_GRANT_TYPE_AUTHORIZATION_CODE".to_string(),
                "OIDC_GRANT_TYPE_REFRESH_TOKEN".to_string(),
            ],
            app_type: "OIDC_APP_TYPE_WEB".to_string(), // Web приложение для server-side flow
            auth_method_type: "OIDC_AUTH_METHOD_TYPE_NONE".to_string(), // Без client secret для публичного клиента
            version: "OIDC_VERSION_1_0".to_string(),
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
            error!("Failed to create Zitadel OIDC app: {} - {}", status, text);
            return Err(anyhow::anyhow!("Failed to create OIDC app: {}", status));
        }

        let app: ZitadelAppResponse = response.json().await?;
        Ok(app)
    }
}