use anyhow::Result;
use serde_json;
use tracing::{info, warn, error};

use super::ZitadelOrganizationService;

impl ZitadelOrganizationService {
    /// Find user by email in organization
    pub async fn find_user_by_email(
        &self,
        org_id: &str,
        email: &str,
    ) -> Result<Option<String>> {
        let url = format!("{}/management/v1/users/_search", self.base_url);
        
        let request = serde_json::json!({
            "query": {
                "offset": 0,
                "limit": 10
            },
            "queries": [
                {
                    "email_query": {
                        "email_address": email,
                        "method": "TEXT_QUERY_METHOD_EQUALS"
                    }
                }
            ]
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
            warn!("Failed to search user by email: {} - {}", status, text);
            return Ok(None);
        }

        let search_result: serde_json::Value = response.json().await?;
        
        if let Some(result) = search_result.get("result") {
            if let Some(users) = result.as_array() {
                if let Some(user) = users.first() {
                    if let Some(user_id) = user.get("id").and_then(|id| id.as_str()) {
                        return Ok(Some(user_id.to_string()));
                    }
                }
            }
        }

        Ok(None)
    }

    /// Assign role to user in project via User Grant (creates Authorization in Project view)
    pub async fn assign_user_project_role(
        &self,
        org_id: &str,
        project_id: &str,
        user_id: &str,
        role_key: &str,
    ) -> Result<()> {
        // Для пользователей внутри организации используем только User Grants API
        // Project Grants предназначены для других организаций
        info!("Creating user grant for user {} in project {} with role {}", user_id, project_id, role_key);
        
        let url = format!("{}/management/v1/users/{}/grants", self.base_url, user_id);
        
        let request = serde_json::json!({
            "projectId": project_id,
            "roleKeys": [role_key]
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
            
            // Если User Grant уже существует (409), это не ошибка
            if status == 409 {
                info!("User grant already exists for user {} in project {}, checking if role needs to be updated", user_id, project_id);
                
                // Пробуем обновить роли в существующем гранте
                return self.update_user_grant_roles(org_id, project_id, user_id, role_key).await;
            }
            
            error!("Failed to assign role {} to user {} via user grants: {} - {}", role_key, user_id, status, text);
            return Err(anyhow::anyhow!("Failed to create user grant: {} - {}", status, text));
        }

        let response_data: serde_json::Value = response.json().await?;
        let grant_id = response_data.get("grantId").and_then(|v| v.as_str()).unwrap_or("unknown");
        
        info!("✅ Assigned role {} to user {} in project {} via User Grants (Grant ID: {}, Authorization created in Project view)", role_key, user_id, project_id, grant_id);
        Ok(())
    }

    /// Update roles in existing user grant
    async fn update_user_grant_roles(
        &self,
        org_id: &str,
        project_id: &str,
        user_id: &str,
        role_key: &str,
    ) -> Result<()> {
        // Сначала получаем существующий grant
        let search_url = format!("{}/management/v1/users/{}/grants/_search", self.base_url, user_id);
        
        let search_request = serde_json::json!({
            "query": { "offset": 0, "limit": 100 }
        });

        let search_response = self
            .client
            .post(&search_url)
            .header("Authorization", format!("Bearer {}", self.service_token))
            .header("Content-Type", "application/json")
            .header("x-zitadel-orgid", org_id)
            .json(&search_request)
            .send()
            .await?;

        if !search_response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to search user grants"));
        }

        let search_data: serde_json::Value = search_response.json().await?;
        let empty_vec = vec![];
        let grants = search_data.get("result").and_then(|r| r.as_array()).unwrap_or(&empty_vec);
        
        // Ищем grant для нашего проекта
        let project_grant = grants.iter().find(|g| {
            g.get("projectId").and_then(|p| p.as_str()) == Some(project_id)
        });

        if let Some(grant) = project_grant {
            let grant_id = grant.get("grantId").and_then(|g| g.as_str()).unwrap_or("");
            let mut existing_roles: Vec<String> = grant.get("roleKeys")
                .and_then(|r| r.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            // Добавляем новую роль если ее нет
            if !existing_roles.contains(&role_key.to_string()) {
                existing_roles.push(role_key.to_string());
                
                // Обновляем grant
                let update_url = format!("{}/management/v1/users/{}/grants/{}", self.base_url, user_id, grant_id);
                
                let update_request = serde_json::json!({
                    "roleKeys": existing_roles
                });

                let update_response = self
                    .client
                    .put(&update_url)
                    .header("Authorization", format!("Bearer {}", self.service_token))
                    .header("Content-Type", "application/json")
                    .header("x-zitadel-orgid", org_id)
                    .json(&update_request)
                    .send()
                    .await?;

                if update_response.status().is_success() {
                    info!("✅ Updated user grant {} with role {}", grant_id, role_key);
                } else {
                    let status = update_response.status();
                    let text = update_response.text().await.unwrap_or_default();
                    warn!("Failed to update user grant: {} - {}", status, text);
                }
            } else {
                info!("✅ User already has role {} in project {}", role_key, project_id);
            }
        }

        Ok(())
    }

    /// Alternative method: Assign role via User Grants API (legacy method)
    async fn create_user_grant_legacy(
        &self,
        org_id: &str,
        project_id: &str,
        user_id: &str,
        role_key: &str,
    ) -> Result<()> {
        let url = format!("{}/management/v1/users/{}/grants", self.base_url, user_id);
        
        let request = serde_json::json!({
            "projectId": project_id,
            "roleKeys": [role_key]
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
            error!("Failed to assign role {} to user {} via user grants: {} - {}", role_key, user_id, status, text);
            return Err(anyhow::anyhow!("Failed to assign role via both methods: {}", status));
        }

        info!("✅ Assigned role {} to user {} in project {} via User Grants", role_key, user_id, project_id);
        Ok(())
    }

    /// Assign default role to user after registration
    pub async fn assign_default_role_to_user(
        &self,
        org_id: &str,
        project_id: &str,
        user_email: &str,
        organization_type: &str,
    ) -> Result<()> {
        info!("Assigning default role to user {} in organization {}", user_email, org_id);

        // Ищем пользователя по email
        let user_id = match self.find_user_by_email(org_id, user_email).await? {
            Some(id) => id,
            None => {
                warn!("User with email {} not found in organization {}", user_email, org_id);
                return Err(anyhow::anyhow!("User not found"));
            }
        };

        // Определяем роль на основе типа организации
        let role_key = match organization_type {
            "advertiser" => "adquest.advertiser",
            "publisher" => "adquest.publisher", 
            "agency" => "adquest.advertiser", // Агентства получают права рекламодателя
            _ => "adquest.moderator" // По умолчанию только просмотр
        };

        // Присваиваем роль
        self.assign_user_project_role(org_id, project_id, &user_id, role_key).await?;

        // Также делаем пользователя владельцем организации
        if let Err(e) = self.make_user_organization_owner(org_id, &user_id).await {
            warn!("Failed to make user organization owner: {}", e);
            // Не критично, продолжаем
        }

        Ok(())
    }
}