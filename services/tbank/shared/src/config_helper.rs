//! ADQuest Platform - Configuration Helper
//! 
//! Утилита для работы с конфигурацией и переменными окружения

use std::env;

/// Макрос для удобного получения переменных окружения
#[macro_export]
macro_rules! env_or_default {
    ($key:expr, $default:expr) => {
        std::env::var($key).unwrap_or_else(|_| $default.to_string())
    };
}

/// Макрос для получения обязательных переменных
#[macro_export]
macro_rules! required_env {
    ($key:expr) => {
        std::env::var($key).expect(&format!("Environment variable {} must be set", $key))
    };
}

/// Макрос для получения переменной как число
#[macro_export]
macro_rules! env_as_u16 {
    ($key:expr, $default:expr) => {
        std::env::var($key)
            .unwrap_or_else(|_| $default.to_string())
            .parse()
            .unwrap_or($default)
    };
}

/// Макрос для получения переменной как boolean
#[macro_export]
macro_rules! env_as_bool {
    ($key:expr, $default:expr) => {
        std::env::var($key)
            .map(|v| v.to_lowercase() == "true" || v == "1")
            .unwrap_or($default)
    };
}

/// Макрос для получения Duration из переменной окружения
#[macro_export]
macro_rules! env_as_duration {
    ($key:expr, $default:expr) => {
        std::time::Duration::from_secs(
            std::env::var($key)
                .unwrap_or_else(|_| $default.to_string())
                .parse()
                .unwrap_or($default)
        )
    };
}

/// Структура для управления конфигурацией
pub struct ConfigHelper;

impl ConfigHelper {
    /// Получает URL для сервиса
    pub fn get_service_url(service: &str) -> String {
        let key = format!("{}_URL", service.to_uppercase().replace("-", "_"));
        env::var(&key).unwrap_or_else(|_| format!("http://localhost:8080"))
    }
    
    /// Получает порт для сервиса
    pub fn get_service_port(service: &str) -> u16 {
        let key = format!("{}_PORT", service.to_uppercase().replace("-", "_"));
        env::var(&key)
            .unwrap_or_else(|_| "8080".to_string())
            .parse()
            .unwrap_or(8080)
    }
    
    /// Получает хост сервера
    pub fn get_server_host() -> String {
        env::var("SERVER_HOST").unwrap_or_else(|_| "localhost".to_string())
    }
    
    /// Получает URL базы данных
    pub fn get_database_url() -> String {
        env::var("DATABASE_URL").expect("DATABASE_URL must be set")
    }
    
    /// Получает URL Redis
    pub fn get_redis_url() -> String {
        env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string())
    }
    
    /// Получает порт из переменной окружения
    pub fn get_port(env_var: &str, default: u16) -> u16 {
        env::var(env_var)
            .unwrap_or_else(|_| default.to_string())
            .parse()
            .unwrap_or(default)
    }
    
    /// Получает URL с портом
    pub fn get_url_with_port(host_var: &str, port_var: &str, default_host: &str, default_port: u16) -> String {
        let host = env::var(host_var).unwrap_or_else(|_| default_host.to_string());
        let port = Self::get_port(port_var, default_port);
        format!("http://{}:{}", host, port)
    }
    
    /// Проверяет все обязательные переменные
    pub fn validate_required_vars(required_vars: &[&str]) -> Result<(), Vec<String>> {
        let mut missing = Vec::new();
        
        for var in required_vars {
            if env::var(var).is_err() {
                missing.push(var.to_string());
            }
        }
        
        if missing.is_empty() {
            Ok(())
        } else {
            Err(missing)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_config_helper() {
        // Тест получения URL сервиса
        let url = ConfigHelper::get_service_url("challenge-engine");
        assert!(!url.is_empty());
        
        // Тест получения порта
        let port = ConfigHelper::get_service_port("challenge-engine");
        assert!(port > 0);
        
        // Тест получения хоста
        let host = ConfigHelper::get_server_host();
        assert!(!host.is_empty());
        
        // Тест получения URL с портом
        let url_with_port = ConfigHelper::get_url_with_port("SERVER_HOST", "CHALLENGE_ENGINE_PORT", "localhost", 8080);
        assert!(url_with_port.starts_with("http://"));
    }
}
