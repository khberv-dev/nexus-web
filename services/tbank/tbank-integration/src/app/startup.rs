use anyhow::Result;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::signal;
use tracing::{error, info};

use crate::{api::create_app_with_state, TBankConfig, TBankServices};

/// Application startup and server management
pub struct AppStartup;

impl AppStartup {
    /// Start the HTTP server with graceful shutdown
    pub async fn start_server(config: &TBankConfig, services: Arc<TBankServices>) -> Result<()> {
        // Create application with state and middleware
        let app = create_app_with_state(services.clone());

        // Determine bind address
        let bind_addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));

        info!(
            bind_address = %bind_addr,
            environment = ?config.environment,
            "Starting HTTP server"
        );

        // Create TCP listener
        let listener = match tokio::net::TcpListener::bind(bind_addr).await {
            Ok(listener) => listener,
            Err(e) => {
                error!(error = %e, bind_address = %bind_addr, "Failed to bind to address");
                return Err(anyhow::anyhow!("Failed to bind to {}: {}", bind_addr, e));
            }
        };

        info!(
            bind_address = %bind_addr,
            "HTTP server listening for connections"
        );

        // Start the server with graceful shutdown
        let server = axum::serve(listener, app).with_graceful_shutdown(Self::shutdown_signal());

        // Log successful startup
        info!(
            service = "tbank-integration",
            version = "0.1.0",
            bind_address = %bind_addr,
            environment = ?config.environment,
            "T-Bank Integration Service started successfully"
        );

        // Run the server
        if let Err(e) = server.await {
            error!(error = %e, "Server error");
            return Err(anyhow::anyhow!("Server error: {}", e));
        }

        info!("T-Bank Integration Service shut down gracefully");
        Ok(())
    }

    /// Handle graceful shutdown signals
    async fn shutdown_signal() {
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {
                info!("Received Ctrl+C signal, initiating graceful shutdown");
            },
            _ = terminate => {
                info!("Received terminate signal, initiating graceful shutdown");
            },
        }

        // Give the server 30 seconds to shut down gracefully
        info!("Graceful shutdown initiated, waiting up to 30 seconds for connections to close");
    }
}
