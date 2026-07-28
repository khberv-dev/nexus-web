use axum::Router;
use sqlx::PgPool;
use std::env;
use tracing::{info, error};

use super::organization::organization_routes;

/// Создать роутер для организаций с подключением к БД
pub async fn build_organization_router() -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    info!("Initializing organization router with database connection");

    // Получаем строку подключения к БД из переменных окружения
    let database_url = env::var("DATABASE_URL")
        .or_else(|_| env::var("POSTGRES_URL"))
        .unwrap_or_else(|_| {
            // Fallback для локальной разработки - НЕ использовать в production!
            "postgresql://postgres:postgres@localhost:5432/postgres".to_string()
        });

    info!("Connecting to database: {}", mask_password(&database_url));

    // Создаем пул подключений
    let pool = PgPool::connect(&database_url).await.map_err(|e| {
        error!("Failed to connect to database: {:?}", e);
        e
    })?;

    // Проверяем подключение
    sqlx::query("SELECT 1").fetch_one(&pool).await.map_err(|e| {
        error!("Database health check failed: {:?}", e);
        e
    })?;

    info!("Database connection established successfully");

    // Создаем роутер с организационными роутами
    let router = organization_routes(pool);

    Ok(router)
}

/// Маскирует пароль в строке подключения для логирования
fn mask_password(url: &str) -> String {
    if let Some(at_pos) = url.find('@') {
        if let Some(colon_pos) = url[..at_pos].rfind(':') {
            let mut masked = url.to_string();
            masked.replace_range(colon_pos + 1..at_pos, "***");
            return masked;
        }
    }
    url.to_string()
}