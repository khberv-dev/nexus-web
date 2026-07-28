use tbank_integration::numbering::{
    NumberingConfig, InvoiceNumberValidator, SequenceType, GeneratorPresets
};

/// Простая демонстрация системы нумерации (без БД)
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔢 ПРОСТАЯ ДЕМОНСТРАЦИЯ СИСТЕМЫ НУМЕРАЦИИ");
    println!("=========================================");
    
    demo_configurations()?;
    demo_validation()?;
    demo_formats()?;
    
    Ok(())
}

/// Демонстрация конфигураций
fn demo_configurations() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n📊 1. КОНФИГУРАЦИИ НУМЕРАЦИИ");
    println!("============================");

    // B2B конфигурация
    let b2b_config = NumberingConfig::b2b_invoices();
    println!("🏢 B2B счета:");
    println!("   Тип префикс: {}", b2b_config.invoice_type_prefix);
    println!("   Включить год: {}", b2b_config.include_year);
    println!("   Включить месяц: {}", b2b_config.include_month);
    println!("   Длина последовательности: {}", b2b_config.sequence_length);
    println!("   Ожидаемая длина: {} цифр", b2b_config.expected_length());
    println!("   Пример: 12601000000001 (тип=1, 2026 год, январь, счет №1)");

    // Тестовая конфигурация
    let test_config = NumberingConfig::test_invoices();
    println!("\n🧪 Тестовые счета:");
    println!("   Тип префикс: {}", test_config.invoice_type_prefix);
    println!("   Ожидаемая длина: {} цифр", test_config.expected_length());
    println!("   Пример: 92601000000001 (тип=9, 2026 год, январь, счет №1)");

    // Простая конфигурация
    let simple_config = NumberingConfig::simple_sequential();
    println!("\n🔢 Простая нумерация:");
    println!("   Тип префикс: {}", simple_config.invoice_type_prefix);
    println!("   Включить год: {}", simple_config.include_year);
    println!("   Включить месяц: {}", simple_config.include_month);
    println!("   Ожидаемая длина: {} цифр", simple_config.expected_length());
    println!("   Пример: 000000000001 (только последовательность)");

    Ok(())
}

/// Демонстрация валидации
fn demo_validation() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n✅ 2. СИСТЕМА ВАЛИДАЦИИ");
    println!("=======================");

    let validator = InvoiceNumberValidator::new();

    // Тестируем валидные номера
    let valid_numbers = vec![
        "1",
        "123456789",
        "12601000000001",
        "000000000001",
        "123456789012345", // максимум 15 цифр
    ];

    println!("✅ Валидные номера:");
    for number in &valid_numbers {
        match validator.validate(number) {
            Ok(()) => println!("   ✓ {} (длина: {})", number, number.len()),
            Err(e) => println!("   ✗ {} - ошибка: {}", number, e),
        }
    }

    // Тестируем невалидные номера
    let invalid_numbers = vec![
        "",                    // пустой
        "1234567890123456",    // слишком длинный
        "INV-2024-001",        // содержит буквы
        "12345abc",            // содержит буквы
    ];

    println!("\n❌ Невалидные номера:");
    for number in &invalid_numbers {
        match validator.validate(number) {
            Ok(()) => println!("   ✓ {} (неожиданно валидный!)", number),
            Err(e) => println!("   ✗ {} - {}", number, e),
        }
    }

    Ok(())
}

/// Демонстрация форматов
fn demo_formats() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🎨 3. ФОРМАТЫ НОМЕРОВ");
    println!("====================");

    // Симуляция различных форматов
    println!("📋 Примеры форматов номеров:");

    println!("\n🏢 B2B счета (тип 1):");
    for i in 1..=5 {
        let number = format!("12601{:08}", i);
        println!("   {} - B2B счет #{} за январь 2026", number, i);
    }

    println!("\n🧪 Тестовые счета (тип 9):");
    for i in 1..=3 {
        let number = format!("92601{:08}", i);
        println!("   {} - Тестовый счет #{} за январь 2026", number, i);
    }

    println!("\n🔢 Простая нумерация:");
    for i in 1..=3 {
        let number = format!("{:012}", i);
        println!("   {} - Простой счет #{}", number, i);
    }

    println!("\n⚙️  Кастомные форматы:");
    let custom_examples = vec![
        ("Acquiring заказы", "22601", "тип=2, 2026 год, январь"),
        ("Аудит записи", "826", "тип=8, 2026 год"),
        ("Разработка", "726", "тип=7, 2026 год"),
    ];

    for (name, prefix, description) in custom_examples {
        println!("   {} ({}): {}XXXXXXXX", name, description, prefix);
    }

    Ok(())
}

/// Демонстрация типов последовательностей
fn demo_sequence_types() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🔄 4. ТИПЫ ПОСЛЕДОВАТЕЛЬНОСТЕЙ");
    println!("==============================");

    let sequence_types = vec![
        (SequenceType::B2BInvoice, "B2B счета для юридических лиц"),
        (SequenceType::TestInvoice, "Тестовые счета для разработки"),
        (SequenceType::AcquiringOrder, "Заказы через эквайринг"),
        (SequenceType::AuditEntry, "Записи аудита"),
    ];

    for (seq_type, description) in sequence_types {
        println!("📋 {}:", seq_type.as_str());
        println!("   Описание: {}", description);
        println!("   Числовой префикс: {}", seq_type.numeric_prefix());
        println!("   Пример номера: {}YYMM00000001", seq_type.numeric_prefix());
        println!();
    }

    Ok(())
}

/// Демонстрация бизнес-сценариев
fn demo_business_scenarios() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n💼 5. БИЗНЕС-СЦЕНАРИИ");
    println!("====================");

    println!("🎯 Сценарий 1: Продакшен vs Тест");
    println!("   Продакшен B2B: 12601000000001");
    println!("   Тест B2B:      92601000000001");
    println!("   Различие: первая цифра (1 vs 9)");

    println!("\n📈 Сценарий 2: Масштабирование");
    println!("   Текущий лимит: 99,999,999 счетов в месяц");
    println!("   При превышении: увеличить длину или изменить формат");
    println!("   Решение: мониторинг использования последовательностей");

    println!("\n🔄 Сценарий 3: Смена периода");
    println!("   Январь 2026: 12601000000001");
    println!("   Февраль 2026: 12602000000001");
    println!("   Январь 2027: 12701000000001");
    println!("   Автоматическое создание новых последовательностей");

    println!("\n🔒 Сценарий 4: Уникальность");
    println!("   Проблема: коллизии при высокой нагрузке");
    println!("   Решение: атомарные операции в PostgreSQL");
    println!("   Механизм: UPDATE ... RETURNING с блокировками");

    Ok(())
}