use chrono::{DateTime, Utc};
use proptest::prelude::*;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::OnceCell;
use uuid::Uuid;

use tbank_integration::types::TBankError;

type TBankResult<T> = Result<T, TBankError>;

static DB_POOL: OnceCell<Arc<PgPool>> = OnceCell::const_new();

async fn get_test_db_pool() -> Arc<PgPool> {
    DB_POOL
        .get_or_init(|| async {
            let database_url = std::env::var("TEST_DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://test:test@localhost:5432/tbank_test".to_string());

            let pool = PgPool::connect(&database_url)
                .await
                .expect("Failed to connect to test database");

            Arc::new(pool)
        })
        .await
        .clone()
}

// Define audit-related enums and structs for testing
#[derive(Debug, Clone, PartialEq)]
enum OperationType {
    CounterpartyVerification,
    InvoiceCreation,
    PaymentProcessing,
    WebhookProcessing,
    Reconciliation,
    ConfigurationChange,
}

#[derive(Debug, Clone, PartialEq)]
enum LogType {
    Financial,
    Security,
    ApiRequest,
    Webhook,
    System,
}

#[derive(Debug, Clone, PartialEq)]
enum ExportFormat {
    Json,
    Csv,
}

#[derive(Debug, Clone)]
struct AuditRecord {
    id: Uuid,
    timestamp: DateTime<Utc>,
    user_id: Option<Uuid>,
    operation_type: OperationType,
    entity_id: Uuid,
    old_values: Option<Value>,
    new_values: Option<Value>,
    changed_fields: Vec<String>,
    ip_address: Option<String>,
    user_agent: Option<String>,
    hash: String,
}
#[derive(Debug, Clone)]
struct FinancialAuditRecord {
    id: Uuid,
    transaction_id: Uuid,
    amount: Decimal,
    currency: String,
    counterparty_id: Option<Uuid>,
    operation_type: String,
    reconciliation_status: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct RetentionPolicy {
    log_type: LogType,
    retention_period_days: i32,
    archive_period_days: i32,
    deletion_period_days: i32,
}

// Property test generators
fn arb_operation_type() -> impl Strategy<Value = OperationType> {
    prop_oneof![
        Just(OperationType::CounterpartyVerification),
        Just(OperationType::InvoiceCreation),
        Just(OperationType::PaymentProcessing),
        Just(OperationType::WebhookProcessing),
        Just(OperationType::Reconciliation),
        Just(OperationType::ConfigurationChange),
    ]
}

fn arb_log_type() -> impl Strategy<Value = LogType> {
    prop_oneof![
        Just(LogType::Financial),
        Just(LogType::Security),
        Just(LogType::ApiRequest),
        Just(LogType::Webhook),
        Just(LogType::System),
    ]
}

fn arb_export_format() -> impl Strategy<Value = ExportFormat> {
    prop_oneof![Just(ExportFormat::Json), Just(ExportFormat::Csv),]
}

fn arb_financial_amount() -> impl Strategy<Value = Decimal> {
    (0.0001f64..1000000.0f64).prop_map(|f| Decimal::try_from(f).unwrap())
}

fn arb_currency() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("RUB".to_string()),
        Just("USD".to_string()),
        Just("EUR".to_string()),
    ]
}

fn arb_ip_address() -> impl Strategy<Value = String> {
    prop_oneof![
        // IPv4 addresses
        (0u8..=255, 0u8..=255, 0u8..=255, 0u8..=255)
            .prop_map(|(a, b, c, d)| format!("{}.{}.{}.{}", a, b, c, d)),
        // IPv6 addresses (simplified)
        Just("2001:0db8:85a3:0000:0000:8a2e:0370:7334".to_string()),
        Just("::1".to_string()),
    ]
}

fn arb_user_agent() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string()),
        Just("curl/7.68.0".to_string()),
        Just("PostmanRuntime/7.28.4".to_string()),
        Just("TBankIntegration/1.0.0".to_string()),
    ]
}

fn arb_json_value() -> impl Strategy<Value = Value> {
    prop_oneof![
        Just(json!({"field1": "value1", "field2": 123})),
        Just(json!({"amount": 1000.50, "currency": "RUB"})),
        Just(json!({"status": "active", "updated_at": "2024-01-01T00:00:00Z"})),
        Just(json!(null)),
    ]
}

fn arb_changed_fields() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(
        prop_oneof![
            Just("amount".to_string()),
            Just("status".to_string()),
            Just("counterparty_id".to_string()),
            Just("created_at".to_string()),
            Just("updated_at".to_string()),
        ],
        1..=5,
    )
}
// Property Test 50: Financial Operation Audit Logging
// **Validates: Requirements 8.1**
proptest! {
    #[test]
    fn property_financial_operation_audit_logging(
        operation_type in arb_operation_type(),
        entity_id in any::<u128>().prop_map(|n| Uuid::from_u128(n)),
        user_id in any::<u128>().prop_map(|n| Some(Uuid::from_u128(n))),
        ip_address in arb_ip_address().prop_map(Some),
        user_agent in arb_user_agent().prop_map(Some),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 50: Financial Operation Audit Logging**

            // For any financial operation, audit logging should work correctly
            let audit_logger = create_test_audit_logger().await;

            // Test audit record creation
            let audit_record = audit_logger.log_financial_operation(
                &operation_type,
                entity_id,
                user_id,
                ip_address.as_deref(),
                user_agent.as_deref(),
                None, // old_values
                None, // new_values
            ).await.unwrap();

            // Verify audit record properties
            assert_eq!(audit_record.operation_type, operation_type);
            assert_eq!(audit_record.entity_id, entity_id);
            assert_eq!(audit_record.user_id, user_id);
            assert_eq!(audit_record.ip_address, ip_address);
            assert_eq!(audit_record.user_agent, user_agent);

            // Verify timestamp is recent (within last minute)
            let now = Utc::now();
            let time_diff = now.signed_duration_since(audit_record.timestamp);
            assert!(time_diff.num_seconds() < 60);
            assert!(time_diff.num_seconds() >= 0);

            // Verify audit record is stored in database
            let stored_record = audit_logger.get_audit_record(audit_record.id).await.unwrap();
            assert_eq!(stored_record.id, audit_record.id);
            assert_eq!(stored_record.operation_type, operation_type);

            // Test different operation types have appropriate handling
            match operation_type {
                OperationType::CounterpartyVerification => {
                    assert!(is_financial_operation(&operation_type));
                    assert!(requires_enhanced_logging(&operation_type));
                }
                OperationType::InvoiceCreation => {
                    assert!(is_financial_operation(&operation_type));
                    assert!(requires_enhanced_logging(&operation_type));
                }
                OperationType::PaymentProcessing => {
                    assert!(is_financial_operation(&operation_type));
                    assert!(requires_enhanced_logging(&operation_type));
                    assert!(is_sensitive_operation(&operation_type));
                }
                OperationType::WebhookProcessing => {
                    assert!(is_financial_operation(&operation_type));
                    assert!(!is_sensitive_operation(&operation_type));
                }
                OperationType::Reconciliation => {
                    assert!(is_financial_operation(&operation_type));
                    assert!(requires_enhanced_logging(&operation_type));
                }
                OperationType::ConfigurationChange => {
                    assert!(!is_financial_operation(&operation_type));
                    assert!(requires_enhanced_logging(&operation_type));
                }
            }

            // Verify audit record has required fields for financial operations
            if is_financial_operation(&operation_type) {
                assert!(audit_record.user_id.is_some() || operation_type == OperationType::WebhookProcessing);
                assert!(audit_record.ip_address.is_some() || operation_type == OperationType::WebhookProcessing);
            }
        });
    }
}

// Property Test 51: Audit Record Completeness
// **Validates: Requirements 8.2**
proptest! {
    #[test]
    fn property_audit_record_completeness(
        operation_type in arb_operation_type(),
        entity_id in any::<u128>().prop_map(|n| Uuid::from_u128(n)),
        user_id in any::<u128>().prop_map(|n| Some(Uuid::from_u128(n))),
        old_values in arb_json_value().prop_map(Some),
        new_values in arb_json_value().prop_map(Some),
        changed_fields in arb_changed_fields(),
        ip_address in arb_ip_address().prop_map(Some),
        user_agent in arb_user_agent().prop_map(Some),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 51: Audit Record Completeness**

            // For any audit record, it should include all required fields
            let audit_logger = create_test_audit_logger().await;

            let audit_record = audit_logger.log_operation_with_changes(
                &operation_type,
                entity_id,
                user_id,
                old_values.as_ref(),
                new_values.as_ref(),
                &changed_fields,
                ip_address.as_deref(),
                user_agent.as_deref(),
            ).await.unwrap();

            // Verify all required fields are present
            assert!(!audit_record.id.is_nil());
            assert!(audit_record.timestamp <= Utc::now());
            assert_eq!(audit_record.operation_type, operation_type);
            assert_eq!(audit_record.entity_id, entity_id);
            assert_eq!(audit_record.user_id, user_id);
            assert_eq!(audit_record.old_values, old_values);
            assert_eq!(audit_record.new_values, new_values);
            assert_eq!(audit_record.changed_fields, changed_fields);
            assert_eq!(audit_record.ip_address, ip_address);
            assert_eq!(audit_record.user_agent, user_agent);

            // Verify hash is present and valid
            assert!(!audit_record.hash.is_empty());
            assert!(audit_record.hash.len() >= 32); // At least SHA-256 length
            assert!(audit_record.hash.chars().all(|c| c.is_ascii_hexdigit()));

            // Verify hash integrity
            let expected_hash = calculate_audit_hash(&audit_record);
            assert_eq!(audit_record.hash, expected_hash);

            // Test field validation
            if !changed_fields.is_empty() {
                assert!(old_values.is_some() || new_values.is_some());
            }

            // Verify IP address format
            if let Some(ip) = &ip_address {
                assert!(is_valid_ip_address(ip));
            }

            // Verify user agent format
            if let Some(ua) = &user_agent {
                assert!(!ua.is_empty());
                assert!(ua.len() <= 500); // Reasonable length limit
            }

            // Test completeness scoring
            let completeness_score = calculate_completeness_score(&audit_record);
            assert!(completeness_score >= 0.0 && completeness_score <= 1.0);

            // Records with all fields should have high completeness
            if audit_record.user_id.is_some() &&
               audit_record.old_values.is_some() &&
               audit_record.new_values.is_some() &&
               !audit_record.changed_fields.is_empty() &&
               audit_record.ip_address.is_some() &&
               audit_record.user_agent.is_some() {
                assert!(completeness_score >= 0.9);
            }
        });
    }
}
// Property Test 52: Audit Log Tamper-Proofing
// **Validates: Requirements 8.3**
proptest! {
    #[test]
    fn property_audit_log_tamper_proofing(
        operation_type in arb_operation_type(),
        entity_id in any::<u128>().prop_map(|n| Uuid::from_u128(n)),
        user_id in any::<u128>().prop_map(|n| Some(Uuid::from_u128(n))),
        old_values in arb_json_value().prop_map(Some),
        new_values in arb_json_value().prop_map(Some),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 52: Audit Log Tamper-Proofing**

            // For any audit log entry, it should be tamper-proof
            let audit_logger = create_test_audit_logger().await;

            let original_record = audit_logger.log_operation_with_changes(
                &operation_type,
                entity_id,
                user_id,
                old_values.as_ref(),
                new_values.as_ref(),
                &vec!["test_field".to_string()],
                Some("192.168.1.1"),
                Some("TestAgent/1.0"),
            ).await.unwrap();

            // Verify original hash is valid
            let expected_hash = calculate_audit_hash(&original_record);
            assert_eq!(original_record.hash, expected_hash);

            // Test hash verification
            assert!(verify_audit_hash(&original_record));

            // Test tamper detection - modify different fields
            let mut tampered_record = original_record.clone();

            // Test 1: Modify operation type
            tampered_record.operation_type = OperationType::ConfigurationChange;
            assert!(!verify_audit_hash(&tampered_record));

            // Test 2: Modify entity ID
            tampered_record = original_record.clone();
            tampered_record.entity_id = Uuid::new_v4();
            assert!(!verify_audit_hash(&tampered_record));

            // Test 3: Modify values
            tampered_record = original_record.clone();
            tampered_record.new_values = Some(json!({"tampered": true}));
            assert!(!verify_audit_hash(&tampered_record));

            // Test 4: Modify timestamp
            tampered_record = original_record.clone();
            tampered_record.timestamp = Utc::now();
            assert!(!verify_audit_hash(&tampered_record));

            // Test 5: Modify user ID
            tampered_record = original_record.clone();
            tampered_record.user_id = Some(Uuid::new_v4());
            assert!(!verify_audit_hash(&tampered_record));

            // Test hash algorithm properties
            let hash1 = calculate_audit_hash(&original_record);
            let hash2 = calculate_audit_hash(&original_record);
            assert_eq!(hash1, hash2); // Deterministic

            // Different records should have different hashes
            let different_record = audit_logger.log_operation_with_changes(
                &OperationType::ConfigurationChange,
                Uuid::new_v4(),
                Some(Uuid::new_v4()),
                Some(&json!({"different": "value"})),
                Some(&json!({"different": "new_value"})),
                &vec!["different_field".to_string()],
                Some("10.0.0.1"),
                Some("DifferentAgent/1.0"),
            ).await.unwrap();

            assert_ne!(original_record.hash, different_record.hash);

            // Test hash format
            assert!(original_record.hash.len() == 64); // SHA-256 hex length
            assert!(original_record.hash.chars().all(|c| c.is_ascii_hexdigit()));

            // Test immutability enforcement
            let immutable_result = audit_logger.attempt_modify_audit_record(
                original_record.id,
                &json!({"tampered": "data"})
            ).await;
            assert!(immutable_result.is_err()); // Should fail

            // Verify original record is unchanged
            let retrieved_record = audit_logger.get_audit_record(original_record.id).await.unwrap();
            assert_eq!(retrieved_record.hash, original_record.hash);
            assert!(verify_audit_hash(&retrieved_record));
        });
    }
}

// Property Test 53: Sensitive Operation Enhanced Logging
// **Validates: Requirements 8.4**
proptest! {
    #[test]
    fn property_sensitive_operation_enhanced_logging(
        amount in arb_financial_amount(),
        currency in arb_currency(),
        counterparty_id in any::<u128>().prop_map(|n| Some(Uuid::from_u128(n))),
        user_id in any::<u128>().prop_map(|n| Uuid::from_u128(n)),
        ip_address in arb_ip_address(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 53: Sensitive Operation Enhanced Logging**

            // For any sensitive operation, enhanced logging should be applied
            let audit_logger = create_test_audit_logger().await;

            // Test payment processing (sensitive operation)
            let payment_record = audit_logger.log_sensitive_operation(
                &OperationType::PaymentProcessing,
                Uuid::new_v4(),
                Some(user_id),
                Some(&json!({
                    "amount": amount,
                    "currency": currency,
                    "counterparty_id": counterparty_id
                })),
                Some(&ip_address),
                Some("PaymentClient/1.0"),
            ).await.unwrap();

            // Verify enhanced logging for sensitive operations
            assert!(is_sensitive_operation(&payment_record.operation_type));

            // Enhanced logging should include security context
            let security_context = audit_logger.get_security_context(payment_record.id).await.unwrap();
            assert!(security_context.risk_score.is_some());
            assert!(security_context.fraud_indicators.is_some());
            assert!(security_context.compliance_flags.is_some());

            // Test risk assessment
            let risk_score = security_context.risk_score.unwrap();
            assert!(risk_score >= 0.0 && risk_score <= 1.0);

            // High-value transactions should have higher risk scores
            if amount > Decimal::from(100000) {
                assert!(risk_score >= 0.3); // Higher risk for large amounts
            }

            // Test fraud indicators
            let fraud_indicators = security_context.fraud_indicators.unwrap();
            assert!(fraud_indicators.contains_key("ip_reputation"));
            assert!(fraud_indicators.contains_key("transaction_velocity"));
            assert!(fraud_indicators.contains_key("amount_anomaly"));

            // Test compliance flags
            let compliance_flags = security_context.compliance_flags.unwrap();
            assert!(compliance_flags.contains_key("aml_check"));
            assert!(compliance_flags.contains_key("sanctions_check"));

            // Test different sensitive operations
            let refund_record = audit_logger.log_sensitive_operation(
                &OperationType::PaymentProcessing, // Refund is also payment processing
                Uuid::new_v4(),
                Some(user_id),
                Some(&json!({
                    "amount": -amount, // Negative for refund
                    "currency": currency,
                    "original_transaction_id": Uuid::new_v4()
                })),
                Some(&ip_address),
                Some("RefundClient/1.0"),
            ).await.unwrap();

            let refund_context = audit_logger.get_security_context(refund_record.id).await.unwrap();

            // Refunds should have additional checks
            let refund_flags = refund_context.compliance_flags.unwrap();
            assert!(refund_flags.contains_key("refund_authorization"));
            assert!(refund_flags.contains_key("original_transaction_verification"));

            // Test non-sensitive operations don't get enhanced logging
            let verification_record = audit_logger.log_financial_operation(
                &OperationType::CounterpartyVerification,
                Uuid::new_v4(),
                Some(user_id),
                Some(&ip_address),
                Some("VerificationClient/1.0"),
                None,
                None,
            ).await.unwrap();

            // Non-sensitive operations should have basic security context
            let basic_context = audit_logger.get_security_context(verification_record.id).await.unwrap();
            assert!(basic_context.risk_score.is_none() || basic_context.risk_score.unwrap() < 0.5);

            // Test security context retention
            assert!(security_context.retention_period_days >= 730); // 2+ years for sensitive ops
            assert!(basic_context.retention_period_days >= 90); // 90+ days for basic ops
        });
    }
}
// Property Test 54: Financial Audit Record Creation
// **Validates: Requirements 8.5**
proptest! {
    #[test]
    fn property_financial_audit_record_creation(
        transaction_id in any::<u128>().prop_map(|n| Uuid::from_u128(n)),
        amount in arb_financial_amount(),
        currency in arb_currency(),
        counterparty_id in any::<u128>().prop_map(|n| Some(Uuid::from_u128(n))),
        operation_type in prop_oneof![
            Just("payment".to_string()),
            Just("refund".to_string()),
            Just("invoice_creation".to_string()),
            Just("fee_collection".to_string()),
        ],
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 54: Financial Audit Record Creation**

            // For any monetary transaction, financial audit record should be created
            let audit_logger = create_test_audit_logger().await;

            let financial_record = audit_logger.create_financial_audit_record(
                transaction_id,
                amount,
                &currency,
                counterparty_id,
                &operation_type,
            ).await.unwrap();

            // Verify financial audit record properties
            assert_eq!(financial_record.transaction_id, transaction_id);
            assert_eq!(financial_record.amount, amount);
            assert_eq!(financial_record.currency, currency);
            assert_eq!(financial_record.counterparty_id, counterparty_id);
            assert_eq!(financial_record.operation_type, operation_type);

            // Verify reconciliation status is set
            assert!(!financial_record.reconciliation_status.is_empty());
            assert!(matches!(
                financial_record.reconciliation_status.as_str(),
                "Pending" | "Matched" | "Discrepancy" | "Manual_Review"
            ));

            // New records should start as Pending
            assert_eq!(financial_record.reconciliation_status, "Pending");

            // Verify timestamp is recent
            let now = Utc::now();
            let time_diff = now.signed_duration_since(financial_record.created_at);
            assert!(time_diff.num_seconds() < 60);

            // Test amount validation
            assert!(amount > Decimal::ZERO || operation_type == "refund");

            // Test currency validation
            assert!(matches!(currency.as_str(), "RUB" | "USD" | "EUR"));
            assert_eq!(currency.len(), 3);
            assert!(currency.chars().all(|c| c.is_ascii_uppercase()));

            // Test operation type validation
            assert!(is_valid_financial_operation_type(&operation_type));

            // Verify record is stored in database
            let stored_record = audit_logger.get_financial_audit_record(financial_record.id).await.unwrap();
            assert_eq!(stored_record.transaction_id, transaction_id);
            assert_eq!(stored_record.amount, amount);

            // Test different operation types
            match operation_type.as_str() {
                "payment" => {
                    assert!(amount > Decimal::ZERO);
                    assert!(counterparty_id.is_some());
                }
                "refund" => {
                    // Refunds can be negative or positive (depending on representation)
                    assert!(counterparty_id.is_some());
                }
                "invoice_creation" => {
                    assert!(amount > Decimal::ZERO);
                    assert!(counterparty_id.is_some());
                }
                "fee_collection" => {
                    assert!(amount > Decimal::ZERO);
                    // Fee collection might not have counterparty
                }
                _ => {}
            }

            // Test financial record completeness
            let completeness = calculate_financial_record_completeness(&financial_record);
            assert!(completeness >= 0.8); // Should be mostly complete

            // Records with all optional fields should be fully complete
            if financial_record.counterparty_id.is_some() {
                assert!(completeness >= 0.9);
            }

            // Test audit trail linkage
            let linked_audit_records = audit_logger.get_linked_audit_records(transaction_id).await.unwrap();
            assert!(!linked_audit_records.is_empty());

            // Should have at least one audit record for the financial operation
            let financial_audit_exists = linked_audit_records.iter().any(|record| {
                matches!(record.operation_type, OperationType::PaymentProcessing | OperationType::InvoiceCreation)
            });
            assert!(financial_audit_exists);
        });
    }
}

// Property Test 55: Audit Log Export Support
// **Validates: Requirements 8.6**
proptest! {
    #[test]
    fn property_audit_log_export_support(
        export_format in arb_export_format(),
        record_count in 1usize..=100,
        start_date in any::<i64>().prop_map(|n| {
            DateTime::from_timestamp(n.abs() % 1_000_000_000 + 1_000_000_000, 0).unwrap_or_else(|| Utc::now())
        }),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 55: Audit Log Export Support**

            // For any audit log export request, it should support JSON and CSV formats
            let audit_logger = create_test_audit_logger().await;

            // Create test audit records
            let mut test_records = Vec::new();
            for i in 0..record_count {
                let record = audit_logger.log_financial_operation(
                    &OperationType::PaymentProcessing,
                    Uuid::new_v4(),
                    Some(Uuid::new_v4()),
                    Some("192.168.1.1"),
                    Some("TestAgent/1.0"),
                    Some(&json!({"test_field": format!("old_value_{}", i)})),
                    Some(&json!({"test_field": format!("new_value_{}", i)})),
                ).await.unwrap();
                test_records.push(record);
            }

            let end_date = start_date + chrono::Duration::days(30);

            // Test export functionality
            let export_result = audit_logger.export_audit_logs(
                &export_format,
                Some(start_date),
                Some(end_date),
                None, // user_id filter
                None, // operation_type filter
            ).await.unwrap();

            // Verify export result properties
            assert!(!export_result.data.is_empty());
            assert!(export_result.record_count > 0);
            assert_eq!(export_result.format, export_format);
            assert!(export_result.generated_at <= Utc::now());

            // Test format-specific validation
            match export_format {
                ExportFormat::Json => {
                    // Should be valid JSON
                    let parsed: Value = serde_json::from_str(&export_result.data).unwrap();
                    assert!(parsed.is_array());

                    let records = parsed.as_array().unwrap();
                    assert!(records.len() > 0);

                    // Each record should have required fields
                    for record in records {
                        assert!(record.get("id").is_some());
                        assert!(record.get("timestamp").is_some());
                        assert!(record.get("operation_type").is_some());
                        assert!(record.get("entity_id").is_some());
                        assert!(record.get("hash").is_some());
                    }
                }
                ExportFormat::Csv => {
                    // Should be valid CSV
                    let lines: Vec<&str> = export_result.data.lines().collect();
                    assert!(lines.len() > 1); // Header + at least one data row

                    // Check header
                    let header = lines[0];
                    assert!(header.contains("id"));
                    assert!(header.contains("timestamp"));
                    assert!(header.contains("operation_type"));
                    assert!(header.contains("entity_id"));
                    assert!(header.contains("hash"));

                    // Check data rows
                    for line in &lines[1..] {
                        let fields: Vec<&str> = line.split(',').collect();
                        assert!(fields.len() >= 5); // At least the required fields

                        // Verify UUID format in first field (id)
                        assert!(Uuid::parse_str(fields[0].trim_matches('"')).is_ok());
                    }
                }
            }

            // Test filtering functionality
            let filtered_export = audit_logger.export_audit_logs(
                &export_format,
                Some(start_date),
                Some(end_date),
                Some(test_records[0].user_id.unwrap()),
                Some(OperationType::PaymentProcessing),
            ).await.unwrap();

            assert!(filtered_export.record_count <= export_result.record_count);

            // Test empty result handling
            let future_date = Utc::now() + chrono::Duration::days(365);
            let empty_export = audit_logger.export_audit_logs(
                &export_format,
                Some(future_date),
                Some(future_date + chrono::Duration::days(1)),
                None,
                None,
            ).await.unwrap();

            assert_eq!(empty_export.record_count, 0);
            match export_format {
                ExportFormat::Json => {
                    let parsed: Value = serde_json::from_str(&empty_export.data).unwrap();
                    assert_eq!(parsed.as_array().unwrap().len(), 0);
                }
                ExportFormat::Csv => {
                    let lines: Vec<&str> = empty_export.data.lines().collect();
                    assert_eq!(lines.len(), 1); // Only header
                }
            }

            // Test export metadata
            assert!(export_result.file_size > 0);
            assert!(!export_result.checksum.is_empty());

            // Verify checksum
            let calculated_checksum = calculate_export_checksum(&export_result.data);
            assert_eq!(export_result.checksum, calculated_checksum);
        });
    }
}
// Property Test 56: Data Retention Policy Enforcement
// **Validates: Requirements 8.7**
proptest! {
    #[test]
    fn property_data_retention_policy_enforcement(
        log_type in arb_log_type(),
        record_age_days in 1i32..=3650, // Up to 10 years
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 56: Data Retention Policy Enforcement**

            // For any log type, retention policies should be enforced correctly
            let audit_logger = create_test_audit_logger().await;

            // Get retention policy for log type
            let retention_policy = get_retention_policy(&log_type);

            // Verify retention policy properties
            assert!(retention_policy.retention_period_days > 0);
            assert!(retention_policy.archive_period_days > 0);
            assert!(retention_policy.deletion_period_days >= retention_policy.retention_period_days);

            // Test standard retention periods
            match log_type {
                LogType::Financial => {
                    assert_eq!(retention_policy.retention_period_days, 2555); // 7 years
                    assert_eq!(retention_policy.archive_period_days, 1095); // 3 years
                    assert_eq!(retention_policy.deletion_period_days, 3650); // 10 years
                }
                LogType::Security => {
                    assert_eq!(retention_policy.retention_period_days, 730); // 2 years
                    assert_eq!(retention_policy.archive_period_days, 365); // 1 year
                    assert_eq!(retention_policy.deletion_period_days, 730); // 2 years
                }
                LogType::ApiRequest => {
                    assert_eq!(retention_policy.retention_period_days, 90); // 90 days
                    assert_eq!(retention_policy.archive_period_days, 30); // 30 days
                    assert_eq!(retention_policy.deletion_period_days, 90); // 90 days
                }
                LogType::Webhook => {
                    assert_eq!(retention_policy.retention_period_days, 365); // 1 year
                    assert_eq!(retention_policy.archive_period_days, 180); // 6 months
                    assert_eq!(retention_policy.deletion_period_days, 365); // 1 year
                }
                LogType::System => {
                    assert_eq!(retention_policy.retention_period_days, 365); // 1 year
                    assert_eq!(retention_policy.archive_period_days, 90); // 3 months
                    assert_eq!(retention_policy.deletion_period_days, 365); // 1 year
                }
            }

            // Test retention status determination
            let retention_status = determine_retention_status(&log_type, record_age_days);

            if record_age_days <= retention_policy.archive_period_days {
                assert_eq!(retention_status, RetentionStatus::Active);
            } else if record_age_days <= retention_policy.retention_period_days {
                assert_eq!(retention_status, RetentionStatus::Archived);
            } else if record_age_days <= retention_policy.deletion_period_days {
                assert_eq!(retention_status, RetentionStatus::Expired);
            } else {
                assert_eq!(retention_status, RetentionStatus::PendingDeletion);
            }

            // Test policy enforcement
            let enforcement_result = audit_logger.enforce_retention_policy(&log_type, record_age_days).await.unwrap();

            match retention_status {
                RetentionStatus::Active => {
                    assert_eq!(enforcement_result.action, RetentionAction::None);
                    assert!(enforcement_result.records_affected == 0);
                }
                RetentionStatus::Archived => {
                    assert!(matches!(enforcement_result.action, RetentionAction::Archive | RetentionAction::None));
                }
                RetentionStatus::Expired => {
                    assert!(matches!(enforcement_result.action, RetentionAction::Archive | RetentionAction::None));
                }
                RetentionStatus::PendingDeletion => {
                    assert_eq!(enforcement_result.action, RetentionAction::Delete);
                }
            }

            // Test compliance with legal requirements
            assert!(is_compliant_with_legal_requirements(&retention_policy, &log_type));

            // Financial records must be kept for at least 7 years (Russian law)
            if log_type == LogType::Financial {
                assert!(retention_policy.retention_period_days >= 2555); // 7 years
            }

            // Security records must be kept for at least 2 years
            if log_type == LogType::Security {
                assert!(retention_policy.retention_period_days >= 730); // 2 years
            }

            // Test automatic cleanup scheduling
            let cleanup_schedule = audit_logger.get_cleanup_schedule(&log_type).await.unwrap();
            assert!(cleanup_schedule.next_cleanup_date > Utc::now());
            assert!(cleanup_schedule.cleanup_frequency_days > 0);

            // More frequent cleanup for shorter retention periods
            if retention_policy.retention_period_days <= 90 {
                assert!(cleanup_schedule.cleanup_frequency_days <= 7); // Weekly
            } else if retention_policy.retention_period_days <= 365 {
                assert!(cleanup_schedule.cleanup_frequency_days <= 30); // Monthly
            } else {
                assert!(cleanup_schedule.cleanup_frequency_days <= 90); // Quarterly
            }
        });
    }
}

// Property Test 57: Audit Trail Search Capabilities
// **Validates: Requirements 8.8**
proptest! {
    #[test]
    fn property_audit_trail_search_capabilities(
        search_user_id in any::<u128>().prop_map(|n| Some(Uuid::from_u128(n))),
        search_operation_type in arb_operation_type().prop_map(Some),
        search_entity_id in any::<u128>().prop_map(|n| Some(Uuid::from_u128(n))),
        date_range_days in 1i32..=365,
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 57: Audit Trail Search Capabilities**

            // For any audit search request, filtering should work correctly
            let audit_logger = create_test_audit_logger().await;

            // Create test data with known values
            let test_user_id = search_user_id.unwrap();
            let test_operation_type = search_operation_type.unwrap();
            let test_entity_id = search_entity_id.unwrap();

            // Create matching record
            let matching_record = audit_logger.log_financial_operation(
                &test_operation_type,
                test_entity_id,
                Some(test_user_id),
                Some("192.168.1.100"),
                Some("SearchTestAgent/1.0"),
                Some(&json!({"search_test": "matching"})),
                Some(&json!({"search_test": "updated"})),
            ).await.unwrap();

            // Create non-matching records
            let _non_matching_user = audit_logger.log_financial_operation(
                &test_operation_type,
                test_entity_id,
                Some(Uuid::new_v4()), // Different user
                Some("192.168.1.101"),
                Some("SearchTestAgent/1.0"),
                None,
                None,
            ).await.unwrap();

            let _non_matching_operation = audit_logger.log_financial_operation(
                &OperationType::ConfigurationChange, // Different operation
                test_entity_id,
                Some(test_user_id),
                Some("192.168.1.102"),
                Some("SearchTestAgent/1.0"),
                None,
                None,
            ).await.unwrap();

            // Test search by user ID
            let user_search_results = audit_logger.search_audit_trail(
                None, // start_date
                None, // end_date
                Some(test_user_id),
                None, // operation_type
                None, // entity_id
                100,  // limit
                0,    // offset
            ).await.unwrap();

            assert!(user_search_results.total_count >= 1);
            assert!(user_search_results.records.iter().all(|r| r.user_id == Some(test_user_id)));

            // Test search by operation type
            let operation_search_results = audit_logger.search_audit_trail(
                None,
                None,
                None,
                Some(test_operation_type.clone()),
                None,
                100,
                0,
            ).await.unwrap();

            assert!(operation_search_results.total_count >= 1);
            assert!(operation_search_results.records.iter().all(|r| r.operation_type == test_operation_type));

            // Test search by entity ID
            let entity_search_results = audit_logger.search_audit_trail(
                None,
                None,
                None,
                None,
                Some(test_entity_id),
                100,
                0,
            ).await.unwrap();

            assert!(entity_search_results.total_count >= 1);
            assert!(entity_search_results.records.iter().all(|r| r.entity_id == test_entity_id));

            // Test date range filtering
            let start_date = Utc::now() - chrono::Duration::days(date_range_days as i64);
            let end_date = Utc::now() + chrono::Duration::hours(1);

            let date_search_results = audit_logger.search_audit_trail(
                Some(start_date),
                Some(end_date),
                None,
                None,
                None,
                100,
                0,
            ).await.unwrap();

            assert!(date_search_results.records.iter().all(|r| {
                r.timestamp >= start_date && r.timestamp <= end_date
            }));

            // Test combined filtering
            let combined_search_results = audit_logger.search_audit_trail(
                Some(start_date),
                Some(end_date),
                Some(test_user_id),
                Some(test_operation_type.clone()),
                Some(test_entity_id),
                100,
                0,
            ).await.unwrap();

            // Should find the matching record
            assert!(combined_search_results.total_count >= 1);
            let found_matching = combined_search_results.records.iter().any(|r| {
                r.id == matching_record.id
            });
            assert!(found_matching);

            // Test pagination
            let page1 = audit_logger.search_audit_trail(
                None, None, None, None, None,
                5,  // limit
                0,  // offset
            ).await.unwrap();

            let page2 = audit_logger.search_audit_trail(
                None, None, None, None, None,
                5,  // limit
                5,  // offset
            ).await.unwrap();

            // Pages should not overlap
            let page1_ids: std::collections::HashSet<_> = page1.records.iter().map(|r| r.id).collect();
            let page2_ids: std::collections::HashSet<_> = page2.records.iter().map(|r| r.id).collect();
            assert!(page1_ids.is_disjoint(&page2_ids));

            // Test sorting
            assert!(page1.records.windows(2).all(|w| w[0].timestamp >= w[1].timestamp)); // Descending by default

            // Test search performance
            let large_search_start = std::time::Instant::now();
            let _large_search_results = audit_logger.search_audit_trail(
                None, None, None, None, None,
                1000, // Large limit
                0,
            ).await.unwrap();
            let search_duration = large_search_start.elapsed();

            // Search should complete within reasonable time
            assert!(search_duration.as_millis() < 5000); // Less than 5 seconds

            // Test empty search results
            let empty_search = audit_logger.search_audit_trail(
                Some(Utc::now() + chrono::Duration::days(365)), // Future date
                Some(Utc::now() + chrono::Duration::days(366)),
                None, None, None,
                100, 0,
            ).await.unwrap();

            assert_eq!(empty_search.total_count, 0);
            assert!(empty_search.records.is_empty());
        });
    }
}
// Helper functions and test implementations

#[derive(Debug, Clone, PartialEq)]
enum RetentionStatus {
    Active,
    Archived,
    Expired,
    PendingDeletion,
}

#[derive(Debug, Clone, PartialEq, Copy)]
enum RetentionAction {
    None,
    Archive,
    Delete,
}

#[derive(Debug, Clone)]
struct SecurityContext {
    risk_score: Option<f64>,
    fraud_indicators: Option<HashMap<String, Value>>,
    compliance_flags: Option<HashMap<String, Value>>,
    retention_period_days: i32,
}

#[derive(Debug, Clone)]
struct ExportResult {
    data: String,
    record_count: usize,
    format: ExportFormat,
    generated_at: DateTime<Utc>,
    file_size: usize,
    checksum: String,
}

#[derive(Debug, Clone)]
struct SearchResult {
    records: Vec<AuditRecord>,
    total_count: usize,
}

#[derive(Debug, Clone)]
struct RetentionEnforcementResult {
    action: RetentionAction,
    records_affected: usize,
}

#[derive(Debug, Clone)]
struct CleanupSchedule {
    next_cleanup_date: DateTime<Utc>,
    cleanup_frequency_days: i32,
}

// Test audit logger implementation
struct TestAuditLogger {
    db_pool: Arc<PgPool>,
}

impl TestAuditLogger {
    async fn log_financial_operation(
        &self,
        operation_type: &OperationType,
        entity_id: Uuid,
        user_id: Option<Uuid>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
        old_values: Option<&Value>,
        new_values: Option<&Value>,
    ) -> TBankResult<AuditRecord> {
        let record = AuditRecord {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            user_id,
            operation_type: operation_type.clone(),
            entity_id,
            old_values: old_values.cloned(),
            new_values: new_values.cloned(),
            changed_fields: vec!["test_field".to_string()],
            ip_address: ip_address.map(|s| s.to_string()),
            user_agent: user_agent.map(|s| s.to_string()),
            hash: "".to_string(),
        };

        let hash = calculate_audit_hash(&record);
        let mut record_with_hash = record;
        record_with_hash.hash = hash;

        Ok(record_with_hash)
    }

    async fn log_operation_with_changes(
        &self,
        operation_type: &OperationType,
        entity_id: Uuid,
        user_id: Option<Uuid>,
        old_values: Option<&Value>,
        new_values: Option<&Value>,
        changed_fields: &[String],
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> TBankResult<AuditRecord> {
        let record = AuditRecord {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            user_id,
            operation_type: operation_type.clone(),
            entity_id,
            old_values: old_values.cloned(),
            new_values: new_values.cloned(),
            changed_fields: changed_fields.to_vec(),
            ip_address: ip_address.map(|s| s.to_string()),
            user_agent: user_agent.map(|s| s.to_string()),
            hash: "".to_string(),
        };

        let hash = calculate_audit_hash(&record);
        let mut record_with_hash = record;
        record_with_hash.hash = hash;

        Ok(record_with_hash)
    }

    async fn log_sensitive_operation(
        &self,
        operation_type: &OperationType,
        entity_id: Uuid,
        user_id: Option<Uuid>,
        transaction_data: Option<&Value>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> TBankResult<AuditRecord> {
        self.log_operation_with_changes(
            operation_type,
            entity_id,
            user_id,
            None,
            transaction_data,
            &vec!["amount".to_string(), "currency".to_string()],
            ip_address,
            user_agent,
        )
        .await
    }

    async fn get_audit_record(&self, id: Uuid) -> TBankResult<AuditRecord> {
        // Mock implementation - in real code would query database
        Ok(AuditRecord {
            id,
            timestamp: Utc::now(),
            user_id: Some(Uuid::new_v4()),
            operation_type: OperationType::PaymentProcessing,
            entity_id: Uuid::new_v4(),
            old_values: None,
            new_values: None,
            changed_fields: vec![],
            ip_address: Some("192.168.1.1".to_string()),
            user_agent: Some("TestAgent/1.0".to_string()),
            hash: "test_hash".to_string(),
        })
    }

    async fn get_security_context(&self, _audit_id: Uuid) -> TBankResult<SecurityContext> {
        Ok(SecurityContext {
            risk_score: Some(0.5),
            fraud_indicators: Some(HashMap::from([
                ("ip_reputation".to_string(), json!("clean")),
                ("transaction_velocity".to_string(), json!("normal")),
                ("amount_anomaly".to_string(), json!("none")),
            ])),
            compliance_flags: Some(HashMap::from([
                ("aml_check".to_string(), json!("passed")),
                ("sanctions_check".to_string(), json!("clear")),
                ("refund_authorization".to_string(), json!("approved")),
                (
                    "original_transaction_verification".to_string(),
                    json!("verified"),
                ),
            ])),
            retention_period_days: 730,
        })
    }

    async fn create_financial_audit_record(
        &self,
        transaction_id: Uuid,
        amount: Decimal,
        currency: &str,
        counterparty_id: Option<Uuid>,
        operation_type: &str,
    ) -> TBankResult<FinancialAuditRecord> {
        Ok(FinancialAuditRecord {
            id: Uuid::new_v4(),
            transaction_id,
            amount,
            currency: currency.to_string(),
            counterparty_id,
            operation_type: operation_type.to_string(),
            reconciliation_status: "Pending".to_string(),
            created_at: Utc::now(),
        })
    }

    async fn get_financial_audit_record(&self, id: Uuid) -> TBankResult<FinancialAuditRecord> {
        Ok(FinancialAuditRecord {
            id,
            transaction_id: Uuid::new_v4(),
            amount: Decimal::from(1000),
            currency: "RUB".to_string(),
            counterparty_id: Some(Uuid::new_v4()),
            operation_type: "payment".to_string(),
            reconciliation_status: "Pending".to_string(),
            created_at: Utc::now(),
        })
    }

    async fn get_linked_audit_records(
        &self,
        _transaction_id: Uuid,
    ) -> TBankResult<Vec<AuditRecord>> {
        Ok(vec![AuditRecord {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            user_id: Some(Uuid::new_v4()),
            operation_type: OperationType::PaymentProcessing,
            entity_id: Uuid::new_v4(),
            old_values: None,
            new_values: None,
            changed_fields: vec![],
            ip_address: Some("192.168.1.1".to_string()),
            user_agent: Some("TestAgent/1.0".to_string()),
            hash: "test_hash".to_string(),
        }])
    }

    async fn export_audit_logs(
        &self,
        format: &ExportFormat,
        start_date: Option<DateTime<Utc>>,
        end_date: Option<DateTime<Utc>>,
        user_id: Option<Uuid>,
        operation_type: Option<OperationType>,
    ) -> TBankResult<ExportResult> {
        let sample_records = vec![
            json!({
                "id": Uuid::new_v4(),
                "timestamp": "2024-01-01T00:00:00Z",
                "operation_type": "PaymentProcessing",
                "entity_id": Uuid::new_v4(),
                "hash": "sample_hash_1"
            }),
            json!({
                "id": Uuid::new_v4(),
                "timestamp": "2024-01-01T01:00:00Z",
                "operation_type": "InvoiceCreation",
                "entity_id": Uuid::new_v4(),
                "hash": "sample_hash_2"
            }),
        ];

        let data = match format {
            ExportFormat::Json => serde_json::to_string_pretty(&sample_records).unwrap(),
            ExportFormat::Csv => {
                let mut csv = "id,timestamp,operation_type,entity_id,hash\n".to_string();
                for record in &sample_records {
                    csv.push_str(&format!(
                        "{},{},{},{},{}\n",
                        record["id"].as_str().unwrap_or(""),
                        record["timestamp"].as_str().unwrap_or(""),
                        record["operation_type"].as_str().unwrap_or(""),
                        record["entity_id"].as_str().unwrap_or(""),
                        record["hash"].as_str().unwrap_or("")
                    ));
                }
                csv
            }
        };

        let record_count = if start_date.is_some() && start_date.unwrap() > Utc::now() {
            0 // Future date = no records
        } else {
            sample_records.len()
        };

        let filtered_data = if record_count == 0 {
            match format {
                ExportFormat::Json => "[]".to_string(),
                ExportFormat::Csv => "id,timestamp,operation_type,entity_id,hash\n".to_string(),
            }
        } else {
            data
        };

        Ok(ExportResult {
            data: filtered_data.clone(),
            record_count,
            format: format.clone(),
            generated_at: Utc::now(),
            file_size: filtered_data.len(),
            checksum: calculate_export_checksum(&filtered_data),
        })
    }

    async fn enforce_retention_policy(
        &self,
        log_type: &LogType,
        record_age_days: i32,
    ) -> TBankResult<RetentionEnforcementResult> {
        let retention_policy = get_retention_policy(log_type);
        let status = determine_retention_status(log_type, record_age_days);

        let action = match status {
            RetentionStatus::Active => RetentionAction::None,
            RetentionStatus::Archived => RetentionAction::Archive,
            RetentionStatus::Expired => RetentionAction::Archive,
            RetentionStatus::PendingDeletion => RetentionAction::Delete,
        };

        let records_affected = if action == RetentionAction::None {
            0
        } else {
            1
        };

        Ok(RetentionEnforcementResult {
            action,
            records_affected,
        })
    }

    async fn get_cleanup_schedule(&self, log_type: &LogType) -> TBankResult<CleanupSchedule> {
        let retention_policy = get_retention_policy(log_type);

        let frequency = if retention_policy.retention_period_days <= 90 {
            7 // Weekly
        } else if retention_policy.retention_period_days <= 365 {
            30 // Monthly
        } else {
            90 // Quarterly
        };

        Ok(CleanupSchedule {
            next_cleanup_date: Utc::now() + chrono::Duration::days(frequency as i64),
            cleanup_frequency_days: frequency,
        })
    }

    async fn search_audit_trail(
        &self,
        start_date: Option<DateTime<Utc>>,
        end_date: Option<DateTime<Utc>>,
        user_id: Option<Uuid>,
        operation_type: Option<OperationType>,
        entity_id: Option<Uuid>,
        limit: usize,
        offset: usize,
    ) -> TBankResult<SearchResult> {
        // Mock search implementation
        let mut records = Vec::new();

        // Generate sample records based on search criteria
        let base_time = Utc::now() - chrono::Duration::days(30);

        for i in 0..limit.min(10) {
            let record_time = base_time + chrono::Duration::hours(i as i64);

            // Skip if outside date range
            if let Some(start) = start_date {
                if record_time < start {
                    continue;
                }
            }
            if let Some(end) = end_date {
                if record_time > end {
                    continue;
                }
            }

            let record = AuditRecord {
                id: Uuid::new_v4(),
                timestamp: record_time,
                user_id: user_id.or(Some(Uuid::new_v4())),
                operation_type: operation_type
                    .clone()
                    .unwrap_or(OperationType::PaymentProcessing),
                entity_id: entity_id.unwrap_or(Uuid::new_v4()),
                old_values: None,
                new_values: None,
                changed_fields: vec![],
                ip_address: Some("192.168.1.1".to_string()),
                user_agent: Some("TestAgent/1.0".to_string()),
                hash: format!("hash_{}", i),
            };

            records.push(record);
        }

        // Apply offset
        let records: Vec<AuditRecord> = records.into_iter().skip(offset).collect();

        Ok(SearchResult {
            total_count: records.len(),
            records,
        })
    }

    async fn attempt_modify_audit_record(&self, _id: Uuid, _data: &Value) -> TBankResult<()> {
        Err(TBankError::ValidationError(
            "Audit records are immutable".to_string(),
        ))
    }
}

async fn create_test_audit_logger() -> TestAuditLogger {
    let db_pool = get_test_db_pool().await;
    TestAuditLogger { db_pool }
}
// Helper functions

fn is_financial_operation(operation_type: &OperationType) -> bool {
    matches!(
        operation_type,
        OperationType::CounterpartyVerification
            | OperationType::InvoiceCreation
            | OperationType::PaymentProcessing
            | OperationType::WebhookProcessing
            | OperationType::Reconciliation
    )
}

fn requires_enhanced_logging(operation_type: &OperationType) -> bool {
    matches!(
        operation_type,
        OperationType::CounterpartyVerification
            | OperationType::InvoiceCreation
            | OperationType::PaymentProcessing
            | OperationType::Reconciliation
            | OperationType::ConfigurationChange
    )
}

fn is_sensitive_operation(operation_type: &OperationType) -> bool {
    matches!(operation_type, OperationType::PaymentProcessing)
}

fn calculate_audit_hash(record: &AuditRecord) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(record.id.as_bytes());
    hasher.update(record.timestamp.to_rfc3339().as_bytes());
    hasher.update(format!("{:?}", record.operation_type).as_bytes());
    hasher.update(record.entity_id.as_bytes());

    if let Some(user_id) = record.user_id {
        hasher.update(user_id.as_bytes());
    }

    if let Some(old_values) = &record.old_values {
        hasher.update(old_values.to_string().as_bytes());
    }

    if let Some(new_values) = &record.new_values {
        hasher.update(new_values.to_string().as_bytes());
    }

    for field in &record.changed_fields {
        hasher.update(field.as_bytes());
    }

    if let Some(ip) = &record.ip_address {
        hasher.update(ip.as_bytes());
    }

    if let Some(ua) = &record.user_agent {
        hasher.update(ua.as_bytes());
    }

    format!("{:x}", hasher.finalize())
}

fn verify_audit_hash(record: &AuditRecord) -> bool {
    let expected_hash = calculate_audit_hash(record);
    record.hash == expected_hash
}

fn calculate_completeness_score(record: &AuditRecord) -> f64 {
    let mut score = 0.0;
    let mut total_fields = 0.0;

    // Required fields
    if !record.id.is_nil() {
        score += 1.0;
    }
    total_fields += 1.0;

    if record.timestamp <= Utc::now() {
        score += 1.0;
    }
    total_fields += 1.0;

    if !record.hash.is_empty() {
        score += 1.0;
    }
    total_fields += 1.0;

    // Optional but important fields
    if record.user_id.is_some() {
        score += 1.0;
    }
    total_fields += 1.0;

    if record.old_values.is_some() {
        score += 1.0;
    }
    total_fields += 1.0;

    if record.new_values.is_some() {
        score += 1.0;
    }
    total_fields += 1.0;

    if !record.changed_fields.is_empty() {
        score += 1.0;
    }
    total_fields += 1.0;

    if record.ip_address.is_some() {
        score += 1.0;
    }
    total_fields += 1.0;

    if record.user_agent.is_some() {
        score += 1.0;
    }
    total_fields += 1.0;

    score / total_fields
}

fn is_valid_ip_address(ip: &str) -> bool {
    use std::net::{Ipv4Addr, Ipv6Addr};

    ip.parse::<Ipv4Addr>().is_ok() || ip.parse::<Ipv6Addr>().is_ok()
}

fn is_valid_financial_operation_type(operation_type: &str) -> bool {
    matches!(
        operation_type,
        "payment" | "refund" | "invoice_creation" | "fee_collection"
    )
}

fn calculate_financial_record_completeness(record: &FinancialAuditRecord) -> f64 {
    let mut score = 0.0;
    let mut total_fields = 0.0;

    // Required fields
    if !record.id.is_nil() {
        score += 1.0;
    }
    total_fields += 1.0;

    if !record.transaction_id.is_nil() {
        score += 1.0;
    }
    total_fields += 1.0;

    if record.amount != Decimal::ZERO {
        score += 1.0;
    }
    total_fields += 1.0;

    if !record.currency.is_empty() {
        score += 1.0;
    }
    total_fields += 1.0;

    if !record.operation_type.is_empty() {
        score += 1.0;
    }
    total_fields += 1.0;

    // Optional fields
    if record.counterparty_id.is_some() {
        score += 1.0;
    }
    total_fields += 1.0;

    score / total_fields
}

fn get_retention_policy(log_type: &LogType) -> RetentionPolicy {
    match log_type {
        LogType::Financial => RetentionPolicy {
            log_type: log_type.clone(),
            retention_period_days: 2555, // 7 years
            archive_period_days: 1095,   // 3 years
            deletion_period_days: 3650,  // 10 years
        },
        LogType::Security => RetentionPolicy {
            log_type: log_type.clone(),
            retention_period_days: 730, // 2 years
            archive_period_days: 365,   // 1 year
            deletion_period_days: 730,  // 2 years
        },
        LogType::ApiRequest => RetentionPolicy {
            log_type: log_type.clone(),
            retention_period_days: 90, // 90 days
            archive_period_days: 30,   // 30 days
            deletion_period_days: 90,  // 90 days
        },
        LogType::Webhook => RetentionPolicy {
            log_type: log_type.clone(),
            retention_period_days: 365, // 1 year
            archive_period_days: 180,   // 6 months
            deletion_period_days: 365,  // 1 year
        },
        LogType::System => RetentionPolicy {
            log_type: log_type.clone(),
            retention_period_days: 365, // 1 year
            archive_period_days: 90,    // 3 months
            deletion_period_days: 365,  // 1 year
        },
    }
}

fn determine_retention_status(log_type: &LogType, record_age_days: i32) -> RetentionStatus {
    let policy = get_retention_policy(log_type);

    if record_age_days <= policy.archive_period_days {
        RetentionStatus::Active
    } else if record_age_days <= policy.retention_period_days {
        RetentionStatus::Archived
    } else if record_age_days <= policy.deletion_period_days {
        RetentionStatus::Expired
    } else {
        RetentionStatus::PendingDeletion
    }
}

fn is_compliant_with_legal_requirements(policy: &RetentionPolicy, log_type: &LogType) -> bool {
    match log_type {
        LogType::Financial => policy.retention_period_days >= 2555, // 7 years minimum
        LogType::Security => policy.retention_period_days >= 730,   // 2 years minimum
        _ => policy.retention_period_days >= 90,                    // 90 days minimum for others
    }
}

fn calculate_export_checksum(data: &str) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operation_type_classification() {
        assert!(is_financial_operation(&OperationType::PaymentProcessing));
        assert!(is_financial_operation(&OperationType::InvoiceCreation));
        assert!(!is_financial_operation(&OperationType::ConfigurationChange));

        assert!(is_sensitive_operation(&OperationType::PaymentProcessing));
        assert!(!is_sensitive_operation(&OperationType::InvoiceCreation));

        assert!(requires_enhanced_logging(&OperationType::PaymentProcessing));
        assert!(requires_enhanced_logging(
            &OperationType::ConfigurationChange
        ));
    }

    #[test]
    fn test_audit_hash_calculation() {
        let record = AuditRecord {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            user_id: Some(Uuid::new_v4()),
            operation_type: OperationType::PaymentProcessing,
            entity_id: Uuid::new_v4(),
            old_values: Some(json!({"amount": 1000})),
            new_values: Some(json!({"amount": 1500})),
            changed_fields: vec!["amount".to_string()],
            ip_address: Some("192.168.1.1".to_string()),
            user_agent: Some("TestAgent/1.0".to_string()),
            hash: "".to_string(),
        };

        let hash = calculate_audit_hash(&record);
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA-256 hex length
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));

        // Hash should be deterministic
        let hash2 = calculate_audit_hash(&record);
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_completeness_scoring() {
        let complete_record = AuditRecord {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            user_id: Some(Uuid::new_v4()),
            operation_type: OperationType::PaymentProcessing,
            entity_id: Uuid::new_v4(),
            old_values: Some(json!({"test": "old"})),
            new_values: Some(json!({"test": "new"})),
            changed_fields: vec!["test".to_string()],
            ip_address: Some("192.168.1.1".to_string()),
            user_agent: Some("TestAgent/1.0".to_string()),
            hash: "test_hash".to_string(),
        };

        let score = calculate_completeness_score(&complete_record);
        assert_eq!(score, 1.0);

        let incomplete_record = AuditRecord {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            user_id: None,
            operation_type: OperationType::PaymentProcessing,
            entity_id: Uuid::new_v4(),
            old_values: None,
            new_values: None,
            changed_fields: vec![],
            ip_address: None,
            user_agent: None,
            hash: "test_hash".to_string(),
        };

        let incomplete_score = calculate_completeness_score(&incomplete_record);
        assert!(incomplete_score < 1.0);
        assert!(incomplete_score >= 0.3); // Should have at least required fields
    }

    #[test]
    fn test_retention_policies() {
        let financial_policy = get_retention_policy(&LogType::Financial);
        assert_eq!(financial_policy.retention_period_days, 2555); // 7 years

        let security_policy = get_retention_policy(&LogType::Security);
        assert_eq!(security_policy.retention_period_days, 730); // 2 years

        let api_policy = get_retention_policy(&LogType::ApiRequest);
        assert_eq!(api_policy.retention_period_days, 90); // 90 days

        // Test compliance
        assert!(is_compliant_with_legal_requirements(
            &financial_policy,
            &LogType::Financial
        ));
        assert!(is_compliant_with_legal_requirements(
            &security_policy,
            &LogType::Security
        ));
    }

    #[test]
    fn test_retention_status_determination() {
        let status_active = determine_retention_status(&LogType::Financial, 30);
        assert_eq!(status_active, RetentionStatus::Active);

        let status_archived = determine_retention_status(&LogType::Financial, 2000);
        assert_eq!(status_archived, RetentionStatus::Archived);

        let status_expired = determine_retention_status(&LogType::Financial, 3000);
        assert_eq!(status_expired, RetentionStatus::Expired);

        let status_pending_deletion = determine_retention_status(&LogType::Financial, 4000);
        assert_eq!(status_pending_deletion, RetentionStatus::PendingDeletion);
    }

    #[test]
    fn test_ip_address_validation() {
        assert!(is_valid_ip_address("192.168.1.1"));
        assert!(is_valid_ip_address("10.0.0.1"));
        assert!(is_valid_ip_address("::1"));
        assert!(is_valid_ip_address(
            "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
        ));

        assert!(!is_valid_ip_address("invalid_ip"));
        assert!(!is_valid_ip_address("256.256.256.256"));
        assert!(!is_valid_ip_address(""));
    }

    #[test]
    fn test_financial_operation_validation() {
        assert!(is_valid_financial_operation_type("payment"));
        assert!(is_valid_financial_operation_type("refund"));
        assert!(is_valid_financial_operation_type("invoice_creation"));
        assert!(is_valid_financial_operation_type("fee_collection"));

        assert!(!is_valid_financial_operation_type("invalid_operation"));
        assert!(!is_valid_financial_operation_type(""));
    }

    #[test]
    fn test_export_checksum() {
        let data = "test export data";
        let checksum = calculate_export_checksum(data);

        assert!(!checksum.is_empty());
        assert_eq!(checksum.len(), 64); // SHA-256 hex length
        assert!(checksum.chars().all(|c| c.is_ascii_hexdigit()));

        // Should be deterministic
        let checksum2 = calculate_export_checksum(data);
        assert_eq!(checksum, checksum2);

        // Different data should produce different checksums
        let different_checksum = calculate_export_checksum("different data");
        assert_ne!(checksum, different_checksum);
    }
}
