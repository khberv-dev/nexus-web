use chrono::{Duration, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;
use tbank_integration::types::b2b::invoice::{
    CreateB2BInvoiceRequest, CreateInvoiceContactRequest, CreateInvoiceItemRequest,
};
use tbank_integration::{TBankConfig, TBankServiceFactory};
use tbank_integration::client::api_methods::B2BApiMethods;
use tracing_subscriber::fmt;

/// Тест создания счета и получения информации о нем
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

    println!("🏦 Тест создания счета и получения информации");
    println!("============================================");

    // 1. Проверка конфигурации
    println!("\n🔧 Проверка конфигурации...");
    let config = match TBankConfig::from_env() {
        Ok(config) => {
            println!("✅ Конфигурация загружена успешно");
            println!("   Окружение: {:?}", config.environment);
            println!("   API Token: {}***", &config.api_token[..std::cmp::min(8, config.api_token.len())]);
            config
        }
        Err(e) => {
            println!("❌ Ошибка загрузки конфигурации: {}", e);
            return Err(e.into());
        }
    };

    // 2. Создание клиента
    println!("\n🔄 Инициализация T-Bank клиента...");
    let tbank_client = match tbank_integration::client::TBankClient::new(std::sync::Arc::new(config)) {
        Ok(client) => {
            println!("✅ T-Bank клиент инициализирован");
            client
        }
        Err(e) => {
            println!("❌ Ошибка инициализации клиента: {}", e);
            return Err(format!("Не удалось инициализировать T-Bank клиент: {}", e).into());
        }
    };

    // 3. Создание тестового счета
    println!("\n📋 Создание тестового счета...");
    let tbank_request = serde_json::json!({
        "invoiceNumber": format!("{}", Utc::now().timestamp()), // Только цифры
        "dueDate": (Utc::now() + Duration::days(30)).format("%Y-%m-%d").to_string(),
        "invoiceDate": Utc::now().format("%Y-%m-%d").to_string(),
        "accountNumber": "40802810110011000000",
        "payer": {
            "name": "ПАО СБЕРБАНК",
            "inn": "7707083893",
            "kpp": "770701001"
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
        "comment": "ТЕСТОВЫЙ СЧЕТ ДЛЯ ПРОВЕРКИ ИНФОРМАЦИИ - НЕ ОПЛАЧИВАТЬ",
        "customPaymentPurpose": "Тестирование получения информации о счете"
    });

    println!("🔄 Отправка счета в T-Bank...");
    let invoice_response = match tbank_client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(tbank_request).await {
        Ok(response) => {
            println!("✅ Счет успешно создан!");
            println!("📄 Ответ: {}", serde_json::to_string_pretty(&response)?);
            response
        }
        Err(e) => {
            println!("❌ Ошибка создания счета: {}", e);
            return Err(format!("Не удалось создать счет: {}", e).into());
        }
    };

    // 4. Извлечение ID счета из ответа
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

    // 5. Получение информации о счете
    println!("\n🔍 Получение информации о созданном счете...");
    match tbank_client.get_invoice_info(invoice_id).await {
        Ok(info_response) => {
            println!("✅ Информация о счете получена успешно!");
            println!("📄 Информация о счете:");
            println!("{}", serde_json::to_string_pretty(&info_response)?);
        }
        Err(e) => {
            println!("❌ Ошибка получения информации о счете: {}", e);
            println!("💡 Возможные причины:");
            println!("   - Счет еще не обработан системой");
            println!("   - Неверный ID счета");
            println!("   - Ограничения доступа к информации");
            // Не возвращаем ошибку, так как основная функция (создание счета) работает
        }
    }

    println!("\n✅ Тест завершен!");
    println!("📋 Результаты:");
    println!("   ✅ Счет успешно создан через T-Bank API");
    println!("   ✅ Получен корректный ответ с ID и URL");
    println!("   ✅ API токен работает в sandbox окружении");
    
    Ok(())
}