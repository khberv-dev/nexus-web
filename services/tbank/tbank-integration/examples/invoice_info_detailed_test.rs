use chrono::{Duration, Utc};
use tbank_integration::{TBankConfig};
use tbank_integration::client::api_methods::B2BApiMethods;
use tracing_subscriber::fmt;

/// Детальный тест получения информации о счете
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

    println!("🔍 Детальный тест получения информации о счете");
    println!("==============================================");

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

    println!("\n📋 Шаг 1: Создание тестового счета");
    println!("==================================");
    
    // Создаем тестовый счет по образцу из документации
    let test_request = serde_json::json!({
        "invoiceNumber": format!("{}", Utc::now().timestamp()),
        "dueDate": (Utc::now() + Duration::days(30)).format("%Y-%m-%d").to_string(),
        "invoiceDate": Utc::now().format("%Y-%m-%d").to_string(),
        "payer": {
            "name": "ООО «Тестовая компания»",
            "inn": "730990470834",
            "kpp": "123456789"
        },
        "items": [
            {
                "name": "Тестовая услуга для проверки информации",
                "price": 500,
                "unit": "шт",
                "vat": "20",
                "amount": 1
            }
        ],
        "contacts": [
            {
                "email": "test@example.com"
            }
        ],
        "contactPhone": "+74996051110",
        "comment": "ТЕСТ ПОЛУЧЕНИЯ ИНФОРМАЦИИ О СЧЕТЕ",
        "customPaymentPurpose": "Тестирование endpoint /openapi/invoice/{invoiceId}/info"
    });

    let invoice_response = match tbank_client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(test_request).await {
        Ok(response) => {
            println!("✅ Счет создан успешно!");
            println!("📄 Ответ: {}", serde_json::to_string_pretty(&response)?);
            response
        }
        Err(e) => {
            println!("❌ Ошибка создания счета: {}", e);
            return Err(format!("Не удалось создать счет: {}", e).into());
        }
    };

    // Извлекаем ID счета
    let invoice_id = match invoice_response.get("invoiceId") {
        Some(id) => {
            let id_str = id.as_str().unwrap_or_default();
            println!("📋 ID созданного счета: {}", id_str);
            id_str
        }
        None => {
            println!("❌ Не удалось получить ID счета из ответа");
            return Err("Invoice ID not found in response".into());
        }
    };

    println!("\n🔍 Шаг 2: Получение детальной информации о счете");
    println!("================================================");
    println!("📡 Используемый endpoint: /openapi/invoice/{}/info", invoice_id);
    println!("🌐 Полный URL: {}/openapi/invoice/{}/info", 
        tbank_client.business_base_url(), 
        invoice_id
    );

    match tbank_client.get_invoice_info(invoice_id).await {
        Ok(info_response) => {
            println!("✅ Информация о счете получена успешно!");
            println!("📄 Полная информация о счете:");
            println!("{}", serde_json::to_string_pretty(&info_response)?);
            
            // Анализируем полученную информацию
            println!("\n🔍 Анализ полученной информации:");
            
            if let Some(status) = info_response.get("status") {
                println!("   📊 Статус: {}", status);
            }
            
            if let Some(amount) = info_response.get("amount") {
                println!("   💰 Сумма: {}", amount);
            }
            
            if let Some(currency) = info_response.get("currency") {
                println!("   💱 Валюта: {}", currency);
            }
            
            if let Some(created_date) = info_response.get("createdDate") {
                println!("   📅 Дата создания: {}", created_date);
            }
            
            if let Some(due_date) = info_response.get("dueDate") {
                println!("   ⏰ Срок оплаты: {}", due_date);
            }
            
            if let Some(payer) = info_response.get("payer") {
                println!("   👤 Плательщик: {}", serde_json::to_string_pretty(payer)?);
            }
            
            if let Some(items) = info_response.get("items") {
                println!("   📦 Позиции: {}", serde_json::to_string_pretty(items)?);
            }
            
            if let Some(payment_info) = info_response.get("paymentInfo") {
                println!("   💳 Информация об оплате: {}", serde_json::to_string_pretty(payment_info)?);
            }
            
            println!("\n✅ Тест успешно завершен!");
            println!("📋 Endpoint /openapi/invoice/{}/info работает корректно", invoice_id);
        }
        Err(e) => {
            println!("❌ Ошибка получения информации о счете: {}", e);
            println!("\n💡 Возможные причины:");
            println!("   - Неправильный endpoint URL");
            println!("   - Счет еще не обработан системой");
            println!("   - Недостаточные права доступа");
            println!("   - Неверный ID счета");
            
            println!("\n🔧 Отладочная информация:");
            println!("   Invoice ID: {}", invoice_id);
            println!("   Environment: {:?}", tbank_client.environment);
            println!("   Expected URL: {}/openapi/invoice/{}/info", 
                tbank_client.business_base_url(), 
                invoice_id
            );
        }
    }

    Ok(())
}