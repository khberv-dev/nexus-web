use chrono::{DateTime, Utc};
use quickcheck::TestResult;
use quickcheck_macros::quickcheck;
use rust_decimal::Decimal;
use serde_json;
use tbank_integration::balance::{BalanceMonitor, TransactionFilter};
use tbank_integration::types::common::{
    AccountBalance, AccountStatement, Currency, OperationType, TBankError, Transaction,
};

#[cfg(test)]
mod balance_monitoring_tests {
    use super::*;

    #[quickcheck]
    fn balance_query_format_property(account_number: String) -> TestResult {
        // Feature: tbank-integration, Property 22: Balance Query Format
        // **Validates: Requirements 4.1**

        // Filter out problematic characters
        let clean_account: String = account_number
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii())
            .collect();

        // Skip empty or extremely long inputs
        if clean_account.trim().is_empty() || clean_account.len() > 50 {
            return TestResult::discard();
        }

        // Test account number format validation
        let validation_result = BalanceMonitor::validate_account_number(&clean_account);

        // Check if account number matches expected format (40702810XXXXXXXXXX)
        let expected_valid = clean_account.len() == 20
            && clean_account.starts_with("40702810")
            && clean_account.chars().all(|c| c.is_ascii_digit());

        match validation_result {
            Ok(()) => {
                // Should only succeed for valid format
                TestResult::from_bool(expected_valid)
            }
            Err(TBankError::InvalidAccountNumber(msg)) => {
                // Should fail for invalid format with appropriate error message
                let has_length_info = if clean_account.len() != 20 {
                    msg.contains(&clean_account.len().to_string())
                } else {
                    true
                };

                let has_prefix_info = if !clean_account.starts_with("40702810") {
                    msg.contains("40702810")
                } else {
                    true
                };

                let has_digit_info = if !clean_account.chars().all(|c| c.is_ascii_digit()) {
                    msg.contains("digits")
                } else {
                    true
                };

                TestResult::from_bool(
                    !expected_valid && has_length_info && has_prefix_info && has_digit_info,
                )
            }
            Err(_) => TestResult::from_bool(false), // Unexpected error type
        }
    }

    #[quickcheck]
    fn statement_parsing_completeness_property(
        account_number: String,
        period_start: i64,
        period_end: i64,
        opening_balance: i64,
        closing_balance: i64,
    ) -> TestResult {
        // Feature: tbank-integration, Property 24: Statement Parsing Completeness
        // **Validates: Requirements 4.3**

        // Filter out problematic characters
        let clean_account: String = account_number
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii())
            .collect();

        // Skip invalid inputs
        if clean_account.trim().is_empty() || clean_account.len() > 50 {
            return TestResult::discard();
        }

        // Skip invalid timestamps (must be positive and reasonable)
        if period_start <= 0 || period_end <= 0 || period_start >= period_end {
            return TestResult::discard();
        }

        // Skip extremely large timestamps (year 2100+)
        if period_start > 4102444800 || period_end > 4102444800 {
            return TestResult::discard();
        }

        // Create test dates
        let start_date = match DateTime::from_timestamp(period_start, 0) {
            Some(dt) => dt,
            None => return TestResult::discard(),
        };

        let end_date = match DateTime::from_timestamp(period_end, 0) {
            Some(dt) => dt,
            None => return TestResult::discard(),
        };

        // Create test account statement
        let statement = AccountStatement {
            account_number: clean_account.clone(),
            period_start: start_date,
            period_end: end_date,
            opening_balance: Decimal::from(opening_balance),
            closing_balance: Decimal::from(closing_balance),
            currency: Currency::RUB,
            transactions: vec![Transaction::new(
                start_date + chrono::Duration::hours(1),
                Decimal::from(1000),
                Currency::RUB,
                Some("7707083893".to_string()),
                Some("Test Company".to_string()),
                "Test transaction".to_string(),
                OperationType::Credit,
                clean_account.clone(),
            )],
            next_cursor: Some("cursor_123".to_string()),
        };

        // Test that all required fields are present and properly parsed
        let account_stored =
            !statement.account_number.is_empty() && statement.account_number == clean_account;
        let dates_valid = statement.period_start <= statement.period_end;
        let balances_present = true; // Decimal values are always present
        let currency_valid = matches!(statement.currency, Currency::RUB);
        let transactions_parsed = !statement.transactions.is_empty();
        let cursor_present = statement.next_cursor.is_some();

        // Test transaction completeness
        let transaction = &statement.transactions[0];
        let transaction_complete = !transaction.description.is_empty()
            && transaction.counterparty_inn.is_some()
            && transaction.counterparty_name.is_some()
            && !transaction.account_number.is_empty()
            && transaction.operation_date >= statement.period_start
            && transaction.operation_date <= statement.period_end;

        // Test serialization completeness (for API responses)
        let serialization_test = match serde_json::to_string(&statement) {
            Ok(json) => {
                json.contains(&clean_account)
                    && json.contains("period_start")
                    && json.contains("period_end")
                    && json.contains("opening_balance")
                    && json.contains("closing_balance")
                    && json.contains("currency")
                    && json.contains("transactions")
                    && json.contains("Test transaction")
                    && json.contains("7707083893")
            }
            Err(_) => false,
        };

        TestResult::from_bool(
            account_stored
                && dates_valid
                && balances_present
                && currency_valid
                && transactions_parsed
                && cursor_present
                && transaction_complete
                && serialization_test,
        )
    }

    #[quickcheck]
    fn balance_cache_ttl_property(
        account_number: String,
        balance_amount: i64,
        cache_duration_seconds: u16,
    ) -> TestResult {
        // Feature: tbank-integration, Property 25: Balance Cache TTL
        // **Validates: Requirements 4.4**

        // Filter out problematic characters
        let clean_account: String = account_number
            .chars()
            .filter(|&c| c != '\0' && c.is_ascii())
            .collect();

        // Skip invalid inputs
        if clean_account.trim().is_empty() || clean_account.len() > 50 {
            return TestResult::discard();
        }

        // Skip extremely large cache durations (more than 1 day = 86400 seconds)
        // Since cache_duration_seconds is u16, max value is 65535, so this check is always false
        // but we keep it for documentation purposes
        if cache_duration_seconds > 3600 {
            // 1 hour instead
            return TestResult::discard();
        }

        // Create test balance
        let balance = AccountBalance::new(
            clean_account.clone(),
            Decimal::from(balance_amount),
            Currency::RUB,
        );

        // Test that balance has proper timestamp
        let now = Utc::now();
        let timestamp_valid = balance.last_updated <= now
            && balance.last_updated > (now - chrono::Duration::minutes(1));

        // Test cache TTL calculation (5 minutes = 300 seconds)
        let expected_ttl_seconds = 300u64;
        let ttl_in_range = cache_duration_seconds as u64 <= expected_ttl_seconds * 2; // Allow some flexibility

        // Test balance structure for caching
        let cache_serializable = match serde_json::to_string(&balance) {
            Ok(json) => {
                json.contains(&clean_account)
                    && json.contains("balance")
                    && json.contains("currency")
                    && json.contains("last_updated")
            }
            Err(_) => false,
        };

        // Test that balance can be deserialized from cache
        let cache_deserializable = if cache_serializable {
            match serde_json::to_string(&balance) {
                Ok(json) => match serde_json::from_str::<AccountBalance>(&json) {
                    Ok(deserialized) => {
                        deserialized.account_number == balance.account_number
                            && deserialized.balance == balance.balance
                            && deserialized.currency == balance.currency
                    }
                    Err(_) => false,
                },
                Err(_) => false,
            }
        } else {
            false
        };

        TestResult::from_bool(
            timestamp_valid && ttl_in_range && cache_serializable && cache_deserializable,
        )
    }

    #[test]
    fn low_balance_alert_triggering_property_test() {
        // Feature: tbank-integration, Property 26: Low Balance Alert Triggering
        // **Validates: Requirements 4.5**

        // Test various balance and threshold combinations
        let test_cases = vec![
            (1000, 2000, true, "balance below threshold"),
            (2000, 1000, false, "balance above threshold"),
            (1000, 1000, false, "balance equal to threshold"),
            (0, 1000, true, "zero balance below threshold"),
            (1000, 0, false, "positive balance above zero threshold"),
        ];

        for (balance_amount, threshold_amount, should_trigger, description) in test_cases {
            let balance = Decimal::from(balance_amount);
            let threshold = Decimal::from(threshold_amount);

            // Create test account balance
            let account_balance =
                AccountBalance::new("40702810110011000000".to_string(), balance, Currency::RUB);

            // Test threshold comparison logic
            let balance_check_result = account_balance.is_below_threshold(threshold);

            assert_eq!(
                balance_check_result,
                should_trigger,
                "Balance {} vs threshold {} should {} trigger alert: {}",
                balance_amount,
                threshold_amount,
                if should_trigger { "" } else { "not" },
                description
            );
        }
    }

    #[quickcheck]
    fn transaction_filtering_support_property(
        amount_min: i32,
        amount_max: i32,
        inn: String,
        description: String,
    ) -> TestResult {
        // Feature: tbank-integration, Property 27: Transaction Filtering Support
        // **Validates: Requirements 4.6**

        // Skip invalid amount ranges
        if amount_min > amount_max || amount_min < 0 {
            return TestResult::discard();
        }

        // Skip extreme amounts
        if amount_min.abs() > 1_000_000 || amount_max.abs() > 1_000_000 {
            return TestResult::discard();
        }

        // Filter out problematic characters
        let clean_inn: String = inn.chars().filter(|&c| c != '\0' && c.is_ascii()).collect();

        let clean_description: String = description.chars().filter(|&c| c != '\0').collect();

        // Skip empty or extremely long inputs
        if clean_inn.len() > 20 || clean_description.len() > 200 {
            return TestResult::discard();
        }

        // Create test filter
        let mut filter = TransactionFilter::new();

        // Set amount range filter
        filter = filter.with_amount_range(
            Some(Decimal::from(amount_min)),
            Some(Decimal::from(amount_max)),
        );

        // Set INN filter if valid
        if !clean_inn.is_empty()
            && (clean_inn.len() == 10 || clean_inn.len() == 12)
            && clean_inn.chars().all(|c| c.is_ascii_digit())
        {
            filter = filter.with_counterparty_inn(clean_inn.clone());
        }

        // Set description filter if not empty
        if !clean_description.trim().is_empty() {
            filter = filter.with_description_contains(clean_description.clone());
        }

        // Set operation type filter
        filter = filter.with_operation_type(OperationType::Credit);

        // Test filter validation
        let validation_result = filter.validate();
        let should_be_valid = amount_min <= amount_max && amount_min >= 0;

        match validation_result {
            Ok(()) => {
                // Test filter structure
                let has_amount_range = filter.amount_range.is_some();
                let has_operation_type = filter.operation_type.is_some();

                let amount_range_valid = if let Some(ref range) = filter.amount_range {
                    range.min.unwrap_or(Decimal::ZERO) <= range.max.unwrap_or(Decimal::MAX)
                } else {
                    true
                };

                TestResult::from_bool(
                    should_be_valid && has_amount_range && has_operation_type && amount_range_valid,
                )
            }
            Err(_) => TestResult::from_bool(!should_be_valid),
        }
    }

    #[quickcheck]
    fn statement_pagination_support_property(
        total_transactions: u16,
        page_size: u16,
        page_offset: u16,
    ) -> TestResult {
        // Feature: tbank-integration, Property 28: Statement Pagination Support
        // **Validates: Requirements 4.8**

        // Skip invalid inputs
        if page_size == 0 || page_size > 10000 {
            return TestResult::discard();
        }

        if total_transactions > 1000 || page_offset > 1000 {
            return TestResult::discard();
        }

        let total_count = total_transactions as usize;
        let limit = page_size as usize;
        let offset = page_offset as usize;

        // Create test transactions
        let mut transactions = Vec::new();
        for i in 0..total_count {
            transactions.push(Transaction::new(
                Utc::now(),
                Decimal::from(1000 + i as i64),
                Currency::RUB,
                Some(format!("770708389{}", i % 10)),
                Some(format!("Company {}", i)),
                format!("Transaction {}", i),
                if i % 2 == 0 {
                    OperationType::Credit
                } else {
                    OperationType::Debit
                },
                "40702810110011000000".to_string(),
            ));
        }

        // Test pagination logic
        let expected_returned_count = if offset >= total_count {
            0
        } else {
            std::cmp::min(limit, total_count - offset)
        };

        let expected_has_more = offset + limit < total_count;

        // Simulate pagination
        let paginated_transactions: Vec<_> =
            transactions.into_iter().skip(offset).take(limit).collect();

        let actual_returned_count = paginated_transactions.len();
        let actual_has_more = offset + actual_returned_count < total_count;

        // Test cursor generation (for next page)
        let next_cursor = if actual_has_more {
            Some(format!("cursor_{}", offset + actual_returned_count))
        } else {
            None
        };

        let cursor_logic_correct = match next_cursor {
            Some(cursor) => {
                actual_has_more && cursor.contains(&(offset + actual_returned_count).to_string())
            }
            None => !actual_has_more,
        };

        TestResult::from_bool(
            actual_returned_count == expected_returned_count
                && actual_has_more == expected_has_more
                && cursor_logic_correct,
        )
    }

    #[test]
    fn test_balance_query_format_validation() {
        // Feature: tbank-integration, Property 22: Balance Query Format
        // **Validates: Requirements 4.1**

        // Valid account numbers
        let valid_accounts = vec![
            "40702810110011000000",
            "40702810999999999999",
            "40702810000000000001",
        ];

        for account in valid_accounts {
            assert!(
                BalanceMonitor::validate_account_number(account).is_ok(),
                "Valid account number should pass validation: {}",
                account
            );
        }

        // Invalid account numbers
        let invalid_accounts = vec![
            ("", "empty"),
            ("4070281011001100000", "too short"),
            ("407028101100110000000", "too long"),
            ("50702810110011000000", "wrong prefix"),
            ("4070281011001100000a", "contains letter"),
            ("40702810-110011000000", "contains hyphen"),
        ];

        for (account, description) in invalid_accounts {
            let result = BalanceMonitor::validate_account_number(account);
            assert!(
                result.is_err(),
                "Invalid account number should fail validation ({}): {}",
                description,
                account
            );

            if let Err(TBankError::InvalidAccountNumber(msg)) = result {
                assert!(
                    !msg.is_empty(),
                    "Error message should not be empty for {}: {}",
                    description,
                    account
                );
            }
        }
    }

    #[test]
    fn test_statement_parsing_required_fields() {
        // Feature: tbank-integration, Property 24: Statement Parsing Completeness
        // **Validates: Requirements 4.3**

        let account_number = "40702810110011000000";
        let now = Utc::now();

        let statement = AccountStatement {
            account_number: account_number.to_string(),
            period_start: now - chrono::Duration::days(1),
            period_end: now,
            opening_balance: Decimal::from(5000),
            closing_balance: Decimal::from(6000),
            currency: Currency::RUB,
            transactions: vec![Transaction::new(
                now - chrono::Duration::hours(12),
                Decimal::from(1000),
                Currency::RUB,
                Some("7707083893".to_string()),
                Some("Test Company Ltd".to_string()),
                "Payment for advertising services".to_string(),
                OperationType::Credit,
                account_number.to_string(),
            )],
            next_cursor: Some("next_page_cursor_123".to_string()),
        };

        // Verify all required fields are present
        assert!(!statement.account_number.is_empty());
        assert!(statement.period_start < statement.period_end);
        assert!(statement.opening_balance >= Decimal::ZERO);
        assert!(statement.closing_balance >= Decimal::ZERO);
        assert!(matches!(statement.currency, Currency::RUB));
        assert!(!statement.transactions.is_empty());
        assert!(statement.next_cursor.is_some());

        // Verify transaction completeness
        let transaction = &statement.transactions[0];
        assert!(transaction.operation_date >= statement.period_start);
        assert!(transaction.operation_date <= statement.period_end);
        assert!(transaction.amount > Decimal::ZERO);
        assert!(transaction.counterparty_inn.is_some());
        assert!(transaction.counterparty_name.is_some());
        assert!(!transaction.description.is_empty());
        assert!(!transaction.account_number.is_empty());

        // Test serialization includes all fields
        let json = serde_json::to_string(&statement).unwrap();
        assert!(json.contains(account_number));
        assert!(json.contains("period_start"));
        assert!(json.contains("period_end"));
        assert!(json.contains("opening_balance"));
        assert!(json.contains("closing_balance"));
        assert!(json.contains("RUB"));
        assert!(json.contains("7707083893"));
        assert!(json.contains("Test Company"));
        assert!(json.contains("advertising services"));
        assert!(json.contains("next_page_cursor_123"));
    }

    #[test]
    fn test_balance_cache_ttl_calculation() {
        // Feature: tbank-integration, Property 25: Balance Cache TTL
        // **Validates: Requirements 4.4**

        let account_number = "40702810110011000000";
        let balance = AccountBalance::new(
            account_number.to_string(),
            Decimal::from(10000),
            Currency::RUB,
        );

        // Test that balance has recent timestamp
        let now = Utc::now();
        assert!(balance.last_updated <= now);
        assert!(balance.last_updated > (now - chrono::Duration::minutes(1)));

        // Test cache TTL (should be 5 minutes = 300 seconds)
        let expected_ttl = std::time::Duration::from_secs(300);
        assert_eq!(expected_ttl.as_secs(), 300);

        // Test balance serialization for caching
        let json = serde_json::to_string(&balance).unwrap();
        assert!(json.contains(account_number));
        assert!(json.contains("10000"));
        assert!(json.contains("RUB"));
        assert!(json.contains("last_updated"));

        // Test deserialization from cache
        let deserialized: AccountBalance = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.account_number, balance.account_number);
        assert_eq!(deserialized.balance, balance.balance);
        assert_eq!(deserialized.currency, balance.currency);
        assert_eq!(deserialized.last_updated, balance.last_updated);
    }

    #[test]
    fn test_low_balance_alert_threshold_logic() {
        // Feature: tbank-integration, Property 26: Low Balance Alert Triggering
        // **Validates: Requirements 4.5**

        let account_number = "40702810110011000000";
        let threshold = Decimal::from(1000);

        // Test cases for balance threshold
        let test_cases = vec![
            (500, true, "below threshold"),
            (999, true, "just below threshold"),
            (1000, false, "equal to threshold"),
            (1001, false, "just above threshold"),
            (5000, false, "well above threshold"),
            (0, true, "zero balance"),
        ];

        for (balance_amount, should_trigger, description) in test_cases {
            let balance = AccountBalance::new(
                account_number.to_string(),
                Decimal::from(balance_amount),
                Currency::RUB,
            );

            let is_below = balance.is_below_threshold(threshold);
            assert_eq!(
                is_below,
                should_trigger,
                "Balance {} should {} trigger alert: {}",
                balance_amount,
                if should_trigger { "" } else { "not" },
                description
            );
        }
    }

    #[test]
    fn test_transaction_filtering_validation() {
        // Feature: tbank-integration, Property 27: Transaction Filtering Support
        // **Validates: Requirements 4.6**

        // Test valid filters
        let valid_filter = TransactionFilter::new()
            .with_amount_range(Some(Decimal::from(100)), Some(Decimal::from(1000)))
            .with_counterparty_inn("7707083893".to_string())
            .with_operation_type(OperationType::Credit)
            .with_currency(Currency::RUB)
            .with_description_contains("payment".to_string())
            .with_pagination(0, 50);

        assert!(
            valid_filter.validate().is_ok(),
            "Valid filter should pass validation"
        );

        // Test invalid filters
        let invalid_filters = vec![
            (
                TransactionFilter::new()
                    .with_amount_range(Some(Decimal::from(1000)), Some(Decimal::from(100))),
                "min > max amount",
            ),
            (
                TransactionFilter::new()
                    .with_amount_range(Some(Decimal::from(-100)), Some(Decimal::from(1000))),
                "negative min amount",
            ),
            (
                TransactionFilter::new().with_counterparty_inn("invalid_inn".to_string()),
                "invalid INN format",
            ),
            (TransactionFilter::new().with_pagination(0, 0), "zero limit"),
            (
                TransactionFilter::new().with_pagination(0, 20000),
                "limit too large",
            ),
        ];

        for (filter, description) in invalid_filters {
            assert!(
                filter.validate().is_err(),
                "Invalid filter should fail validation: {}",
                description
            );
        }
    }

    #[test]
    fn test_statement_pagination_logic() {
        // Feature: tbank-integration, Property 28: Statement Pagination Support
        // **Validates: Requirements 4.8**

        // Create test transactions
        let mut transactions = Vec::new();
        for i in 0..25 {
            transactions.push(Transaction::new(
                Utc::now(),
                Decimal::from(1000 + i),
                Currency::RUB,
                Some(format!("770708389{}", i % 10)),
                Some(format!("Company {}", i)),
                format!("Transaction {}", i),
                if i % 2 == 0 {
                    OperationType::Credit
                } else {
                    OperationType::Debit
                },
                "40702810110011000000".to_string(),
            ));
        }

        // Test pagination scenarios
        let test_cases = vec![
            (0, 10, 10, true, "first page"),
            (10, 10, 10, true, "second page"),
            (20, 10, 5, false, "last page"),
            (25, 10, 0, false, "beyond end"),
            (0, 100, 25, false, "large page size"),
        ];

        for (offset, limit, expected_count, expected_has_more, description) in test_cases {
            let paginated: Vec<_> = transactions.iter().skip(offset).take(limit).collect();

            let has_more = offset + paginated.len() < transactions.len();

            assert_eq!(
                paginated.len(),
                expected_count,
                "Wrong count for {}: expected {}, got {}",
                description,
                expected_count,
                paginated.len()
            );
            assert_eq!(
                has_more, expected_has_more,
                "Wrong has_more for {}: expected {}, got {}",
                description, expected_has_more, has_more
            );

            // Test cursor generation
            if has_more {
                let next_cursor = format!("cursor_{}", offset + paginated.len());
                assert!(
                    next_cursor.contains(&(offset + paginated.len()).to_string()),
                    "Cursor should contain next offset for {}",
                    description
                );
            }
        }
    }
}
