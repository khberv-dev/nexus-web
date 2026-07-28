use std::sync::Arc;
use tbank_integration::{
    client::TBankClient,
    config::TBankConfig,
    database::DatabaseManager,
    numbering::{GeneratorPresets, SequenceType},
    types::TBankResult,
};

/// Улучшенное создание счетов с автоматической нумерацией
#[tokio::main]
async fn main() -> TBankResult<()> {
    println!("🧾 УЛУЧШЕННОЕ СОЗДАНИЕ СЧЕТОВ С АВТОНУМЕРАЦИЕЙ");
    println!("===============================================");

    // Инициализация
    let config = TBankConfig::from_env()?;
    let db_manager = DatabaseManager::new(&config.database_url).await?;
    let db_pool = Arc::new(db_manager.get_pool().clone());
    
    // Применение миграций
    println!("📦 Применение миграций...");
    db_manager.run_migrations().await?;

    // Создание T-Bank клиента
    let tbank_client = TBankClient::new(config.clone())?;

    // Получение реального номера счета
    println!("🏦 Получение номера банковского счета...");
    let accounts_response = tbank_client.get_bank_accounts(None).await?;
    let account_number = extract_account_number(&accounts_response)?;
    println!("   Номер счета: {}", account_number);

    // Демонстрация различных сценариев
    demo_production_invoice_creation(&tbank_client, db_pool.clone(), &account_number).await?;
    demo_test_invoice_creation(&tbank_client, db_pool.clone(), &account_number).await?;
    demo_batch_invoice_creation(&tbank_client, db_pool.clone(), &account_number).await?;

    println!("\n✅ Демонстрация завершена успешно!");
    Ok(())
}

/// Создание продакшен B2B счета
async fn demo_production_invoice_creation(
    client: &TBankClient,
    db_pool: Arc<sqlx::PgPool>,
    account_number: &str,
) -> TBankResult<()> {
    println!("\n🏢 1. СОЗДАНИЕ ПРОДАКШЕН B2B СЧЕТА");
    println!("==================================");

    // Создание генератора для B2B счетов
    let b2b_generator = GeneratorPresets::production_b2b(db_pool)?;
    
    // Генерация уникального номера счета
    let invoice_number = b2b_generator.generate_unique_number(SequenceType::B2BInvoice).await?;
    println!("📋 Сгенерированный номер счета: {}", invoice_number);

    // Создание запроса на счет
    let invoice_request = serde_json::json!({
        "invoiceNumber": invoice_number,
        "dueDate": "2026-02-20",
        "invoiceDate": "2026-01-21",
        "accountNumber": account_number,
        "payer": {
            "name": "ООО «Продакшен Клиент»",
            "inn": "730990470834",
            "kpp": "123456789"
        },
        "items": [{
            "name": "Консультационные услуги",
            "price": 50000,
            "unit": "услуга",
            "vat": "20",
            "amount": 1
        }],
        "contacts": [{"email": "client@production.com"}],
        "contactPhone": "+74996051110",
        "comment": "Продакшен B2B счет с автонумерацией",
        "customPaymentPurpose": "Оплата по договору №B2B-2026-001"
    });

    // Отправка счета
    println!("📤 Отправка B2B счета в T-Bank...");
    match client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(invoice_request).await {
        Ok(response) => {
            println!("✅ B2B счет успешно создан!");
            if let Some(invoice_id) = response.get("invoiceId") {
                println!("   ID счета: {}", invoice_id);
                
                // Получение информации о счете
                if let Ok(info) = client.get_invoice_info(invoice_id.as_str().unwrap()).await {
                    if let Some(status) = info.get("status") {
                        println!("   Статус: {}", status);
                    }
                }
            }
            
            if let Some(pdf_url) = response.get("pdfUrl") {
                println!("   PDF URL: {}", pdf_url);
            }
        }
        Err(e) => {
            println!("❌ Ошибка создания B2B счета: {}", e);
        }
    }

    Ok(())
}

/// Создание тестового счета
async fn demo_test_invoice_creation(
    client: &TBankClient,
    db_pool: Arc<sqlx::PgPool>,
    account_number: &str,
) -> TBankResult<()> {
    println!("\n🧪 2. СОЗДАНИЕ ТЕСТОВОГО СЧЕТА");
    println!("==============================");

    // Создание генератора для тестовых счетов
    let test_generator = GeneratorPresets::test_invoices(db_pool)?;
    
    // Генерация номера тестового счета
    let invoice_number = test_generator.generate_test_invoice_number().await?;
    println!("📋 Сгенерированный тестовый номер: {}", invoice_number);

    // Создание тестового запроса
    let invoice_request = serde_json::json!({
        "invoiceNumber": invoice_number,
        "dueDate": "2026-02-20",
        "invoiceDate": "2026-01-21",
        "accountNumber": account_number,
        "payer": {
            "name": "ИП Тестовый Предприниматель",
            "inn": "123456789012"
        },
        "items": [{
            "name": "Тестовая услуга",
            "price": 1000,
            "unit": "шт",
            "vat": "20",
            "amount": 1
        }],
        "contacts": [{"email": "test@example.com"}],
        "contactPhone": "+74996051110",
        "comment": "Тестовый счет с автонумерацией",
        "customPaymentPurpose": "Тестовый платеж"
    });

    // Отправка тестового счета
    println!("📤 Отправка тестового счета...");
    match client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(invoice_request).await {
        Ok(response) => {
            println!("✅ Тестовый счет успешно создан!");
            if let Some(invoice_id) = response.get("invoiceId") {
                println!("   ID счета: {}", invoice_id);
            }
        }
        Err(e) => {
            println!("❌ Ошибка создания тестового счета: {}", e);
        }
    }

    Ok(())
}

/// Пакетное создание счетов
async fn demo_batch_invoice_creation(
    client: &TBankClient,
    db_pool: Arc<sqlx::PgPool>,
    account_number: &str,
) -> TBankResult<()> {
    println!("\n� 3. ПАКЕТНОЕ СОЗДАНИЕ СЧЕТОВ");
    println!("==============================");

    let b2b_generator = GeneratorPresets::production_b2b(db_pool.clone())?;
    let acquiring_generator = GeneratorPresets::acquiring_orders(db_pool)?;

    // Создание нескольких счетов разных типов
    let invoice_configs = vec![
        ("B2B Клиент 1", "ООО «Первый Клиент»", "730990470834", 25000, &b2b_generator, SequenceType::B2BInvoice),
        ("B2B Клиент 2", "ООО «Второй Клиент»", "730990470835", 35000, &b2b_generator, SequenceType::B2BInvoice),
        ("Acquiring 1", "ООО «Эквайринг Клиент»", "730990470836", 15000, &acquiring_generator, SequenceType::AcquiringOrder),
    ];

    for (i, (name, company_name, inn, amount, generator, seq_type)) in invoice_configs.iter().enumerate() {
        println!("\n📋 Создание счета #{}: {}", i + 1, name);
        
        // Генерация номера
        let invoice_number = generator.generate_number(*seq_type).await?;
        println!("   Номер: {}", invoice_number);

        // Создание запроса
        let invoice_request = serde_json::json!({
            "invoiceNumber": invoice_number,
            "dueDate": "2026-02-20",
            "invoiceDate": "2026-01-21",
            "accountNumber": account_number,
            "payer": {
                "name": company_name,
                "inn": inn,
                "kpp": "123456789"
            },
            "items": [{
                "name": format!("Услуги для {}", name),
                "price": amount,
                "unit": "услуга",
                "vat": "20",
                "amount": 1
            }],
            "contacts": [{"email": format!("{}@example.com", name.to_lowercase().replace(" ", ""))}],
            "contactPhone": "+74996051110",
            "comment": format!("Пакетный счет для {}", name),
            "customPaymentPurpose": format!("Оплата услуг - {}", name)
        });

        // Отправка счета
        match client.send_b2b_invoice::<serde_json::Value, serde_json::Value>(invoice_request).await {
            Ok(response) => {
                println!("   ✅ Успешно создан");
                if let Some(invoice_id) = response.get("invoiceId") {
                    println!("   ID: {}", invoice_id);
                }
            }
            Err(e) => {
                println!("   ❌ Ошибка: {}", e);
            }
        }

        // Небольшая пауза между запросами
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // Показать статистику последовательностей
    println!("\n📊 Статистика использования номеров:");
    let b2b_stats = b2b_generator.get_sequence_stats(SequenceType::B2BInvoice).await?;
    for stat in b2b_stats {
        println!("   B2B ({}): {} номеров использовано", 
                 format!("{:?}-{:?}", stat.year, stat.month), stat.current_value);
    }

    let acq_stats = acquiring_generator.get_sequence_stats(SequenceType::AcquiringOrder).await?;
    for stat in acq_stats {
        println!("   Acquiring ({}): {} номеров использовано", 
                 format!("{:?}-{:?}", stat.year, stat.month), stat.current_value);
    }

    Ok(())
}

/// Извлечение номера счета из ответа API
fn extract_account_number(response: &serde_json::Value) -> TBankResult<String> {
    if let Some(accounts) = response.get("accounts").and_then(|a| a.as_array()) {
        if let Some(account) = accounts.first() {
            if let Some(account_number) = account.get("accountNumber").and_then(|n| n.as_str()) {
                return Ok(account_number.to_string());
            }
        }
    }
    
    Err(crate::types::TBankError::ConfigurationError(
        "Не удалось извлечь номер банковского счета из ответа API".to_string()
    ))
}