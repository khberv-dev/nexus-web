use chrono::{Duration, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;
use tbank_integration::types::b2b::invoice::{
    CreateB2BInvoiceRequest, CreateInvoiceContactRequest, CreateInvoiceItemRequest,
};
use tracing_subscriber::fmt;

/// Пример тестирования создания B2B счета для юридического лица
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Инициализация логирования
    fmt::init();

    println!("🏦 Тестирование T-Bank B2B Invoice API");
    println!("=====================================");

    // 1. Создание тестового запроса на счет
    let test_invoice = create_test_invoice_request()?;
    println!("✅ Создан тестовый запрос на счет");
    print_invoice_details(&test_invoice);

    // 2. Валидация запроса
    println!("\n🔍 Валидация запроса...");
    validate_test_invoice(&test_invoice)?;
    println!("✅ Валидация прошла успешно");

    // 3. Тестирование различных сценариев
    println!("\n🧪 Тестирование различных сценариев...");
    test_validation_scenarios().await?;

    // 4. Тестирование с реальными данными (sandbox)
    println!("\n🌐 Тестирование с T-Bank Sandbox API...");
    test_sandbox_api().await?;

    println!("\n✅ Все тесты завершены успешно!");
    Ok(())
}

/// Создает тестовый запрос на B2B счет
fn create_test_invoice_request() -> Result<CreateB2BInvoiceRequest, Box<dyn std::error::Error>> {
    let invoice_request = CreateB2BInvoiceRequest {
        // Данные контрагента (тестовый ИНН Сбербанка)
        counterparty_inn: "7707083893".to_string(),
        counterparty_kpp: Some("770701001".to_string()),
        counterparty_name: "ПАО СБЕРБАНК".to_string(),

        // Финансовые данные
        total_amount: Decimal::from_str("150000.00")?, // 150,000 рублей
        due_date: (Utc::now() + Duration::days(30)).date_naive(),
        invoice_date: Some(Utc::now().date_naive()),
        account_number: Some("40702810110011000000".to_string()),

        // Номер счета (должен быть уникальным)
        invoice_number: format!("INV-{}", Utc::now().timestamp()),

        // Дополнительная информация
        comment: Some("Тестовый счет для проверки интеграции с T-Bank API".to_string()),
        custom_payment_purpose: Some("Оплата за услуги разработки ПО".to_string()),

        // Позиции счета
        items: vec![
            CreateInvoiceItemRequest {
                name: "Разработка веб-приложения".to_string(),
                price: Decimal::from_str("100000.00")?,
                unit: "шт".to_string(),
                vat_rate: "20%".to_string(),
                amount: 1,
            },
            CreateInvoiceItemRequest {
                name: "Техническая поддержка".to_string(),
                price: Decimal::from_str("50000.00")?,
                unit: "мес".to_string(),
                vat_rate: "20%".to_string(),
                amount: 1,
            },
        ],

        // Контакты для уведомлений
        contacts: vec![CreateInvoiceContactRequest {
            email: Some("test@example.com".to_string()),
        }],
    };

    Ok(invoice_request)
}

/// Выводит детали счета
fn print_invoice_details(invoice: &CreateB2BInvoiceRequest) {
    println!("📋 Детали счета:");
    println!("   Номер: {}", invoice.invoice_number);
    println!("   Контрагент: {} (ИНН: {})", invoice.counterparty_name, invoice.counterparty_inn);
    if let Some(kpp) = &invoice.counterparty_kpp {
        println!("   КПП: {}", kpp);
    }
    println!("   Сумма: {} руб.", invoice.total_amount);
    println!("   Срок оплаты: {}", invoice.due_date);
    println!("   Позиций: {}", invoice.items.len());
    println!("   Контактов: {}", invoice.contacts.len());
}

/// Валидирует тестовый счет
fn validate_test_invoice(invoice: &CreateB2BInvoiceRequest) -> Result<(), Box<dyn std::error::Error>> {
    // Проверка ИНН
    if invoice.counterparty_inn.len() != 10 && invoice.counterparty_inn.len() != 12 {
        return Err("Неверная длина ИНН".into());
    }

    if !invoice.counterparty_inn.chars().all(|c| c.is_ascii_digit()) {
        return Err("ИНН должен содержать только цифры".into());
    }

    // Проверка суммы
    if invoice.total_amount <= Decimal::ZERO {
        return Err("Сумма должна быть положительной".into());
    }

    // Проверка срока оплаты
    if invoice.due_date <= Utc::now().date_naive() {
        return Err("Срок оплаты должен быть в будущем".into());
    }

    // Проверка позиций
    if invoice.items.is_empty() {
        return Err("Счет должен содержать хотя бы одну позицию".into());
    }

    // Проверка суммы позиций
    let items_total: Decimal = invoice.items.iter()
        .map(|item| item.price * Decimal::from(item.amount))
        .sum();

    if (items_total - invoice.total_amount).abs() > Decimal::from_str("0.01")? {
        return Err("Сумма позиций не соответствует общей сумме счета".into());
    }

    Ok(())
}

/// Тестирует различные сценарии валидации
async fn test_validation_scenarios() -> Result<(), Box<dyn std::error::Error>> {
    println!("  🔸 Тест 1: Неверный ИНН");
    let mut invalid_inn_request = create_test_invoice_request()?;
    invalid_inn_request.counterparty_inn = "123".to_string(); // Слишком короткий
    
    match validate_test_invoice(&invalid_inn_request) {
        Err(_) => println!("    ✅ Неверный ИНН корректно отклонен"),
        Ok(_) => println!("    ❌ Неверный ИНН не был отклонен"),
    }

    println!("  🔸 Тест 2: Отрицательная сумма");
    let mut negative_amount_request = create_test_invoice_request()?;
    negative_amount_request.total_amount = Decimal::from_str("-1000.00")?;
    
    match validate_test_invoice(&negative_amount_request) {
        Err(_) => println!("    ✅ Отрицательная сумма корректно отклонена"),
        Ok(_) => println!("    ❌ Отрицательная сумма не была отклонена"),
    }

    println!("  🔸 Тест 3: Прошедший срок оплаты");
    let mut past_due_request = create_test_invoice_request()?;
    past_due_request.due_date = (Utc::now() - Duration::days(1)).date_naive();
    
    match validate_test_invoice(&past_due_request) {
        Err(_) => println!("    ✅ Прошедший срок оплаты корректно отклонен"),
        Ok(_) => println!("    ❌ Прошедший срок оплаты не был отклонен"),
    }

    println!("  🔸 Тест 4: Пустой список позиций");
    let mut empty_items_request = create_test_invoice_request()?;
    empty_items_request.items.clear();
    
    match validate_test_invoice(&empty_items_request) {
        Err(_) => println!("    ✅ Пустой список позиций корректно отклонен"),
        Ok(_) => println!("    ❌ Пустой список позиций не был отклонен"),
    }

    Ok(())
}

/// Тестирует интеграцию с T-Bank Sandbox API
async fn test_sandbox_api() -> Result<(), Box<dyn std::error::Error>> {
    println!("  🔸 Проверка конфигурации sandbox...");
    
    // Проверяем переменные окружения
    let api_token = std::env::var("TBANK_API_TOKEN")
        .unwrap_or_else(|_| "test_token".to_string());
    let environment = std::env::var("TBANK_ENVIRONMENT")
        .unwrap_or_else(|_| "sandbox".to_string());
    
    println!("    Окружение: {}", environment);
    println!("    API Token: {}***", &api_token[..std::cmp::min(8, api_token.len())]);

    if environment == "sandbox" {
        println!("    ✅ Sandbox окружение настроено");
        
        // Здесь можно добавить реальный вызов API, если доступен sandbox
        println!("    ℹ️  Для реального тестирования API необходимо:");
        println!("       1. Получить sandbox токен от T-Bank");
        println!("       2. Настроить TBANK_API_TOKEN в .env");
        println!("       3. Запустить интеграционные тесты");
    } else {
        println!("    ⚠️  Не sandbox окружение - пропускаем API тесты");
    }

    Ok(())
}

/// Создает различные тестовые сценарии для разных типов юридических лиц
pub fn create_test_scenarios() -> Vec<CreateB2BInvoiceRequest> {
    vec![
        // Сценарий 1: ООО
        CreateB2BInvoiceRequest {
            counterparty_inn: "7707083893".to_string(), // Сбербанк
            counterparty_kpp: Some("770701001".to_string()),
            counterparty_name: "ООО \"Тестовая Компания\"".to_string(),
            total_amount: Decimal::from_str("50000.00").unwrap(),
            due_date: (Utc::now() + Duration::days(14)).date_naive(),
            invoice_date: Some(Utc::now().date_naive()),
            account_number: Some("40702810110011000000".to_string()),
            invoice_number: format!("INV-OOO-{}", Utc::now().timestamp()),
            comment: Some("Счет для ООО".to_string()),
            custom_payment_purpose: None,
            items: vec![CreateInvoiceItemRequest {
                name: "Консультационные услуги".to_string(),
                price: Decimal::from_str("50000.00").unwrap(),
                unit: "услуга".to_string(),
                vat_rate: "20%".to_string(),
                amount: 1,
            }],
            contacts: vec![CreateInvoiceContactRequest {
                email: Some("ooo@test.com".to_string()),
            }],
        },

        // Сценарий 2: ИП (12-значный ИНН)
        CreateB2BInvoiceRequest {
            counterparty_inn: "123456789012".to_string(), // Тестовый ИНН ИП
            counterparty_kpp: None, // У ИП нет КПП
            counterparty_name: "ИП Иванов Иван Иванович".to_string(),
            total_amount: Decimal::from_str("25000.00").unwrap(),
            due_date: (Utc::now() + Duration::days(7)).date_naive(),
            invoice_date: Some(Utc::now().date_naive()),
            account_number: None,
            invoice_number: format!("INV-IP-{}", Utc::now().timestamp()),
            comment: Some("Счет для ИП".to_string()),
            custom_payment_purpose: Some("Оплата за товары".to_string()),
            items: vec![CreateInvoiceItemRequest {
                name: "Поставка товаров".to_string(),
                price: Decimal::from_str("25000.00").unwrap(),
                unit: "партия".to_string(),
                vat_rate: "НДС не облагается".to_string(),
                amount: 1,
            }],
            contacts: vec![CreateInvoiceContactRequest {
                email: Some("ip@test.com".to_string()),
            }],
        },

        // Сценарий 3: Крупная сумма с несколькими позициями
        CreateB2BInvoiceRequest {
            counterparty_inn: "7707083893".to_string(),
            counterparty_kpp: Some("770701001".to_string()),
            counterparty_name: "АО \"Большая Компания\"".to_string(),
            total_amount: Decimal::from_str("500000.00").unwrap(),
            due_date: (Utc::now() + Duration::days(45)).date_naive(),
            invoice_date: Some(Utc::now().date_naive()),
            account_number: Some("40702810220022000000".to_string()),
            invoice_number: format!("INV-BIG-{}", Utc::now().timestamp()),
            comment: Some("Крупный заказ на разработку".to_string()),
            custom_payment_purpose: Some("Разработка корпоративной системы".to_string()),
            items: vec![
                CreateInvoiceItemRequest {
                    name: "Анализ требований".to_string(),
                    price: Decimal::from_str("100000.00").unwrap(),
                    unit: "этап".to_string(),
                    vat_rate: "20%".to_string(),
                    amount: 1,
                },
                CreateInvoiceItemRequest {
                    name: "Разработка MVP".to_string(),
                    price: Decimal::from_str("250000.00").unwrap(),
                    unit: "этап".to_string(),
                    vat_rate: "20%".to_string(),
                    amount: 1,
                },
                CreateInvoiceItemRequest {
                    name: "Тестирование и внедрение".to_string(),
                    price: Decimal::from_str("150000.00").unwrap(),
                    unit: "этап".to_string(),
                    vat_rate: "20%".to_string(),
                    amount: 1,
                },
            ],
            contacts: vec![
                CreateInvoiceContactRequest {
                    email: Some("pm@bigcompany.com".to_string()),
                },
                CreateInvoiceContactRequest {
                    email: Some("finance@bigcompany.com".to_string()),
                },
            ],
        },
    ]
}