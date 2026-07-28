use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct CloudRuConfig {
    pub key_id: String,
    pub key_secret: String,
    pub project_id: String,
    pub folder_path: String,
}

impl CloudRuConfig {
    pub fn from_env() -> Result<Self> {
        let key_id = std::env::var("CLOUDRU_KEY_ID")
            .context("CLOUDRU_KEY_ID environment variable not set")?;
        let key_secret = std::env::var("CLOUDRU_KEY_SECRET")
            .context("CLOUDRU_KEY_SECRET environment variable not set")?;
        let project_id = std::env::var("CLOUDRU_PROJECT_ID")
            .context("CLOUDRU_PROJECT_ID environment variable not set")?;
        let folder_path = std::env::var("CLOUDRU_FOLDER_PATH")
            .unwrap_or_else(|_| "adquest-core".to_string());

        Ok(Self {
            key_id,
            key_secret,
            project_id,
            folder_path,
        })
    }
}

pub fn should_use_cloudru_secrets() -> bool {
    std::env::var("USE_CLOUDRU_SECRETS")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false)
}
