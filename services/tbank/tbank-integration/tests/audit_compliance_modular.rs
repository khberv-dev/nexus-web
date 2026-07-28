mod audit_compliance;

use proptest::prelude::*;
use audit_compliance::*;

// Основные property-based тесты для аудита
proptest! {
    #[test]
    fn test_audit_record_creation(record in arb_audit_record()) {
        // Тест создания записи аудита
        prop_assert!(!record.id.to_string().is_empty());
        prop_assert!(record.timestamp <= chrono::Utc::now());
        prop_assert!(!record.hash.is_empty());
    }

    #[test]
    fn test_financial_audit_record_validation(record in arb_financial_audit_record()) {
        // Тест валидации финансовых записей
        prop_assert!(record.amount >= rust_decimal::Decimal::ZERO);
        prop_assert!(["RUB", "USD", "EUR"].contains(&record.currency.as_str()));
        prop_assert!(["pending", "completed", "failed"].contains(&record.reconciliation_status.as_str()));
    }

    #[test]
    fn test_retention_policy_consistency(policy in arb_retention_policy()) {
        // Тест согласованности политики хранения
        prop_assert!(policy.retention_period_days > 0);
        prop_assert!(policy.archive_period_days > 0);
        prop_assert!(policy.deletion_period_days > 0);
        
        // Логическая проверка: архивирование должно происходить после периода хранения
        prop_assert!(policy.archive_period_days >= policy.retention_period_days);
        prop_assert!(policy.deletion_period_days >= policy.archive_period_days);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_database_connection() {
        let pool = get_test_db_pool().await;
        // Простая проверка подключения к БД
        let result = sqlx::query("SELECT 1 as test")
            .fetch_one(&*pool)
            .await;
        
        assert!(result.is_ok());
    }
}