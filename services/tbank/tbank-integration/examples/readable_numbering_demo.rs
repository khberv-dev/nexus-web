use tbank_integration::numbering::{
    NumberingConfig, InvoiceNumberValidator, InvoiceNumber
};
use chrono::{Datelike, Utc};

/// Демонстрация читаемой системы нумерации АД/2026/01/26-00
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("📋 ДЕМОНСТРАЦИЯ ЧИТАЕМОЙ СИСТЕМЫ НУМЕРАЦИИ");
    println!("==========================================");
    
    demo_readable_formats()?;
    demo_dual_numbering()?;
    demo_validation_system()?;
    demo_business_scenarios()?;
    
    Ok(())
}

/// Демонстрация читаемых форматов
fn demo_readable_formats() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n📊 1. ЧИТАЕМЫЕ ФОРМАТЫ НОМЕРОВ");
    println!("==============================");

    let now = Utc::now();

    // B2B конфигурация с читаемым форматом
    let b2b_config = NumberingConfig::b2b_invoices();
    println!("🏢 B2B счета (АдКвест):");
    println!("   Префикс компании: {}", b2b_config.company_prefix);
    println!("   Включить год: {}", b2b_config.include_year);
    println!("   Включить месяц: {}", b2b_config.include_month);
    println!("   Включить день: {}", b2b_config.include_day);
    println!("   Длина последовательности: {}", b2b_config.sequence_length);
    println!("   Читаемый формат: {}", b2b_config.use_readable_format);

    // Создание примеров номеров
    for i in 1..=5 {
        let invoice_number = InvoiceNumber::new(&b2b_config, i, now)?;
        println!("   Счет #{}: {} → T-Bank: {}", 
                 i, 
                 invoice_number.for_documents(), 
                 invoice_number.for_tbank());
    }

    // Тестовая конфигурация
    println!("\n🧪 Тестовые счета:");
    let test_config = NumberingConfig::test_invoices();
    println!("   Префикс: {}", test_config.company_prefix);
    
    for i in 1..=3 {
        let invoice_number = InvoiceNumber::new(&test_config, i, now)?;
        println!("   Тест #{}: {} → T-Bank: {}", 
                 i, 
                 invoice_number.for_documents(), 
                 invoice_number.for_tbank());
    }

    Ok(())
}

/// Демонстрация двойной нумерации
fn demo_dual_numbering() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🔄 2. ДВОЙНАЯ СИСТЕМА НУМЕРАЦИИ");
    println!("===============================");

    let config = NumberingConfig::b2b_invoices();
    let now = Utc::now();

    println!("📋 Один счет - два формата:");
    let invoice_number = InvoiceNumber::new(&config, 42, now)?;
    
    println!("   📄 Для документооборота: {}", invoice_number.for_documents());
    println!("   🏦 Для T-Bank API: {}", invoice_number.for_tbank());
    println!("   🔢 Номер последовательности: {}", invoice_number.sequence_number);
    println!("   📅 Дата создания: {}", invoice_number.created_date.format("%Y-%m-%d %H:%M:%S"));

    println!("\n🎯 Преимущества двойной системы:");
    println!("   ✅ Читаемые номера для людей: АД/2026/01/26-42");
    println!("   ✅ Совместимость с T-Bank: 1260126042");
    println!("   ✅ Автоматическое преобразование");
    println!("   ✅ Сохранение всей информации");

    Ok(())
}

/// Демонстрация системы валидации
fn demo_validation_system() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n✅ 3. СИСТЕМА ВАЛИДАЦИИ");
    println!("=======================");

    let validator = InvoiceNumberValidator::new();
    let config = NumberingConfig::b2b_invoices();
    let now = Utc::now();

    println!("🔍 Валидация T-Bank форматов:");
    
    // Тестируем различные номера
    let test_cases = vec![
        (1, "Первый счет дня"),
        (99, "Последний счет дня (максимум 2 цифры)"),
        (123, "Переполнение (будет обрезано)"),
    ];

    for (seq_num, description) in test_cases {
        let invoice_number = InvoiceNumber::new(&config, seq_num, now)?;
        let tbank_format = invoice_number.for_tbank();
        
        match validator.validate(tbank_format) {
            Ok(()) => println!("   ✓ {} - {} → {} (валидный)", 
                             description, 
                             invoice_number.for_documents(), 
                             tbank_format),
            Err(e) => println!("   ✗ {} - {} → {} (ошибка: {})", 
                             description, 
                             invoice_number.for_documents(), 
                             tbank_format, 
                             e),
        }
    }

    Ok(())
}

/// Демонстрация бизнес-сценариев
fn demo_business_scenarios() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n💼 4. БИЗНЕС-СЦЕНАРИИ");
    println!("====================");

    let config = NumberingConfig::b2b_invoices();
    let now = Utc::now();

    println!("🎯 Сценарий 1: Ежедневная нумерация");
    println!("   Каждый день начинается с номера 01:");
    
    // Симуляция разных дней
    let dates = vec![
        (26, "Сегодня"),
        (27, "Завтра"),
        (28, "Послезавтра"),
    ];

    for (day, description) in dates {
        let mut date = now;
        date = date.with_day(day).unwrap_or(now);
        
        for seq in 1..=3 {
            let invoice_number = InvoiceNumber::new(&config, seq, date)?;
            println!("     {} #{}: {} → {}", 
                     description, 
                     seq, 
                     invoice_number.for_documents(), 
                     invoice_number.for_tbank());
        }
    }

    println!("\n📈 Сценарий 2: Разные типы счетов");
    let configs = vec![
        (NumberingConfig::b2b_invoices(), "B2B"),
        (NumberingConfig::test_invoices(), "Тест"),
    ];

    for (cfg, type_name) in configs {
        let invoice_number = InvoiceNumber::new(&cfg, 1, now)?;
        println!("   {} счет: {} → {}", 
                 type_name, 
                 invoice_number.for_documents(), 
                 invoice_number.for_tbank());
    }

    println!("\n🔄 Сценарий 3: Интеграция с системами");
    let invoice_number = InvoiceNumber::new(&config, 15, now)?;
    
    println!("   📊 В CRM системе: {}", invoice_number.for_documents());
    println!("   📧 В email клиенту: {}", invoice_number.for_documents());
    println!("   🏦 В T-Bank API: {}", invoice_number.for_tbank());
    println!("   📄 В PDF документе: {}", invoice_number.for_documents());
    println!("   💾 В базе данных: оба формата сохраняются");

    println!("\n⚙️  Сценарий 4: Настройка под компанию");
    let custom_config = NumberingConfig {
        company_prefix: "МОЯКОМПАНИЯ".to_string(),
        invoice_type_prefix: 2,
        include_year: true,
        include_month: true,
        include_day: true,
        sequence_length: 3,
        max_total_length: 15,
        use_readable_format: true,
    };

    let custom_invoice = InvoiceNumber::new(&custom_config, 123, now)?;
    println!("   Кастомный формат: {} → {}", 
             custom_invoice.for_documents(), 
             custom_invoice.for_tbank());

    Ok(())
}