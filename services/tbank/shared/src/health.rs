use chrono::{DateTime, Utc};
use redis::aio::ConnectionManager;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::time::timeout;
use ts_rs::TS;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub struct HealthCheck {
    pub status: HealthStatus,
    pub service: String,
    pub version: String,
    pub timestamp: DateTime<Utc>,
    pub components: HashMap<String, ComponentHealth>,
    pub uptime_seconds: u64,
    pub memory_usage_bytes: Option<u64>,
    pub cpu_usage_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub enum HealthStatus {
    #[serde(rename = "healthy")]
    Healthy,
    #[serde(rename = "degraded")]
    Degraded,
    #[serde(rename = "unhealthy")]
    Unhealthy,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared-services/")]
pub struct ComponentHealth {
    pub status: HealthStatus,
    pub message: Option<String>,
    pub last_check: DateTime<Utc>,
    pub response_time_ms: Option<u64>,
    #[ts(type = "Record<string, any>")]
    pub details: Option<HashMap<String, serde_json::Value>>,
}

pub struct HealthChecker {
    service_name: String,
    version: String,
    start_time: Instant,
    db_pool: Option<PgPool>,
    redis_manager: Option<ConnectionManager>,
}

impl HealthCheck {
    pub fn new(service_name: &str, version: &str) -> Self {
        Self {
            status: HealthStatus::Healthy,
            service: service_name.to_string(),
            version: version.to_string(),
            timestamp: Utc::now(),
            components: HashMap::new(),
            uptime_seconds: 0,
            memory_usage_bytes: None,
            cpu_usage_percent: None,
        }
    }

    pub fn add_component(&mut self, name: &str, health: ComponentHealth) {
        self.components.insert(name.to_string(), health);
        self.update_overall_status();
    }

    pub fn update_uptime(&mut self, uptime_seconds: u64) {
        self.uptime_seconds = uptime_seconds;
        self.timestamp = Utc::now();
    }

    pub fn update_system_metrics(&mut self, memory_bytes: Option<u64>, cpu_percent: Option<f64>) {
        self.memory_usage_bytes = memory_bytes;
        self.cpu_usage_percent = cpu_percent;
    }

    fn update_overall_status(&mut self) {
        let mut has_unhealthy = false;
        let mut has_degraded = false;

        for component in self.components.values() {
            match component.status {
                HealthStatus::Unhealthy => has_unhealthy = true,
                HealthStatus::Degraded => has_degraded = true,
                HealthStatus::Healthy => {}
            }
        }

        self.status = if has_unhealthy {
            HealthStatus::Unhealthy
        } else if has_degraded {
            HealthStatus::Degraded
        } else {
            HealthStatus::Healthy
        };
    }

    pub fn is_healthy(&self) -> bool {
        matches!(self.status, HealthStatus::Healthy)
    }

    pub fn is_ready(&self) -> bool {
        // Service is ready if no components are unhealthy
        !self
            .components
            .values()
            .any(|c| matches!(c.status, HealthStatus::Unhealthy))
    }
}

impl ComponentHealth {
    pub fn healthy(message: Option<String>) -> Self {
        Self {
            status: HealthStatus::Healthy,
            message,
            last_check: Utc::now(),
            response_time_ms: None,
            details: None,
        }
    }

    pub fn degraded(message: String) -> Self {
        Self {
            status: HealthStatus::Degraded,
            message: Some(message),
            last_check: Utc::now(),
            response_time_ms: None,
            details: None,
        }
    }

    pub fn unhealthy(message: String) -> Self {
        Self {
            status: HealthStatus::Unhealthy,
            message: Some(message),
            last_check: Utc::now(),
            response_time_ms: None,
            details: None,
        }
    }

    pub fn with_response_time(mut self, response_time_ms: u64) -> Self {
        self.response_time_ms = Some(response_time_ms);
        self
    }

    pub fn with_details(mut self, details: HashMap<String, serde_json::Value>) -> Self {
        self.details = Some(details);
        self
    }
}

impl HealthChecker {
    pub fn new(service_name: &str, version: &str) -> Self {
        Self {
            service_name: service_name.to_string(),
            version: version.to_string(),
            start_time: Instant::now(),
            db_pool: None,
            redis_manager: None,
        }
    }

    pub fn with_database(mut self, pool: PgPool) -> Self {
        self.db_pool = Some(pool);
        self
    }

    pub fn with_redis(mut self, manager: ConnectionManager) -> Self {
        self.redis_manager = Some(manager);
        self
    }

    pub async fn check_health(&self) -> HealthCheck {
        let mut health_check = HealthCheck::new(&self.service_name, &self.version);

        // Update uptime
        let uptime = self.start_time.elapsed().as_secs();
        health_check.update_uptime(uptime);

        // Check database health
        if let Some(ref pool) = self.db_pool {
            let db_health = self.check_database_health(pool).await;
            health_check.add_component("database", db_health);
        }

        // Check Redis health
        if let Some(ref manager) = self.redis_manager {
            let redis_health = self.check_redis_health(manager).await;
            health_check.add_component("redis", redis_health);
        }

        // Check system metrics
        let (memory_usage, cpu_usage) = self.get_system_metrics();
        health_check.update_system_metrics(memory_usage, cpu_usage);

        // Add system health component
        let system_health = self.check_system_health(memory_usage, cpu_usage);
        health_check.add_component("system", system_health);

        health_check
    }

    async fn check_database_health(&self, pool: &PgPool) -> ComponentHealth {
        let start = Instant::now();

        match timeout(
            Duration::from_secs(5),
            sqlx::query("SELECT 1").execute(pool),
        )
        .await
        {
            Ok(Ok(_)) => {
                let response_time = start.elapsed().as_millis() as u64;
                let mut details = HashMap::new();
                details.insert(
                    "active_connections".to_string(),
                    serde_json::Value::Number(serde_json::Number::from(pool.size() as u64)),
                );
                details.insert(
                    "idle_connections".to_string(),
                    serde_json::Value::Number(serde_json::Number::from(pool.num_idle() as u64)),
                );

                if response_time > 1000 {
                    ComponentHealth::degraded("Database responding slowly".to_string())
                        .with_response_time(response_time)
                        .with_details(details)
                } else {
                    ComponentHealth::healthy(Some("Database connection successful".to_string()))
                        .with_response_time(response_time)
                        .with_details(details)
                }
            }
            Ok(Err(e)) => ComponentHealth::unhealthy(format!("Database query failed: {}", e)),
            Err(_) => ComponentHealth::unhealthy("Database connection timeout".to_string()),
        }
    }

    async fn check_redis_health(&self, manager: &ConnectionManager) -> ComponentHealth {
        let start = Instant::now();

        match timeout(Duration::from_secs(5), async {
            let mut conn = manager.clone();
            redis::cmd("PING").query_async::<String>(&mut conn).await
        })
        .await
        {
            Ok(Ok(response)) if response == "PONG" => {
                let response_time = start.elapsed().as_millis() as u64;
                if response_time > 500 {
                    ComponentHealth::degraded("Redis responding slowly".to_string())
                        .with_response_time(response_time)
                } else {
                    ComponentHealth::healthy(Some("Redis connection successful".to_string()))
                        .with_response_time(response_time)
                }
            }
            Ok(Ok(_)) => {
                ComponentHealth::degraded("Redis returned unexpected response".to_string())
            }
            Ok(Err(e)) => ComponentHealth::unhealthy(format!("Redis command failed: {}", e)),
            Err(_) => ComponentHealth::unhealthy("Redis connection timeout".to_string()),
        }
    }

    fn get_system_metrics(&self) -> (Option<u64>, Option<f64>) {
        // In a real implementation, you would use system metrics libraries
        // For now, we'll return None to indicate metrics are not available
        // You could integrate with libraries like `sysinfo` for actual metrics
        (None, None)
    }

    fn check_system_health(
        &self,
        memory_usage: Option<u64>,
        cpu_usage: Option<f64>,
    ) -> ComponentHealth {
        let mut details = HashMap::new();
        let mut issues = Vec::new();

        if let Some(memory) = memory_usage {
            details.insert(
                "memory_bytes".to_string(),
                serde_json::Value::Number(serde_json::Number::from(memory)),
            );

            // 256MB threshold
            if memory > 256 * 1024 * 1024 {
                issues.push("High memory usage".to_string());
            }
        }

        if let Some(cpu) = cpu_usage {
            details.insert(
                "cpu_percent".to_string(),
                serde_json::Value::Number(
                    serde_json::Number::from_f64(cpu).unwrap_or(serde_json::Number::from(0)),
                ),
            );

            // 80% threshold
            if cpu > 80.0 {
                issues.push("High CPU usage".to_string());
            }
        }

        if issues.is_empty() {
            ComponentHealth::healthy(Some("System resources within normal limits".to_string()))
                .with_details(details)
        } else {
            ComponentHealth::degraded(issues.join(", ")).with_details(details)
        }
    }
}
