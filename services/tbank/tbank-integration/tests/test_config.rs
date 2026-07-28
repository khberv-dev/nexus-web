use std::sync::Once;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

static INIT: Once = Once::new();

/// Initialize test logging (call once per test suite)
pub fn init_test_logging() {
    INIT.call_once(|| {
        tracing_subscriber::registry()
            .with(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "tbank_integration=debug,sqlx=warn".into()),
            )
            .with(tracing_subscriber::fmt::layer().with_test_writer())
            .init();
    });
}

/// Test database setup helper
pub struct TestDatabase {
    pub url: String,
}

impl TestDatabase {
    pub fn new() -> Self {
        let database_url = std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/tbank_test".to_string());

        Self { url: database_url }
    }

    /// Run database migrations for tests
    pub async fn migrate(&self) -> Result<(), sqlx::Error> {
        let pool = sqlx::PgPool::connect(&self.url).await?;

        // Create test tables (simplified versions for testing)
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS counterparties (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                inn VARCHAR(12) NOT NULL UNIQUE,
                kpp VARCHAR(9),
                full_name TEXT NOT NULL,
                short_name TEXT,
                legal_address TEXT,
                status VARCHAR(20) NOT NULL,
                registration_date TIMESTAMP WITH TIME ZONE,
                okved_codes JSONB,
                verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS b2b_invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_number VARCHAR(15) NOT NULL UNIQUE,
                tbank_invoice_id VARCHAR(100),
                counterparty_inn VARCHAR(12) NOT NULL,
                counterparty_kpp VARCHAR(9),
                counterparty_name TEXT NOT NULL,
                due_date DATE NOT NULL,
                invoice_date DATE,
                account_number VARCHAR(22),
                total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount > 0),
                status VARCHAR(20) NOT NULL DEFAULT 'Draft',
                pdf_url TEXT,
                incoming_invoice_url TEXT,
                comment TEXT,
                custom_payment_purpose TEXT,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS b2b_invoice_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID NOT NULL,
                name TEXT NOT NULL,
                price DECIMAL(15,2) NOT NULL CHECK (price > 0),
                unit VARCHAR(50) NOT NULL,
                vat_rate VARCHAR(10) NOT NULL,
                amount INTEGER NOT NULL CHECK (amount > 0),
                total_price DECIMAL(15,2) NOT NULL CHECK (total_price > 0),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                FOREIGN KEY (invoice_id) REFERENCES b2b_invoices(id) ON DELETE CASCADE
            )
        "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS b2b_invoice_contacts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID NOT NULL,
                email VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                FOREIGN KEY (invoice_id) REFERENCES b2b_invoices(id) ON DELETE CASCADE
            )
        "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS acquiring_payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id VARCHAR(36) NOT NULL UNIQUE,
                tbank_payment_id VARCHAR(100),
                amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
                currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
                payment_method VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Initialized',
                description TEXT,
                customer_email VARCHAR(255),
                customer_phone VARCHAR(20),
                payment_url TEXT,
                qr_code TEXT,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                commission_amount DECIMAL(15,2),
                completed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS financial_audit (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                transaction_id VARCHAR(100) NOT NULL,
                transaction_type VARCHAR(20) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) NOT NULL,
                counterparty_inn VARCHAR(12),
                operation_date TIMESTAMP WITH TIME ZONE NOT NULL,
                status VARCHAR(20) NOT NULL,
                reconciled_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                user_id VARCHAR(100),
                operation_type VARCHAR(50) NOT NULL,
                entity_type VARCHAR(20) NOT NULL,
                entity_id VARCHAR(100) NOT NULL,
                old_values JSONB,
                new_values JSONB,
                changed_fields TEXT[],
                ip_address INET,
                user_agent TEXT,
                hash VARCHAR(64) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS webhook_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                event_id VARCHAR(100) NOT NULL UNIQUE,
                event_type VARCHAR(50) NOT NULL,
                webhook_type VARCHAR(20) NOT NULL,
                entity_id VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL,
                payload JSONB NOT NULL,
                processing_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
                retry_count INTEGER NOT NULL DEFAULT 0,
                processed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        "#,
        )
        .execute(&pool)
        .await?;

        pool.close().await;
        Ok(())
    }

    /// Clean up test database
    pub async fn cleanup(&self) -> Result<(), sqlx::Error> {
        let pool = sqlx::PgPool::connect(&self.url).await?;

        // Drop all test tables
        let tables = [
            "webhook_events",
            "audit_logs",
            "financial_audit",
            "b2b_invoice_contacts",
            "b2b_invoice_items",
            "b2b_invoices",
            "acquiring_payments",
            "counterparties",
        ];

        for table in tables.iter() {
            let _ = sqlx::query(&format!("DROP TABLE IF EXISTS {} CASCADE", table))
                .execute(&pool)
                .await;
        }

        pool.close().await;
        Ok(())
    }
}

/// Test Redis setup helper
pub struct TestRedis {
    pub url: String,
}

impl TestRedis {
    pub fn new() -> Self {
        let redis_url = std::env::var("TEST_REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379/1".to_string());

        Self { url: redis_url }
    }

    /// Flush test Redis database
    pub async fn flush(&self) -> Result<(), redis::RedisError> {
        let client = redis::Client::open(self.url.as_str())?;
        let mut conn = client.get_async_connection().await?;
        redis::cmd("FLUSHDB").query_async(&mut conn).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_creation() {
        let db = TestDatabase::new();
        assert!(!db.url.is_empty());

        let redis = TestRedis::new();
        assert!(!redis.url.is_empty());
    }

    #[tokio::test]
    async fn test_database_migration() {
        init_test_logging();

        let db = TestDatabase::new();

        // This test requires a running PostgreSQL instance
        // Skip if not available
        if let Err(e) = db.migrate().await {
            println!("Skipping database test (no PostgreSQL available): {}", e);
            return;
        }

        // Test successful migration
        let pool = sqlx::PgPool::connect(&db.url).await.unwrap();

        // Verify tables exist
        let table_count = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(
            table_count.unwrap_or(0) >= 8,
            "All test tables should be created"
        );

        pool.close().await;
        let _ = db.cleanup().await;
    }

    #[tokio::test]
    async fn test_redis_connection() {
        init_test_logging();

        let redis = TestRedis::new();

        // This test requires a running Redis instance
        // Skip if not available
        if let Err(e) = redis.flush().await {
            println!("Skipping Redis test (no Redis available): {}", e);
            return;
        }

        println!("Redis connection test passed");
    }
}
