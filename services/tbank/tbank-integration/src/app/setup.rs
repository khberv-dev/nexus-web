use anyhow::Result;
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::{middleware::init_structured_logging, TBankConfig, TBankServiceFactory, TBankServices};

/// Application setup and initialization
pub struct AppSetup;

impl AppSetup {
    /// Load configuration from environment variables
    pub async fn load_config() -> Result<TBankConfig> {
        // Load secrets from Cloud.ru if enabled (must be before config loading)
        shared::secrets::init_secrets().await?;

        match TBankConfig::from_env() {
            Ok(config) => {
                info!(
                    environment = ?config.environment,
                    "Configuration loaded successfully"
                );
                Ok(config)
            }
            Err(e) => {
                eprintln!("Failed to load configuration: {}", e);
                Err(e.into())
            }
        }
    }

    /// Initialize structured logging based on environment
    pub fn init_logging(config: &TBankConfig) -> Result<()> {
        if let Err(e) = init_structured_logging(&config.environment) {
            eprintln!("Failed to initialize logging: {}", e);
            return Err(anyhow::anyhow!("Logging initialization failed: {}", e));
        }

        info!(
            environment = ?config.environment,
            service = "tbank-integration",
            version = "0.1.0",
            "Structured logging initialized"
        );

        Ok(())
    }

    /// Initialize all T-Bank services
    pub async fn init_services(config: TBankConfig) -> Result<Arc<TBankServices>> {
        info!("Initializing T-Bank services...");

        match TBankServiceFactory::create_with_config(config.clone()).await {
            Ok(services) => {
                let services = Arc::new(services);
                info!("All services initialized successfully");

                // Perform initial health check
                match services.health_check().await {
                    Ok(health_status) => {
                        info!(
                            health_status = %serde_json::to_string_pretty(&health_status)
                                .unwrap_or_default(),
                            "Initial health check completed"
                        );
                    }
                    Err(e) => {
                        warn!(error = %e, "Initial health check failed, but continuing startup");
                    }
                }

                Ok(services)
            }
            Err(e) => {
                error!(error = %e, "Failed to initialize T-Bank services");
                Err(anyhow::anyhow!("Service initialization failed: {}", e))
            }
        }
    }
}
