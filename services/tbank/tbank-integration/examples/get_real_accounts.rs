use tbank_integration::{TBankConfig};
use tbank_integration::client::api_methods::BankingApiMethods;
use tracing_subscriber::fmt;

/// Получение реальных номеров банковских счетов организации
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

    println!("🏦 Получение реальных номеров банковских счетов");
    println!("===============================================");

    // Принудительно устанавливаем production окружение
    std::env::set_var("TBANK_ENVIRONMENT", "production");

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
            println!("✅ T-Bank клиент создан для production");
            client
        }
        Err(e) => {
            println!("❌ Ошибка создания клиента: {}", e);
            return Err(e.into());
        }
    };

    println!("\n📋 Получение списка банковских счетов");
    println!("====================================");

    // Пробуем разные версии API для получения счетов
    let versions = vec![None, Some("v2"), Some("v3"), Some("v4")];
    
    for version in versions {
        let version_str = version.unwrap_or("v1");
        println!("\n🔍 Тестируем API версии: {}", version_str);
        
        match tbank_client.get_bank_accounts(version).await {
            Ok(accounts) => {
                println!("✅ Счета получены успешно (версия {}):", version_str);
                println!("{}", serde_json::to_string_pretty(&accounts)?);
                
                // Анализируем структуру ответа
                if let Some(accounts_array) = accounts.as_array() {
                    println!("\n📊 Найдено счетов: {}", accounts_array.len());
                    
                    for (i, account) in accounts_array.iter().enumerate() {
                        println!("\n📋 Счет #{}", i + 1);
                        
                        if let Some(account_number) = account.get("accountNumber") {
                            println!("   💳 Номер счета: {}", account_number);
                            println!("   📝 Для создания счетов используйте: \"accountNumber\": \"{}\"", account_number);
                        }
                        
                        if let Some(currency) = account.get("currency") {
                            println!("   💱 Валюта: {}", currency);
                        }
                        
                        if let Some(balance) = account.get("balance") {
                            println!("   💰 Баланс: {}", balance);
                        }
                        
                        if let Some(status) = account.get("status") {
                            println!("   📊 Статус: {}", status);
                        }
                        
                        if let Some(account_type) = account.get("accountType") {
                            println!("   🏷️  Тип: {}", account_type);
                        }
                        
                        if let Some(is_main) = account.get("isMain") {
                            if is_main.as_bool().unwrap_or(false) {
                                println!("   ⭐ ГЛАВНЫЙ СЧЕТ - используйте этот для создания счетов!");
                            }
                        }
                    }
                } else if let Some(account_number) = accounts.get("accountNumber") {
                    println!("\n📋 Единственный счет:");
                    println!("   💳 Номер счета: {}", account_number);
                    println!("   📝 Для создания счетов используйте: \"accountNumber\": \"{}\"", account_number);
                    
                    if let Some(currency) = accounts.get("currency") {
                        println!("   💱 Валюта: {}", currency);
                    }
                    
                    if let Some(balance) = accounts.get("balance") {
                        println!("   💰 Баланс: {}", balance);
                    }
                }
                
                // Если нашли счета, прерываем цикл
                break;
            }
            Err(e) => {
                println!("❌ Ошибка получения счетов (версия {}): {}", version_str, e);
                
                if e.to_string().contains("401") {
                    println!("   💡 Проблема с авторизацией - проверьте API токен");
                } else if e.to_string().contains("403") {
                    println!("   💡 Недостаточно прав - токен не имеет доступа к счетам");
                } else if e.to_string().contains("404") {
                    println!("   💡 Endpoint не найден - попробуем другую версию");
                }
            }
        }
    }

    println!("\n💡 Инструкции:");
    println!("==============");
    println!("1. Скопируйте номер счета из вывода выше");
    println!("2. Замените '40802123456789012345' в файле real_production_invoice.rs");
    println!("3. Запустите: cargo run --example real_production_invoice");
    println!("4. Это создаст РЕАЛЬНЫЙ исходящий счет!");

    println!("\n⚠️  ВАЖНО:");
    println!("=========");
    println!("- Используйте только АКТИВНЫЕ счета (status: ACTIVE)");
    println!("- Предпочтительно использовать главный счет (isMain: true)");
    println!("- Для рублевых операций используйте рублевые счета (currency: RUB)");

    Ok(())
}