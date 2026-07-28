use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub server: ServerConfig,
    pub logging: LoggingConfig,
    pub metrics: MetricsConfig,
    pub auth: AuthConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout_ms: u64,
    pub idle_timeout_ms: u64,
    pub max_lifetime_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub pool_size: u32,
    pub connection_timeout_ms: u64,
    pub command_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: LogFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogFormat {
    Json,
    Pretty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub enabled: bool,
    pub endpoint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub token_expiry_hours: u64,
    pub encryption_key: String,
    // Zitadel configuration
    pub zitadel_enabled: bool,
    pub zitadel_url: String,
    pub zitadel_jwks_uri: String,
    pub zitadel_project_id: String,
    pub zitadel_client_id: String,
    pub zitadel_client_secret: String,
}

impl Config {
    pub fn from_env() -> Result<Self, crate::ADQuestError> {
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            // Fallback для локальной разработки - НЕ использовать в production!
            "postgresql://postgres:postgres@localhost:5432/postgres".to_string()
        });

        let redis_url =
            env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());

        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

        let server_port = env::var("SERVER_PORT")
            .or_else(|_| env::var("PORT"))
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|e| crate::ADQuestError::Config(format!("Invalid SERVER_PORT: {}", e)))?;

        let log_level = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());

        let log_format = match env::var("LOG_FORMAT").as_deref() {
            Ok("json") => LogFormat::Json,
            _ => LogFormat::Pretty,
        };

        let workers = env::var("TOKIO_WORKER_THREADS")
            .ok()
            .and_then(|s| s.parse().ok());

        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "adquest_jwt_secret_change_in_production".to_string());

        let jwt_issuer = env::var("JWT_ISSUER").unwrap_or_else(|_| "adquest".to_string());

        let jwt_audience = env::var("JWT_AUDIENCE").unwrap_or_else(|_| "adquest-api".to_string());

        let token_expiry_hours = env::var("JWT_EXPIRY_HOURS")
            .unwrap_or_else(|_| "24".to_string())
            .parse::<u64>()
            .map_err(|e| crate::ADQuestError::Config(format!("Invalid JWT_EXPIRY_HOURS: {}", e)))?;

        let encryption_key = env::var("ENCRYPTION_KEY").unwrap_or_else(|_| {
            // Generate a default key for development (should be changed in production)
            use base64::{engine::general_purpose, Engine as _};
            let key_bytes = b"adquest_encryption_key_change_me";
            general_purpose::STANDARD.encode(key_bytes)
        });

        // Zitadel configuration
        let zitadel_enabled = env::var("ZITADEL_ENABLED")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .unwrap_or(false);

        let zitadel_url = env::var("ZITADEL_URL")
            .unwrap_or_else(|_| "http://localhost:8085".to_string());

        let zitadel_jwks_uri = env::var("ZITADEL_JWKS_URI")
            .unwrap_or_else(|_| format!("{}/.well-known/openid_configuration/jwks", zitadel_url));

        let zitadel_project_id = env::var("ZITADEL_PROJECT_ID")
            .unwrap_or_else(|_| "".to_string());

        let zitadel_client_id = env::var("ZITADEL_CLIENT_ID")
            .unwrap_or_else(|_| "".to_string());

        let zitadel_client_secret = env::var("ZITADEL_CLIENT_SECRET")
            .unwrap_or_else(|_| "".to_string());

        Ok(Config {
            database: DatabaseConfig {
                url: database_url,
                max_connections: 30,        // Увеличиваем с 10 до 30
                min_connections: 5,         // Увеличиваем с 1 до 5
                acquire_timeout_ms: 5000,   // Сокращаем с 10000 до 5000
                idle_timeout_ms: 300_000,   // Сокращаем с 600_000 до 5 минут
                max_lifetime_ms: 1_800_000, // 30 minutes
            },
            redis: RedisConfig {
                url: redis_url,
                pool_size: 20,
                connection_timeout_ms: 5000,
                command_timeout_ms: 1000,
            },
            server: ServerConfig {
                host: server_host,
                port: server_port,
                workers,
            },
            logging: LoggingConfig {
                level: log_level,
                format: log_format,
            },
            metrics: MetricsConfig {
                enabled: true,
                endpoint: "/metrics".to_string(),
            },
            auth: AuthConfig {
                jwt_secret,
                jwt_issuer,
                jwt_audience,
                token_expiry_hours,
                encryption_key,
                zitadel_enabled,
                zitadel_url,
                zitadel_jwks_uri,
                zitadel_project_id,
                zitadel_client_id,
                zitadel_client_secret,
            },
        })
    }
}
