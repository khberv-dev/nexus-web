use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value;
use std::str::FromStr;
use tracing::{debug, error, warn};
use uuid::Uuid;

use crate::types::{Currency, OperationType, TBankError, TBankResult, Transaction};

/// Parse transactions from T-Bank statement response
pub fn parse_transactions(
    transactions_array: &[Value],
    account_number: &str,
) -> TBankResult<Vec<Transaction>> {
    debug!(
        transaction_count = transactions_array.len(),
        account_number = account_number,
        "Parsing transactions from statement"
    );

    let mut transactions = Vec::new();

    for (index, transaction_data) in transactions_array.iter().enumerate() {
        match parse_single_transaction(transaction_data, account_number) {
            Ok(transaction) => {
                transactions.push(transaction);
            }
            Err(e) => {
                warn!(
                    error = %e,
                    index = index,
                    account_number = account_number,
                    "Failed to parse transaction, skipping"
                );
                // Continue parsing other transactions instead of failing completely
                continue;
            }
        }
    }

    debug!(
        parsed_count = transactions.len(),
        total_count = transactions_array.len(),
        account_number = account_number,
        "Completed parsing transactions"
    );

    Ok(transactions)
}

/// Parse a single transaction from T-Bank API response
pub fn parse_single_transaction(
    transaction_data: &Value,
    account_number: &str,
) -> TBankResult<Transaction> {
    // Parse operation date
    let operation_date_str = transaction_data
        .get("operationDate")
        .or_else(|| transaction_data.get("date"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| TBankError::ParseError("Missing operationDate field".to_string()))?;

    let operation_date = DateTime::parse_from_rfc3339(operation_date_str)
        .or_else(|_| {
            // Try parsing as date only and add time
            let date_only = format!("{}T00:00:00Z", operation_date_str);
            DateTime::parse_from_rfc3339(&date_only)
        })
        .map_err(|e| TBankError::ParseError(format!("Invalid operationDate format: {}", e)))?
        .with_timezone(&Utc);

    // Parse amount
    let amount_str = transaction_data
        .get("amount")
        .and_then(|v| v.as_str())
        .or_else(|| transaction_data.get("sum").and_then(|v| v.as_str()))
        .ok_or_else(|| TBankError::ParseError("Missing amount field".to_string()))?;

    let amount = amount_str
        .parse::<Decimal>()
        .map_err(|e| TBankError::ParseError(format!("Invalid amount format: {}", e)))?;

    // Parse currency
    let currency_str = transaction_data
        .get("currency")
        .and_then(|v| v.as_str())
        .unwrap_or("RUB");

    let currency = currency_str
        .parse::<Currency>()
        .map_err(|e| TBankError::InvalidCurrency(e))?;

    // Parse counterparty information
    let counterparty_inn = transaction_data
        .get("counterpartyInn")
        .or_else(|| transaction_data.get("inn"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let counterparty_name = transaction_data
        .get("counterpartyName")
        .or_else(|| transaction_data.get("counterparty"))
        .or_else(|| transaction_data.get("name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Parse description
    let description = transaction_data
        .get("description")
        .or_else(|| transaction_data.get("purpose"))
        .or_else(|| transaction_data.get("paymentPurpose"))
        .and_then(|v| v.as_str())
        .unwrap_or("No description")
        .to_string();

    // Parse operation type
    let operation_type = parse_operation_type(transaction_data, &amount)?;

    // Parse reference number
    let reference_number = transaction_data
        .get("referenceNumber")
        .or_else(|| transaction_data.get("documentNumber"))
        .or_else(|| transaction_data.get("transactionId"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let transaction = Transaction {
        id: Some(Uuid::new_v4()), // Generate UUID for internal tracking
        operation_date,
        amount,
        currency,
        counterparty_inn,
        counterparty_name,
        description,
        operation_type,
        account_number: account_number.to_string(),
        reference_number,
        created_at: Some(Utc::now()),
    };

    debug!(
        operation_date = %transaction.operation_date,
        amount = %transaction.amount,
        operation_type = %transaction.operation_type,
        counterparty_inn = ?transaction.counterparty_inn,
        "Parsed transaction successfully"
    );

    Ok(transaction)
}

/// Parse operation type from transaction data
fn parse_operation_type(transaction_data: &Value, amount: &Decimal) -> TBankResult<OperationType> {
    // Check explicit operation type field
    if let Some(op_type_str) = transaction_data
        .get("operationType")
        .or_else(|| transaction_data.get("type"))
        .and_then(|v| v.as_str())
    {
        return match op_type_str.to_lowercase().as_str() {
            "credit" | "incoming" | "receipt" | "поступление" => {
                Ok(OperationType::Credit)
            }
            "debit" | "outgoing" | "payment" | "списание" => Ok(OperationType::Debit),
            _ => {
                warn!(
                    operation_type = op_type_str,
                    "Unknown operation type, falling back to amount-based detection"
                );
                Ok(if amount.is_sign_positive() {
                    OperationType::Credit
                } else {
                    OperationType::Debit
                })
            }
        };
    }

    // Check debit/credit indicator
    if let Some(dc_indicator) = transaction_data
        .get("debitCreditIndicator")
        .or_else(|| transaction_data.get("dcIndicator"))
        .and_then(|v| v.as_str())
    {
        return match dc_indicator.to_uppercase().as_str() {
            "C" | "CREDIT" => Ok(OperationType::Credit),
            "D" | "DEBIT" => Ok(OperationType::Debit),
            _ => Ok(if amount.is_sign_positive() {
                OperationType::Credit
            } else {
                OperationType::Debit
            }),
        };
    }

    // Fall back to amount sign
    Ok(if amount.is_sign_positive() {
        OperationType::Credit
    } else {
        OperationType::Debit
    })
}

/// Parse pagination cursor from statement response
pub fn parse_pagination_cursor(response: &Value) -> Option<String> {
    response
        .get("nextCursor")
        .or_else(|| response.get("cursor"))
        .or_else(|| response.get("pagination"))
        .and_then(|v| {
            if v.is_string() {
                v.as_str().map(|s| s.to_string())
            } else {
                v.get("nextCursor")
                    .or_else(|| v.get("next"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            }
        })
}

/// Validate transaction data completeness
pub fn validate_transaction_data(transaction: &Transaction) -> TBankResult<()> {
    if transaction.amount.is_zero() {
        return Err(TBankError::ValidationError(
            "Transaction amount cannot be zero".to_string(),
        ));
    }

    if transaction.description.trim().is_empty() {
        return Err(TBankError::ValidationError(
            "Transaction description cannot be empty".to_string(),
        ));
    }

    if transaction.account_number.is_empty() {
        return Err(TBankError::ValidationError(
            "Transaction account number cannot be empty".to_string(),
        ));
    }

    // Validate INN format if present
    if let Some(ref inn) = transaction.counterparty_inn {
        if !inn.is_empty() && !is_valid_inn_format(inn) {
            return Err(TBankError::InvalidInn(inn.clone()));
        }
    }

    Ok(())
}

/// Validate INN format (10 or 12 digits)
fn is_valid_inn_format(inn: &str) -> bool {
    (inn.len() == 10 || inn.len() == 12) && inn.chars().all(|c| c.is_ascii_digit())
}

/// Extract transaction summary from parsed transactions
pub fn extract_transaction_summary(transactions: &[Transaction]) -> TransactionSummary {
    let mut credit_count = 0;
    let mut debit_count = 0;
    let mut total_credit_amount = Decimal::ZERO;
    let mut total_debit_amount = Decimal::ZERO;

    for transaction in transactions {
        match transaction.operation_type {
            OperationType::Credit => {
                credit_count += 1;
                total_credit_amount += transaction.amount.abs();
            }
            OperationType::Debit => {
                debit_count += 1;
                total_debit_amount += transaction.amount.abs();
            }
        }
    }

    TransactionSummary {
        total_count: transactions.len(),
        credit_count,
        debit_count,
        total_credit_amount,
        total_debit_amount,
        net_amount: total_credit_amount - total_debit_amount,
    }
}

/// Summary of parsed transactions
#[derive(Debug, Clone)]
pub struct TransactionSummary {
    pub total_count: usize,
    pub credit_count: usize,
    pub debit_count: usize,
    pub total_credit_amount: Decimal,
    pub total_debit_amount: Decimal,
    pub net_amount: Decimal,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_single_transaction() {
        let transaction_data = json!({
            "operationDate": "2024-01-15T10:30:00Z",
            "amount": "1000.50",
            "currency": "RUB",
            "counterpartyInn": "7707083893",
            "counterpartyName": "Test Company",
            "description": "Payment for services",
            "operationType": "credit",
            "referenceNumber": "TXN123456"
        });

        let result = parse_single_transaction(&transaction_data, "40702810110011000000");
        assert!(result.is_ok());

        let transaction = result.unwrap();
        assert_eq!(transaction.amount, Decimal::from_str("1000.50").unwrap());
        assert_eq!(transaction.currency, Currency::RUB);
        assert_eq!(transaction.counterparty_inn, Some("7707083893".to_string()));
        assert_eq!(transaction.operation_type, OperationType::Credit);
    }

    #[test]
    fn test_parse_operation_type() {
        let credit_data = json!({"operationType": "credit", "amount": "1000"});
        let amount = Decimal::from(1000);
        assert_eq!(
            parse_operation_type(&credit_data, &amount).unwrap(),
            OperationType::Credit
        );

        let debit_data = json!({"operationType": "debit", "amount": "-500"});
        let amount = Decimal::from(-500);
        assert_eq!(
            parse_operation_type(&debit_data, &amount).unwrap(),
            OperationType::Debit
        );
    }

    #[test]
    fn test_validate_transaction_data() {
        let valid_transaction = Transaction::new(
            Utc::now(),
            Decimal::from(1000),
            Currency::RUB,
            Some("7707083893".to_string()),
            Some("Test Company".to_string()),
            "Payment for services".to_string(),
            OperationType::Credit,
            "40702810110011000000".to_string(),
        );

        assert!(validate_transaction_data(&valid_transaction).is_ok());

        let invalid_transaction = Transaction::new(
            Utc::now(),
            Decimal::ZERO,
            Currency::RUB,
            None,
            None,
            "".to_string(),
            OperationType::Credit,
            "".to_string(),
        );

        assert!(validate_transaction_data(&invalid_transaction).is_err());
    }

    #[test]
    fn test_inn_validation() {
        assert!(is_valid_inn_format("7707083893")); // 10 digits
        assert!(is_valid_inn_format("770708389312")); // 12 digits
        assert!(!is_valid_inn_format("77070838")); // 8 digits
        assert!(!is_valid_inn_format("770708389a")); // contains letter
    }

    #[test]
    fn test_transaction_summary() {
        let transactions = vec![
            Transaction::new(
                Utc::now(),
                Decimal::from(1000),
                Currency::RUB,
                None,
                None,
                "Credit".to_string(),
                OperationType::Credit,
                "40702810110011000000".to_string(),
            ),
            Transaction::new(
                Utc::now(),
                Decimal::from(-500),
                Currency::RUB,
                None,
                None,
                "Debit".to_string(),
                OperationType::Debit,
                "40702810110011000000".to_string(),
            ),
        ];

        let summary = extract_transaction_summary(&transactions);
        assert_eq!(summary.total_count, 2);
        assert_eq!(summary.credit_count, 1);
        assert_eq!(summary.debit_count, 1);
        assert_eq!(summary.total_credit_amount, Decimal::from(1000));
        assert_eq!(summary.total_debit_amount, Decimal::from(500));
        assert_eq!(summary.net_amount, Decimal::from(500));
    }
}
