use anyhow::{Context, Result};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{info, warn};

use super::{client::CloudRuClient, config::{should_use_cloudru_secrets, CloudRuConfig}};

#[derive(Debug, Clone)]
pub struct SecretMapping {
    pub env_var_name: String,
    pub cloudru_path: String,
    pub is_critical: bool,
}

fn get_secrets_mapping(folder: &str) -> Vec<SecretMapping> {
    vec![
        SecretMapping {
            env_var_name: "DATABASE_URL".to_string(),
            cloudru_path: format!("{}/DATABASE_URL", folder),
            is_critical: true,
        },
        SecretMapping {
            env_var_name: "DATABASE_PASSWORD".to_string(),
            cloudru_path: format!("{}/DATABASE_PASSWORD", folder),
            is_critical: true,
        },
        SecretMapping {
            env_var_name: "JWT_SECRET".to_string(),
            cloudru_path: format!("{}/JWT_SECRET", folder),
            is_critical: true,
        },
        SecretMapping {
            env_var_name: "ENCRYPTION_KEY".to_string(),
            cloudru_path: format!("{}/ENCRYPTION_KEY", folder),
            is_critical: true,
        },
        SecretMapping {
            env_var_name: "ZITADEL_SERVICE_ACCOUNT_SECRET".to_string(),
            cloudru_path: format!("{}/ZITADEL_SERVICE_ACCOUNT_SECRET", folder),
            is_critical: true,
        },
        SecretMapping {
            env_var_name: "ZITADEL_CLIENT_SECRET".to_string(),
            cloudru_path: format!("{}/ZITADEL_CLIENT_SECRET", folder),
            is_critical: false,  // Not critical - PAT validation is optional
        },
        SecretMapping {
            env_var_name: "ZITADEL_PAT_TOKEN".to_string(),
            cloudru_path: format!("{}/ZITADEL_PAT_TOKEN", folder),
            is_critical: true,
        },
        SecretMapping {
            env_var_name: "TBANK_API_TOKEN".to_string(),
            cloudru_path: format!("{}/TBANK_API_TOKEN", folder),
            is_critical: false,
        },
        SecretMapping {
            env_var_name: "TBANK_TERMINAL_KEY".to_string(),
            cloudru_path: format!("{}/TBANK_TERMINAL_KEY", folder),
            is_critical: false,
        },
        SecretMapping {
            env_var_name: "TBANK_WEBHOOK_SECRET".to_string(),
            cloudru_path: format!("{}/TBANK_WEBHOOK_SECRET", folder),
            is_critical: false,
        },
        SecretMapping {
            env_var_name: "TBANK_ENCRYPTION_KEY".to_string(),
            cloudru_path: format!("{}/TBANK_ENCRYPTION_KEY", folder),
            is_critical: false,
        },
        SecretMapping {
            env_var_name: "TBANK_EMAIL_PASSWORD".to_string(),
            cloudru_path: format!("{}/TBANK_EMAIL_PASSWORD", folder),
            is_critical: false,
        },
        SecretMapping {
            env_var_name: "ERIR_API_KEY".to_string(),
            cloudru_path: format!("{}/ERIR_API_KEY", folder),
            is_critical: false,
        },
    ]
}

async fn load_secrets_from_cloudru() -> Result<()> {
    let start_time = Instant::now();

    info!("Loading secrets from Cloud.ru Secret Management");

    let config = CloudRuConfig::from_env()
        .context("Failed to load Cloud.ru configuration from environment")?;

    let folder = config.folder_path.clone();
    let client = CloudRuClient::new(config)
        .context("Failed to create Cloud.ru client")?;

    let secrets_mapping = get_secrets_mapping(&folder);

    let mut tasks: Vec<tokio::task::JoinHandle<Result<(String, bool)>>> = Vec::new();
    for secret_config in secrets_mapping.iter() {
        let mut client_clone = client.clone();
        let config_clone = secret_config.clone();

        tasks.push(tokio::spawn(async move {
            match client_clone.get_secret(&config_clone.cloudru_path).await {
                Ok(value) => {
                    std::env::set_var(&config_clone.env_var_name, &value);
                    Ok((config_clone.env_var_name, true))
                }
                Err(e) => {
                    warn!(
                        "Failed to load secret '{}' for {}: {}",
                        config_clone.cloudru_path, config_clone.env_var_name, e
                    );
                    Ok((config_clone.env_var_name, false))
                }
            }
        }));
    }

    let mut results = HashMap::new();
    for task in tasks {
        match task.await {
            Ok(Ok((env_var, success))) => {
                results.insert(env_var, success);
            }
            Ok(Err(e)) => {
                warn!("Task error: {}", e);
            }
            Err(e) => {
                warn!("Task join error: {}", e);
            }
        }
    }

    let success_count = results.values().filter(|&&v| v).count();
    let fail_count = results.values().filter(|&&v| !v).count();

    let duration = start_time.elapsed();

    if fail_count == 0 {
        info!(
            "Successfully loaded {} secrets from Cloud.ru in {:?}",
            success_count, duration
        );
    } else {
        warn!(
            "Loaded {} secrets, {} failed in {:?}",
            success_count, fail_count, duration
        );

        let missing_critical: Vec<_> = secrets_mapping
            .iter()
            .filter(|s| s.is_critical && !results.get(&s.env_var_name).unwrap_or(&false))
            .map(|s| s.env_var_name.as_str())
            .collect();

        if !missing_critical.is_empty() {
            anyhow::bail!("Failed to load critical secrets: {}", missing_critical.join(", "));
        }
    }

    Ok(())
}

pub async fn init_secrets() -> Result<()> {
    if should_use_cloudru_secrets() {
        load_secrets_from_cloudru().await?;
    } else {
        info!("Using secrets from environment variables (Cloud.ru disabled)");
    }

    Ok(())
}

pub fn validate_required_secrets() -> Result<()> {
    let required_secrets = vec!["DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"];

    let missing: Vec<_> = required_secrets
        .iter()
        .filter(|&&secret| std::env::var(secret).is_err())
        .copied()
        .collect();

    if !missing.is_empty() {
        anyhow::bail!("Missing required secrets: {}", missing.join(", "));
    }

    let recommended = vec![
        "ZITADEL_SERVICE_ACCOUNT_SECRET",
        "ZITADEL_PAT_TOKEN",
        "TBANK_API_TOKEN",
    ];

    let missing_recommended: Vec<_> = recommended
        .iter()
        .filter(|&&secret| std::env::var(secret).is_err())
        .copied()
        .collect();

    if !missing_recommended.is_empty() {
        warn!("Missing recommended secrets: {}", missing_recommended.join(", "));
    }

    Ok(())
}
