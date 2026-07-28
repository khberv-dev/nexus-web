use anyhow::Result;

use tbank_integration::app::{AppSetup, AppStartup};

#[tokio::main]
async fn main() -> Result<()> {
    // Load configuration from environment variables (includes secrets loading)
    let config = AppSetup::load_config().await?;

    // Initialize structured logging based on environment
    AppSetup::init_logging(&config)?;

    // Initialize all T-Bank services
    let services = AppSetup::init_services(config.clone()).await?;

    // Start the HTTP server with graceful shutdown
    AppStartup::start_server(&config, services).await?;

    Ok(())
}
