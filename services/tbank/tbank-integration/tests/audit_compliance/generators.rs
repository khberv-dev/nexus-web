use proptest::prelude::*;
use chrono::{DateTime, Utc, Duration};
use rust_decimal::Decimal;
use serde_json::{json, Value};
use uuid::Uuid;

use super::types::*;

// Property test generators
pub fn arb_operation_type() -> impl Strategy<Value = OperationType> {
    prop_oneof![
        Just(OperationType::CounterpartyVerification),
        Just(OperationType::InvoiceCreation),
        Just(OperationType::PaymentProcessing),
        Just(OperationType::WebhookProcessing),
        Just(OperationType::Reconciliation),
        Just(OperationType::ConfigurationChange),
    ]
}

pub fn arb_log_type() -> impl Strategy<Value = LogType> {
    prop_oneof![
        Just(LogType::Financial),
        Just(LogType::Security),
        Just(LogType::ApiRequest),
        Just(LogType::Webhook),
        Just(LogType::System),
    ]
}

pub fn arb_export_format() -> impl Strategy<Value = ExportFormat> {
    prop_oneof![
        Just(ExportFormat::Json),
        Just(ExportFormat::Csv),
    ]
}

pub fn arb_datetime() -> impl Strategy<Value = DateTime<Utc>> {
    (0i64..=365 * 24 * 60 * 60).prop_map(|seconds| {
        Utc::now() - Duration::seconds(seconds)
    })
}

pub fn arb_decimal() -> impl Strategy<Value = Decimal> {
    (0u64..=1_000_000_00).prop_map(|cents| {
        Decimal::new(cents as i64, 2)
    })
}

pub fn arb_uuid() -> impl Strategy<Value = Uuid> {
    any::<[u8; 16]>().prop_map(|bytes| Uuid::from_bytes(bytes))
}

pub fn arb_audit_record() -> impl Strategy<Value = AuditRecord> {
    (
        arb_uuid(),
        arb_datetime(),
        prop::option::of(arb_uuid()),
        arb_operation_type(),
        arb_uuid(),
        prop::option::of(any::<String>().prop_map(|s| json!(s))),
        prop::option::of(any::<String>().prop_map(|s| json!(s))),
        prop::collection::vec(any::<String>(), 0..5),
        prop::option::of(any::<String>()),
        prop::option::of(any::<String>()),
        any::<String>(),
    ).prop_map(|(id, timestamp, user_id, operation_type, entity_id, old_values, new_values, changed_fields, ip_address, user_agent, hash)| {
        AuditRecord {
            id,
            timestamp,
            user_id,
            operation_type,
            entity_id,
            old_values,
            new_values,
            changed_fields,
            ip_address,
            user_agent,
            hash,
        }
    })
}

pub fn arb_financial_audit_record() -> impl Strategy<Value = FinancialAuditRecord> {
    (
        arb_uuid(),
        arb_uuid(),
        arb_decimal(),
        prop_oneof!["RUB", "USD", "EUR"].prop_map(String::from),
        prop::option::of(arb_uuid()),
        any::<String>(),
        prop_oneof!["pending", "completed", "failed"].prop_map(String::from),
        arb_datetime(),
    ).prop_map(|(id, transaction_id, amount, currency, counterparty_id, operation_type, reconciliation_status, created_at)| {
        FinancialAuditRecord {
            id,
            transaction_id,
            amount,
            currency,
            counterparty_id,
            operation_type,
            reconciliation_status,
            created_at,
        }
    })
}

pub fn arb_retention_policy() -> impl Strategy<Value = RetentionPolicy> {
    (
        arb_log_type(),
        1i32..=3650,  // 1 day to 10 years
        1i32..=3650,
        1i32..=3650,
    ).prop_map(|(log_type, retention_period_days, archive_period_days, deletion_period_days)| {
        RetentionPolicy {
            log_type,
            retention_period_days,
            archive_period_days,
            deletion_period_days,
        }
    })
}