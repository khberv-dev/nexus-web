use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::types::{TBankError, TBankResult};

/// Counterparty data structure for storing verified entity information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CounterpartyData {
    pub id: Option<Uuid>,
    pub inn: String,
    pub kpp: Option<String>,
    pub full_name: String,
    pub short_name: String,
    pub legal_address: String,
    pub status: CounterpartyStatus,
    pub registration_date: DateTime<Utc>,
    pub okved_codes: Vec<String>,
    pub verified_at: DateTime<Utc>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Status of counterparty verification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CounterpartyStatus {
    Active,
    Inactive,
    Blocked,
    Liquidating,
    Liquidated,
    Bankrupt,
    Reorganizing,
    Unknown,
}

impl ToString for CounterpartyStatus {
    fn to_string(&self) -> String {
        match self {
            CounterpartyStatus::Active => "Active".to_string(),
            CounterpartyStatus::Inactive => "Inactive".to_string(),
            CounterpartyStatus::Blocked => "Blocked".to_string(),
            CounterpartyStatus::Liquidating => "Liquidating".to_string(),
            CounterpartyStatus::Liquidated => "Liquidated".to_string(),
            CounterpartyStatus::Bankrupt => "Bankrupt".to_string(),
            CounterpartyStatus::Reorganizing => "Reorganizing".to_string(),
            CounterpartyStatus::Unknown => "Unknown".to_string(),
        }
    }
}

impl std::str::FromStr for CounterpartyStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Active" => Ok(CounterpartyStatus::Active),
            "Inactive" => Ok(CounterpartyStatus::Inactive),
            "Blocked" => Ok(CounterpartyStatus::Blocked),
            "Liquidating" => Ok(CounterpartyStatus::Liquidating),
            "Liquidated" => Ok(CounterpartyStatus::Liquidated),
            "Bankrupt" => Ok(CounterpartyStatus::Bankrupt),
            "Reorganizing" => Ok(CounterpartyStatus::Reorganizing),
            "Unknown" => Ok(CounterpartyStatus::Unknown),
            _ => Err(format!("Invalid counterparty status: {}", s)),
        }
    }
}

impl CounterpartyData {
    /// Create a new counterparty data instance
    pub fn new(
        inn: String,
        kpp: Option<String>,
        full_name: String,
        short_name: String,
        legal_address: String,
        status: CounterpartyStatus,
        registration_date: DateTime<Utc>,
        okved_codes: Vec<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            inn,
            kpp,
            full_name,
            short_name,
            legal_address,
            status,
            registration_date,
            okved_codes,
            verified_at: now,
            created_at: Some(now),
            updated_at: Some(now),
        }
    }

    /// Validate KPP format (9 digits)
    pub fn validate_kpp(kpp: &str) -> bool {
        kpp.chars().all(|c| c.is_ascii_digit()) && kpp.len() == 9
    }

    // validate_inn удалена - используйте InnKppValidator::validate_inn из counterparty::validator

    /// Check if counterparty is active
    pub fn is_active(&self) -> bool {
        matches!(self.status, CounterpartyStatus::Active)
    }

    /// Create CounterpartyData from database row
    pub fn from_row(row: &sqlx::postgres::PgRow) -> TBankResult<Self> {
        use std::str::FromStr;

        let status_str: String = row
            .try_get("status")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let status = CounterpartyStatus::from_str(&status_str)
            .map_err(|e| TBankError::ValidationError(e))?;

        let okved_codes: Option<serde_json::Value> = row
            .try_get("okved_codes")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let okved_codes = if let Some(codes) = okved_codes {
            serde_json::from_value(codes)
                .map_err(|e| TBankError::ValidationError(format!("Invalid OKVED codes: {}", e)))?
        } else {
            Vec::new()
        };

        Ok(Self {
            id: Some(
                row.try_get("id")
                    .map_err(|e| TBankError::DatabaseError(e))?,
            ),
            inn: row
                .try_get("inn")
                .map_err(|e| TBankError::DatabaseError(e))?,
            kpp: row
                .try_get("kpp")
                .map_err(|e| TBankError::DatabaseError(e))?,
            full_name: row
                .try_get("full_name")
                .map_err(|e| TBankError::DatabaseError(e))?,
            short_name: row
                .try_get("short_name")
                .map_err(|e| TBankError::DatabaseError(e))?,
            legal_address: row
                .try_get("legal_address")
                .map_err(|e| TBankError::DatabaseError(e))?,
            status,
            registration_date: row
                .try_get("registration_date")
                .map_err(|e| TBankError::DatabaseError(e))?,
            okved_codes,
            verified_at: row
                .try_get("verified_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
            created_at: Some(
                row.try_get("created_at")
                    .map_err(|e| TBankError::DatabaseError(e))?,
            ),
            updated_at: Some(
                row.try_get("updated_at")
                    .map_err(|e| TBankError::DatabaseError(e))?,
            ),
        })
    }
}

/// Request structure for counterparty verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CounterpartyVerificationRequest {
    pub inn: String,
    pub kpp: Option<String>,
}

impl CounterpartyVerificationRequest {
    /// Validate the request data
    pub fn validate(&self) -> Result<(), String> {
        // Validate INN format using centralized validator
        use crate::counterparty::validator::InnKppValidator;
        if InnKppValidator::validate_inn(&self.inn).is_err() {
            return Err(format!("Invalid INN format: {}", self.inn));
        }

        if let Some(ref kpp) = self.kpp {
            if !CounterpartyData::validate_kpp(kpp) {
                return Err(format!("Invalid KPP format: {}", kpp));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inn_validation() {
        assert!(CounterpartyData::validate_inn("7707083893"));
        assert!(CounterpartyData::validate_inn("123456789012"));
        assert!(!CounterpartyData::validate_inn("123"));
        assert!(!CounterpartyData::validate_inn("12345678901"));
        assert!(!CounterpartyData::validate_inn("abcd567890"));
    }

    #[test]
    fn test_kpp_validation() {
        assert!(CounterpartyData::validate_kpp("770701001"));
        assert!(!CounterpartyData::validate_kpp("12345678"));
        assert!(!CounterpartyData::validate_kpp("1234567890"));
        assert!(!CounterpartyData::validate_kpp("abcd56789"));
    }

    #[test]
    fn test_counterparty_creation() {
        let counterparty = CounterpartyData::new(
            "7707083893".to_string(),
            Some("770701001".to_string()),
            "Test Company LLC".to_string(),
            "Test Co".to_string(),
            "Moscow, Russia".to_string(),
            CounterpartyStatus::Active,
            Utc::now(),
            vec!["62.01".to_string()],
        );

        assert_eq!(counterparty.inn, "7707083893");
        assert!(counterparty.is_active());
        assert!(counterparty.created_at.is_some());
    }
}
