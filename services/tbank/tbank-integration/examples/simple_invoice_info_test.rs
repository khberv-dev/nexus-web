use tbank_integration::{TBankConfig};
use tbank_integration::client::api_methods::B2BApiMethods;

/// Простой тест получения информации о счете
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Загрузка переменных окружения
    if let Err(e) = dotenvy::dotenv() {
        println!("⚠️  Предупреждение: не удалось загрузить .env файл: {}", e);
    } else {
        println!("✅ .env файл загружен успешно");
    }

    println!("🔍 Простой тест получения информации о счете");
    println!("===========================================");

    // Проверка конфигурации
    let config = match TBankConfig::from_env() {
        Ok(config) => {
            println!("✅ Конфигурация загружена");
            println!("   Окружение: {:?}", config.environment);
            println!("   Business API URL: {}", config.business_api_base_url);
            println!("   API Token: {}***", &config.api_token[..std::cmp::min(8, config.api_token.len())]);
            config
        }
        Err(e) => {
            println!("❌ Ошибка загрузки конфигурации: {}", e);
            return Err(e.into());
        }
    };

    // Создание клиента
    let tbank_client = match tbank_integration::client::TBankClient::new(std::sync::Arc::new(config)) {
        Ok(client) => {
            println!("✅ T-Bank клиент создан");
            client
        }
        Err(e) => {
            println!("❌ Ошибка создания клиента: {}", e);
            return Err(e.into());
        }
    };

    // Тестируем с несколькими примерами ID счетов
    let test_invoice_ids = vec![
        "12345",
        "67890", 
        "test123",
        "1769016078", // Из предыдущего теста
    ];

    for invoice_id in test_invoice_ids {
        println!("\n🔍 Тестируем получение информации о счете ID: {}", invoice_id);
        println!("📡 Endpoint: /openapi/invoice/{}/info", invoice_id);
        
        match tbank_client.get_invoice_info(invoice_id).await {
            Ok(info_response) => {
                println!("✅ Информация получена успешно!");
                println!("📄 Ответ: {}", serde_json::to_string_pretty(&info_response)?);
                
                // Если получили успешный ответ, прерываем цикл
                break;
            }
            Err(e) => {
                println!("❌ Ошибка для ID {}: {}", invoice_id, e);
                
                // Анализируем тип ошибки
                if e.to_string().contains("404") {
                    println!("   💡 Счет с ID {} не найден", invoice_id);
                } else if e.to_string().contains("401") {
                    println!("   💡 Проблема с авторизацией");
                } else if e.to_string().contains("403") {
                    println!("   💡 Недостаточно прав доступа");
                } else {
                    println!("   💡 Другая ошибка: {}", e);
                }
            }
        }
    }

    println!("\n📋 Информация об endpoint:");
    println!("=========================");
    println!("🌐 Полный URL: {}/openapi/invoice/{{invoiceId}}/info", 
        match tbank_client.is_sandbox() {
            true => "https://business.tbank.ru/openapi/sandbox/api/v1",
            false => "https://business.tbank.ru/openapi/api/v1"
        }
    );
    println!("📝 Метод: GET");
    println!("🔑 Авторизация: Bearer Token");
    println!("📤 Заголовки: Accept: application/json");

    println!("\n💡 Для тестирования с curl:");
    println!("===========================");
    let base_url = match tbank_client.is_sandbox() {
        true => "https://business.tbank.ru/openapi/sandbox/api/v1",
        false => "https://business.tbank.ru/openapi/api/v1"
    };
    println!("curl --location '{}/openapi/invoice/INVOICE_ID/info' \\", base_url);
    println!("  --header 'Accept: application/json' \\");
    println!("  --header 'Authorization: Bearer YOUR_TOKEN'");

    Ok(())
}