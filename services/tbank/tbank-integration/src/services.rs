use std::sync::Arc;
use std::time::Duration;

use redis::Client as RedisClient;
use sqlx::PgPool;

use shared::{
    auth::{JwtAuth, RateLimitConfig, InMemoryRateLimiter},
    config::RedisConfig,
    metrics::MetricsCollector,
    AuthMiddlewareState, CacheManager, EncryptionService, HealthChecker, ZitadelValidator,
};

use crate::{
    client::TBankClient,
    config::{HotReloadManager, TBankConfig},
    email::EmailSender,
    middleware::{TBankAuthState, TBankRateLimitConfig},
    types::{TBankError, TBankResult},
};

/// T-Bank service container with all initialized services
#[derive(Clone)]
pub struct TBankServices {
    pub config: TBankConfig,
    pub tbank_client: Arc<TBankClient>,
    pub auth_state: TBankAuthState,
    pub encryption_service: Arc<EncryptionService>,
    pub db_pool: Arc<PgPool>,
    pub redis_client: Arc<RedisClient>,
    pub cache_manager: Arc<CacheManager>,
    pub health_checker: Arc<HealthChecker>,
    pub metrics_collector: Arc<MetricsCollector>,
    pub hot_reload_manager: Arc<HotReloadManager>,
    pub email_sender: Arc<EmailSender>,
}

impl TBankServices {
    /// Initialize all T-Bank services
    pub async fn new(config: TBankConfig) -> TBankResult<Self> {
        // Initialize T-Bank client
        let tbank_client = Arc::new(TBankClient::new(Arc::new(config.clone()))?);

        // Initialize database connection pool
        let db_pool = Arc::new(
            PgPool::connect(&config.database_url)
                .await
                .map_err(|e| TBankError::DatabaseError(e))?,
        );

        // Initialize Redis client
        let redis_client = Arc::new(RedisClient::open(config.redis_url.clone()).map_err(|e| {
            TBankError::CacheError(format!("Failed to create Redis client: {}", e))
        })?);

        // Initialize cache manager
        let redis_config = RedisConfig {
            url: config.redis_url.clone(),
            pool_size: 10,
            connection_timeout_ms: 5000,
            command_timeout_ms: 5000,
        };
        let cache_manager = Arc::new(CacheManager::new(&redis_config).await.map_err(|e| {
            TBankError::CacheError(format!("Failed to initialize cache manager: {}", e))
        })?);

        // Initialize encryption service
        let encryption_key_bytes = config.encryption_key_bytes()?;
        let encryption_service =
            Arc::new(EncryptionService::new(&encryption_key_bytes).map_err(|e| {
                TBankError::InternalError(format!("Failed to initialize encryption service: {}", e))
            })?);

        // Initialize JWT auth (for legacy compatibility)
        let jwt_auth = JwtAuth::new(
            "tbank_jwt_secret", // This should come from config in production
            config.zitadel_issuer.clone(),
            config.zitadel_audience.clone(),
        )
        .map_err(|e| {
            TBankError::AuthenticationError(format!("Failed to initialize JWT auth: {}", e))
        })?;

        // Initialize Zitadel validator
        let zitadel_validator = ZitadelValidator::new(
            config.zitadel_issuer.clone(),
            config.zitadel_audience.clone(),
        );

        // Initialize rate limiter with T-Bank specific configuration
        let rate_limit_config = convert_tbank_rate_limit_config(&config.rate_limit_config);
        let rate_limiter = InMemoryRateLimiter::new(rate_limit_config);

        // Create auth middleware state
        let auth_middleware_state = AuthMiddlewareState {
            jwt_auth: Arc::new(jwt_auth),
            zitadel_validator: Arc::new(zitadel_validator),
            pat_validator: None, // PAT validation not used in tbank-integration
            rate_limiter: Arc::new(rate_limiter),
            use_zitadel: config.use_zitadel,
        };

        // Create T-Bank auth state
        let auth_state = TBankAuthState::new(auth_middleware_state, (*encryption_service).clone());

        // Initialize metrics collector
        let metrics_collector = Arc::new(MetricsCollector::new().map_err(|e| {
            TBankError::InternalError(format!("Failed to initialize metrics collector: {}", e))
        })?);

        // Initialize health checker with database and Redis
        let redis_manager = redis::aio::ConnectionManager::new((*redis_client).clone())
            .await
            .map_err(|e| {
                TBankError::CacheError(format!("Failed to create Redis connection manager: {}", e))
            })?;

        let health_checker = Arc::new(
            HealthChecker::new("tbank-integration", "0.1.0")
                .with_database((*db_pool).clone())
                .with_redis(redis_manager),
        );

        // Initialize hot-reload manager
        let hot_reload_manager = Arc::new(
            HotReloadManager::new(config.environment.clone()).map_err(|e| {
                TBankError::InternalError(format!("Failed to initialize hot-reload manager: {}", e))
            })?,
        );

        // Start hot-reload background task
        let hot_reload_task = hot_reload_manager.clone();
        tokio::spawn(async move {
            hot_reload_task.start_hot_reload_task().await;
        });

        // Initialize email sender
        let email_sender = Arc::new(EmailSender::new(config.email_config.clone())?);

        Ok(Self {
            config,
            tbank_client,
            auth_state,
            encryption_service,
            db_pool,
            redis_client,
            cache_manager,
            health_checker,
            metrics_collector,
            hot_reload_manager,
            email_sender,
        })
    }

    /// Get database pool
    pub fn db_pool(&self) -> &PgPool {
        &self.db_pool
    }

    /// Get T-Bank client
    pub fn tbank_client(&self) -> &TBankClient {
        &self.tbank_client
    }

    /// Get Redis client
    pub fn redis_client(&self) -> &RedisClient {
        &self.redis_client
    }

    /// Get cache manager
    pub fn cache_manager(&self) -> &CacheManager {
        &self.cache_manager
    }

    /// Get encryption service
    pub fn encryption_service(&self) -> &EncryptionService {
        &self.encryption_service
    }

    /// Get auth state for middleware
    pub fn auth_state(&self) -> &TBankAuthState {
        &self.auth_state
    }

    /// Get health checker
    pub fn health_checker(&self) -> &HealthChecker {
        &self.health_checker
    }

    /// Get metrics collector
    pub fn metrics_collector(&self) -> &MetricsCollector {
        &self.metrics_collector
    }

    /// Get hot-reload manager
    pub fn hot_reload_manager(&self) -> &HotReloadManager {
        &self.hot_reload_manager
    }

    /// Get environment indicator for logs and responses
    pub fn get_environment_indicator(&self) -> serde_json::Value {
        self.hot_reload_manager.get_environment_indicator()
    }

    /// Check if running in production environment
    pub fn is_production(&self) -> bool {
        matches!(
            self.config.environment,
            crate::config::Environment::Production
        )
    }

    /// Check if webhook signature validation is enforced
    pub fn enforce_webhook_signature(&self) -> bool {
        self.config.enforce_webhook_signature()
    }

    /// Get API timeout duration
    pub fn api_timeout(&self) -> Duration {
        Duration::from_secs(self.config.api_timeout_seconds())
    }

    /// Encrypt sensitive data
    pub fn encrypt_data(&self, plaintext: &str) -> TBankResult<shared::encryption::EncryptedData> {
        self.encryption_service
            .encrypt(plaintext)
            .map_err(|e| TBankError::InternalError(format!("Failed to encrypt data: {}", e)))
    }

    /// Decrypt sensitive data
    pub fn decrypt_data(
        &self,
        encrypted_data: &shared::encryption::EncryptedData,
    ) -> TBankResult<String> {
        self.encryption_service
            .decrypt(encrypted_data)
            .map_err(|e| TBankError::InternalError(format!("Failed to decrypt data: {}", e)))
    }

    /// Perform health check on all services
    pub async fn health_check(&self) -> TBankResult<serde_json::Value> {
        let health_status = self.health_checker.check_health().await;
        Ok(serde_json::json!({
            "status": if health_status.is_healthy() { "healthy" } else { "unhealthy" },
            "service": health_status.service,
            "version": health_status.version,
            "timestamp": health_status.timestamp,
            "components": health_status.components
        }))
    }
}

/// Convert T-Bank rate limit config to shared rate limit config
fn convert_tbank_rate_limit_config(tbank_config: &TBankRateLimitConfig) -> RateLimitConfig {
    RateLimitConfig {
        requests_per_minute: tbank_config.b2b_invoices, // Use B2B invoices as default
        burst_size: tbank_config.b2b_invoices / 2,      // Allow burst of half the rate
        window_size_seconds: 60,                        // 1 minute window
        cleanup_interval_seconds: 300,                  // 5 minutes cleanup
    }
}

/// Service factory for creating T-Bank services from environment
pub struct TBankServiceFactory;

impl TBankServiceFactory {
    /// Create T-Bank services from environment configuration
    pub async fn create_from_env() -> TBankResult<TBankServices> {
        let config = TBankConfig::from_env()?;
        TBankServices::new(config).await
    }

    /// Create T-Bank services with custom configuration
    pub async fn create_with_config(config: TBankConfig) -> TBankResult<TBankServices> {
        TBankServices::new(config).await
    }

    /// Generate a new encryption key for configuration
    pub fn generate_encryption_key() -> TBankResult<String> {
        use base64::{engine::general_purpose, Engine as _};

        let key_bytes = EncryptionService::generate_key().map_err(|e| {
            TBankError::InternalError(format!("Failed to generate encryption key: {}", e))
        })?;

        Ok(general_purpose::STANDARD.encode(&key_bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::TBankRateLimitConfig;

    #[test]
    fn test_convert_rate_limit_config() {
        let tbank_config = TBankRateLimitConfig {
            counterparty_verification: 100,
            b2b_invoices: 200,
            acquiring_payments: 500,
            balance_queries: 300,
            reconciliation: 50,
            audit_queries: 100,
        };

        let shared_config = convert_tbank_rate_limit_config(&tbank_config);

        assert_eq!(shared_config.requests_per_minute, 200);
        assert_eq!(shared_config.burst_size, 100);
        assert_eq!(shared_config.window_size_seconds, 60);
        assert_eq!(shared_config.cleanup_interval_seconds, 300);
    }

    #[test]
    fn test_generate_encryption_key() {
        let key = TBankServiceFactory::generate_encryption_key().unwrap();

        // Should be valid base64
        use base64::{engine::general_purpose, Engine as _};
        let key_bytes = general_purpose::STANDARD.decode(&key).unwrap();

        // Should be 32 bytes for AES-256
        assert_eq!(key_bytes.len(), 32);
    }

    #[tokio::test]
    async fn test_service_factory_validation() {
        // This test would require environment variables to be set
        // In a real test environment, you would set up test configuration

        // Test that factory validates configuration
        let result = TBankServiceFactory::create_from_env().await;

        // Should fail if environment variables are not set
        assert!(result.is_err());
    }
}
