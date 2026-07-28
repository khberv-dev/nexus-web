use std::sync::Arc;
use tbank_integration::{
    config::TBankConfig,
    database::DatabaseManager,
    numbering::{
        InvoiceNumberGenerator, GeneratorPresets, SequenceType, 
        NumberingConfig, InvoiceNumberValidator
    },
};

/// Полная демонстрация системы нумерации с базой данных
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔢 ПОЛНАЯ ДЕМОНСТРАЦИЯ СИСТЕМЫ НУМЕРАЦИИ");
    println!("========================================");
    
    // Инициализация базы данных
    let config = TBankConfig::from_env()?;
    let db_manager = DatabaseManager::new(&config.database_url).await?;
    let db_pool = Arc::new(db_manager.get_pool().clone());
    
    // Запуск миграций для системы нумерации
    println!("📦 Применение миграций базы данных...");
    db_manager.run_migrations().await?;
    
    demo_preset_generators(db_pool.clone()).await?;
    demo_custom_configurations(db_pool.clone()).await?;
    demo_sequence_statistics(db_pool.clone()).await?;
    demo_validation_system().await?;
    demo_business_scenarios(db_pool.clone()).await?;
    
    println!("\n✅ Демонстрация завершена успешно!");
    Ok(())
}

/// Демонстрация предустановленных генераторов
async fn demo_preset_generators(db_pool: Arc<sqlx::PgPool>) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🏭 1. ПРЕДУСТАНОВЛЕННЫЕ ГЕНЕРАТОРЫ");
    println!("==================================");

    // B2B продакшен генератор
    println!("🏢 B2B продакшен счета:");
    let b2b_generator = GeneratorPresets::production_b2b(db_pool.clone())?;
    for i in 1..=3 {
        let invoice_number = b2b_generator.generate_b2b_invoice_number().await?;
        println!("   #{}: {} (B2B счет)", i, invoice_number);
    }

    // Тестовый генератор
    println!("\n🧪 Тестовые счета:");
    let test_generator = GeneratorPresets::test_invoices(db_pool.clone())?;
    for i in 1..=3 {
        let invoice_number = test_generator.generate_test_invoice_number().await?;
        println!("   #{}: {} (Тестовый счет)", i, invoice_number);
    }

    // Простая последовательность
    println!("\n🔢 Простая последовательность:");
    let simple_generator = GeneratorPresets::simple_sequential(db_pool.clone())?;
    for i in 1..=3 {
        let invoice_number = simple_generator.generate_simple_sequential(SequenceType::B2BInvoice).await?;
        println!("   #{}: {} (Простой номер)", i, invoice_number);
    }

    // Acquiring заказы
    println!("\n💳 Acquiring заказы:");
    let acquiring_generator = GeneratorPresets::acquiring_orders(db_pool.clone())?;
    for i in 1..=2 {
        let invoice_number = acquiring_generator.generate_acquiring_order_number().await?;
        println!("   #{}: {} (Acquiring заказ)", i, invoice_number);
    }

    Ok(())
}

/// Демонстрация кастомных конфигураций
async fn demo_custom_configurations(db_pool: Arc<sqlx::PgPool>) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n⚙️  2. КАСТОМНЫЕ КОНФИГУРАЦИИ");
    println!("=============================");

    // Конфигурация для высокой нагрузки (без месяца)
    println!("🚀 Высокая нагрузка (без месяца):");
    let high_volume_config = NumberingConfig {
        invoice_type_prefix: 3,
        include_year: true,
        include_month: false,
        sequence_length: 10,
        max_total_length: 15,
    };
    let high_volume_generator = InvoiceNumberGenerator::new(db_pool.clone(), high_volume_config)?;
    for i in 1..=2 {
        let invoice_number = high_volume_generator.generate_number(SequenceType::B2BInvoice).await?;
        println!("   #{}: {} (Высокая нагрузка)", i, invoice_number);
    }

    // Конфигурация для аудита (только год)
    println!("\n📋 Аудит записи (только год):");
    let audit_config = NumberingConfig {
        invoice_type_prefix: 8,
        include_year: true,
        include_month: false,
        sequence_length: 9,
        max_total_length: 15,
    };
    let audit_generator = InvoiceNumberGenerator::new(db_pool.clone(), audit_config)?;
    for i in 1..=2 {
        let invoice_number = audit_generator.generate_number(SequenceType::AuditEntry).await?;
        println!("   #{}: {} (Аудит запись)", i, invoice_number);
    }

    // Кастомный формат с шаблоном
    println!("\n🎨 Кастомный формат:");
    let custom_generator = GeneratorPresets::development(db_pool.clone())?;
    let custom_number = custom_generator.generate_custom_format(
        SequenceType::B2BInvoice,
        "{type}{year}{month}{seq8}"
    ).await?;
    println!("   Кастомный: {} (Шаблон: type+year+month+seq8)", custom_number);

    Ok(())
}

/// Демонстрация статистики последовательностей
async fn demo_sequence_statistics(db_pool: Arc<sqlx::PgPool>) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n📊 3. СТАТИСТИКА ПОСЛЕДОВАТЕЛЬНОСТЕЙ");
    println!("====================================");

    let generator = GeneratorPresets::production_b2b(db_pool.clone())?;

    // Получение статистики для B2B счетов
    let stats = generator.get_sequence_stats(SequenceType::B2BInvoice).await?;
    println!("📈 B2B счета:");
    for stat in stats {
        println!("   Год: {:?}, Месяц: {:?}, Текущее значение: {}", 
                 stat.year, stat.month, stat.current_value);
        println!("   Создано: {}, Обновлено: {}", 
                 stat.created_at.format("%Y-%m-%d %H:%M:%S"), 
                 stat.updated_at.format("%Y-%m-%d %H:%M:%S"));
    }

    // Статистика для тестовых счетов
    let test_stats = generator.get_sequence_stats(SequenceType::TestInvoice).await?;
    println!("\n🧪 Тестовые счета:");
    for stat in test_stats {
        println!("   Год: {:?}, Месяц: {:?}, Текущее значение: {}", 
                 stat.year, stat.month, stat.current_value);
    }

    Ok(())
}

/// Демонстрация системы валидации
async fn demo_validation_system() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n✅ 4. СИСТЕМА ВАЛИДАЦИИ");
    println!("=======================");

    let validator = InvoiceNumberValidator::new();

    // Тестирование валидных номеров
    let valid_numbers = vec![
        "1260100000001",  // B2B формат
        "9260100000001",  // Тестовый формат
        "000000000001",   // Простой формат
        "3260000000001",  // Высокая нагрузка
        "8260000000001",  // Аудит
    ];

    println!("✅ Валидные номера:");
    for number in &valid_numbers {
        match validator.validate(number) {
            Ok(()) => println!("   ✓ {} - OK", number),
            Err(e) => println!("   ✗ {} - Ошибка: {}", number, e),
        }
    }

    // Тестирование с предложениями
    let problematic_numbers = vec![
        "INV-2024-001",      // Содержит буквы
        "1234567890123456",  // Слишком длинный
        "",                  // Пустой
    ];

    println!("\n❌ Проблемные номера с предложениями:");
    for number in &problematic_numbers {
        match validator.validate_with_suggestions(number) {
            Ok(()) => println!("   ✓ {} - OK", number),
            Err((error, suggestions)) => {
                println!("   ✗ {} - {}", number, error);
                for suggestion in suggestions {
                    println!("     💡 Предложение: {}", suggestion);
                }
            }
        }
    }

    Ok(())
}

/// Демонстрация бизнес-сценариев
async fn demo_business_scenarios(db_pool: Arc<sqlx::PgPool>) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n💼 5. БИЗНЕС-СЦЕНАРИИ");
    println!("====================");

    // Сценарий 1: Гарантированная уникальность
    println!("🔒 Сценарий 1: Гарантированная уникальность");
    let generator = GeneratorPresets::production_b2b(db_pool.clone())?;
    
    let unique_number = generator.generate_unique_number(SequenceType::B2BInvoice).await?;
    println!("   Уникальный номер: {}", unique_number);
    
    // Проверка существования
    let exists = generator.number_exists(&unique_number).await?;
    println!("   Номер существует в БД: {}", exists);

    // Сценарий 2: Параллельная генерация
    println!("\n⚡ Сценарий 2: Параллельная генерация");
    let mut handles = vec![];
    
    for i in 1..=3 {
        let gen = GeneratorPresets::production_b2b(db_pool.clone())?;
        let handle = tokio::spawn(async move {
            let number = gen.generate_b2b_invoice_number().await?;
            Ok::<String, Box<dyn std::error::Error + Send + Sync>>(format!("Поток {}: {}", i, number))
        });
        handles.push(handle);
    }
    
    for handle in handles {
        match handle.await? {
            Ok(result) => println!("   ✓ {}", result),
            Err(e) => println!("   ✗ Ошибка: {}", e),
        }
    }

    // Сценарий 3: Разные типы в одном месяце
    println!("\n🎯 Сценарий 3: Разные типы последовательностей");
    let b2b_gen = GeneratorPresets::production_b2b(db_pool.clone())?;
    let test_gen = GeneratorPresets::test_invoices(db_pool.clone())?;
    let acquiring_gen = GeneratorPresets::acquiring_orders(db_pool.clone())?;
    
    let b2b_num = b2b_gen.generate_b2b_invoice_number().await?;
    let test_num = test_gen.generate_test_invoice_number().await?;
    let acq_num = acquiring_gen.generate_acquiring_order_number().await?;
    
    println!("   B2B счет: {} (тип 1)", b2b_num);
    println!("   Тестовый: {} (тип 9)", test_num);
    println!("   Acquiring: {} (тип 2)", acq_num);

    Ok(())
}