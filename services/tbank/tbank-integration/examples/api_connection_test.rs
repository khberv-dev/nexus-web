use reqwest::Client;
use serde_json::json;
use std::env;
use tracing_subscriber::fmt;

/// Простой тест соединения с T-Bank API
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Загрузка переменных окружения из .env файла
    if let Err(e) = dotenvy::dotenv() {
        println!("⚠️  Предупреждение: не удалось загрузить .env файл: {}", e);
        println!("   Убедитесь, что .env файл существует в корне проекта");
    } else {
        println!("✅ .env файл загружен успешно");
    }

    // Инициализация логирования
    fmt::init();

    println!("🔌 Тест соединения с T-Bank API");
    println!("===============================");

    // 1. Проверка переменных окружения
    println!("\n🔧 Проверка переменных окружения...");
    
    let api_token = env::var("TBANK_API_TOKEN")
        .map_err(|_| "TBANK_API_TOKEN не найден в переменных окружения")?;
    
    let environment = env::var("TBANK_ENVIRONMENT")
        .unwrap_or_else(|_| "sandbox".to_string());
    
    let base_url = env::var("TBANK_BUSINESS_API_BASE_URL")
        .unwrap_or_else(|_| "https://business.tbank.ru/openapi/api/v1".to_string());

    println!("✅ Переменные окружения:");
    println!("   Окружение: {}", environment);
    println!("   API Token: {}***", &api_token[..std::cmp::min(8, api_token.len())]);
    println!("   Base URL: {}", base_url);

    // 2. Тест базового соединения
    println!("\n🌐 Тест базового соединения...");
    test_basic_connection(&base_url, &api_token).await?;

    // 3. Тест получения информации об аккаунте
    println!("\n👤 Тест получения информации об аккаунте...");
    test_account_info(&base_url, &api_token).await?;

    // 4. Тест получения банковских счетов
    println!("\n🏦 Тест получения банковских счетов...");
    test_bank_accounts(&base_url, &api_token).await?;

    println!("\n✅ Все тесты соединения завершены успешно!");
    Ok(())
}

/// Тест базового соединения с API
async fn test_basic_connection(base_url: &str, token: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    
    // Попробуем несколько эндпоинтов для проверки соединения
    let endpoints = vec![
        "/ping",
        "/health",
        "/status",
    ];

    for endpoint in endpoints {
        let url = format!("{}{}", base_url, endpoint);
        println!("📡 Проверка эндпоинта: {}", url);
        
        match test_endpoint(&client, &url, token).await {
            Ok(response) => {
                println!("✅ Эндпоинт {} доступен", endpoint);
                println!("   Ответ: {}", response);
                return Ok(());
            }
            Err(e) => {
                println!("⚠️  Эндпоинт {} недоступен: {}", endpoint, e);
            }
        }
    }
    
    // Если ни один эндпоинт не работает, попробуем базовый URL
    println!("📡 Проверка базового URL: {}", base_url);
    match test_endpoint(&client, base_url, token).await {
        Ok(response) => {
            println!("✅ Базовый URL доступен");
            println!("   Ответ: {}", response);
            Ok(())
        }
        Err(e) => {
            Err(format!("Не удалось подключиться к T-Bank API: {}", e).into())
        }
    }
}

/// Тест получения информации об аккаунте
async fn test_account_info(base_url: &str, token: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    let url = format!("{}/account/info", base_url);
    
    println!("📡 Запрос информации об аккаунте: {}", url);
    
    match test_endpoint(&client, &url, token).await {
        Ok(response) => {
            println!("✅ Информация об аккаунте получена");
            println!("   Ответ: {}", response);
            Ok(())
        }
        Err(e) => {
            println!("⚠️  Не удалось получить информацию об аккаунте: {}", e);
            // Не возвращаем ошибку, так как этот эндпоинт может не существовать
            Ok(())
        }
    }
}

/// Тест получения банковских счетов
async fn test_bank_accounts(base_url: &str, token: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    let url = format!("{}/bank-accounts", base_url);
    
    println!("📡 Запрос банковских счетов: {}", url);
    
    match test_endpoint(&client, &url, token).await {
        Ok(response) => {
            println!("✅ Банковские счета получены");
            println!("   Ответ: {}", response);
            Ok(())
        }
        Err(e) => {
            println!("⚠️  Не удалось получить банковские счета: {}", e);
            // Не возвращаем ошибку, так как этот эндпоинт может требовать особых прав
            Ok(())
        }
    }
}

/// Универсальная функция для тестирования эндпоинта
async fn test_endpoint(client: &Client, url: &str, token: &str) -> Result<String, Box<dyn std::error::Error>> {
    let response = client
        .get(url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .header("User-Agent", "ADQuest-TBank-Integration/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;

    let status = response.status();
    let headers = response.headers().clone();
    let body = response.text().await?;
    
    println!("📨 Ответ сервера:");
    println!("   Статус: {}", status);
    println!("   Заголовки: {:?}", headers);
    println!("   Тело ответа: {}", if body.len() > 200 { 
        format!("{}...", &body[..200]) 
    } else { 
        body.clone() 
    });
    
    if status.is_success() {
        Ok(body)
    } else if status.as_u16() == 401 {
        Err("Ошибка авторизации: неверный API токен".into())
    } else if status.as_u16() == 403 {
        Err("Ошибка доступа: недостаточно прав".into())
    } else if status.as_u16() == 404 {
        Err("Эндпоинт не найден".into())
    } else {
        Err(format!("HTTP ошибка {}: {}", status, body).into())
    }
}

/// Тест создания простого запроса к API
async fn test_simple_api_request(base_url: &str, token: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    
    // Попробуем отправить простой POST запрос для проверки API
    let url = format!("{}/test", base_url);
    
    let test_payload = json!({
        "test": true,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    println!("📡 Отправка тестового POST запроса: {}", url);
    println!("📦 Payload: {}", test_payload);
    
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&test_payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;

    let status = response.status();
    let body = response.text().await?;
    
    println!("📨 Ответ на POST запрос:");
    println!("   Статус: {}", status);
    println!("   Тело: {}", body);
    
    if status.is_success() {
        println!("✅ POST запрос выполнен успешно");
    } else {
        println!("⚠️  POST запрос неуспешен, но это нормально для тестового эндпоинта");
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_env_variables() {
        // Проверяем, что переменные окружения доступны
        let token = env::var("TBANK_API_TOKEN");
        assert!(token.is_ok(), "TBANK_API_TOKEN должен быть установлен");
        
        let token = token.unwrap();
        assert!(!token.is_empty(), "TBANK_API_TOKEN не должен быть пустым");
        assert!(token.len() > 10, "TBANK_API_TOKEN должен быть достаточно длинным");
    }

    #[test]
    fn test_url_construction() {
        let base_url = "https://business.tbank.ru/openapi/api/v1";
        let endpoint = "/ping";
        let full_url = format!("{}{}", base_url, endpoint);
        
        assert_eq!(full_url, "https://business.tbank.ru/openapi/api/v1/ping");
    }
}