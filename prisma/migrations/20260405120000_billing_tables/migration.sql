-- Billing tables managed by billing-svc (T-Bank microservice)
-- These tables are written by the Rust service and read by Next.js via Prisma

-- Counterparties (B2B юрлица)
CREATE TABLE IF NOT EXISTS "counterparties" (
    "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "inn"              VARCHAR(12) NOT NULL UNIQUE,
    "kpp"              VARCHAR(9),
    "full_name"        TEXT NOT NULL,
    "short_name"       TEXT,
    "legal_address"    TEXT,
    "status"           VARCHAR(50) NOT NULL DEFAULT 'active',
    "okved_codes"      JSONB,
    "verified_at"      TIMESTAMPTZ,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B2B invoices (счета для юрлиц)
CREATE TABLE IF NOT EXISTS "b2b_invoices" (
    "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_number"          VARCHAR(100) NOT NULL UNIQUE,
    "tbank_invoice_id"        VARCHAR(255),
    "counterparty_inn"        VARCHAR(12) NOT NULL,
    "counterparty_kpp"        VARCHAR(9),
    "counterparty_name"       TEXT NOT NULL,
    "due_date"                DATE NOT NULL,
    "invoice_date"            DATE NOT NULL DEFAULT CURRENT_DATE,
    "account_number"          VARCHAR(20),
    "total_amount"            BIGINT NOT NULL CHECK ("total_amount" > 0),
    "status"                  VARCHAR(50) NOT NULL DEFAULT 'Sent',
    "pdf_url"                 TEXT,
    "incoming_invoice_url"    TEXT,
    "comment"                 TEXT,
    "custom_payment_purpose"  TEXT,
    "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "b2b_invoice_items" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_id"  UUID NOT NULL REFERENCES "b2b_invoices"("id") ON DELETE CASCADE,
    "name"        TEXT NOT NULL,
    "price"       BIGINT NOT NULL CHECK ("price" > 0),
    "unit"        VARCHAR(50) NOT NULL,
    "vat_rate"    VARCHAR(10) NOT NULL DEFAULT '20',
    "amount"      INTEGER NOT NULL CHECK ("amount" > 0),
    "total_price" BIGINT NOT NULL,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "b2b_invoice_contacts" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_id"  UUID NOT NULL REFERENCES "b2b_invoices"("id") ON DELETE CASCADE,
    "email"       VARCHAR(255) NOT NULL,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acquiring payments (эквайринг — физлица)
CREATE TABLE IF NOT EXISTS "acquiring_payments" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id"          VARCHAR(255) NOT NULL UNIQUE,
    "tbank_payment_id"  VARCHAR(255),
    "amount"            BIGINT NOT NULL CHECK ("amount" > 0),
    "currency"          VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "payment_method"    VARCHAR(50) NOT NULL DEFAULT 'card',
    "status"            VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "description"       TEXT,
    "customer_email"    VARCHAR(255),
    "customer_phone"    VARCHAR(20),
    "payment_url"       TEXT,
    "qr_code"           TEXT,
    "expires_at"        TIMESTAMPTZ,
    "commission_amount" BIGINT,
    "completed_at"      TIMESTAMPTZ,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial audit trail
CREATE TABLE IF NOT EXISTS "financial_audit" (
    "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "transaction_id"   UUID NOT NULL UNIQUE,
    "transaction_type" VARCHAR(50) NOT NULL,
    "amount"           BIGINT NOT NULL,
    "currency"         VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "counterparty_inn" VARCHAR(12),
    "operation_date"   DATE NOT NULL DEFAULT CURRENT_DATE,
    "status"           VARCHAR(50) NOT NULL,
    "reconciled_at"    TIMESTAMPTZ,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook events (idempotency + retry tracking)
CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "event_id"          VARCHAR(255) NOT NULL UNIQUE,
    "event_type"        VARCHAR(100) NOT NULL,
    "webhook_type"      VARCHAR(50) NOT NULL DEFAULT 'Acquiring',
    "entity_id"         VARCHAR(255),
    "status"            VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "payload"           JSONB NOT NULL,
    "processing_status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "retry_count"       INTEGER NOT NULL DEFAULT 0,
    "processed_at"      TIMESTAMPTZ,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_acquiring_payments_status"     ON "acquiring_payments"("status");
CREATE INDEX IF NOT EXISTS "idx_acquiring_payments_created_at" ON "acquiring_payments"("created_at");
CREATE INDEX IF NOT EXISTS "idx_b2b_invoices_counterparty_inn" ON "b2b_invoices"("counterparty_inn");
CREATE INDEX IF NOT EXISTS "idx_b2b_invoices_status"           ON "b2b_invoices"("status");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_processing"     ON "webhook_events"("processing_status", "retry_count");
CREATE INDEX IF NOT EXISTS "idx_financial_audit_transaction"   ON "financial_audit"("transaction_id");
