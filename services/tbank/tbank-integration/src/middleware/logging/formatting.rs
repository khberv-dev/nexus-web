use tracing::info;
use tracing_subscriber::EnvFilter;

/// Initialize structured logging for the application
pub fn init_structured_logging(
    environment: &crate::config::Environment,
) -> Result<(), Box<dyn std::error::Error>> {
    use tracing_subscriber::{
        fmt::{self, format::FmtSpan},
        layer::SubscriberExt,
        util::SubscriberInitExt,
        EnvFilter,
    };

    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| match environment {
        crate::config::Environment::Production => EnvFilter::new("info"),
        crate::config::Environment::Sandbox => EnvFilter::new("debug"),
    });

    match environment {
        crate::config::Environment::Production => {
            // JSON format for production
            tracing_subscriber::registry()
                .with(env_filter)
                .with(
                    fmt::layer()
                        .json()
                        .with_target(true)
                        .with_thread_ids(true)
                        .with_thread_names(true)
                        .with_file(true)
                        .with_line_number(true),
                )
                .init();
        }
        crate::config::Environment::Sandbox => {
            // Pretty format for development
            tracing_subscriber::registry()
                .with(env_filter)
                .with(
                    fmt::layer()
                        .pretty()
                        .with_target(true)
                        .with_thread_ids(false)
                        .with_thread_names(false)
                        .with_file(true)
                        .with_line_number(true),
                )
                .init();
        }
    }

    info!(
        environment = ?environment,
        "Structured logging initialized"
    );

    Ok(())
}

/// Configure logging format based on environment
pub fn configure_log_format(environment: &crate::config::Environment) -> EnvFilter {
    use tracing_subscriber::EnvFilter;

    EnvFilter::try_from_default_env().unwrap_or_else(|_| match environment {
        crate::config::Environment::Production => {
            // More restrictive logging in production
            EnvFilter::new("warn,tbank_integration=info,shared=info")
        }
        crate::config::Environment::Sandbox => {
            // More verbose logging in development
            EnvFilter::new("debug,tbank_integration=trace,shared=debug")
        }
    })
}

/// Get log level string for environment
pub fn get_log_level_for_environment(environment: &crate::config::Environment) -> &'static str {
    match environment {
        crate::config::Environment::Production => "info",
        crate::config::Environment::Sandbox => "debug",
    }
}