use chrono::{Duration, Utc};
use tbank_integration::{TBankConfig};
use tbank_integration::client::api_methods::B2BApiMethods;
use tracing_subscriber::fmt;

/// Тест создания реального исходящего счета в production окружении T-Bank
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

    println!("🏦 Тест создания ИСХОДЯЩЕГО счета в production T-Bank API");
    println!("========================================================");
    println!("⚠️  ВНИМАНИЕ: Этот тест создает РЕАЛЬНЫЕ счета!");
    println!("   Используйте только для тестирования с минимальными суммами");
    println!("");

    // Временно переопределяем окружение на production
    std::env::set_var("TBANK_ENVIRONMENT", "production");

    // Проверка конфигурации
    let config = match TBankConfig::from_env() {
        Ok(config) => {
            println!("✅ Конфигурация загружена");
            println!("   Окружение: {:?}", config.environment);
            println!("   Business API URL: {}", config.business_api_base_url);
            println!("   API Token: {}***", &config.api_token[..std::cmp::min(8, config.api_token.len())]);
            
            // Проверяем, что используется production URL
            if !config.business_api_base_url.contains("/sandbox/") {
                println!("✅ Используется production API URL");
            } else {
                println!("❌ Ошибка: все еще используется sandbox URL");
                return Err("Неправильная конфигурация URL".into());
            }
            
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
            println!("✅ T-Bank клиент создан для production");
            client
        }
        Err(e) => {
            println!("❌ Ошибка создания клиента: {}", e);
            return Err(e.into());
        }
    };

    println!("\n🧪 Создание исходящего счета через production API");
    println!("=================================================");
    
    // Создаем тестовый счет по образцу из документации T-Bank
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
                "name": "Тестовая услуга",
                "price": 100,
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
        "comment": "Тестовый исходящий счет через production API",
        "customPaymentPurpose": "Тестирование создания исходящих счетов"
    });

    println!("📋 Отправляемый запрос:");
    println!("{}", serde_json::to_string_pretty(&test_request)?);

    match tbank_client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(test_request).await {
        Ok(response) => {
            println!("✅ Счет создан успешно!");
            println!("📄 Полный ответ от production API:");
            println!("{}", serde_json::to_string_pretty(&response)?);
            
            // Анализируем ответ
            println!("\n🔍 Анализ ответа:");
            
            if let Some(invoice_id) = response.get("invoiceId") {
                println!("   📋 Invoice ID: {}", invoice_id);
            }
            
            if let Some(pdf_url) = response.get("pdfUrl") {
                println!("   📄 PDF URL: {}", pdf_url);
            }
            
            if let Some(incoming_url) = response.get("incomingInvoiceUrl") {
                println!("   🔗 Incoming Invoice URL: {}", incoming_url);
            }
            
            if let Some(outgoing_url) = response.get("outgoingInvoiceUrl") {
                println!("   🔗 Outgoing Invoice URL: {}", outgoing_url);
            }
            
            if let Some(payment_url) = response.get("paymentUrl") {
                println!("   💳 Payment URL: {}", payment_url);
            }
            
            if let Some(status) = response.get("status") {
                println!("   📊 Status: {}", status);
            }
            
            // Определяем тип счета
            println!("\n🎯 Определение типа счета:");
            if response.get("outgoingInvoiceUrl").is_some() {
                println!("   ⬆️  ✅ Это ИСХОДЯЩИЙ счет (outgoing) - мы выставили его клиенту!");
                println!("   💰 Клиент должен оплатить этот счет нам");
            } else if response.get("incomingInvoiceUrl").is_some() {
                println!("   ⬇️  ❌ Это все еще входящий счет (incoming)");
                println!("   🤔 Возможно, нужны другие параметры или права доступа");
            }
            
            // Если есть invoice ID, попробуем получить информацию о счете
            if let Some(invoice_id) = response.get("invoiceId").and_then(|v| v.as_str()) {
                println!("\n🔍 Получение информации о созданном счете...");
                match tbank_client.get_invoice_info(invoice_id).await {
                    Ok(info) => {
                        println!("✅ Информация получена:");
                        println!("{}", serde_json::to_string_pretty(&info)?);
                    }
                    Err(e) => {
                        println!("❌ Ошибка получения информации: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            println!("❌ Ошибка создания счета: {}", e);
            println!("\n💡 Возможные причины:");
            println!("   - API токен не имеет прав для создания исходящих счетов");
            println!("   - Нужна активация функции выставления счетов в T-Bank");
            println!("   - Требуется другой endpoint или параметры");
            println!("   - Ограничения для тестового аккаунта");
        }
    }

    println!("\n📋 Выводы:");
    println!("=========");
    println!("1. Production API URL: https://business.tbank.ru/openapi/api/v1/invoice/send");
    println!("2. Этот endpoint должен создавать исходящие счета (которые мы выставляем)");
    println!("3. Если все еще создаются входящие счета, возможно:");
    println!("   - Нужны дополнительные права в T-Bank аккаунте");
    println!("   - Требуется активация функции выставления счетов");
    println!("   - Используется другой API или продукт T-Bank");

    Ok(())
}