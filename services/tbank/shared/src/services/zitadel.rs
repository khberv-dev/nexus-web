use anyhow::Result;
use reqwest::Client;
use std::env;
use tracing::{info, warn};

// Подмодули для разделения функциональности
mod applications;
mod organizations;
mod projects;
mod types;
mod users;
mod project_roles;
mod user_roles;

// Экспортируем публичные типы
pub use types::*;

/// Zitadel organization creation service for B2B onboarding
/// Creates organizations, projects, and OIDC apps, allowing users to self-register
pub struct ZitadelOrganizationService {
    client: Client,
    base_url: String,
    service_token: String,
    admin_redirect_uri: String,
    localhost_redirect_uri: String,
    platform_org_id: String,
    platform_project_id: String,
}

impl ZitadelOrganizationService {
    pub fn new() -> Result<Self> {
        let base_url = env::var("ZITADEL_ISSUER")
            .unwrap_or_else(|_| "https://auth.ad-quest.ru".to_string());
        
        // Try JWT token first (preferred), fallback to PAT token
        let service_token = env::var("ZITADEL_SERVICE_ACCOUNT_TOKEN")
            .or_else(|_| env::var("ZITADEL_PAT_TOKEN"))
            .map_err(|_| anyhow::anyhow!("ZITADEL_SERVICE_ACCOUNT_TOKEN or ZITADEL_PAT_TOKEN environment variable is required"))?;

        let admin_redirect_uri = env::var("ZITADEL_ADMIN_REDIRECT_URI")
            .unwrap_or_else(|_| "https://ad-quest.ru/callback".to_string());

        let localhost_redirect_uri = env::var("ZITADEL_LOCALHOST_REDIRECT_URI")
            .unwrap_or_else(|_| "http://localhost:3000/callback".to_string());

        let platform_org_id = env::var("ZITADEL_PLATFORM_ORG_ID")
            .unwrap_or_else(|_| {
                warn!("ZITADEL_PLATFORM_ORG_ID not set, using default");
                "356291810764587018".to_string()
            });

        let platform_project_id = env::var("ZITADEL_PLATFORM_PROJECT_ID")
            .unwrap_or_else(|_| {
                warn!("ZITADEL_PLATFORM_PROJECT_ID not set, using default");
                "356435568101425155".to_string()
            });

        info!("Zitadel service initialized with base_url: {}", base_url);

        Ok(Self {
            client: Client::new(),
            base_url,
            service_token,
            admin_redirect_uri,
            localhost_redirect_uri,
            platform_org_id,
            platform_project_id,
        })
    }

    /// Create complete organization setup in Zitadel for self-registration
    /// Creates organization, project, and OIDC app, but lets user register themselves
    pub async fn create_organization_complete(
        &self,
        org_name: &str,
        owner_email: &str,
        _owner_first_name: &str,
        _owner_last_name: &str,
        organization_type: &str,
        inn: Option<&str>,
    ) -> Result<OrganizationCreationResult> {
        // Генерируем правильное имя организации в Zitadel
        let zitadel_org_name = match organization_type {
            "advertiser" | "agency" => {
                if let Some(inn_value) = inn {
                    // Добавляем timestamp для уникальности
                    let timestamp = chrono::Utc::now().timestamp();
                    format!("adquest_{}_{}", inn_value, timestamp)
                } else {
                    // Fallback если ИНН не указан
                    let timestamp = chrono::Utc::now().timestamp();
                    format!("adquest_{}_{}", org_name.to_lowercase().replace(' ', "_"), timestamp)
                }
            },
            "publisher" => {
                // Для паблишеров используем email как идентификатор + timestamp
                let email_prefix = owner_email.split('@').next().unwrap_or("publisher");
                let timestamp = chrono::Utc::now().timestamp();
                format!("adquest_{}_{}", email_prefix.replace('.', "_"), timestamp)
            },
            _ => {
                let timestamp = chrono::Utc::now().timestamp();
                format!("adquest_{}_{}", org_name.to_lowercase().replace(' ', "_"), timestamp)
            }
        };

        info!("Creating Zitadel organization for self-registration: {} (Zitadel name: {})", org_name, zitadel_org_name);

        // 1. Create organization only (no user creation)
        let org = self.create_organization(&zitadel_org_name).await?;
        info!("✅ Zitadel organization created: {}", org.id);

        // 2. Create project in the new organization
        let project = self.create_project(&org.id, "ADQuest Services").await?;
        info!("✅ Zitadel project created: {}", project.id);

        // 3. Create OIDC application
        let app = self.create_oidc_app(&org.id, &project.id, &zitadel_org_name).await?;
        info!("✅ Zitadel OIDC app created: {}", app.client_id);

        // 3.5. Create project roles for the organization
        if let Err(e) = self.create_project_roles(&org.id, &project.id).await {
            warn!("Failed to create project roles: {}", e);
            // Не критично, продолжаем
        }

        // 4. Add organization domain for proper user login names
        let org_domain = format!("{}.auth.ad-quest.ru", zitadel_org_name.to_lowercase().replace('_', "-"));
        if let Err(e) = self.add_organization_domain(&org.id, &org_domain).await {
            warn!("Failed to add organization domain {}: {}", org_domain, e);
            // Не критично, продолжаем
        } else {
            // Пытаемся сделать домен primary
            if let Err(e) = self.set_primary_domain(&org.id, &org_domain).await {
                warn!("Failed to set primary domain {}: {}", org_domain, e);
            }
        }

        // 5. Generate OAuth authorization URL with organization context for self-registration
        // Используем organization scope согласно документации Zitadel
        let org_scope = format!("urn:zitadel:iam:org:id:{}", org.id);
        let login_url = format!(
            "{}/oauth/v2/authorize?client_id={}&response_type=code&scope=openid profile email {}&redirect_uri=https://ad-quest.ru/callback&login_hint={}&prompt=login",
            self.base_url, app.client_id, org_scope, owner_email
        );
        
        // Fallback URL с параметром org_id (если scope не работает)
        let fallback_login_url = format!(
            "{}/oauth/v2/authorize?client_id={}&response_type=code&scope=openid profile email&redirect_uri=https://ad-quest.ru/callback&login_hint={}&prompt=login&org_id={}",
            self.base_url, app.client_id, owner_email, org.id
        );

        info!("✅ Organization setup complete. User will self-register at: {}", login_url);
        info!("🔍 OAuth parameters: client_id={}, org_id={}, zitadel_name={}", app.client_id, org.id, zitadel_org_name);
        info!("🔄 Fallback URL: {}", fallback_login_url);

        Ok(OrganizationCreationResult {
            org_id: org.id,
            project_id: project.id,
            client_id: app.client_id,
            login_url,
        })
    }
}