use tracing::{debug, error, info};

use super::core::{ApiType, TBankClient};
use super::requests::RequestExecutor;
use super::retry::RetryPolicy;
use crate::types::{TBankError, TBankResult};

/// B2B API methods trait for T-Bank Business API
pub trait B2BApiMethods {
    /// Send B2B invoice via T-Bank Business API
    async fn send_b2b_invoice<T, R>(&self, request: T) -> TBankResult<R>
    where
        T: serde::Serialize + std::fmt::Debug,
        R: for<'de> serde::Deserialize<'de> + Send + 'static;

    /// Get invoice information
    async fn get_invoice_info(&self, invoice_id: &str) -> TBankResult<serde_json::Value>;

    /// Create one-time B2B QR code
    async fn create_onetime_qr<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug;

    /// Create reusable B2B QR code
    async fn create_reusable_qr<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug;

    /// Get QR code information
    async fn get_qr_info(&self, qr_id: &str, with_image: bool) -> TBankResult<serde_json::Value>;

    /// Verify company information
    async fn verify_company(&self, inn: &str, kpp: Option<&str>) -> TBankResult<serde_json::Value>;

    /// Get company signer status
    async fn get_signer_status(&self, inn: &str, kpp: Option<&str>) -> TBankResult<serde_json::Value>;
}

/// Banking operations API methods trait
pub trait BankingApiMethods {
    /// Get bank accounts (multiple versions supported)
    async fn get_bank_accounts(&self, version: Option<&str>) -> TBankResult<serde_json::Value>;

    /// Get bank statement
    async fn get_bank_statement(
        &self,
        from_date: &str,
        to_date: &str,
        currency: Option<&str>,
    ) -> TBankResult<serde_json::Value>;

    /// Get account operations with authorizations
    async fn get_account_operations(
        &self,
        from_date: &str,
        to_date: &str,
        currency: Option<&str>,
    ) -> TBankResult<serde_json::Value>;

    /// Get statement (alternative endpoint)
    async fn get_statement(
        &self,
        from_date: &str,
        to_date: &str,
        currency: Option<&str>,
    ) -> TBankResult<serde_json::Value>;
}

/// Nominal accounts API methods trait
pub trait NominalAccountsApiMethods {
    /// Create beneficiary
    async fn create_beneficiary<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug;

    /// Get beneficiaries list
    async fn get_beneficiaries(&self, status: Option<&str>) -> TBankResult<serde_json::Value>;

    /// Get beneficiary scoring results
    async fn get_beneficiary_scoring(&self) -> TBankResult<serde_json::Value>;

    /// Create deal
    async fn create_deal<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug;

    /// Get deals list
    async fn get_deals(&self, status: Option<&str>) -> TBankResult<serde_json::Value>;

    /// Accept deal
    async fn accept_deal(&self, deal_id: &str) -> TBankResult<serde_json::Value>;

    /// Create payment
    async fn create_payment<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug;

    /// Get payments list
    async fn get_payments(
        &self,
        status: Option<&str>,
        beneficiary_id: Option<&str>,
        deal_id: Option<&str>,
    ) -> TBankResult<serde_json::Value>;
}

/// Acquiring API methods trait
pub trait AcquiringApiMethods {
    /// Initialize acquiring payment via T-Bank Acquiring API
    async fn init_acquiring_payment<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug;

    /// Get payment status
    async fn get_payment_status(&self, payment_id: &str) -> TBankResult<serde_json::Value>;

    /// Cancel payment
    async fn cancel_payment(&self, payment_id: &str) -> TBankResult<serde_json::Value>;
}

/// Balance API methods trait
pub trait BalanceApiMethods {
    /// Get account balance via T-Bank Business API
    async fn get_balance(&self, account_number: &str) -> TBankResult<serde_json::Value>;
}

impl B2BApiMethods for TBankClient {
    /// Send B2B invoice via T-Bank Business API
    async fn send_b2b_invoice<T, R>(&self, request: T) -> TBankResult<R>
    where
        T: serde::Serialize + std::fmt::Debug,
        R: for<'de> serde::Deserialize<'de> + Send + 'static,
    {
        debug!(
            request = ?request,
            "Sending B2B invoice via T-Bank Business API"
        );

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/invoice/send", ApiType::Business)
            .json(&request);

        let retry_policy = RetryPolicy::standard();

        self.execute_request_with_retry("send_b2b_invoice", request_builder, retry_policy)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to send B2B invoice");
                match e {
                    TBankError::TBankApiError { status, message, error_code } => {
                        TBankError::InvoiceCreationFailed {
                            reason: format!("T-Bank API error: {} - {}", status, message),
                            counterparty_inn: None,
                        }
                    }
                    _ => TBankError::InvoiceCreationFailed {
                        reason: format!("Network error: {}", e),
                        counterparty_inn: None,
                    },
                }
            })
    }

    async fn get_invoice_info(&self, invoice_id: &str) -> TBankResult<serde_json::Value> {
        debug!(invoice_id = invoice_id, "Getting invoice info");

        let request_builder = self.authenticated_request(
            reqwest::Method::GET,
            &format!("/openapi/invoice/{}/info", invoice_id),
            ApiType::Business,
        );

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_invoice_info", request_builder, retry_policy)
            .await
    }

    async fn create_onetime_qr<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        debug!(request = ?request, "Creating one-time B2B QR code");

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/b2b/qr/onetime", ApiType::Business)
            .json(&request);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("create_onetime_qr", request_builder, retry_policy)
            .await
    }

    async fn create_reusable_qr<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        debug!(request = ?request, "Creating reusable B2B QR code");

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/b2b/qr/reusable", ApiType::Business)
            .json(&request);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("create_reusable_qr", request_builder, retry_policy)
            .await
    }

    async fn get_qr_info(&self, qr_id: &str, with_image: bool) -> TBankResult<serde_json::Value> {
        debug!(qr_id = qr_id, with_image = with_image, "Getting QR code info");

        let mut request_builder = self.authenticated_request(
            reqwest::Method::GET,
            &format!("/b2b/qr/{}/info", qr_id),
            ApiType::Business,
        );

        if with_image {
            request_builder = request_builder.query(&[("withImage", "true")]);
        }

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_qr_info", request_builder, retry_policy)
            .await
    }

    async fn verify_company(&self, inn: &str, kpp: Option<&str>) -> TBankResult<serde_json::Value> {
        debug!(inn = inn, kpp = ?kpp, "Verifying company");

        let mut query_params = vec![("inn", inn)];
        if let Some(kpp_value) = kpp {
            query_params.push(("kpp", kpp_value));
        }

        let request_builder = self
            .authenticated_request(reqwest::Method::GET, "/company", ApiType::Business)
            .query(&query_params);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("verify_company", request_builder, retry_policy)
            .await
            .map_err(|e| match e {
                TBankError::TBankApiError { status: 404, .. } => {
                    TBankError::CounterpartyNotFound {
                        inn: inn.to_string(),
                    }
                }
                _ => e,
            })
    }

    async fn get_signer_status(&self, inn: &str, kpp: Option<&str>) -> TBankResult<serde_json::Value> {
        debug!(inn = inn, kpp = ?kpp, "Getting signer status");

        let mut query_params = vec![("inn", inn)];
        if let Some(kpp_value) = kpp {
            query_params.push(("kpp", kpp_value));
        }

        let request_builder = self
            .authenticated_request(reqwest::Method::GET, "/company/signer/status", ApiType::Business)
            .query(&query_params);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_signer_status", request_builder, retry_policy)
            .await
    }
}

impl BankingApiMethods for TBankClient {
    async fn get_bank_accounts(&self, version: Option<&str>) -> TBankResult<serde_json::Value> {
        let endpoint = match version {
            Some("v2") => "/v2/bank-accounts",
            Some("v3") => "/v3/bank-accounts",
            Some("v4") => "/v4/bank-accounts",
            _ => "/bank-accounts",
        };

        debug!(endpoint = endpoint, "Getting bank accounts");

        let request_builder = self.authenticated_request(
            reqwest::Method::GET,
            endpoint,
            ApiType::Business,
        );

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_bank_accounts", request_builder, retry_policy)
            .await
    }

    async fn get_bank_statement(
        &self,
        from_date: &str,
        to_date: &str,
        currency: Option<&str>,
    ) -> TBankResult<serde_json::Value> {
        debug!(from_date = from_date, to_date = to_date, "Getting bank statement");

        let mut query_params = vec![("fromDate", from_date), ("toDate", to_date)];
        if let Some(curr) = currency {
            query_params.push(("currency", curr));
        }

        let request_builder = self
            .authenticated_request(reqwest::Method::GET, "/bank-statement", ApiType::Business)
            .query(&query_params);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_bank_statement", request_builder, retry_policy)
            .await
    }

    async fn get_account_operations(
        &self,
        from_date: &str,
        to_date: &str,
        currency: Option<&str>,
    ) -> TBankResult<serde_json::Value> {
        debug!(from_date = from_date, to_date = to_date, "Getting account operations");

        let mut query_params = vec![("fromDate", from_date), ("toDate", to_date)];
        if let Some(curr) = currency {
            query_params.push(("currency", curr));
        }

        let request_builder = self
            .authenticated_request(reqwest::Method::GET, "/account-operations", ApiType::Business)
            .query(&query_params);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_account_operations", request_builder, retry_policy)
            .await
    }

    async fn get_statement(
        &self,
        from_date: &str,
        to_date: &str,
        currency: Option<&str>,
    ) -> TBankResult<serde_json::Value> {
        debug!(from_date = from_date, to_date = to_date, "Getting statement");

        let mut query_params = vec![("fromDate", from_date), ("toDate", to_date)];
        if let Some(curr) = currency {
            query_params.push(("currency", curr));
        }

        let request_builder = self
            .authenticated_request(reqwest::Method::GET, "/statement", ApiType::Business)
            .query(&query_params);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_statement", request_builder, retry_policy)
            .await
    }
}

impl NominalAccountsApiMethods for TBankClient {
    async fn create_beneficiary<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        debug!(request = ?request, "Creating beneficiary");

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/nominal-accounts/beneficiaries", ApiType::Business)
            .json(&request);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("create_beneficiary", request_builder, retry_policy)
            .await
    }

    async fn get_beneficiaries(&self, status: Option<&str>) -> TBankResult<serde_json::Value> {
        debug!(status = ?status, "Getting beneficiaries");

        let mut request_builder = self.authenticated_request(
            reqwest::Method::GET,
            "/nominal-accounts/beneficiaries",
            ApiType::Business,
        );

        if let Some(status_value) = status {
            request_builder = request_builder.query(&[("status", status_value)]);
        }

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_beneficiaries", request_builder, retry_policy)
            .await
    }

    async fn get_beneficiary_scoring(&self) -> TBankResult<serde_json::Value> {
        debug!("Getting beneficiary scoring");

        let request_builder = self.authenticated_request(
            reqwest::Method::GET,
            "/nominal-accounts/beneficiaries/scoring",
            ApiType::Business,
        );

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_beneficiary_scoring", request_builder, retry_policy)
            .await
    }

    async fn create_deal<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        debug!(request = ?request, "Creating deal");

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/nominal-accounts/deals", ApiType::Business)
            .json(&request);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("create_deal", request_builder, retry_policy)
            .await
    }

    async fn get_deals(&self, status: Option<&str>) -> TBankResult<serde_json::Value> {
        debug!(status = ?status, "Getting deals");

        let mut request_builder = self.authenticated_request(
            reqwest::Method::GET,
            "/nominal-accounts/deals",
            ApiType::Business,
        );

        if let Some(status_value) = status {
            request_builder = request_builder.query(&[("status", status_value)]);
        }

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_deals", request_builder, retry_policy)
            .await
    }

    async fn accept_deal(&self, deal_id: &str) -> TBankResult<serde_json::Value> {
        debug!(deal_id = deal_id, "Accepting deal");

        let request_builder = self.authenticated_request(
            reqwest::Method::POST,
            &format!("/nominal-accounts/deals/{}/accept", deal_id),
            ApiType::Business,
        );

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("accept_deal", request_builder, retry_policy)
            .await
    }

    async fn create_payment<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        debug!(request = ?request, "Creating payment");

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/nominal-accounts/payments", ApiType::Business)
            .json(&request);

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("create_payment", request_builder, retry_policy)
            .await
    }

    async fn get_payments(
        &self,
        status: Option<&str>,
        beneficiary_id: Option<&str>,
        deal_id: Option<&str>,
    ) -> TBankResult<serde_json::Value> {
        debug!(status = ?status, beneficiary_id = ?beneficiary_id, deal_id = ?deal_id, "Getting payments");

        let mut query_params = Vec::new();
        if let Some(status_value) = status {
            query_params.push(("status", status_value));
        }
        if let Some(beneficiary_value) = beneficiary_id {
            query_params.push(("beneficiaryId", beneficiary_value));
        }
        if let Some(deal_value) = deal_id {
            query_params.push(("dealId", deal_value));
        }

        let mut request_builder = self.authenticated_request(
            reqwest::Method::GET,
            "/nominal-accounts/payments",
            ApiType::Business,
        );

        if !query_params.is_empty() {
            request_builder = request_builder.query(&query_params);
        }

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_payments", request_builder, retry_policy)
            .await
    }
}

impl AcquiringApiMethods for TBankClient {
    /// Initialize acquiring payment via T-Bank Acquiring API
    async fn init_acquiring_payment<T>(&self, request: T) -> TBankResult<serde_json::Value>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        debug!(
            request = ?request,
            "Initializing acquiring payment via T-Bank Acquiring API"
        );

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/Init", ApiType::Acquiring)
            .json(&request);

        let retry_policy = RetryPolicy::standard();

        self.execute_request_with_retry("init_acquiring_payment", request_builder, retry_policy)
            .await
            .map_err(|e| {
                error!(error = %e, "Failed to initialize acquiring payment");
                match e {
                    TBankError::TBankApiError { status, message, error_code } => {
                        TBankError::PaymentInitializationFailed {
                            reason: format!("T-Bank Acquiring API error: {} - {}", status, message),
                            transaction_id: None,
                        }
                    }
                    _ => TBankError::PaymentInitializationFailed {
                        reason: format!("Network error: {}", e),
                        transaction_id: None,
                    },
                }
            })
    }

    async fn get_payment_status(&self, payment_id: &str) -> TBankResult<serde_json::Value> {
        debug!(payment_id = payment_id, "Getting payment status");

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/GetState", ApiType::Acquiring)
            .json(&serde_json::json!({
                "PaymentId": payment_id
            }));

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("get_payment_status", request_builder, retry_policy)
            .await
    }

    async fn cancel_payment(&self, payment_id: &str) -> TBankResult<serde_json::Value> {
        debug!(payment_id = payment_id, "Cancelling payment");

        let request_builder = self
            .authenticated_request(reqwest::Method::POST, "/Cancel", ApiType::Acquiring)
            .json(&serde_json::json!({
                "PaymentId": payment_id
            }));

        let retry_policy = RetryPolicy::standard();
        self.execute_request_with_retry("cancel_payment", request_builder, retry_policy)
            .await
    }
}

impl BalanceApiMethods for TBankClient {
    /// Get account balance via T-Bank Business API
    async fn get_balance(&self, account_number: &str) -> TBankResult<serde_json::Value> {
        debug!(
            account_number = account_number,
            "Getting account balance via T-Bank Business API"
        );

        let request_builder = self.authenticated_request(
            reqwest::Method::GET,
            &format!("/account/{}/balance", account_number),
            ApiType::Business,
        );

        let retry_policy = RetryPolicy::standard();

        self.execute_request_with_retry("get_balance", request_builder, retry_policy)
            .await
            .map_err(|e| {
                error!(
                    error = %e,
                    account_number = account_number,
                    "Failed to get balance via T-Bank Business API"
                );
                TBankError::BalanceQueryFailed {
                    account_number: account_number.to_string(),
                    reason: e.to_string(),
                }
            })
    }
}
