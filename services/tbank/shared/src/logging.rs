use crate::config::{LogFormat, LoggingConfig};
use tracing_subscriber::{
    fmt::{self, format::FmtSpan, time::FormatTime, format::Writer},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
};
use chrono::{DateTime, Local};

// Custom time formatter for Moscow timezone
struct MoscowTime;

impl FormatTime for MoscowTime {
    fn format_time(&self, w: &mut Writer<'_>) -> std::fmt::Result {
        let now: DateTime<Local> = Local::now();
        write!(w, "{}", now.format("%Y-%m-%dT%H:%M:%S%.9f%:z"))
    }
}

pub fn init_logging(
    config: &LoggingConfig,
    service_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let env_filter =
        EnvFilter::try_from_default_env().or_else(|_| EnvFilter::try_new(&config.level))?;

    match config.format {
        LogFormat::Json => {
            tracing_subscriber::registry()
                .with(env_filter)
                .with(
                    fmt::layer()
                        .json()
                        .with_current_span(false)
                        .with_span_list(true)
                        .with_target(true)
                        .with_thread_ids(true)
                        .with_thread_names(true)
                        .with_file(true)
                        .with_line_number(true)
                        .with_span_events(FmtSpan::CLOSE)
                        .with_timer(MoscowTime),
                )
                .init();
        }
        LogFormat::Pretty => {
            tracing_subscriber::registry()
                .with(env_filter)
                .with(
                    fmt::layer()
                        .pretty()
                        .with_target(true)
                        .with_thread_ids(true)
                        .with_thread_names(true)
                        .with_file(true)
                        .with_line_number(true)
                        .with_span_events(FmtSpan::CLOSE)
                        .with_timer(MoscowTime),
                )
                .init();
        }
    }

    tracing::info!("Logging initialized for service: {}", service_name);
    Ok(())
}
