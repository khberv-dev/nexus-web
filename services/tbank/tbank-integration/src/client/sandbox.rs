use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, warn};

use crate::client::{ApiType, TBankClient};
use crate::types::{TBankError, TBankResult};

/// Predefined sandbox test data for counterparties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxCounterparty {
    pub inn: String,
    pub kpp: Option<String>,
    pub full_name: String,
    pub short_name: String,
    pub legal_address: String,
    pub status: String,
    pub registration_date: DateTime<Utc>,
    pub okved_codes: Vec<String>,
}

/// Predefined sandbox test data for account statements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxTransaction {
    pub operation_date: DateTime<Utc>,
    pub amount: Decimal,
    pub currency: String,
    pub counterparty_inn: Option<String>,
    pub counterparty_name: Option<String>,
    pub description: String,
    pub operation_type: String,
}

/// Sandbox client with predefined test data
impl TBankClient {
    /// Get predefined sandbox counterparty data
    pub fn get_sandbox_counterparty(&self, inn: &str) -> TBankResult<Option<SandboxCounterparty>> {
        if !self.is_sandbox() {
            return Err(TBankError::SandboxOperationInProduction);
        }

        debug!(inn = inn, "Getting sandbox counterparty data");

        let counterparty = match inn {
            "7707083893" => Some(SandboxCounterparty {
                inn: "7707083893".to_string(),
                kpp: Some("770701001".to_string()),
                full_name: "Общество с ограниченной ответственностью \"Тестовая компания\""
                    .to_string(),
                short_name: "ООО \"Тестовая компания\"".to_string(),
                legal_address: "123456, г. Москва, ул. Тестовая, д. 1".to_string(),
                status: "ACTIVE".to_string(),
                registration_date: DateTime::parse_from_rfc3339("2020-01-15T00:00:00Z")
                    .unwrap()
                    .with_timezone(&Utc),
                okved_codes: vec!["62.01".to_string(), "62.02".to_string()],
            }),
            "1234567890" => Some(SandboxCounterparty {
                inn: "1234567890".to_string(),
                kpp: Some("123456789".to_string()),
                full_name: "Акционерное общество \"Демо Организация\"".to_string(),
                short_name: "АО \"Демо Организация\"".to_string(),
                legal_address: "654321, г. Санкт-Петербург, пр. Демонстрационный, д. 42"
                    .to_string(),
                status: "ACTIVE".to_string(),
                registration_date: DateTime::parse_from_rfc3339("2019-06-10T00:00:00Z")
                    .unwrap()
                    .with_timezone(&Utc),
                okved_codes: vec!["73.11".to_string(), "73.20".to_string()],
            }),
            "9999999999" => {
                // This INN should return an error for testing error handling
                return Err(TBankError::CounterpartyNotFound {
                    inn: inn.to_string(),
                });
            }
            _ => None,
        };

        Ok(counterparty)
    }

    /// Get predefined sandbox account balance
    pub fn get_sandbox_balance(&self, account_number: &str) -> TBankResult<Decimal> {
        if !self.is_sandbox() {
            return Err(TBankError::SandboxOperationInProduction);
        }

        debug!(account_number = account_number, "Getting sandbox balance");

        match account_number {
            "40702810110011000000" => Ok(Decimal::new(1500000, 2)), // 15,000.00 RUB
            "40702810110011000001" => Ok(Decimal::new(250000, 2)),  // 2,500.00 RUB
            "40702810110011000002" => Ok(Decimal::new(0, 2)),       // 0.00 RUB
            _ => Err(TBankError::BalanceQueryFailed {
                account_number: account_number.to_string(),
                reason: "Account not found in sandbox".to_string(),
            }),
        }
    }

    /// Get predefined sandbox transaction history
    pub fn get_sandbox_statement(
        &self,
        account_number: &str,
    ) -> TBankResult<Vec<SandboxTransaction>> {
        if !self.is_sandbox() {
            return Err(TBankError::SandboxOperationInProduction);
        }

        debug!(account_number = account_number, "Getting sandbox statement");

        let transactions = match account_number {
            "40702810110011000000" => vec![
                SandboxTransaction {
                    operation_date: Utc::now() - chrono::Duration::days(1),
                    amount: Decimal::new(50000, 2), // 500.00 RUB
                    currency: "RUB".to_string(),
                    counterparty_inn: Some("7707083893".to_string()),
                    counterparty_name: Some("ООО \"Тестовая компания\"".to_string()),
                    description: "Оплата по договору №123".to_string(),
                    operation_type: "Credit".to_string(),
                },
                SandboxTransaction {
                    operation_date: Utc::now() - chrono::Duration::days(2),
                    amount: Decimal::new(-25000, 2), // -250.00 RUB
                    currency: "RUB".to_string(),
                    counterparty_inn: Some("1234567890".to_string()),
                    counterparty_name: Some("АО \"Демо Организация\"".to_string()),
                    description: "Комиссия за обслуживание".to_string(),
                    operation_type: "Debit".to_string(),
                },
                SandboxTransaction {
                    operation_date: Utc::now() - chrono::Duration::days(3),
                    amount: Decimal::new(100000, 2), // 1,000.00 RUB
                    currency: "RUB".to_string(),
                    counterparty_inn: Some("7707083893".to_string()),
                    counterparty_name: Some("ООО \"Тестовая компания\"".to_string()),
                    description: "Поступление средств".to_string(),
                    operation_type: "Credit".to_string(),
                },
            ],
            "40702810110011000001" => vec![SandboxTransaction {
                operation_date: Utc::now() - chrono::Duration::hours(6),
                amount: Decimal::new(75000, 2), // 750.00 RUB
                currency: "RUB".to_string(),
                counterparty_inn: None,
                counterparty_name: Some("Банковский перевод".to_string()),
                description: "Пополнение счета".to_string(),
                operation_type: "Credit".to_string(),
            }],
            "40702810110011000002" => vec![], // Empty account
            _ => {
                return Err(TBankError::StatementRetrievalFailed {
                    account_number: account_number.to_string(),
                    reason: "Account not found in sandbox".to_string(),
                });
            }
        };

        Ok(transactions)
    }

    /// Get sandbox payment status for testing
    pub fn get_sandbox_payment_status(&self, transaction_id: &str) -> TBankResult<String> {
        if !self.is_sandbox() {
            return Err(TBankError::SandboxOperationInProduction);
        }

        debug!(
            transaction_id = transaction_id,
            "Getting sandbox payment status"
        );

        let status = match transaction_id {
            id if id.starts_with("success_") => "Completed",
            id if id.starts_with("failed_") => "Failed",
            id if id.starts_with("pending_") => "Pending",
            id if id.starts_with("cancelled_") => "Cancelled",
            _ => "Initialized",
        };

        Ok(status.to_string())
    }

    /// Create sandbox invoice for testing (Business API)
    pub fn create_sandbox_invoice(
        &self,
        counterparty_inn: &str,
        amount: Decimal,
    ) -> TBankResult<String> {
        if !self.is_sandbox() {
            return Err(TBankError::SandboxOperationInProduction);
        }

        debug!(
            counterparty_inn = counterparty_inn,
            amount = %amount,
            "Creating sandbox invoice via Business API"
        );

        // Validate counterparty exists in sandbox
        self.get_sandbox_counterparty(counterparty_inn)?
            .ok_or_else(|| TBankError::CounterpartyNotFound {
                inn: counterparty_inn.to_string(),
            })?;

        // Generate mock invoice number
        let invoice_number = format!("INV-SANDBOX-{}", chrono::Utc::now().timestamp());

        Ok(invoice_number)
    }

    /// Initialize sandbox payment for testing (Acquiring API)
    pub fn initialize_sandbox_payment(
        &self,
        invoice_id: &str,
        payment_method: &str,
    ) -> TBankResult<SandboxPaymentResponse> {
        if !self.is_sandbox() {
            return Err(TBankError::SandboxOperationInProduction);
        }

        debug!(
            invoice_id = invoice_id,
            payment_method = payment_method,
            "Initializing sandbox payment via Acquiring API"
        );

        let transaction_id = format!(
            "sandbox_{}_{}",
            payment_method,
            chrono::Utc::now().timestamp()
        );
        let payment_url = format!(
            "https://securepay.tbank.ru/sandbox/payment/{}",
            transaction_id
        );
        let qr_code = format!("data:image/png;base64,sandbox_qr_code_{}", transaction_id);

        Ok(SandboxPaymentResponse {
            transaction_id,
            payment_url,
            qr_code: Some(qr_code),
            expires_at: Utc::now() + chrono::Duration::hours(1),
        })
    }

    /// Validate sandbox environment for operation
    pub fn validate_sandbox_operation(&self, operation: &str) -> TBankResult<()> {
        if !self.is_sandbox() {
            warn!(
                operation = operation,
                "Attempted sandbox operation in production environment"
            );
            return Err(TBankError::SandboxOperationInProduction);
        }

        debug!(operation = operation, "Validated sandbox operation");
        Ok(())
    }

    /// Get all available sandbox test data
    pub fn get_sandbox_test_data(&self) -> TBankResult<SandboxTestData> {
        self.validate_sandbox_operation("get_test_data")?;

        Ok(SandboxTestData {
            counterparties: vec![
                self.get_sandbox_counterparty("7707083893")?.unwrap(),
                self.get_sandbox_counterparty("1234567890")?.unwrap(),
            ],
            accounts: vec![
                SandboxAccount {
                    account_number: "40702810110011000000".to_string(),
                    balance: self.get_sandbox_balance("40702810110011000000")?,
                    transactions: self.get_sandbox_statement("40702810110011000000")?,
                },
                SandboxAccount {
                    account_number: "40702810110011000001".to_string(),
                    balance: self.get_sandbox_balance("40702810110011000001")?,
                    transactions: self.get_sandbox_statement("40702810110011000001")?,
                },
                SandboxAccount {
                    account_number: "40702810110011000002".to_string(),
                    balance: self.get_sandbox_balance("40702810110011000002")?,
                    transactions: self.get_sandbox_statement("40702810110011000002")?,
                },
            ],
        })
    }
}

/// Sandbox payment response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxPaymentResponse {
    pub transaction_id: String,
    pub payment_url: String,
    pub qr_code: Option<String>,
    pub expires_at: DateTime<Utc>,
}

/// Sandbox account data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxAccount {
    pub account_number: String,
    pub balance: Decimal,
    pub transactions: Vec<SandboxTransaction>,
}

/// Complete sandbox test data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxTestData {
    pub counterparties: Vec<SandboxCounterparty>,
    pub accounts: Vec<SandboxAccount>,
}
