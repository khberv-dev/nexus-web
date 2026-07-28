# T-Bank Integration - Database Operations Quick Reference

## Основные операции с БД

### Создание счета (B2B Invoice)

**Что читает:**
- `counterparties` - проверка существования контрагента по ИНН
- `number_sequences` - получение следующего номера счета
- `b2b_invoices` - проверка уникальности номера

**Что записывает:**
- `counterparties` - создание/обновление контрагента (если нужно)
- `b2b_invoices` - основная запись счета
- `b2b_invoice_items` - позиции счета (товары/услуги)
- `b2b_invoice_contacts` - контакты для отправки
- `number_sequences` - инкремент счетчика
- `invoice_number_history` - история генерации номера
- `financial_audit` - запись аудита операции
- `audit_logs` - детальный лог операции

**Код:**
```rust
// src/database/b2b_queries.rs
pub async fn insert_invoice_with_items_and_contacts(
    pool: &PgPool,
    invoice: &B2BInvoice,
    items: &[CreateInvoiceItemRequest],
    contacts: &[CreateInvoiceContactRequest],
) -> TBankResult<()>
```

---

### Обновление статуса счета

**Что читает:**
- `b2b_invoices` - текущий статус для валидации перехода

**Что записывает:**
- `b2b_invoices` - новый статус и updated_at
- `financial_audit` - запись об изменении
- `audit_logs` - лог изменения статуса

**Код:**
```rust
// src/database/b2b_queries.rs
pub async fn update_invoice_status(
    pool: &PgPool,
    invoice_id: Uuid,
    new_status: B2BInvoiceStatus,
) -> TBankResult<()>
```

---

### Получение счета

**Что читает:**
- `b2b_invoices` - основные данные счета
- `b2b_invoice_items` - позиции счета (опционально)
- `b2b_invoice_contacts` - контакты (опционально)

**Код:**
```rust
// src/database/b2b_queries.rs
pub async fn get_invoice_by_id(
    pool: &PgPool,
    invoice_id: Uuid,
) -> TBankResult<Option<B2BInvoice>>

pub async fn get_invoice_by_number(
    pool: &PgPool,
    invoice_number: &str,
) -> TBankResult<Option<B2BInvoice>>
```

---

### Список счетов с фильтрами

**Что читает:**
- `b2b_invoices` - с фильтрацией по статусу, контрагенту, датам

**Код:**
```rust
// src/database/b2b_queries.rs
pub async fn list_invoices(
    pool: &PgPool,
    counterparty_inn: Option<&str>,
    status: Option<B2BInvoiceStatus>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> TBankResult<Vec<B2BInvoice>>
```

---

### Инициализация эквайрингового платежа

**Что читает:**
- `acquiring_payments` - проверка уникальности order_id

**Что записывает:**
- `acquiring_payments` - новый платеж
- `financial_audit` - запись аудита
- `audit_logs` - лог создания

**Код:**
```rust
// src/database/acquiring_queries.rs
pub async fn create_payment(
    pool: &PgPool,
    payment: &AcquiringPayment,
) -> TBankResult<()>
```

---

### Обновление статуса платежа

**Что читает:**
- `acquiring_payments` - текущий статус

**Что записывает:**
- `acquiring_payments` - новый статус, completed_at
- `financial_audit` - запись об изменении
- `audit_logs` - лог изменения

**Код:**
```rust
// src/database/acquiring_queries.rs
pub async fn update_payment_status(
    pool: &PgPool,
    payment_id: Uuid,
    status: AcquiringPaymentStatus,
) -> TBankResult<()>
```

---

### Обработка webhook

**Что читает:**
- `webhook_events` - проверка дубликатов по event_id
- `b2b_invoices` или `acquiring_payments` - поиск сущности

**Что записывает:**
- `webhook_events` - запись события
- `b2b_invoices` или `acquiring_payments` - обновление статуса
- `financial_audit` - запись аудита
- `audit_logs` - лог обработки

**Код:**
```rust
// src/database/common_queries.rs
pub async fn create_webhook_event(
    pool: &PgPool,
    event: &WebhookEvent,
) -> TBankResult<()>

pub async fn webhook_event_exists(
    pool: &PgPool,
    event_id: &str,
) -> TBankResult<bool>
```

---

### Проверка/создание контрагента

**Что читает:**
- `counterparties` - поиск по ИНН

**Что записывает:**
- `counterparties` - INSERT ON CONFLICT UPDATE
- `audit_logs` - лог операции

**Код:**
```rust
// src/database/common_queries.rs
pub async fn upsert_counterparty(
    pool: &PgPool,
    counterparty: &Counterparty,
) -> TBankResult<()>

pub async fn counterparty_exists(
    pool: &PgPool,
    inn: &str,
) -> TBankResult<bool>
```

---

### Генерация номера счета

**Что читает:**
- `number_sequences` - текущее значение для типа/года/месяца

**Что записывает:**
- `number_sequences` - инкремент current_value
- `invoice_number_history` - запись о генерации

**Код:**
```rust
// src/numbering/sequence.rs
pub async fn get_next_number(
    &mut self,
    pool: &PgPool,
) -> TBankResult<u32>

// src/database/common_queries.rs
pub async fn record_invoice_number_generation(
    pool: &PgPool,
    invoice_id: Option<Uuid>,
    invoice_number: &str,
    sequence_type: &str,
) -> TBankResult<()>
```

---

### Финансовый аудит

**Что записывает:**
- `financial_audit` - запись о каждой финансовой операции

**Код:**
```rust
// src/database/common_queries.rs
pub async fn create_financial_audit(
    pool: &PgPool,
    audit: &FinancialAudit,
) -> TBankResult<()>
```

**Поля:**
- `transaction_id` - ID счета или платежа
- `transaction_type` - B2B_INVOICE или ACQUIRING_PAYMENT
- `amount` - сумма операции
- `currency` - валюта
- `counterparty_inn` - ИНН (для B2B)
- `operation_date` - дата операции
- `status` - статус операции

---

### Логирование операций

**Что записывает:**
- `audit_logs` - детальный лог каждой операции

**Код:**
```rust
// src/database/common_queries.rs
pub async fn create_audit_log(
    pool: &PgPool,
    log: &AuditLog,
) -> TBankResult<()>
```

**Поля:**
- `operation_type` - CREATE, UPDATE, DELETE, WEBHOOK
- `entity_type` - B2B_INVOICE, ACQUIRING_PAYMENT, COUNTERPARTY
- `entity_id` - ID сущности
- `old_values` - старые значения (JSONB)
- `new_values` - новые значения (JSONB)
- `changed_fields` - список измененных полей

---

## Транзакции

### Создание счета (атомарная операция)

```rust
let mut tx = pool.begin().await?;

// 1. Проверка/создание контрагента
upsert_counterparty(&mut tx, counterparty).await?;

// 2. Генерация номера
let invoice_number = generate_invoice_number(&mut tx).await?;

// 3. Создание счета
insert_invoice(&mut tx, invoice).await?;

// 4. Добавление позиций
for item in items {
    insert_invoice_item(&mut tx, item).await?;
}

// 5. Добавление контактов
for contact in contacts {
    insert_invoice_contact(&mut tx, contact).await?;
}

// 6. Аудит
create_financial_audit(&mut tx, audit).await?;
create_audit_log(&mut tx, log).await?;

tx.commit().await?;
```

---

## Частые запросы

### Поиск счета по разным критериям

```rust
// По ID
let invoice = get_invoice_by_id(pool, invoice_id).await?;

// По номеру
let invoice = get_invoice_by_number(pool, "202401001").await?;

// По T-Bank ID
let invoice = find_invoice_by_tbank_id(pool, "TBANK_INV_123").await?;

// Список с фильтрами
let invoices = list_invoices(
    pool,
    Some("7707083893"), // ИНН
    Some(B2BInvoiceStatus::Sent), // статус
    Some(50), // limit
    Some(0),  // offset
).await?;
```

### Проверка существования

```rust
// Контрагент
let exists = counterparty_exists(pool, "7707083893").await?;

// Номер счета
let exists = invoice_number_exists(pool, "202401001").await?;

// Webhook событие
let exists = webhook_event_exists(pool, "evt_123").await?;

// Order ID платежа
let exists = order_id_exists(pool, "order_123").await?;
```

---

## Миграции

### Применение миграций

```bash
# Автоматически при старте сервиса
docker compose up tbank-integration

# Или вручную через sqlx
sqlx migrate run --database-url $DATABASE_URL
```

### Создание новой миграции

```bash
sqlx migrate add <migration_name>
```

---

## Мониторинг БД

### Проверка размера таблиц

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename LIKE '%b2b%' OR tablename LIKE '%acquiring%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Активные запросы

```sql
SELECT 
    pid,
    now() - query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE datname = 'adquest_db'
    AND state != 'idle'
ORDER BY duration DESC;
```

### Статистика по таблицам

```sql
SELECT 
    schemaname,
    tablename,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_tup_ins DESC;
```

---

## Troubleshooting

### Deadlock при создании счета

**Причина**: Конкурентный доступ к `number_sequences`

**Решение**: Используется `SELECT FOR UPDATE` для блокировки строки

```rust
let row = sqlx::query(
    "SELECT current_value FROM number_sequences 
     WHERE sequence_type = $1 AND year = $2 AND month = $3
     FOR UPDATE"
)
```

### Дубликаты webhook событий

**Причина**: Повторная отправка от Т-Банка

**Решение**: Проверка `event_id` перед обработкой

```rust
if webhook_event_exists(pool, &event_id).await? {
    return Ok(()); // Уже обработано
}
```

### Медленные запросы списка счетов

**Причина**: Отсутствие индексов

**Решение**: Проверить наличие индексов

```sql
-- Должны быть созданы
CREATE INDEX idx_b2b_invoices_status ON b2b_invoices(status);
CREATE INDEX idx_b2b_invoices_created_at ON b2b_invoices(created_at);
CREATE INDEX idx_b2b_invoices_counterparty_inn ON b2b_invoices(counterparty_inn);
```
