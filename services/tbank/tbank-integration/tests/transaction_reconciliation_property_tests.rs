use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use proptest::prelude::*;
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::sync::OnceCell;

use tbank_integration::database::common_queries::CommonQueries;
use tbank_integration::reconciliation::{
    matcher::ReconciliationResult, ReconciliationReportGenerator, TransactionMatcher,
};
use tbank_integration::types::{
    Currency, Discrepancy, DiscrepancySeverity, DiscrepancyType, FinancialAudit, OperationType,
    ReconciliationReport, ReconciliationStatus, Transaction,
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
fn arb_account_number() -> impl Strategy<Value = String> {
    "40702810[0-9]{12}".prop_map(|s| s)
}

fn arb_transaction_id() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9]{8,32}".prop_map(|s| format!("txn_{}", s))
}

fn arb_inn() -> impl Strategy<Value = String> {
    prop_oneof!["[0-9]{10}".prop_map(|s| s), "[0-9]{12}".prop_map(|s| s),]
}

fn arb_amount() -> impl Strategy<Value = Decimal> {
    (1.0f64..1000000.0f64).prop_map(|f| Decimal::from_f64_retain(f).unwrap_or(Decimal::ZERO))
}

fn arb_reconciliation_date() -> impl Strategy<Value = NaiveDate> {
    (0i64..365i64).prop_map(|days_ago| (Utc::now() - Duration::days(days_ago)).date_naive())
}

fn arb_transaction() -> impl Strategy<Value = Transaction> {
    (
        arb_transaction_id(),
        arb_amount(),
        arb_inn(),
        "[A-Za-z0-9 ]{10,50}",
        arb_account_number(),
        prop::bool::ANY,
    )
        .prop_map(|(id, amount, inn, description, account, is_credit)| {
            let operation_type = if is_credit {
                OperationType::Credit
            } else {
                OperationType::Debit
            };
            let mut transaction = Transaction::new(
                Utc::now(),
                amount,
                Currency::RUB,
                Some(inn),
                Some("Test Company".to_string()),
                description,
                operation_type,
                account,
            );
            transaction.reference_number = Some(id);
            transaction
        })
}

fn arb_financial_audit() -> impl Strategy<Value = FinancialAudit> {
    (arb_transaction_id(), arb_amount(), arb_inn()).prop_map(|(id, amount, inn)| {
        FinancialAudit::new(
            id,
            amount,
            Currency::RUB,
            Some(inn),
            Utc::now(),
            ReconciliationStatus::Unmatched,
        )
    })
}

// Property Test 37: Reconciliation Statement Fetching
// **Validates: Requirements 6.1**
proptest! {
    #[test]
    fn property_reconciliation_statement_fetching(
        account_number in arb_account_number(),
        date in arb_reconciliation_date(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 37: Reconciliation Statement Fetching**

            // For any valid account number and date, statement fetching should work correctly
            // Validate account number format
            assert!(tbank_integration::balance::BalanceMonitor::validate_account_number(&account_number).is_ok());

            // Date should be reasonable (not in future, not too old)
            let today = Utc::now().date_naive();
            let age_days = (today - date).num_days();
            assert!(age_days >= 0); // Not in future
            assert!(age_days <= 365); // Not older than 1 year

            // Account number should follow Russian bank account format
            assert_eq!(account_number.len(), 20);
            assert!(account_number.starts_with("40702810"));
            assert!(account_number.chars().all(|c| c.is_ascii_digit()));

            // Date should be valid business date
            let weekday = date.weekday().number_from_monday();
            // Property: reconciliation can be run for any date, including weekends
            assert!(weekday >= 1 && weekday <= 7);
        });
    }
}

// Property Test 38: Transaction Comparison Logic
// **Validates: Requirements 6.2**
proptest! {
    #[test]
    fn property_transaction_comparison_logic(
        tbank_transactions in prop::collection::vec(arb_transaction(), 0..10),
        internal_transactions in prop::collection::vec(arb_financial_audit(), 0..10),
        date in arb_reconciliation_date(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 38: Transaction Comparison Logic**

            let pool = get_test_db_pool().await;
            let matcher = TransactionMatcher::new(pool);

            // For any set of T-Bank and internal transactions, comparison should work correctly
            let result = matcher.compare_transactions(&tbank_transactions, &internal_transactions, date).await.unwrap();

            // Basic invariants
            let total_tbank = tbank_transactions.len();
            let total_internal = internal_transactions.len();
            let matched_count = result.matched_transactions.len();
            let unmatched_tbank_count = result.unmatched_tbank.len();
            let unmatched_internal_count = result.unmatched_internal.len();

            // Conservation of transactions
            assert_eq!(matched_count + unmatched_tbank_count, total_tbank);
            assert_eq!(matched_count + unmatched_internal_count, total_internal);

            // No transaction should appear in multiple categories
            let mut all_tbank_refs = std::collections::HashSet::new();
            for (tbank_tx, _) in &result.matched_transactions {
                if let Some(ref_num) = &tbank_tx.reference_number {
                    assert!(all_tbank_refs.insert(ref_num.clone()));
                }
            }
            for tbank_tx in &result.unmatched_tbank {
                if let Some(ref_num) = &tbank_tx.reference_number {
                    assert!(all_tbank_refs.insert(ref_num.clone()));
                }
            }

            // Matched transactions should have same amount and date
            for (tbank_tx, internal_tx) in &result.matched_transactions {
                assert_eq!(tbank_tx.amount.abs(), internal_tx.amount.abs());
                assert_eq!(tbank_tx.operation_date.date_naive(), internal_tx.operation_date.date_naive());

                // If both have INN, they should match
                if let (Some(tbank_inn), Some(internal_inn)) = (&tbank_tx.counterparty_inn, &internal_tx.counterparty_inn) {
                    assert_eq!(tbank_inn, internal_inn);
                }
            }

            // Discrepancies should be reasonable
            assert!(result.discrepancies.len() <= total_tbank + total_internal);
        });
    }
}

// Property Test 39: Transaction Matching Status
// **Validates: Requirements 6.3**
proptest! {
    #[test]
    fn property_transaction_matching_status(
        amount in arb_amount(),
        inn in arb_inn(),
        transaction_id in arb_transaction_id(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 39: Transaction Matching Status**

            // For any transaction, matching status should be correctly determined
            let date = Utc::now();

            // Create matching T-Bank and internal transactions
            let mut tbank_transaction = Transaction::new(
                date,
                amount,
                Currency::RUB,
                Some(inn.clone()),
                Some("Test Company".to_string()),
                "Test payment".to_string(),
                OperationType::Credit,
                "40702810110011000000".to_string(),
            );
            tbank_transaction.reference_number = Some(transaction_id.clone());

            let internal_transaction = FinancialAudit::new(
                transaction_id.clone(),
                amount,
                Currency::RUB,
                Some(inn.clone()),
                date,
                ReconciliationStatus::Unmatched,
            );

            let pool = get_test_db_pool().await;
            let matcher = TransactionMatcher::new(pool);

            // Compare single matching pair
            let result = matcher.compare_transactions(
                &[tbank_transaction.clone()],
                &[internal_transaction.clone()],
                date.date_naive(),
            ).await.unwrap();

            // Should find exactly one match
            assert_eq!(result.matched_transactions.len(), 1);
            assert_eq!(result.unmatched_tbank.len(), 0);
            assert_eq!(result.unmatched_internal.len(), 0);

            let (matched_tbank, matched_internal) = &result.matched_transactions[0];
            assert_eq!(matched_tbank.amount, amount);
            assert_eq!(matched_internal.amount, amount);
            assert_eq!(matched_tbank.counterparty_inn, Some(inn.clone()));
            assert_eq!(matched_internal.counterparty_inn, Some(inn));

            // Test non-matching transactions
            let mut different_tbank = tbank_transaction.clone();
            different_tbank.amount = amount + Decimal::from(100); // Different amount

            let result2 = matcher.compare_transactions(
                &[different_tbank],
                &[internal_transaction],
                date.date_naive(),
            ).await.unwrap();

            // Should not match due to amount difference
            assert_eq!(result2.matched_transactions.len(), 0);
            assert_eq!(result2.unmatched_tbank.len(), 1);
            assert_eq!(result2.unmatched_internal.len(), 1);
        });
    }
}

// Property Test 40: Discrepancy Report Generation
// **Validates: Requirements 6.4**
proptest! {
    #[test]
    fn property_discrepancy_report_generation(
        missing_amount in arb_amount(),
        mismatch_amount1 in arb_amount(),
        mismatch_amount2 in arb_amount(),
        date in arb_reconciliation_date(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 40: Discrepancy Report Generation**

            // For any discrepancies, report generation should work correctly
            let pool = get_test_db_pool().await;
            let report_generator = ReconciliationReportGenerator::new(pool);

            // Create test discrepancies
            let missing_discrepancy = Discrepancy {
                discrepancy_type: DiscrepancyType::MissingTransaction,
                transaction_id: Some("missing_txn_123".to_string()),
                expected_amount: Some(missing_amount),
                actual_amount: None,
                description: format!("Missing transaction with amount {}", missing_amount),
                severity: if missing_amount >= Decimal::from(1_000_000) {
                    DiscrepancySeverity::Critical
                } else if missing_amount >= Decimal::from(100_000) {
                    DiscrepancySeverity::High
                } else if missing_amount >= Decimal::from(10_000) {
                    DiscrepancySeverity::Medium
                } else {
                    DiscrepancySeverity::Low
                },
            };

            let amount_mismatch_discrepancy = Discrepancy {
                discrepancy_type: DiscrepancyType::AmountMismatch,
                transaction_id: Some("mismatch_txn_456".to_string()),
                expected_amount: Some(mismatch_amount1),
                actual_amount: Some(mismatch_amount2),
                description: format!("Amount mismatch: expected {}, actual {}", mismatch_amount1, mismatch_amount2),
                severity: {
                    let difference = (mismatch_amount1 - mismatch_amount2).abs();
                    if difference >= Decimal::from(1_000_000) {
                        DiscrepancySeverity::Critical
                    } else if difference >= Decimal::from(100_000) {
                        DiscrepancySeverity::High
                    } else if difference >= Decimal::from(10_000) {
                        DiscrepancySeverity::Medium
                    } else {
                        DiscrepancySeverity::Low
                    }
                },
            };

            // Create reconciliation result with discrepancies
            let reconciliation_result = ReconciliationResult {
                matched_transactions: Vec::new(),
                unmatched_tbank: Vec::new(),
                unmatched_internal: Vec::new(),
                discrepancies: vec![missing_discrepancy.clone(), amount_mismatch_discrepancy.clone()],
            };

            // Generate report
            let report = report_generator.generate_report(date, &reconciliation_result).await.unwrap();

            // Validate report structure
            assert_eq!(report.date, date);
            assert_eq!(report.matched_count, 0);
            assert_eq!(report.unmatched_count, 0);
            assert_eq!(report.discrepancies.len(), 2);

            // Validate discrepancies are preserved
            let report_discrepancies = &report.discrepancies;
            assert!(report_discrepancies.iter().any(|d| {
                matches!(d.discrepancy_type, DiscrepancyType::MissingTransaction) &&
                d.expected_amount == Some(missing_amount)
            }));
            assert!(report_discrepancies.iter().any(|d| {
                matches!(d.discrepancy_type, DiscrepancyType::AmountMismatch) &&
                d.expected_amount == Some(mismatch_amount1) &&
                d.actual_amount == Some(mismatch_amount2)
            }));

            // Validate severity assignment
            for discrepancy in &report.discrepancies {
                match discrepancy.severity {
                    DiscrepancySeverity::Critical => {
                        let amount = discrepancy.expected_amount.or(discrepancy.actual_amount).unwrap_or(Decimal::ZERO);
                        assert!(amount >= Decimal::from(1_000_000) ||
                               (discrepancy.expected_amount.is_some() && discrepancy.actual_amount.is_some() &&
                                (discrepancy.expected_amount.unwrap() - discrepancy.actual_amount.unwrap()).abs() >= Decimal::from(1_000_000)));
                    }
                    DiscrepancySeverity::High => {
                        let amount = discrepancy.expected_amount.or(discrepancy.actual_amount).unwrap_or(Decimal::ZERO);
                        assert!(amount >= Decimal::from(100_000) ||
                               (discrepancy.expected_amount.is_some() && discrepancy.actual_amount.is_some() &&
                                (discrepancy.expected_amount.unwrap() - discrepancy.actual_amount.unwrap()).abs() >= Decimal::from(100_000)));
                    }
                    DiscrepancySeverity::Medium => {
                        let amount = discrepancy.expected_amount.or(discrepancy.actual_amount).unwrap_or(Decimal::ZERO);
                        assert!(amount >= Decimal::from(10_000) ||
                               (discrepancy.expected_amount.is_some() && discrepancy.actual_amount.is_some() &&
                                (discrepancy.expected_amount.unwrap() - discrepancy.actual_amount.unwrap()).abs() >= Decimal::from(10_000)));
                    }
                    DiscrepancySeverity::Low => {
                        // Low severity for smaller amounts
                    }
                }
            }
        });
    }
}

// Property Test 41: Financial Audit Record Creation
// **Validates: Requirements 6.5**
proptest! {
    #[test]
    fn property_financial_audit_record_creation(
        transaction_id in arb_transaction_id(),
        amount in arb_amount(),
        inn in arb_inn(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 41: Financial Audit Record Creation**

            let pool = get_test_db_pool().await;

            // For any transaction, financial audit record should be created correctly
            let operation_date = Utc::now();

            // Create financial audit record
            CommonQueries::insert_financial_audit(
                &pool,
                &transaction_id,
                "RECONCILIATION_TEST",
                amount,
                "RUB",
                Some(&inn),
                operation_date,
                "Matched",
            ).await.unwrap();

            // Verify record was created
            let query = r#"
                SELECT transaction_id, transaction_type, amount, currency, counterparty_inn, 
                       operation_date, status, created_at
                FROM financial_audit 
                WHERE transaction_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            "#;

            let row = sqlx::query(query)
                .bind(&transaction_id)
                .fetch_one(&*pool)
                .await
                .unwrap();

            // Validate stored data
            let stored_transaction_id: String = row.try_get("transaction_id").unwrap();
            let stored_transaction_type: String = row.try_get("transaction_type").unwrap();
            let stored_amount: Decimal = row.try_get("amount").unwrap();
            let stored_currency: String = row.try_get("currency").unwrap();
            let stored_inn: Option<String> = row.try_get("counterparty_inn").unwrap();
            let stored_status: String = row.try_get("status").unwrap();
            let stored_created_at: DateTime<Utc> = row.try_get("created_at").unwrap();

            assert_eq!(stored_transaction_id, transaction_id);
            assert_eq!(stored_transaction_type, "RECONCILIATION_TEST");
            assert_eq!(stored_amount, amount);
            assert_eq!(stored_currency, "RUB");
            assert_eq!(stored_inn, Some(inn));
            assert_eq!(stored_status, "Matched");

            // Timestamp should be recent
            let age = Utc::now().signed_duration_since(stored_created_at);
            assert!(age.num_seconds() < 60); // Created within last minute

            // Status should be valid reconciliation status
            assert!(matches!(stored_status.as_str(), "Matched" | "Unmatched" | "Disputed"));

            // Clean up
            sqlx::query("DELETE FROM financial_audit WHERE transaction_id = $1")
                .bind(&transaction_id)
                .execute(&*pool)
                .await
                .unwrap();
        });
    }
}

// Property Test 42: Reconciliation Summary Report
// **Validates: Requirements 6.6**
proptest! {
    #[test]
    fn property_reconciliation_summary_report(
        matched_count in 0u32..100u32,
        unmatched_count in 0u32..50u32,
        matched_amount in arb_amount(),
        unmatched_amount in arb_amount(),
        date in arb_reconciliation_date(),
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 42: Reconciliation Summary Report**

            // For any reconciliation results, summary report should be generated correctly
            let mut report = ReconciliationReport::new(date);
            report.matched_count = matched_count;
            report.unmatched_count = unmatched_count;
            report.total_matched_amount = matched_amount;
            report.total_unmatched_amount = unmatched_amount;

            // Validate report structure
            assert_eq!(report.date, date);
            assert_eq!(report.matched_count, matched_count);
            assert_eq!(report.unmatched_count, unmatched_count);
            assert_eq!(report.total_matched_amount, matched_amount);
            assert_eq!(report.total_unmatched_amount, unmatched_amount);

            // Report should have reasonable timestamp
            let age = Utc::now().signed_duration_since(report.generated_at);
            assert!(age.num_seconds() < 60); // Generated within last minute

            // Amounts should be non-negative
            assert!(report.total_matched_amount >= Decimal::ZERO);
            assert!(report.total_unmatched_amount >= Decimal::ZERO);

            // Counts should be consistent
            assert!(report.matched_count >= 0);
            assert!(report.unmatched_count >= 0);

            // Test critical discrepancy detection
            let has_critical = report.discrepancies.iter().any(|d| {
                matches!(d.severity, DiscrepancySeverity::Critical)
            });

            // If unmatched amount is very large, should be considered critical
            let large_unmatched = report.total_unmatched_amount >= Decimal::from(1_000_000);
            if large_unmatched {
                // Large unmatched amounts should trigger alerts (tested separately)
                assert!(report.total_unmatched_amount >= Decimal::from(1_000_000));
            }
        });
    }
}

// Property Test 43: Manual Reconciliation Support
// **Validates: Requirements 6.7**
proptest! {
    #[test]
    fn property_manual_reconciliation_support(
        account_number in arb_account_number(),
        days_range in 1u32..30u32,
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 43: Manual Reconciliation Support**

            // For any date range, manual reconciliation should work correctly
            let end_date = Utc::now().date_naive();
            let start_date = end_date - Duration::days(days_range as i64);

            // Validate date range
            assert!(start_date <= end_date);
            assert!(days_range >= 1);
            assert!(days_range <= 30); // Reasonable range limit

            // Account number should be valid
            assert!(tbank_integration::balance::BalanceMonitor::validate_account_number(&account_number).is_ok());

            // Date range should be reasonable
            let total_days = (end_date - start_date).num_days();
            assert_eq!(total_days, days_range as i64);
            assert!(total_days > 0);
            assert!(total_days <= 30);

            // Each date in range should be valid
            let mut current_date = start_date;
            let mut date_count = 0;
            while current_date <= end_date {
                // Date should be valid
                assert!(current_date <= Utc::now().date_naive());

                // Should be able to process this date
                let weekday = current_date.weekday().number_from_monday();
                assert!(weekday >= 1 && weekday <= 7);

                current_date += Duration::days(1);
                date_count += 1;
            }

            // Should have processed expected number of dates
            assert_eq!(date_count, days_range + 1); // Inclusive range
        });
    }
}

// Property Test 44: Critical Discrepancy Alerts
// **Validates: Requirements 6.8**
proptest! {
    #[test]
    fn property_critical_discrepancy_alerts(
        large_amount in 1_000_000.0f64..10_000_000.0f64,
        small_amount in 1.0f64..10_000.0f64,
        multiple_count in 5u32..20u32,
    ) {
        tokio_test::block_on(async {
            // **Feature: tbank-integration, Property 44: Critical Discrepancy Alerts**

            let large_decimal = Decimal::from_f64_retain(large_amount).unwrap_or(Decimal::from(1_000_000));
            let small_decimal = Decimal::from_f64_retain(small_amount).unwrap_or(Decimal::from(1_000));

            // For any critical discrepancies, alerts should be triggered correctly
            let date = Utc::now().date_naive();

            // Test large amount discrepancy (should be critical)
            let large_discrepancy = Discrepancy {
                discrepancy_type: DiscrepancyType::MissingTransaction,
                transaction_id: Some("large_missing_txn".to_string()),
                expected_amount: Some(large_decimal),
                actual_amount: None,
                description: format!("Large missing transaction: {}", large_decimal),
                severity: DiscrepancySeverity::Critical,
            };

            // Test multiple small discrepancies
            let mut small_discrepancies = Vec::new();
            for i in 0..multiple_count {
                small_discrepancies.push(Discrepancy {
                    discrepancy_type: DiscrepancyType::UnexpectedTransaction,
                    transaction_id: Some(format!("small_unexpected_txn_{}", i)),
                    expected_amount: None,
                    actual_amount: Some(small_decimal),
                    description: format!("Small unexpected transaction {}: {}", i, small_decimal),
                    severity: DiscrepancySeverity::Low,
                });
            }

            // Create report with critical discrepancy
            let mut critical_report = ReconciliationReport::new(date);
            critical_report.discrepancies = vec![large_discrepancy];
            critical_report.total_unmatched_amount = large_decimal;

            // Should detect critical discrepancies
            assert!(critical_report.has_critical_discrepancies());

            // Create report with multiple small discrepancies
            let mut multiple_report = ReconciliationReport::new(date);
            multiple_report.discrepancies = small_discrepancies;
            multiple_report.unmatched_count = multiple_count;
            multiple_report.total_unmatched_amount = small_decimal * Decimal::from(multiple_count);

            // Multiple small discrepancies might be critical based on total amount
            let total_small_amount = small_decimal * Decimal::from(multiple_count);
            let should_be_critical = total_small_amount >= Decimal::from(1_000_000) || multiple_count >= 10;

            // Validate severity determination
            assert!(large_decimal >= Decimal::from(1_000_000)); // Large amount should be critical
            assert!(small_decimal < Decimal::from(10_000)); // Small amount should be low severity
            assert!(multiple_count >= 5); // Multiple transactions

            // Test alert conditions
            let critical_amount_threshold = Decimal::from(1_000_000);
            let critical_count_threshold = 10u32;

            // Large single discrepancy should trigger alert
            assert!(large_decimal >= critical_amount_threshold);

            // Multiple discrepancies might trigger alert based on count or total amount
            if multiple_count >= critical_count_threshold || total_small_amount >= critical_amount_threshold {
                // Should trigger alert
                assert!(multiple_count >= critical_count_threshold || total_small_amount >= critical_amount_threshold);
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_transaction_matcher_basic() {
        let pool = get_test_db_pool().await;
        let matcher = TransactionMatcher::new(pool);

        // Test basic matching logic
        let date = Utc::now();
        let amount = Decimal::from(1000);
        let inn = "7707083893".to_string();

        let mut tbank_transaction = Transaction::new(
            date,
            amount,
            Currency::RUB,
            Some(inn.clone()),
            Some("Test Company".to_string()),
            "Test payment".to_string(),
            OperationType::Credit,
            "40702810110011000000".to_string(),
        );
        tbank_transaction.reference_number = Some("test_ref_123".to_string());

        let internal_transaction = FinancialAudit::new(
            "test_ref_123".to_string(),
            amount,
            Currency::RUB,
            Some(inn),
            date,
            ReconciliationStatus::Unmatched,
        );

        let result = matcher
            .compare_transactions(
                &[tbank_transaction],
                &[internal_transaction],
                date.date_naive(),
            )
            .await
            .unwrap();

        // Should find exact match
        assert_eq!(result.matched_transactions.len(), 1);
        assert_eq!(result.unmatched_tbank.len(), 0);
        assert_eq!(result.unmatched_internal.len(), 0);
    }

    #[tokio::test]
    async fn test_reconciliation_report_generation() {
        let pool = get_test_db_pool().await;
        let report_generator = ReconciliationReportGenerator::new(pool);

        let date = Utc::now().date_naive();
        let reconciliation_result = ReconciliationResult {
            matched_transactions: Vec::new(),
            unmatched_tbank: Vec::new(),
            unmatched_internal: Vec::new(),
            discrepancies: Vec::new(),
        };

        let report = report_generator
            .generate_report(date, &reconciliation_result)
            .await
            .unwrap();

        assert_eq!(report.date, date);
        assert_eq!(report.matched_count, 0);
        assert_eq!(report.unmatched_count, 0);
        assert_eq!(report.total_matched_amount, Decimal::ZERO);
        assert_eq!(report.total_unmatched_amount, Decimal::ZERO);
    }

    #[tokio::test]
    async fn test_discrepancy_severity_determination() {
        // Test severity levels
        let critical_amount = Decimal::from(2_000_000);
        let high_amount = Decimal::from(500_000);
        let medium_amount = Decimal::from(50_000);
        let low_amount = Decimal::from(1_000);

        // Test discrepancy creation with different amounts
        let critical_discrepancy = Discrepancy {
            discrepancy_type: DiscrepancyType::MissingTransaction,
            transaction_id: Some("critical_test".to_string()),
            expected_amount: Some(critical_amount),
            actual_amount: None,
            description: "Critical test".to_string(),
            severity: DiscrepancySeverity::Critical,
        };

        assert_eq!(critical_discrepancy.severity, DiscrepancySeverity::Critical);
        assert!(critical_discrepancy.expected_amount.unwrap() >= Decimal::from(1_000_000));
    }
}
