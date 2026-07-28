use chrono::{Duration, Utc};
use rust_decimal::Decimal;
use std::io::{self, Write};
use std::str::FromStr;
use tbank_integration::types::b2b::invoice::{
    CreateB2BInvoiceRequest, CreateInvoiceContactRequest, CreateInvoiceItemRequest,
};
use tbank_integration::counterparty::validator::InnKppValidator;
use tracing_subscriber::fmt;

/// Интерактивный тест для создания B2B счетов
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    fmt::init();
    println!("🏦 Интерактивный тест T-Bank B2B Invoice API");
    println!("===========================================");
    
    loop {
        println!("\nВыберите действие:");
        println!("1. Создать тестовый счет");
        println!("2. Проверить валидацию ИНН");
        println!("3. Тест с реальными данными");
        println!("4. Показать примеры запросов");
        println!("5. Выход");
        
        print!("Ваш выбор (1-5): ");
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        
        match input.trim() {
            "1" => create_interactive_invoice().await?,
            "2" => test_inn_validation().await?,
            "3" => test_with_real_data().await?,
            "4" => show_examples().await?,
            "5" => {
                println!("До свидания!");
                break;
            }
            _ => println!("Неверный выбор, попробуйте снова."),
        }
    }
    
    Ok(())
}

async fn create_interactive_invoice() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n📝 Создание нового счета");
    println!("========================");
    
    // Ввод данных контрагента
    print!("Введите ИНН контрагента (10 или 12 цифр): ");
    io::stdout().flush()?;
    let mut inn = String::new();
    io::stdin().read_line(&mut inn)?;
    let inn = inn.trim().to_string();
    
    print!("Введите КПП (опционально, Enter для пропуска): ");
    io::stdout().flush()?;
    let mut kpp = String::new();
    io::stdin().read_line(&mut kpp)?;
    let kpp = if kpp.trim().is_empty() {
        None
    } else {
        Some(kpp.trim().to_string())
    };
    
    print!("Введите название организации: ");
    io::stdout().flush()?;
    let mut name = String::new();
    io::stdin().read_line(&mut name)?;
    let name = name.trim().to_string();
    
    print!("Введите сумму счета (руб.): ");
    io::stdout().flush()?;
    let mut amount_str = String::new();
    io::stdin().read_line(&mut amount_str)?;
    let amount = Decimal::from_str(amount_str.trim())?;
    
    print!("Введите количество дней до оплаты: ");
    io::stdout().flush()?;
    let mut days_str = String::new();
    io::stdin().read_line(&mut days_str)?;
    let days: i64 = days_str.trim().parse()?;
    
    // Создание счета
    let invoice = CreateB2BInvoiceRequest {
        counterparty_inn: inn,
        counterparty_kpp: kpp,
        counterparty_name: name,
        total_amount: amount,
        due_date: (Utc::now() + Duration::days(days)).date_naive(),
        invoice_date: Some(Utc::now().date_naive()),
        account_number: Some("40702810110011000000".to_string()),
        invoice_number: format!("INV-INTERACTIVE-{}", Utc::now().timestamp()),
        comment: Some("Интерактивно созданный счет".to_string()),
        custom_payment_purpose: None,
        items: vec![CreateInvoiceItemRequest {
            name: "Услуги/товары".to_string(),
            price: amount,
            unit: "шт".to_string(),
            vat_rate: "20%".to_string(),
            amount: 1,
        }],
        contacts: vec![],
    };
    
    println!("\n✅ Счет создан:");
    print_invoice_summary(&invoice);
    
    // Валидация
    match validate_invoice(&invoice) {
        Ok(_) => println!("✅ Валидация прошла успешно"),
        Err(e) => println!("❌ Ошибка валидации: {}", e),
    }
    
    Ok(())
}

async fn test_inn_validation() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🔍 Тест валидации ИНН");
    println!("=====================");
    
    let test_cases = vec![
        ("7707083893", "Сбербанк (валидный 10-значный)"),
        ("123456789012", "Тестовый ИП (валидный 12-значный)"),
        ("123", "Слишком короткий"),
        ("12345678901234567", "Слишком длинный"),
        ("770708389a", "Содержит буквы"),
        ("", "Пустой"),
    ];
    
    for (inn, description) in test_cases {
        let is_valid = InnKppValidator::validate_inn(inn).is_ok();
        let status = if is_valid { "✅" } else { "❌" };
        println!("{} {} - {}", status, inn, description);
    }
    
    Ok(())
}

async fn test_with_real_data() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🌐 Тест с реальными данными");
    println!("===========================");
    
    // Проверяем настройки окружения
    let api_token = std::env::var("TBANK_API_TOKEN")
        .unwrap_or_else(|_| "НЕ НАСТРОЕН".to_string());
    let environment = std::env::var("TBANK_ENVIRONMENT")
        .unwrap_or_else(|_| "НЕ НАСТРОЕН".to_string());
    
    println!("Текущие настройки:");
    println!("  Окружение: {}", environment);
    println!("  API Token: {}", if api_token == "НЕ НАСТРОЕН" { 
        api_token 
    } else { 
        format!("{}***", &api_token[..std::cmp::min(8, api_token.len())])
    });
    
    if environment == "sandbox" && api_token != "НЕ НАСТРОЕН" {
        println!("\n✅ Настройки корректны для тестирования");
        
        // Создаем тестовый счет с реальными данными известных организаций
        let test_invoice = CreateB2BInvoiceRequest {
            counterparty_inn: "7707083893".to_string(), // Сбербанк
            counterparty_kpp: Some("770701001".to_string()),
            counterparty_name: "ПАО СБЕРБАНК".to_string(),
            total_amount: Decimal::from_str("10000.00")?,
            due_date: (Utc::now() + Duration::days(30)).date_naive(),
            invoice_date: Some(Utc::now().date_naive()),
            account_number: Some("40702810110011000000".to_string()),
            invoice_number: format!("TEST-{}", Utc::now().timestamp()),
            comment: Some("Тестовый счет для проверки API".to_string()),
            custom_payment_purpose: Some("Тестовая оплата".to_string()),
            items: vec![CreateInvoiceItemRequest {
                name: "Тестовая услуга".to_string(),
                price: Decimal::from_str("10000.00")?,
                unit: "шт".to_string(),
                vat_rate: "20%".to_string(),
                amount: 1,
            }],
            contacts: vec![CreateInvoiceContactRequest {
                email: Some("test@example.com".to_string()),
            }],
        };
        
        println!("\n📋 Тестовый счет для API:");
        print_invoice_summary(&test_invoice);
        
        println!("\n💡 Для отправки в T-Bank API выполните:");
        println!("   cargo test --package tbank-integration --test integration_tests");
        
    } else {
        println!("\n⚠️  Для тестирования с реальным API необходимо:");
        println!("   1. Установить TBANK_ENVIRONMENT=sandbox в .env");
        println!("   2. Получить sandbox токен от T-Bank");
        println!("   3. Установить TBANK_API_TOKEN в .env");
    }
    
    Ok(())
}

async fn show_examples() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n📚 Примеры запросов");
    println!("==================");
    
    println!("\n1️⃣ Простой счет для ООО:");
    let simple_invoice = CreateB2BInvoiceRequest {
        counterparty_inn: "7707083893".to_string(),
        counterparty_kpp: Some("770701001".to_string()),
        counterparty_name: "ООО \"Пример\"".to_string(),
        total_amount: Decimal::from_str("50000.00").unwrap(),
        due_date: (Utc::now() + Duration::days(14)).date_naive(),
        invoice_date: Some(Utc::now().date_naive()),
        account_number: Some("40702810110011000000".to_string()),
        invoice_number: "INV-2024-001".to_string(),
        comment: Some("Оплата за услуги".to_string()),
        custom_payment_purpose: None,
        items: vec![CreateInvoiceItemRequest {
            name: "Консультационные услуги".to_string(),
            price: Decimal::from_str("50000.00").unwrap(),
            unit: "услуга".to_string(),
            vat_rate: "20%".to_string(),
            amount: 1,
        }],
        contacts: vec![CreateInvoiceContactRequest {
            email: Some("contact@example.com".to_string()),
        }],
    };
    print_invoice_summary(&simple_invoice);
    
    println!("\n2️⃣ Счет для ИП (без КПП):");
    let ip_invoice = CreateB2BInvoiceRequest {
        counterparty_inn: "123456789012".to_string(), // 12 цифр для ИП
        counterparty_kpp: None, // У ИП нет КПП
        counterparty_name: "ИП Иванов Иван Иванович".to_string(),
        total_amount: Decimal::from_str("25000.00").unwrap(),
        due_date: (Utc::now() + Duration::days(7)).date_naive(),
        invoice_date: Some(Utc::now().date_naive()),
        account_number: None,
        invoice_number: "INV-IP-001".to_string(),
        comment: Some("Поставка товаров".to_string()),
        custom_payment_purpose: Some("Оплата по договору поставки".to_string()),
        items: vec![CreateInvoiceItemRequest {
            name: "Товары".to_string(),
            price: Decimal::from_str("25000.00").unwrap(),
            unit: "партия".to_string(),
            vat_rate: "НДС не облагается".to_string(),
            amount: 1,
        }],
        contacts: vec![CreateInvoiceContactRequest {
            email: Some("ip@example.com".to_string()),
        }],
    };
    print_invoice_summary(&ip_invoice);
    
    println!("\n3️⃣ Счет с несколькими позициями:");
    let multi_item_invoice = CreateB2BInvoiceRequest {
        counterparty_inn: "7707083893".to_string(),
        counterparty_kpp: Some("770701001".to_string()),
        counterparty_name: "АО \"Многопозиционный\"".to_string(),
        total_amount: Decimal::from_str("120000.00").unwrap(),
        due_date: (Utc::now() + Duration::days(30)).date_naive(),
        invoice_date: Some(Utc::now().date_naive()),
        account_number: Some("40702810220022000000".to_string()),
        invoice_number: "INV-MULTI-001".to_string(),
        comment: Some("Комплексные услуги".to_string()),
        custom_payment_purpose: Some("Оплата по договору №123".to_string()),
        items: vec![
            CreateInvoiceItemRequest {
                name: "Разработка ТЗ".to_string(),
                price: Decimal::from_str("30000.00").unwrap(),
                unit: "этап".to_string(),
                vat_rate: "20%".to_string(),
                amount: 1,
            },
            CreateInvoiceItemRequest {
                name: "Программирование".to_string(),
                price: Decimal::from_str("60000.00").unwrap(),
                unit: "этап".to_string(),
                vat_rate: "20%".to_string(),
                amount: 1,
            },
            CreateInvoiceItemRequest {
                name: "Тестирование".to_string(),
                price: Decimal::from_str("30000.00").unwrap(),
                unit: "этап".to_string(),
                vat_rate: "20%".to_string(),
                amount: 1,
            },
        ],
        contacts: vec![
            CreateInvoiceContactRequest {
                email: Some("pm@example.com".to_string()),
            },
            CreateInvoiceContactRequest {
                email: Some("finance@example.com".to_string()),
            },
        ],
    };
    print_invoice_summary(&multi_item_invoice);
    
    Ok(())
}

fn print_invoice_summary(invoice: &CreateB2BInvoiceRequest) {
    println!("  📋 Номер: {}", invoice.invoice_number);
    println!("  🏢 Контрагент: {}", invoice.counterparty_name);
    println!("  🆔 ИНН: {}", invoice.counterparty_inn);
    if let Some(kpp) = &invoice.counterparty_kpp {
        println!("  🆔 КПП: {}", kpp);
    }
    println!("  💰 Сумма: {} руб.", invoice.total_amount);
    println!("  📅 Срок оплаты: {}", invoice.due_date);
    println!("  📦 Позиций: {}", invoice.items.len());
    println!("  📞 Контактов: {}", invoice.contacts.len());
    if let Some(comment) = &invoice.comment {
        println!("  💬 Комментарий: {}", comment);
    }
}

fn validate_invoice(invoice: &CreateB2BInvoiceRequest) -> Result<(), String> {
    // Валидация ИНН
    if InnKppValidator::validate_inn(&invoice.counterparty_inn).is_err() {
        return Err("Неверный формат ИНН".to_string());
    }
    
    // Валидация суммы
    if invoice.total_amount <= Decimal::ZERO {
        return Err("Сумма должна быть положительной".to_string());
    }
    
    // Валидация срока оплаты
    if invoice.due_date <= Utc::now().date_naive() {
        return Err("Срок оплаты должен быть в будущем".to_string());
    }
    
    // Валидация позиций
    if invoice.items.is_empty() {
        return Err("Счет должен содержать хотя бы одну позицию".to_string());
    }
    
    // Проверка суммы позиций
    let items_total: Decimal = invoice.items.iter()
        .map(|item| item.price * Decimal::from(item.amount))
        .sum();
    
    if (items_total - invoice.total_amount).abs() > Decimal::from_str("0.01").unwrap() {
        return Err("Сумма позиций не соответствует общей сумме".to_string());
    }
    
    Ok(())
}

// Используем централизованную валидацию ИНН из counterparty::validator
// fn validate_inn удалена - используйте InnKppValidator::validate_inn