use tbank_integration::{TBankConfig};
use tbank_integration::client::api_methods::B2BApiMethods;
use tracing_subscriber::fmt;

/// Простой тест для получения информации о счете
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Загрузка переменных окружения
    if let Err(e) = dotenvy::dotenv() {
        println!("⚠️  Предупреждение: не удалось загрузить .env файл: {}", e);
    } else {
        println!("✅ .env файл загружен успешно");
    }

    // Инициализация логирования
    fmt::init();

    println!("📋 ПОЛУЧЕНИЕ ИНФОРМАЦИИ О СЧЕТЕ");
    println!("===============================");

    // Принудительно устанавливаем production окружение
    std::env::set_var("TBANK_ENVIRONMENT", "production");

    // Проверка конфигурации
    let config = match TBankConfig::from_env() {
        Ok(config) => {
            println!("✅ Конфигурация загружена");
            println!("   Окружение: {:?}", config.environment);
            println!("   Business API URL: {}", config.business_api_base_url);
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

    // Список ID счетов для проверки (из предыдущих тестов)
    let invoice_ids = vec![
        "5d30aafc-2220-46b5-b6d8-30ed8189f721", // Из real_production_invoice
        "221b9b4a-423e-4ceb-b781-4daf30c55c63", // Из investigate_invoice_types тест 1
        "c27ac27a-b74a-476c-bfb7-73fe61568416", // Из investigate_invoice_types тест 3
    ];

    for (i, invoice_id) in invoice_ids.iter().enumerate() {
        println!("\n🔍 Тест {}: Получение информации о счете {}", i + 1, invoice_id);
        println!("🌐 URL: https://business.tbank.ru/openapi/api/v1/openapi/invoice/{}/info", invoice_id);
        
        match tbank_client.get_invoice_info(invoice_id).await {
            Ok(info) => {
                println!("✅ Информация получена:");
                println!("{}", serde_json::to_string_pretty(&info)?);
                
                // Анализ статуса
                if let Some(status) = info.get("status") {
                    match status.as_str() {
                        Some("SUBMITTED") => println!("📊 Статус: Счет отправлен"),
                        Some("PAID") => println!("📊 Статус: Счет оплачен"),
                        Some("CANCELLED") => println!("📊 Статус: Счет отменен"),
                        Some("EXPIRED") => println!("📊 Статус: Счет просрочен"),
                        Some(other) => println!("📊 Статус: {}", other),
                        None => println!("📊 Статус: Неизвестный формат"),
                    }
                }
            }
            Err(e) => {
                println!("❌ Ошибка получения информации: {}", e);
                
                if e.to_string().contains("404") {
                    println!("   💡 Счет не найден или недоступен");
                } else if e.to_string().contains("403") {
                    println!("   💡 Недостаточно прав для доступа к счету");
                } else if e.to_string().contains("401") {
                    println!("   💡 Проблема с авторизацией");
                }
            }
        }
    }

    println!("\n📋 Итоги:");
    println!("=========");
    println!("🔗 Endpoint: /openapi/invoice/{{invoiceId}}/info");
    println!("📄 Документация: https://business.tbank.ru/openapi/api/v1/openapi/invoice/{{invoiceId}}/info");
    println!("🔑 Авторизация: Bearer токен");
    println!("📊 Возвращает: Статус счета и дополнительную информацию");

    Ok(())
}