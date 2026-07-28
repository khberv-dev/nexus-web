pub mod cache;
pub mod erir;
pub mod validator;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use self::cache::CounterpartyCache;
use self::erir::ErirClient;
use self::validator::InnKppValidator;
use crate::client::requests::RequestExecutor;
use crate::client::ApiType;
use crate::client::TBankClient;
use crate::types::counterparty::{
    CounterpartyData, CounterpartyStatus, CounterpartyVerificationRequest,
};
use crate::types::{TBankError, TBankResult};
use shared::CacheManager;

/// T-Bank API response for counterparty verification
#[derive(Debug, Deserialize, Serialize)]
pub struct TBankCounterpartyResponse {
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
    pub registration_date: DateTime<Utc>,
    #[serde(rename = "okvedCodes")]
    pub okved_codes: Vec<String>,
}

impl From<TBankCounterpartyResponse> for CounterpartyData {
    fn from(response: TBankCounterpartyResponse) -> Self {
        let status = match response.status.to_lowercase().as_str() {
            "active" => CounterpartyStatus::Active,
            "inactive" => CounterpartyStatus::Inactive,
            "liquidating" => CounterpartyStatus::Liquidating,
            "liquidated" => CounterpartyStatus::Liquidated,
            "bankrupt" => CounterpartyStatus::Bankrupt,
            "reorganizing" => CounterpartyStatus::Reorganizing,
            _ => CounterpartyStatus::Unknown,
        };

        CounterpartyData::new(
            response.inn,
            response.kpp,
            response.full_name,
            response.short_name,
            response.legal_address,
            status,
            response.registration_date,
            response.okved_codes,
        )
    }
}

/// Counterparty verification service with T-Bank API integration
pub struct CounterpartyVerifier {
    tbank_client: Arc<TBankClient>,
    db_pool: Arc<PgPool>,
    cache: CounterpartyCache,
    erir_client: Option<ErirClient>,
}

impl CounterpartyVerifier {
    /// Create new counterparty verifier
    pub fn new(
        tbank_client: Arc<TBankClient>,
        db_pool: Arc<PgPool>,
        cache_manager: Arc<CacheManager>,
    ) -> Self {
        info!("Initializing CounterpartyVerifier");

        // Initialize ERIR client if configuration is available
        let erir_client = match ErirClient::from_env() {
            Ok(client) => {
                info!("ERIR client initialized successfully");
                Some(client)
            }
            Err(e) => {
                warn!(error = %e, "Failed to initialize ERIR client, continuing without ERIR integration");
                None
            }
        };

        Self {
            tbank_client,
            db_pool,
            cache: CounterpartyCache::new((*cache_manager).clone()),
            erir_client,
        }
    }

    /// Verify counterparty by INN/KPP with caching and database storage
    pub async fn verify_counterparty(
        &self,
        request: CounterpartyVerificationRequest,
    ) -> TBankResult<CounterpartyData> {
        info!(
            inn = %request.inn,
            kpp = ?request.kpp,
            "Starting counterparty verification"
        );

        // Validate INN/KPP format first
        request
            .validate()
            .map_err(|msg| TBankError::ValidationError(msg))?;

        // Check cache first
        if let Some(cached_data) = self.cache.get(&request.inn).await? {
            info!(inn = %request.inn, "Counterparty found in cache");
            return Ok(cached_data);
        }

        // Check database
        if let Some(db_data) = self.get_from_database(&request.inn).await? {
            info!(inn = %request.inn, "Counterparty found in database");

            // Cache the database result
            self.cache.set(&request.inn, &db_data).await?;
            return Ok(db_data);
        }

        // Try ERIR verification first if available
        if let Some(ref erir_client) = self.erir_client {
            match self.verify_with_erir(erir_client, &request).await {
                Ok(verified_data) => {
                    info!(inn = %request.inn, "Counterparty verified through ERIR");

                    // Store in database
                    self.store_in_database(&verified_data).await?;

                    // Cache the result
                    self.cache.set(&request.inn, &verified_data).await?;

                    return Ok(verified_data);
                }
                Err(e) => {
                    warn!(
                        inn = %request.inn,
                        error = %e,
                        "ERIR verification failed, falling back to T-Bank API"
                    );
                }
            }
        }

        // Verify with T-Bank API as fallback
        let verified_data = self.verify_with_tbank_api(&request).await?;

        // Store in database
        self.store_in_database(&verified_data).await?;

        // Cache the result
        self.cache.set(&request.inn, &verified_data).await?;

        info!(
            inn = %request.inn,
            full_name = %verified_data.full_name,
            status = ?verified_data.status,
            "Counterparty verification completed successfully"
        );

        Ok(verified_data)
    }

    /// Get counterparty by INN from database or cache
    pub async fn get_counterparty(&self, inn: &str) -> TBankResult<Option<CounterpartyData>> {
        debug!(inn = %inn, "Getting counterparty");

        // Validate INN format
        InnKppValidator::validate_inn(inn)?;

        // Check cache first
        if let Some(cached_data) = self.cache.get(inn).await? {
            debug!(inn = %inn, "Counterparty found in cache");
            return Ok(Some(cached_data));
        }

        // Check database
        if let Some(db_data) = self.get_from_database(inn).await? {
            debug!(inn = %inn, "Counterparty found in database");

            // Cache the database result
            self.cache.set(inn, &db_data).await?;
            return Ok(Some(db_data));
        }

        debug!(inn = %inn, "Counterparty not found");
        Ok(None)
    }

    /// Verify counterparty with ERIR (ЕГРЮЛ) database
    async fn verify_with_erir(
        &self,
        erir_client: &ErirClient,
        request: &CounterpartyVerificationRequest,
    ) -> TBankResult<CounterpartyData> {
        info!(inn = %request.inn, "Verifying counterparty with ERIR");

        let erir_result = erir_client
            .verify_counterparty(&request.inn, request.kpp.as_deref())
            .await?;

        if !erir_result.verified {
            return Err(TBankError::CounterpartyNotFound {
                inn: request.inn.clone(),
            });
        }

        match erir_result.counterparty_data {
            Some(data) => {
                info!(
                    inn = %data.inn,
                    full_name = %data.full_name,
                    status = ?data.status,
                    "ERIR verification successful"
                );
                Ok(data)
            }
            None => {
                warn!(inn = %request.inn, "ERIR verification succeeded but no counterparty data returned");
                Err(TBankError::CounterpartyNotFound {
                    inn: request.inn.clone(),
                })
            }
        }
    }

    /// Verify counterparty with T-Bank API
    async fn verify_with_tbank_api(
        &self,
        request: &CounterpartyVerificationRequest,
    ) -> TBankResult<CounterpartyData> {
        info!(inn = %request.inn, "Verifying counterparty with T-Bank API");

        // Handle sandbox environment with predefined test data
        if self.tbank_client.is_sandbox() {
            return self.get_sandbox_counterparty_data(&request.inn);
        }

        // Build API request
        let mut api_request = serde_json::json!({
            "inn": request.inn
        });

        if let Some(ref kpp) = request.kpp {
            api_request["kpp"] = serde_json::Value::String(kpp.clone());
        }

        // Make API call to T-Bank
        let request_builder = self
            .tbank_client
            .authenticated_request(
                reqwest::Method::POST,
                "/counterparty/verify",
                ApiType::Business,
            )
            .json(&api_request);

        let response: TBankCounterpartyResponse = self
            .tbank_client
            .execute_request(request_builder)
            .await
            .map_err(|e| {
                error!(
                    inn = %request.inn,
                    error = %e,
                    "T-Bank API counterparty verification failed"
                );
                match e {
                    TBankError::TBankApiError { status: 404, .. } => {
                        TBankError::CounterpartyNotFound {
                            inn: request.inn.clone(),
                        }
                    }
                    other => other,
                }
            })?;

        info!(
            inn = %response.inn,
            full_name = %response.full_name,
            status = %response.status,
            "T-Bank API verification successful"
        );

        Ok(response.into())
    }

    /// Get predefined sandbox counterparty data for testing
    fn get_sandbox_counterparty_data(&self, inn: &str) -> TBankResult<CounterpartyData> {
        debug!(inn = %inn, "Getting sandbox counterparty data");

        match inn {
            "7707083893" => Ok(CounterpartyData::new(
                "7707083893".to_string(),
                Some("770701001".to_string()),
                "ООО \"Тестовая Компания\"".to_string(),
                "Тест Ко".to_string(),
                "г. Москва, ул. Тестовая, д. 1".to_string(),
                CounterpartyStatus::Active,
                chrono::DateTime::parse_from_rfc3339("2020-01-01T00:00:00Z")
                    .unwrap()
                    .with_timezone(&Utc),
                vec!["62.01".to_string(), "62.02".to_string()],
            )),
            "1234567890" => Ok(CounterpartyData::new(
                "1234567890".to_string(),
                Some("123456001".to_string()),
                "ООО \"Другая Тестовая Компания\"".to_string(),
                "Другая Тест".to_string(),
                "г. Санкт-Петербург, ул. Другая, д. 2".to_string(),
                CounterpartyStatus::Active,
                chrono::DateTime::parse_from_rfc3339("2021-06-15T00:00:00Z")
                    .unwrap()
                    .with_timezone(&Utc),
                vec!["63.11".to_string()],
            )),
            "9999999999" => {
                warn!(inn = %inn, "Sandbox test INN for error simulation");
                Err(TBankError::CounterpartyNotFound {
                    inn: inn.to_string(),
                })
            }
            _ => {
                warn!(inn = %inn, "Unknown sandbox INN");
                Err(TBankError::CounterpartyNotFound {
                    inn: inn.to_string(),
                })
            }
        }
    }

    /// Store counterparty data in database
    async fn store_in_database(&self, data: &CounterpartyData) -> TBankResult<()> {
        debug!(inn = %data.inn, "Storing counterparty in database");

        crate::database::CommonQueries::insert_counterparty(&self.db_pool, data).await?;
        info!(inn = %data.inn, "Counterparty stored in database successfully");

        Ok(())
    }

    /// Get counterparty data from database
    async fn get_from_database(&self, inn: &str) -> TBankResult<Option<CounterpartyData>> {
        debug!(inn = %inn, "Getting counterparty from database");

        let result =
            crate::database::CommonQueries::get_counterparty_by_inn(&self.db_pool, inn).await?;
        if result.is_some() {
            debug!(inn = %inn, "Counterparty found in database");
        } else {
            debug!(inn = %inn, "Counterparty not found in database");
        }
        Ok(result)
    }

    /// Get cache statistics
    pub async fn get_cache_stats(&self) -> TBankResult<cache::CounterpartyCacheStats> {
        self.cache.get_cache_stats().await
    }

    /// Check if counterparty exists in database
    pub async fn exists(&self, inn: &str) -> TBankResult<bool> {
        debug!(inn = %inn, "Checking if counterparty exists");

        InnKppValidator::validate_inn(inn)?;

        let exists =
            crate::database::CommonQueries::counterparty_exists(&self.db_pool, inn).await?;
        debug!(inn = %inn, exists = exists, "Counterparty existence check completed");
        Ok(exists)
    }

    /// Get verification statistics
    pub async fn get_verification_stats(&self) -> TBankResult<VerificationStats> {
        debug!("Getting verification statistics");

        // TODO: Implement database stats when DATABASE_URL is available
        // For now, return empty stats
        let verification_stats = VerificationStats {
            total_verified: 0,
            active_counterparties: 0,
            verified_last_24h: 0,
        };

        debug!(
            ?verification_stats,
            "Verification statistics retrieved (database not available)"
        );
        Ok(verification_stats)
    }

    /// Check ERIR service health
    pub async fn check_erir_health(&self) -> TBankResult<bool> {
        match &self.erir_client {
            Some(client) => {
                debug!("Checking ERIR service health");
                client.health_check().await
            }
            None => {
                debug!("ERIR client not available");
                Ok(false)
            }
        }
    }

    /// Get detailed counterparty information from ERIR if available
    pub async fn get_detailed_erir_info(
        &self,
        inn: &str,
    ) -> TBankResult<Option<erir::ErirAdditionalInfo>> {
        match &self.erir_client {
            Some(client) => {
                info!(inn = %inn, "Getting detailed ERIR information");
                match client.get_detailed_info(inn).await {
                    Ok(info) => Ok(Some(info)),
                    Err(TBankError::CounterpartyNotFound { .. }) => Ok(None),
                    Err(e) => Err(e),
                }
            }
            None => {
                debug!("ERIR client not available");
                Ok(None)
            }
        }
    }

    /// Batch verify multiple counterparties using ERIR if available
    pub async fn batch_verify_erir(
        &self,
        requests: &[(String, Option<String>)],
    ) -> TBankResult<Vec<Option<erir::ErirVerificationResult>>> {
        match &self.erir_client {
            Some(client) => {
                info!(count = requests.len(), "Starting ERIR batch verification");
                let results = client.batch_verify(requests).await?;
                Ok(results.into_iter().map(Some).collect())
            }
            None => {
                debug!("ERIR client not available for batch verification");
                Ok(vec![None; requests.len()])
            }
        }
    }
}

/// Verification statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationStats {
    pub total_verified: u64,
    pub active_counterparties: u64,
    pub verified_last_24h: u64,
}
