use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::debug;

use super::CloudRuConfig;

const IAM_API_URL: &str = "https://iam.api.cloud.ru/api/v1";
const SECRET_API_URL: &str = "https://secretmanager.api.cloud.ru/v2";
const TOKEN_BUFFER_SECONDS: u64 = 300;

#[derive(Debug, Deserialize)]
struct AuthToken {
    access_token: String,
    expires_in: u64,
}

#[derive(Debug, Serialize)]
struct AuthRequest {
    #[serde(rename = "keyId")]
    key_id: String,
    secret: String,
}

#[derive(Debug, Deserialize)]
struct SecretPayload {
    payload: String,
}

pub struct CloudRuClient {
    config: CloudRuConfig,
    token: Option<String>,
    token_expires_at: u64,
    client: reqwest::Client,
}

impl CloudRuClient {
    pub fn new(config: CloudRuConfig) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            config,
            token: None,
            token_expires_at: 0,
            client,
        })
    }

    async fn get_token(&mut self) -> Result<String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(ref token) = self.token {
            if now < self.token_expires_at.saturating_sub(TOKEN_BUFFER_SECONDS) {
                return Ok(token.clone());
            }
        }

        debug!("Requesting new authentication token from Cloud.ru IAM");

        let auth_request = AuthRequest {
            key_id: self.config.key_id.clone(),
            secret: self.config.key_secret.clone(),
        };

        let response = self
            .client
            .post(format!("{}/auth/token", IAM_API_URL))
            .json(&auth_request)
            .send()
            .await
            .context("Failed to send authentication request")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("Authentication failed: {} - {}", status, error_text);
        }

        let auth_token: AuthToken = response
            .json()
            .await
            .context("Failed to parse authentication response")?;

        self.token = Some(auth_token.access_token.clone());
        self.token_expires_at = now + auth_token.expires_in;

        debug!("Successfully obtained authentication token");

        Ok(auth_token.access_token)
    }

    pub async fn get_secret(&mut self, path: &str) -> Result<String> {
        let token = self.get_token().await?;

        let url = format!(
            "{}/version/{}?projectId={}",
            SECRET_API_URL, path, self.config.project_id
        );

        debug!("Fetching secret from path: {}", path);

        let response = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .context(format!("Failed to get secret '{}'", path))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("Failed to get secret '{}': {} - {}", path, status, error_text);
        }

        let secret_payload: SecretPayload = response
            .json()
            .await
            .context(format!("Failed to parse secret response for '{}'", path))?;

        let decoded = BASE64
            .decode(&secret_payload.payload)
            .context(format!("Failed to decode base64 payload for '{}'", path))?;

        String::from_utf8(decoded).context(format!("Secret '{}' contains invalid UTF-8", path))
    }

    pub async fn create_secret(&mut self, path: &str, value: &str) -> Result<()> {
        let token = self.get_token().await?;
        let payload = BASE64.encode(value.as_bytes());

        let body = serde_json::json!({
            "projectId": self.config.project_id,
            "path": path,
            "payload": payload,
        });

        let response = self
            .client
            .post(format!("{}/secret", SECRET_API_URL))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", token))
            .json(&body)
            .send()
            .await
            .context(format!("Failed to create secret '{}'", path))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("Failed to create secret '{}': {} - {}", path, status, error_text);
        }

        Ok(())
    }

    pub async fn update_secret(&mut self, path: &str, value: &str) -> Result<()> {
        let token = self.get_token().await?;
        let payload = BASE64.encode(value.as_bytes());

        let body = serde_json::json!({
            "projectId": self.config.project_id,
            "path": path,
            "payload": payload,
        });

        let response = self
            .client
            .post(format!("{}/version", SECRET_API_URL))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", token))
            .json(&body)
            .send()
            .await
            .context(format!("Failed to update secret '{}'", path))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("Failed to update secret '{}': {} - {}", path, status, error_text);
        }

        Ok(())
    }
}

impl Clone for CloudRuClient {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            token: self.token.clone(),
            token_expires_at: self.token_expires_at,
            client: self.client.clone(),
        }
    }
}
