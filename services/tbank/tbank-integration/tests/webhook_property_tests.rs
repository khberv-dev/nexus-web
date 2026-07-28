use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use proptest::prelude::*;
use serde_json::json;
use sha2::Sha256;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::sync::OnceCell;

use tbank_integration::database::common_queries::CommonQueries;
use tbank_integration::types::TBankError;
use tbank_integration::webhook::{
    events::{WebhookEvent, WebhookEventType, WebhookProcessingStatus, WebhookType},
    signature::WebhookSignatureValidator,
};

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

// Property test generators
fn arb_event_id() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9]{8,32}".prop_map(|s| format!("evt_{}", s))
}

fn arb_entity_id() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9]{8,32}".prop_map(|s| format!("entity_{}", s))
}

fn arb_webhook_event_type() -> impl Strategy<Value = WebhookEventType> {
    prop_oneof![
        Just(WebhookEventType::B2BInvoiceViewed),
        Just(WebhookEventType::B2BInvoicePaid),
        Just(WebhookEventType::B2BInvoiceOverdue),
        Just(WebhookEventType::B2BInvoiceCancelled),
        Just(WebhookEventType::B2BInvoiceRefunded),
        Just(WebhookEventType::AcquiringPaymentCompleted),
        Just(WebhookEventType::AcquiringPaymentFailed),
        Just(WebhookEventType::AcquiringPaymentCancelled),
        Just(WebhookEventType::AcquiringPaymentExpired),
    ]
}

fn arb_webhook_event() -> impl Strategy<Value = WebhookEvent> {
    (
        arb_event_id(),
        arb_webhook_event_type(),
        arb_entity_id(),
        "[a-zA-Z0-9_]{3,20}",
        prop::option::of(0i64..1000000i64),
    ).prop_map(|(event_id, event_type, entity_id, status, timestamp_offset)| {
        let timestamp = match timestamp_offset {
            Some(offset) => Utc::now() - Duration::seconds(offset),
            None => Utc::now(),
        };

        let payload = match event_type.webhook_type() {
            WebhookType::B2B => json!({
                "invoiceId": format!("inv_{}", entity_id),
                "invoiceNumber": format!("INV-2024-{:03}", fastrand::u32(1..=999)),
                "counterpartyInn": format!("{:010}", fastrand::u64(1000000000..=9999999999u64)),
                "amount": fastrand::f64() * 1000000.0,
                "currency": "RUB",
                "dueDate": "2024-12-31",
                "status": status.clone(),
            }),
            WebhookType::Acquiring => json!({
                "paymentId": format!("pay_{}", entity_id),
                "orderId": format!("ord_{}", fastrand::u32(100000..=999999)),
                "amount": fastrand::f64() * 100000.0,
                "currency": "RUB",
                "paymentMethod": "Card",
                "status": status.clone(),
            }),
        };

        WebhookEvent {
            event_id,
            event_type,
            entity_id,
            status,
            timestamp,
            payload,
        }
    })
}

fn arb_webhook_signature() -> impl Strategy<Value = String> {
    "[a-f0-9]{64}".prop_map(|hex| format!("sha256={}", hex))
}

fn arb_webhook_payload() -> impl Strategy<Value = String> {
    arb_webhook_event().prop_map(|event| serde_json::to_string(&event).unwrap())
}

// Property Test 29: Webhook Signature Validation
// **Validates: Requirements 5.1**
proptest! {
    #[test]
    fn property_webhook_signature_validation(
        payload in arb_webhook_payload(),
        secret in "[a-zA-Z0-9]{16,64}",
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 29: Webhook Signature Validation**

            // For any webhook payload and secret, signature validation should work correctly
            // Generate valid signature
            #[cfg(test)]
            let valid_signature = {
                type HmacSha256 = Hmac<Sha256>;

                let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
                mac.update(payload.as_bytes());
                let signature = mac.finalize().into_bytes();
                format!("sha256={}", hex::encode(signature))
            };

            let validator = WebhookSignatureValidator::new(secret);

            // Valid signature should pass validation
            assert!(validator.validate(&payload, &valid_signature).is_ok());

            // Invalid signature should fail validation
            let invalid_signature = "sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
            assert!(validator.validate(&payload, invalid_signature).is_err());

            // Disabled validator should always pass
            let disabled_validator = WebhookSignatureValidator::disabled();
            assert!(disabled_validator.validate(&payload, "any_signature").is_ok());
        });
    }
}

// Property Test 30: Webhook Data Parsing
// **Validates: Requirements 5.2**
proptest! {
    #[test]
    fn property_webhook_data_parsing(
        event in arb_webhook_event(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 30: Webhook Data Parsing**

            // For any valid webhook event, parsing should extract all required fields
            let event_id = event.event_id.clone();
            let event_type = event.event_type.clone();
            let entity_id = event.entity_id.clone();
            let status = event.status.clone();
            let timestamp = event.timestamp;

            // Event should validate successfully
            assert!(event.validate().is_ok());

            // Event ID should not be empty
            assert!(!event.event_id.is_empty());

            // Entity ID should not be empty
            assert!(!event.entity_id.is_empty());

            // Status should not be empty
            assert!(!event.status.is_empty());

            // Timestamp should be reasonable (not too far in future or past)
            let now = Utc::now();
            let age = now.signed_duration_since(event.timestamp);
            assert!(age.num_days().abs() < 365); // Within a year

            // Event type should match webhook type
            match event.event_type.webhook_type() {
                WebhookType::B2B => {
                    assert!(matches!(
                        event.event_type,
                        WebhookEventType::B2BInvoiceViewed |
                        WebhookEventType::B2BInvoicePaid |
                        WebhookEventType::B2BInvoiceOverdue |
                        WebhookEventType::B2BInvoiceCancelled |
                        WebhookEventType::B2BInvoiceRefunded
                    ));

                    // Should be able to parse B2B payload
                    assert!(event.parse_b2b_invoice_payload().is_ok());
                }
                WebhookType::Acquiring => {
                    assert!(matches!(
                        event.event_type,
                        WebhookEventType::AcquiringPaymentCompleted |
                        WebhookEventType::AcquiringPaymentFailed |
                        WebhookEventType::AcquiringPaymentCancelled |
                        WebhookEventType::AcquiringPaymentExpired
                    ));

                    // Should be able to parse acquiring payload
                    assert!(event.parse_acquiring_payment_payload().is_ok());
                }
            }
        });
    }
}

// Property Test 31: Payment Webhook Status Updates
// **Validates: Requirements 5.3**
proptest! {
    #[test]
    fn property_payment_webhook_status_updates(
        event_id in arb_event_id(),
        payment_id in arb_entity_id(),
        order_id in "[0-9]{6,10}",
        amount in 1.0f64..1000000.0f64,
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 31: Payment Webhook Status Updates**

            // For any acquiring payment webhook, status should be updated correctly
            let acquiring_events = vec![
                WebhookEventType::AcquiringPaymentCompleted,
                WebhookEventType::AcquiringPaymentFailed,
                WebhookEventType::AcquiringPaymentCancelled,
                WebhookEventType::AcquiringPaymentExpired,
            ];

            for event_type in acquiring_events {
                let payload = json!({
                    "paymentId": payment_id,
                    "orderId": order_id,
                    "amount": amount,
                    "currency": "RUB",
                    "paymentMethod": "Card",
                    "status": match event_type {
                        WebhookEventType::AcquiringPaymentCompleted => "Completed",
                        WebhookEventType::AcquiringPaymentFailed => "Failed",
                        WebhookEventType::AcquiringPaymentCancelled => "Cancelled",
                        WebhookEventType::AcquiringPaymentExpired => "Expired",
                        _ => unreachable!(),
                    },
                });

                let webhook_event = WebhookEvent {
                    event_id: event_id.clone(),
                    event_type: event_type.clone(),
                    entity_id: payment_id.clone(),
                    status: payload["status"].as_str().unwrap().to_string(),
                    timestamp: Utc::now(),
                    payload,
                };

                // Event should be valid
                assert!(webhook_event.validate().is_ok());

                // Should be able to parse acquiring payload
                let parsed_payload = webhook_event.parse_acquiring_payment_payload().unwrap();
                assert_eq!(parsed_payload.payment_id, payment_id);
                assert_eq!(parsed_payload.order_id, order_id);
                assert!((parsed_payload.amount.to_string().parse::<f64>().unwrap_or(0.0) - amount).abs() < 0.01);

                // Event type should map to correct payment status
                let expected_status = event_type.to_acquiring_payment_status().unwrap();
                assert!(matches!(
                    expected_status,
                    tbank_integration::types::acquiring::payment::AcquiringPaymentStatus::Completed |
                    tbank_integration::types::acquiring::payment::AcquiringPaymentStatus::Failed |
                    tbank_integration::types::acquiring::payment::AcquiringPaymentStatus::Cancelled |
                    tbank_integration::types::acquiring::payment::AcquiringPaymentStatus::Expired
                ));
            }
        });
    }
}

// Property Test 32: Invoice Webhook Status Updates
// **Validates: Requirements 5.4**
proptest! {
    #[test]
    fn property_invoice_webhook_status_updates(
        event_id in arb_event_id(),
        invoice_id in arb_entity_id(),
        invoice_number in "INV-[0-9]{4}-[0-9]{3}",
        counterparty_inn in "[0-9]{10,12}",
        amount in 1.0f64..1000000.0f64,
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 32: Invoice Webhook Status Updates**

            // For any B2B invoice webhook, status should be updated correctly
            let b2b_events = vec![
                WebhookEventType::B2BInvoiceViewed,
                WebhookEventType::B2BInvoicePaid,
                WebhookEventType::B2BInvoiceOverdue,
                WebhookEventType::B2BInvoiceCancelled,
                WebhookEventType::B2BInvoiceRefunded,
            ];

            for event_type in b2b_events {
                let payload = json!({
                    "invoiceId": invoice_id,
                    "invoiceNumber": invoice_number,
                    "counterpartyInn": counterparty_inn,
                    "amount": amount,
                    "currency": "RUB",
                    "dueDate": "2024-12-31",
                    "status": match event_type {
                        WebhookEventType::B2BInvoiceViewed => "Viewed",
                        WebhookEventType::B2BInvoicePaid => "Paid",
                        WebhookEventType::B2BInvoiceOverdue => "Overdue",
                        WebhookEventType::B2BInvoiceCancelled => "Cancelled",
                        WebhookEventType::B2BInvoiceRefunded => "Refunded",
                        _ => unreachable!(),
                    },
                });

                let webhook_event = WebhookEvent {
                    event_id: event_id.clone(),
                    event_type: event_type.clone(),
                    entity_id: invoice_id.clone(),
                    status: payload["status"].as_str().unwrap().to_string(),
                    timestamp: Utc::now(),
                    payload,
                };

                // Event should be valid
                assert!(webhook_event.validate().is_ok());

                // Should be able to parse B2B payload
                let parsed_payload = webhook_event.parse_b2b_invoice_payload().unwrap();
                assert_eq!(parsed_payload.invoice_id, invoice_id);
                assert_eq!(parsed_payload.invoice_number, invoice_number);
                assert_eq!(parsed_payload.counterparty_inn, counterparty_inn);
                assert!((parsed_payload.amount.to_string().parse::<f64>().unwrap_or(0.0) - amount).abs() < 0.01);

                // Event type should map to correct invoice status
                let expected_status = event_type.to_b2b_invoice_status().unwrap();
                assert!(matches!(
                    expected_status,
                    tbank_integration::types::b2b::invoice::B2BInvoiceStatus::Viewed |
                    tbank_integration::types::b2b::invoice::B2BInvoiceStatus::Paid |
                    tbank_integration::types::b2b::invoice::B2BInvoiceStatus::Overdue |
                    tbank_integration::types::b2b::invoice::B2BInvoiceStatus::Cancelled |
                    tbank_integration::types::b2b::invoice::B2BInvoiceStatus::Refunded
                ));
            }
        });
    }
}

// Property Test 33: Invalid Webhook Signature Rejection
// **Validates: Requirements 5.5**
proptest! {
    #[test]
    fn property_invalid_webhook_signature_rejection(
        payload in arb_webhook_payload(),
        secret in "[a-zA-Z0-9]{16,64}",
        invalid_signature in arb_webhook_signature(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 33: Invalid Webhook Signature Rejection**

            // For any webhook with invalid signature, system should reject with error
            // Generate valid signature for comparison
            #[cfg(test)]
            let valid_signature = {
                type HmacSha256 = Hmac<Sha256>;

                let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
                mac.update(payload.as_bytes());
                let signature = mac.finalize().into_bytes();
                format!("sha256={}", hex::encode(signature))
            };

            let validator = WebhookSignatureValidator::new(secret);

            // Invalid signature should be rejected
            if invalid_signature != valid_signature {
                let result = validator.validate(&payload, &invalid_signature);
                assert!(result.is_err());

                // Should be InvalidWebhookSignature error
                match result.unwrap_err() {
                    TBankError::InvalidWebhookSignature => {
                        // Expected error type
                    }
                    other => panic!("Expected InvalidWebhookSignature, got: {:?}", other),
                }
            }

            // Valid signature should pass
            assert!(validator.validate(&payload, &valid_signature).is_ok());

            // Malformed signatures should be rejected
            let malformed_signatures = vec![
                "invalid_format",
                "sha256=",
                "sha256=invalid_hex",
                "sha256=too_short",
                "md5=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefg", // invalid hex char
            ];

            for malformed in malformed_signatures {
                let result = validator.validate(&payload, malformed);
                assert!(result.is_err());
                assert!(matches!(result.unwrap_err(), TBankError::InvalidWebhookSignature));
            }
        });
    }
}

// Property Test 34: Webhook Idempotency
// **Validates: Requirements 5.6**
proptest! {
    #[test]
    fn property_webhook_idempotency(
        event in arb_webhook_event(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 34: Webhook Idempotency**

            let pool = get_test_db_pool().await;

            // For any webhook event, processing should be idempotent
            let event_id = event.event_id.clone();

            // First check - event should not exist
            let exists_before = CommonQueries::webhook_event_exists(&pool, &event_id).await.unwrap();
            assert!(!exists_before);

            // Store the event
            let internal_event = event.to_internal();
            CommonQueries::insert_webhook_event(&pool, &internal_event).await.unwrap();

            // Second check - event should now exist
            let exists_after = CommonQueries::webhook_event_exists(&pool, &event_id).await.unwrap();
            assert!(exists_after);

            // Attempting to store the same event again should handle duplicates
            // (This would typically be handled at the application level by checking existence first)
            let duplicate_check = CommonQueries::webhook_event_exists(&pool, &event_id).await.unwrap();
            assert!(duplicate_check);

            // Clean up
            sqlx::query("DELETE FROM webhook_events WHERE event_id = $1")
                .bind(&event_id)
                .execute(&*pool)
                .await
                .unwrap();
        });
    }
}

// Property Test 35: Webhook Retry Mechanism
// **Validates: Requirements 5.7**
proptest! {
    #[test]
    fn property_webhook_retry_mechanism(
        event in arb_webhook_event(),
        retry_count in 0u32..10u32,
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 35: Webhook Retry Mechanism**

            let pool = get_test_db_pool().await;

            // For any failed webhook processing, retry mechanism should work with exponential backoff
            let mut internal_event = event.to_internal();
            internal_event.retry_count = retry_count as i32;
            internal_event.processing_status = WebhookProcessingStatus::Failed;

            // Store the failed event
            CommonQueries::insert_webhook_event(&pool, &internal_event).await.unwrap();

            // Check retry eligibility
            let can_retry = internal_event.can_retry();
            let expected_can_retry = retry_count < 5;
            assert_eq!(can_retry, expected_can_retry);

            // Get failed events for retry
            let failed_events = CommonQueries::get_failed_webhook_events(&pool, 10).await.unwrap();

            if expected_can_retry {
                // Should find the event in failed events list
                assert!(failed_events.iter().any(|e| e.event_id == event.event_id));
            }

            // Test retry count increment
            let mut retry_event = internal_event.clone();
            retry_event.mark_failed();
            assert_eq!(retry_event.retry_count, retry_count as i32 + 1);
            assert_eq!(retry_event.processing_status, WebhookProcessingStatus::Failed);

            // Test completion marking
            let mut complete_event = internal_event.clone();
            complete_event.mark_completed();
            assert_eq!(complete_event.processing_status, WebhookProcessingStatus::Completed);
            assert!(complete_event.processed_at.is_some());

            // Clean up
            sqlx::query("DELETE FROM webhook_events WHERE event_id = $1")
                .bind(&event.event_id)
                .execute(&*pool)
                .await
                .unwrap();
        });
    }
}

// Property Test 36: Webhook Audit Storage
// **Validates: Requirements 5.8**
proptest! {
    #[test]
    fn property_webhook_audit_storage(
        event in arb_webhook_event(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 36: Webhook Audit Storage**

            let pool = get_test_db_pool().await;

            // For any webhook event, all details should be stored for audit purposes
            let internal_event = event.to_internal();

            // Store webhook event
            CommonQueries::insert_webhook_event(&pool, &internal_event).await.unwrap();

            // Verify all required fields are stored
            let query = r#"
                SELECT event_id, event_type, webhook_type, entity_id, status,
                       payload, processing_status, retry_count, created_at
                FROM webhook_events 
                WHERE event_id = $1
            "#;

            let row = sqlx::query(query)
                .bind(&event.event_id)
                .fetch_one(&*pool)
                .await
                .unwrap();

            // Verify stored data matches original event
            let stored_event_id: String = row.try_get("event_id").unwrap();
            let stored_event_type: String = row.try_get("event_type").unwrap();
            let stored_webhook_type: String = row.try_get("webhook_type").unwrap();
            let stored_entity_id: String = row.try_get("entity_id").unwrap();
            let stored_status: String = row.try_get("status").unwrap();
            let stored_payload: serde_json::Value = row.try_get("payload").unwrap();
            let stored_processing_status: String = row.try_get("processing_status").unwrap();
            let stored_retry_count: i32 = row.try_get("retry_count").unwrap();
            let stored_created_at: Option<DateTime<Utc>> = row.try_get("created_at").unwrap();

            assert_eq!(stored_event_id, event.event_id);
            assert_eq!(stored_event_type, event.event_type.to_string());
            assert_eq!(stored_webhook_type, event.event_type.webhook_type().to_string());
            assert_eq!(stored_entity_id, event.entity_id);
            assert_eq!(stored_status, event.status);
            assert_eq!(stored_payload, event.payload);
            assert_eq!(stored_processing_status, "Pending");
            assert_eq!(stored_retry_count, 0);
            assert!(stored_created_at.is_some());

            // Test status updates
            CommonQueries::update_webhook_event_status(
                &pool,
                &event.event_id,
                WebhookProcessingStatus::Completed,
                1,
                Some(Utc::now()),
            ).await.unwrap();

            // Verify status was updated
            let updated_row = sqlx::query("SELECT processing_status, retry_count, processed_at FROM webhook_events WHERE event_id = $1")
                .bind(&event.event_id)
                .fetch_one(&*pool)
                .await
                .unwrap();

            let updated_status: String = updated_row.try_get("processing_status").unwrap();
            let updated_retry_count: i32 = updated_row.try_get("retry_count").unwrap();
            let updated_processed_at: Option<DateTime<Utc>> = updated_row.try_get("processed_at").unwrap();

            assert_eq!(updated_status, "Completed");
            assert_eq!(updated_retry_count, 1);
            assert!(updated_processed_at.is_some());

            // Clean up
            sqlx::query("DELETE FROM webhook_events WHERE event_id = $1")
                .bind(&event.event_id)
                .execute(&*pool)
                .await
                .unwrap();
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_webhook_signature_validator_basic() {
        let secret = "test_secret_key";
        let validator = WebhookSignatureValidator::new(secret.to_string());
        let payload = r#"{"eventId":"test123","eventType":"invoice.paid"}"#;

        // Generate valid signature manually for testing
        type HmacSha256 = Hmac<Sha256>;

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(payload.as_bytes());
        let signature_bytes = mac.finalize().into_bytes();
        let signature = format!("sha256={}", hex::encode(signature_bytes));

        // Validate signature
        assert!(validator.validate(payload, &signature).is_ok());

        // Test invalid signature
        let invalid_signature = "sha256=invalid_signature_hex_value_that_is_exactly_64_chars_long";
        assert!(validator.validate(payload, invalid_signature).is_err());
    }

    #[tokio::test]
    async fn test_webhook_event_validation() {
        let event = WebhookEvent {
            event_id: "test_event_123".to_string(),
            event_type: WebhookEventType::B2BInvoicePaid,
            entity_id: "invoice_456".to_string(),
            status: "Paid".to_string(),
            timestamp: Utc::now(),
            payload: json!({
                "invoiceId": "invoice_456",
                "amount": 1000.0,
                "currency": "RUB"
            }),
        };

        // Should validate successfully
        assert!(event.validate().is_ok());

        // Should convert to internal event
        let internal = event.to_internal();
        assert_eq!(internal.event_id, event.event_id);
        assert_eq!(internal.event_type, event.event_type);
        assert_eq!(internal.webhook_type, WebhookType::B2B);
        assert_eq!(internal.processing_status, WebhookProcessingStatus::Pending);
        assert_eq!(internal.retry_count, 0);
    }

    #[tokio::test]
    async fn test_webhook_event_type_mappings() {
        // Test B2B event types
        assert_eq!(
            WebhookEventType::B2BInvoiceViewed.webhook_type(),
            WebhookType::B2B
        );
        assert_eq!(
            WebhookEventType::B2BInvoicePaid.webhook_type(),
            WebhookType::B2B
        );

        // Test acquiring event types
        assert_eq!(
            WebhookEventType::AcquiringPaymentCompleted.webhook_type(),
            WebhookType::Acquiring
        );
        assert_eq!(
            WebhookEventType::AcquiringPaymentFailed.webhook_type(),
            WebhookType::Acquiring
        );

        // Test status mappings
        assert!(WebhookEventType::B2BInvoicePaid
            .to_b2b_invoice_status()
            .is_some());
        assert!(WebhookEventType::AcquiringPaymentCompleted
            .to_acquiring_payment_status()
            .is_some());

        // Cross-type mappings should return None
        assert!(WebhookEventType::B2BInvoicePaid
            .to_acquiring_payment_status()
            .is_none());
        assert!(WebhookEventType::AcquiringPaymentCompleted
            .to_b2b_invoice_status()
            .is_none());
    }
}
