use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, warn};

use crate::types::counterparty::{CounterpartyData, CounterpartyStatus};
use crate::types::{TBankError, TBankResult};

/// ERIR (ЕГРЮЛ) integration client for additional counterparty verification
pub struct ErirClient {
    pub(crate) http_client: Client,
    pub base_url: String,
    pub api_key: Option<String>,
}

/// ERIR API response for counterparty data
#[derive(Debug, Deserialize, Serialize)]
pub struct ErirCounterpartyResponse {
    #[serde(rename = "inn")]
    pub inn: String,
    #[serde(rename = "kpp")]
    pub kpp: Option<String>,
    #[serde(rename = "fullName")]
    pub full_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    #[serde(rename = "legalAddress")]
    pub legal_address: String,
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "registrationDate")]
    pub registration_date: String,
    #[serde(rename = "okvedCodes")]
    pub okved_codes: Vec<String>,
    #[serde(rename = "authorized")]
    pub authorized: bool,
    #[serde(rename = "capital")]
    pub capital: Option<f64>,
}

/// ERIR verification result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ErirVerificationResult {
    pub verified: bool,
    pub counterparty_data: Option<CounterpartyData>,
    pub verification_source: String,
    pub verification_timestamp: chrono::DateTime<chrono::Utc>,
    pub additional_info: ErirAdditionalInfo,
}

/// Additional information from ERIR verification
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ErirAdditionalInfo {
    pub authorized_capital: Option<f64>,
    pub registration_authority: Option<String>,
    pub tax_registration_date: Option<String>,
    pub liquidation_date: Option<String>,
    pub bankruptcy_info: Option<String>,
}

impl ErirClient {
    /// Create new ERIR client
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        info!("Initializing ERIR client with base URL: {}", base_url);
        Self {
            http_client: Client::new(),
            base_url,
            api_key,
        }
    }

    /// Create ERIR client from environment variables
    pub fn from_env() -> TBankResult<Self> {
        let base_url =
            std::env::var("ERIR_BASE_URL").unwrap_or_else(|_| "http://localhost:8083".to_string());

        let api_key = std::env::var("ERIR_API_KEY").ok();

        info!("Creating ERIR client from environment");
        Ok(Self::new(base_url, api_key))
    }

    /// Verify counterparty through ERIR (ЕГРЮЛ) database
    pub async fn verify_counterparty(
        &self,
        inn: &str,
        kpp: Option<&str>,
    ) -> TBankResult<ErirVerificationResult> {
        info!(inn = %inn, kpp = ?kpp, "Starting ERIR counterparty verification");

        // Build request URL
        let url = format!("{}/api/v1/counterparty/verify", self.base_url);

        // Build query parameters
        let mut query_params = vec![("inn", inn)];
        if let Some(kpp_val) = kpp {
            query_params.push(("kpp", kpp_val));
        }

        // Create HTTP request
        let mut request_builder = self.http_client.get(&url).query(&query_params);

        // Add API key if available
        if let Some(ref api_key) = self.api_key {
            request_builder = request_builder.header("X-API-Key", api_key);
        }

        // Add standard headers
        request_builder = request_builder
            .header("User-Agent", "TBank-Integration/1.0")
            .header("Accept", "application/json");

        // Execute request
        let response = request_builder.send().await.map_err(|e| {
            error!(inn = %inn, error = %e, "ERIR API request failed");
            TBankError::NetworkError(e.to_string())
        })?;

        // Check response status
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            warn!(
                inn = %inn,
                status = %status,
                error = %error_text,
                "ERIR API returned error status"
            );

            return match status.as_u16() {
                404 => Err(TBankError::CounterpartyNotFound {
                    inn: inn.to_string(),
                }),
                429 => Err(TBankError::RateLimitExceeded),
                _ => Err(TBankError::TBankApiError {
                    status: status.as_u16(),
                    message: format!("ERIR API error: {}", error_text),
                    error_code: None,
                }),
            };
        }

        // Parse response
        let erir_response: ErirCounterpartyResponse = response.json().await.map_err(|e| {
            error!(inn = %inn, error = %e, "Failed to parse ERIR response");
            TBankError::InternalError(format!("Failed to parse ERIR response: {}", e))
        })?;

        info!(
            inn = %erir_response.inn,
            full_name = %erir_response.full_name,
            status = %erir_response.status,
            authorized = %erir_response.authorized,
            "ERIR verification successful"
        );

        // Convert to our internal format
        let verification_result = self.convert_erir_response(erir_response)?;

        Ok(verification_result)
    }

    /// Check if ERIR service is available
    pub async fn health_check(&self) -> TBankResult<bool> {
        debug!("Performing ERIR health check");

        let health_url = format!("{}/health", self.base_url);

        let response = self
            .http_client
            .get(&health_url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| {
                warn!(error = %e, "ERIR health check failed");
                TBankError::NetworkError(e.to_string())
            })?;

        let is_healthy = response.status().is_success();

        if is_healthy {
            debug!("ERIR service is healthy");
        } else {
            warn!(status = %response.status(), "ERIR service health check failed");
        }

        Ok(is_healthy)
    }

    /// Convert ERIR response to our internal verification result
    fn convert_erir_response(
        &self,
        response: ErirCounterpartyResponse,
    ) -> TBankResult<ErirVerificationResult> {
        // Parse status
        let status = match response.status.to_lowercase().as_str() {
            "active" => CounterpartyStatus::Active,
            "inactive" => CounterpartyStatus::Inactive,
            "liquidating" => CounterpartyStatus::Liquidating,
            "liquidated" => CounterpartyStatus::Liquidated,
            "bankrupt" => CounterpartyStatus::Bankrupt,
            "reorganizing" => CounterpartyStatus::Reorganizing,
            _ => CounterpartyStatus::Unknown,
        };

        // Parse registration date
        let registration_date = chrono::DateTime::parse_from_rfc3339(&response.registration_date)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());

        // Create counterparty data
        let counterparty_data = CounterpartyData::new(
            response.inn.clone(),
            response.kpp.clone(),
            response.full_name.clone(),
            response.short_name.clone(),
            response.legal_address.clone(),
            status,
            registration_date,
            response.okved_codes.clone(),
        );

        // Create additional info
        let additional_info = ErirAdditionalInfo {
            authorized_capital: response.capital,
            registration_authority: None, // Not provided in basic response
            tax_registration_date: Some(response.registration_date.clone()),
            liquidation_date: None, // Would be provided if status is liquidated
            bankruptcy_info: None,  // Would be provided if status is bankrupt
        };

        // Create verification result
        let verification_result = ErirVerificationResult {
            verified: response.authorized,
            counterparty_data: Some(counterparty_data),
            verification_source: "ERIR".to_string(),
            verification_timestamp: chrono::Utc::now(),
            additional_info,
        };

        Ok(verification_result)
    }

    /// Get detailed counterparty information including financial data
    pub async fn get_detailed_info(&self, inn: &str) -> TBankResult<ErirAdditionalInfo> {
        info!(inn = %inn, "Getting detailed ERIR information");

        let url = format!("{}/api/v1/counterparty/details/{}", self.base_url, inn);

        let mut request_builder = self.http_client.get(&url);

        // Add API key if available
        if let Some(ref api_key) = self.api_key {
            request_builder = request_builder.header("X-API-Key", api_key);
        }

        let response = request_builder.send().await.map_err(|e| {
            error!(inn = %inn, error = %e, "ERIR detailed info request failed");
            TBankError::NetworkError(e.to_string())
        })?;

        if !response.status().is_success() {
            return Err(TBankError::TBankApiError {
                status: response.status().as_u16(),
                message: format!("ERIR detailed info API error"),
                error_code: None,
            });
        }

        let detailed_info: ErirAdditionalInfo = response.json().await.map_err(|e| {
            error!(inn = %inn, error = %e, "Failed to parse ERIR detailed response");
            TBankError::InternalError(format!("Failed to parse ERIR detailed response: {}", e))
        })?;

        info!(inn = %inn, "ERIR detailed information retrieved successfully");
        Ok(detailed_info)
    }

    /// Batch verify multiple counterparties
    pub async fn batch_verify(
        &self,
        requests: &[(String, Option<String>)],
    ) -> TBankResult<Vec<ErirVerificationResult>> {
        info!(count = requests.len(), "Starting ERIR batch verification");

        let mut results = Vec::with_capacity(requests.len());

        // For now, process sequentially to avoid overwhelming the ERIR service
        // In production, this could be optimized with proper rate limiting and concurrency
        for (inn, kpp) in requests {
            match self.verify_counterparty(inn, kpp.as_deref()).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    warn!(inn = %inn, error = %e, "ERIR verification failed for counterparty");
                    // Create a failed verification result
                    let failed_result = ErirVerificationResult {
                        verified: false,
                        counterparty_data: None,
                        verification_source: "ERIR".to_string(),
                        verification_timestamp: chrono::Utc::now(),
                        additional_info: ErirAdditionalInfo {
                            authorized_capital: None,
                            registration_authority: None,
                            tax_registration_date: None,
                            liquidation_date: None,
                            bankruptcy_info: Some(format!("Verification failed: {}", e)),
                        },
                    };
                    results.push(failed_result);
                }
            }
        }

        info!(
            count = requests.len(),
            verified = results.iter().filter(|r| r.verified).count(),
            "ERIR batch verification completed"
        );

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_erir_client_creation() {
        let client = ErirClient::new("http://localhost:8083".to_string(), None);
        assert_eq!(client.base_url, "http://localhost:8083");
        assert!(client.api_key.is_none());
    }

    #[test]
    fn test_erir_client_with_api_key() {
        let client = ErirClient::new(
            "http://localhost:8083".to_string(),
            Some("test-api-key".to_string()),
        );
        assert_eq!(client.base_url, "http://localhost:8083");
        assert_eq!(client.api_key, Some("test-api-key".to_string()));
    }

    #[tokio::test]
    async fn test_erir_response_conversion() {
        let client = ErirClient::new("http://localhost:8083".to_string(), None);

        let erir_response = ErirCounterpartyResponse {
            inn: "7707083893".to_string(),
            kpp: Some("770701001".to_string()),
            full_name: "Test Company LLC".to_string(),
            short_name: "Test Co".to_string(),
            legal_address: "Moscow, Test Street, 1".to_string(),
            status: "active".to_string(),
            registration_date: "2020-01-01T00:00:00Z".to_string(),
            okved_codes: vec!["62.01".to_string()],
            authorized: true,
            capital: Some(100000.0),
        };

        let result = client.convert_erir_response(erir_response).unwrap();

        assert!(result.verified);
        assert_eq!(result.verification_source, "ERIR");
        assert!(result.counterparty_data.is_some());

        let counterparty = result.counterparty_data.unwrap();
        assert_eq!(counterparty.inn, "7707083893");
        assert_eq!(counterparty.kpp, Some("770701001".to_string()));
        assert_eq!(counterparty.full_name, "Test Company LLC");
        assert_eq!(counterparty.status, CounterpartyStatus::Active);

        assert_eq!(result.additional_info.authorized_capital, Some(100000.0));
    }
}
