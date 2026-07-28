use sqlx::{migrate::MigrateDatabase, PgPool, Postgres};
use tracing::{error, info};

use crate::types::{TBankError, TBankResult};

/// Database migration management
pub struct MigrationManager {
    db_pool: PgPool,
}

impl MigrationManager {
    pub fn new(db_pool: PgPool) -> Self {
        Self { db_pool }
    }

    /// Run all pending migrations
    pub async fn run_migrations(&self) -> TBankResult<()> {
        info!("Running database migrations");

        // Migration to add webhook_type field to webhook_events table
        self.add_webhook_type_field().await?;

        info!("Database migrations completed successfully");
        Ok(())
    }

    /// Add webhook_type field to webhook_events table for B2B/Acquiring separation
    async fn add_webhook_type_field(&self) -> TBankResult<()> {
        info!("Adding webhook_type field to webhook_events table");

        let migration_sql = r#"
            -- Add webhook_type column if it doesn't exist
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'webhook_events' 
                    AND column_name = 'webhook_type'
                ) THEN
                    ALTER TABLE webhook_events 
                    ADD COLUMN webhook_type VARCHAR(20) NOT NULL DEFAULT 'B2B';
                    
                    -- Update existing records based on event_type
                    UPDATE webhook_events 
                    SET webhook_type = CASE 
                        WHEN event_type IN ('PaymentCompleted', 'PaymentFailed', 'PaymentCancelled') 
                        THEN 'Acquiring'
                        WHEN event_type IN ('InvoiceViewed', 'InvoicePaid') 
                        THEN 'B2B'
                        ELSE 'B2B'
                    END;
                    
                    -- Remove default after updating existing records
                    ALTER TABLE webhook_events 
                    ALTER COLUMN webhook_type DROP DEFAULT;
                    
                    -- Add index for better query performance
                    CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_type 
                    ON webhook_events(webhook_type);
                    
                    -- Add composite index for webhook_type and event_type
                    CREATE INDEX IF NOT EXISTS idx_webhook_events_type_event 
                    ON webhook_events(webhook_type, event_type);
                END IF;
            END $$;
        "#;

        sqlx::query(migration_sql)
            .execute(&self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    "Failed to add webhook_type field to webhook_events table"
                );
                TBankError::DatabaseError(e)
            })?;

        info!("Successfully added webhook_type field to webhook_events table");
        Ok(())
    }

    /// Create initial database schema if it doesn't exist
    pub async fn create_initial_schema(&self) -> TBankResult<()> {
        info!("Creating initial database schema");

        let schema_sql = r#"
            -- Create counterparties table (only for legal entities)
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
            );

            -- Create B2B invoices table (for legal entities)
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
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                FOREIGN KEY (counterparty_inn) REFERENCES counterparties(inn)
            );

            -- Create B2B invoice items table
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
            );

            -- Create B2B invoice contacts table
            CREATE TABLE IF NOT EXISTS b2b_invoice_contacts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID NOT NULL,
                email VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                FOREIGN KEY (invoice_id) REFERENCES b2b_invoices(id) ON DELETE CASCADE
            );

            -- Create acquiring payments table (for physical persons)
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
            );

            -- Create financial audit table (for all transaction types)
            CREATE TABLE IF NOT EXISTS financial_audit (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                transaction_id VARCHAR(100) NOT NULL,
                transaction_type VARCHAR(20) NOT NULL, -- 'B2B_INVOICE' | 'ACQUIRING_PAYMENT'
                amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) NOT NULL,
                counterparty_inn VARCHAR(12),
                operation_date TIMESTAMP WITH TIME ZONE NOT NULL,
                status VARCHAR(20) NOT NULL,
                reconciled_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );

            -- Create audit logs table
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                user_id VARCHAR(100),
                operation_type VARCHAR(50) NOT NULL,
                entity_type VARCHAR(20) NOT NULL, -- 'B2B_INVOICE' | 'ACQUIRING_PAYMENT' | 'COUNTERPARTY'
                entity_id VARCHAR(100) NOT NULL,
                old_values JSONB,
                new_values JSONB,
                changed_fields TEXT[],
                ip_address INET,
                user_agent TEXT,
                hash VARCHAR(64) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );

            -- Create webhook events table with webhook_type field
            CREATE TABLE IF NOT EXISTS webhook_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                event_id VARCHAR(100) NOT NULL UNIQUE,
                event_type VARCHAR(50) NOT NULL,
                webhook_type VARCHAR(20) NOT NULL, -- 'B2B' | 'Acquiring'
                entity_id VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL,
                payload JSONB NOT NULL,
                processing_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
                retry_count INTEGER NOT NULL DEFAULT 0,
                processed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );

            -- Create indexes for better performance
            CREATE INDEX IF NOT EXISTS idx_counterparties_inn ON counterparties(inn);
            CREATE INDEX IF NOT EXISTS idx_b2b_invoices_counterparty_inn ON b2b_invoices(counterparty_inn);
            CREATE INDEX IF NOT EXISTS idx_b2b_invoices_status ON b2b_invoices(status);
            CREATE INDEX IF NOT EXISTS idx_b2b_invoices_created_at ON b2b_invoices(created_at);
            CREATE INDEX IF NOT EXISTS idx_acquiring_payments_order_id ON acquiring_payments(order_id);
            CREATE INDEX IF NOT EXISTS idx_acquiring_payments_status ON acquiring_payments(status);
            CREATE INDEX IF NOT EXISTS idx_acquiring_payments_created_at ON acquiring_payments(created_at);
            CREATE INDEX IF NOT EXISTS idx_financial_audit_transaction_id ON financial_audit(transaction_id);
            CREATE INDEX IF NOT EXISTS idx_financial_audit_transaction_type ON financial_audit(transaction_type);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
            CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
            CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_type ON webhook_events(webhook_type);
            CREATE INDEX IF NOT EXISTS idx_webhook_events_type_event ON webhook_events(webhook_type, event_type);
            CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_status ON webhook_events(processing_status);
        "#;

        sqlx::query(schema_sql)
            .execute(&self.db_pool)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    "Failed to create initial database schema"
                );
                TBankError::DatabaseError(e)
            })?;

        info!("Successfully created initial database schema");
        Ok(())
    }
}
