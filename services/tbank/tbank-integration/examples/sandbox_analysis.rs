use chrono::{Duration, Utc};
use tbank_integration::{TBankConfig};
use tbank_integration::client::api_methods::B2BApiMethods;
use tracing_subscriber::fmt;

/// Анализ поведения T-Bank API в sandbox окружении
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

    println!("🔬 Анализ T-Bank API в sandbox окружении");
    println!("=======================================");

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

    println!("\n🧪 Тест 1: Создание счета через /invoice/send");
    println!("==============================================");
    
    // Создаем тестовый счет
    let test_request = serde_json::json!({
        "invoiceNumber": format!("{}", Utc::now().timestamp()),
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
                "name": "Тестовая услуга",
                "price": 1000,
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
        "comment": "АНАЛИЗ SANDBOX - НЕ ОПЛАЧИВАТЬ",
        "customPaymentPurpose": "Анализ поведения T-Bank API в sandbox"
    });

    match tbank_client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(test_request).await {
        Ok(response) => {
            println!("✅ Счет создан успешно!");
            println!("📄 Полный ответ от API:");
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
            
            // Определяем тип счета по URL
            println!("\n🎯 Определение типа счета:");
            if response.get("incomingInvoiceUrl").is_some() {
                println!("   ⬇️  Это ВХОДЯЩИЙ счет (incoming) - мы должны его оплатить");
                println!("   💡 В sandbox /invoice/send создает входящие счета для тестирования оплаты");
            }
            if response.get("outgoingInvoiceUrl").is_some() {
                println!("   ⬆️  Это ИСХОДЯЩИЙ счет (outgoing) - нам должны его оплатить");
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
        }
    }

    println!("\n📋 Выводы:");
    println!("=========");
    println!("1. В sandbox окружении T-Bank API:");
    println!("   - /invoice/send создает входящие счета (incoming)");
    println!("   - Это позволяет разработчикам тестировать процесс оплаты");
    println!("   - Получаем incomingInvoiceUrl для оплаты счета");
    println!("");
    println!("2. Для создания исходящих счетов (которые выставляем клиентам):");
    println!("   - Возможно, нужен другой endpoint");
    println!("   - Или другие параметры в запросе");
    println!("   - Или это доступно только в production");
    println!("");
    println!("3. Рекомендации:");
    println!("   - Проверить документацию T-Bank для production API");
    println!("   - Уточнить у поддержки T-Bank правильный способ создания исходящих счетов");
    println!("   - Возможно, нужно использовать другой продукт T-Bank для выставления счетов");

    Ok(())
}