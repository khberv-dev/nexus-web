use chrono::{Duration, Utc};
use tbank_integration::{TBankConfig};
use tbank_integration::client::api_methods::B2BApiMethods;
use tracing_subscriber::fmt;

/// Создание РЕАЛЬНОГО исходящего счета через production T-Bank API
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

    println!("🏦 СОЗДАНИЕ РЕАЛЬНОГО ИСХОДЯЩЕГО СЧЕТА");
    println!("=====================================");
    println!("⚠️  ВНИМАНИЕ: Этот тест создает РЕАЛЬНЫЕ счета!");
    println!("   Endpoint: https://business.tbank.ru/openapi/api/v1/invoice/send");
    println!("   Это НЕ sandbox - счета будут реальными!");
    println!("");

    // Принудительно устанавливаем production окружение
    std::env::set_var("TBANK_ENVIRONMENT", "production");

    // Проверка конфигурации
    let config = match TBankConfig::from_env() {
        Ok(config) => {
            println!("✅ Конфигурация загружена");
            println!("   Окружение: {:?}", config.environment);
            println!("   Business API URL: {}", config.business_api_base_url);
            println!("   API Token: {}***", &config.api_token[..std::cmp::min(8, config.api_token.len())]);
            
            // Проверяем, что используется production URL
            if config.business_api_base_url.contains("/sandbox/") {
                println!("❌ ОШИБКА: Все еще используется sandbox URL!");
                return Err("Неправильная конфигурация - sandbox вместо production".into());
            } else {
                println!("✅ Используется production API URL");
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
            println!("✅ T-Bank клиент создан для PRODUCTION");
            client
        }
        Err(e) => {
            println!("❌ Ошибка создания клиента: {}", e);
            return Err(e.into());
        }
    };

    println!("\n🧪 Создание реального исходящего счета");
    println!("=====================================");
    
    // Создаем реальный счет по образцу из документации T-Bank
    let invoice_request = serde_json::json!({
        "invoiceNumber": format!("{}", Utc::now().timestamp()),
        "dueDate": (Utc::now() + Duration::days(30)).format("%Y-%m-%d").to_string(),
        "invoiceDate": Utc::now().format("%Y-%m-%d").to_string(),
        "accountNumber": "40802810700008268639", // РЕАЛЬНЫЙ номер счета из API
        "payer": {
            "name": "ООО «Тестовая компания»",
            "inn": "730990470834",
            "kpp": "123456789"
        },
        "items": [
            {
                "name": "Тестовая услуга",
                "price": 100, // Минимальная сумма для теста
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
        "comment": "ТЕСТОВЫЙ РЕАЛЬНЫЙ СЧЕТ - НЕ ОПЛАЧИВАТЬ",
        "customPaymentPurpose": "Тестирование создания реальных исходящих счетов"
    });

    println!("📋 Отправляемый запрос:");
    println!("{}", serde_json::to_string_pretty(&invoice_request)?);
    println!("");
    println!("🌐 URL: https://business.tbank.ru/openapi/api/v1/invoice/send");
    println!("📤 Метод: POST");
    println!("🔑 Авторизация: Bearer {}", &tbank_client.api_token[..8]);

    match tbank_client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(invoice_request).await {
        Ok(response) => {
            println!("\n✅ РЕАЛЬНЫЙ СЧЕТ СОЗДАН УСПЕШНО!");
            println!("📄 Полный ответ от production API:");
            println!("{}", serde_json::to_string_pretty(&response)?);
            
            // Детальный анализ ответа
            println!("\n🔍 Анализ созданного счета:");
            
            if let Some(invoice_id) = response.get("invoiceId") {
                println!("   📋 Invoice ID: {}", invoice_id);
            }
            
            if let Some(pdf_url) = response.get("pdfUrl") {
                println!("   📄 PDF URL: {}", pdf_url);
            }
            
            // Проверяем тип счета
            if let Some(outgoing_url) = response.get("outgoingInvoiceUrl") {
                println!("   ⬆️  ✅ ИСХОДЯЩИЙ СЧЕТ (outgoing) - мы выставили его клиенту!");
                println!("   🔗 Outgoing URL: {}", outgoing_url);
                println!("   💰 Клиент должен оплатить этот счет нам");
            } else if let Some(incoming_url) = response.get("incomingInvoiceUrl") {
                println!("   ⬇️  ❌ Входящий счет (incoming) - это не то, что нужно");
                println!("   🔗 Incoming URL: {}", incoming_url);
            } else {
                println!("   ❓ Неопределенный тип счета");
            }
            
            if let Some(payment_url) = response.get("paymentUrl") {
                println!("   💳 Payment URL: {}", payment_url);
            }
            
            if let Some(status) = response.get("status") {
                println!("   📊 Status: {}", status);
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
            println!("\n❌ Ошибка создания реального счета: {}", e);
            
            // Детальный анализ ошибки
            if e.to_string().contains("RECEIVER_ACCOUNT_NOT_FOUND") {
                println!("\n💡 Проблема с номером счета:");
                println!("   - Номер счета '40802123456789012345' не найден");
                println!("   - Нужно использовать реальный номер счета вашей организации");
                println!("   - Получите список счетов через API /bank-accounts");
            } else if e.to_string().contains("401") {
                println!("\n💡 Проблема с авторизацией:");
                println!("   - Проверьте правильность API токена");
                println!("   - Убедитесь, что токен имеет права для создания счетов");
            } else if e.to_string().contains("403") {
                println!("\n💡 Недостаточно прав:");
                println!("   - API токен не имеет прав для создания исходящих счетов");
                println!("   - Обратитесь в T-Bank для активации функции");
            } else {
                println!("\n💡 Другая ошибка: {}", e);
            }
        }
    }

    println!("\n📋 Итоги тестирования:");
    println!("======================");
    println!("🌐 Production URL: https://business.tbank.ru/openapi/api/v1/invoice/send");
    println!("🎯 Цель: Создание ИСХОДЯЩИХ счетов (которые мы выставляем клиентам)");
    println!("⚠️  Внимание: Все созданные счета являются реальными!");
    
    Ok(())
}