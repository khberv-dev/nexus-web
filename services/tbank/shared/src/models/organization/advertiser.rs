use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

use super::LegalEntity;

/// Advertiser data model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct AdvertiserData {
    pub id: Uuid,
    pub organization_id: Uuid,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub campaigns: serde_json::Value, // Array of campaign IDs
    #[ts(type = "string")]
    pub balance: Decimal,
    #[ts(type = "string")]
    pub credit_limit: Decimal,
    pub erir_id: Option<String>,
    pub erir_registered: bool,
    pub erir_registration_date: Option<DateTime<Utc>>,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub erir_data: serde_json::Value,
    #[ts(type = "string")]
    pub total_spent: Decimal,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl AdvertiserData {
    /// Get campaigns as Vec<Uuid>
    pub fn get_campaigns(&self) -> Vec<Uuid> {
        serde_json::from_value(self.campaigns.clone()).unwrap_or_default()
    }

    /// Check if has sufficient balance
    pub fn has_sufficient_balance(&self, amount: Decimal) -> bool {
        self.balance >= amount
    }

    /// Check if ERIR registered
    pub fn is_erir_registered(&self) -> bool {
        self.erir_registered && self.erir_id.is_some()
    }

    /// Get available balance (balance + credit limit)
    pub fn available_balance(&self) -> Decimal {
        self.balance + self.credit_limit
    }
}

/// Advertiser onboarding request
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct AdvertiserOnboardingRequest {
    pub organization_name: String,
    pub legal_entity: LegalEntity,
    pub erir_registration: bool,
    #[ts(type = "string")]
    pub initial_budget: Option<Decimal>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_has_sufficient_balance() {
        let advertiser = AdvertiserData {
            id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            campaigns: serde_json::json!([]),
            balance: Decimal::from(1000),
            credit_limit: Decimal::from(500),
            erir_id: None,
            erir_registered: false,
            erir_registration_date: None,
            erir_data: serde_json::json!({}),
            total_spent: Decimal::ZERO,
            metadata: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(advertiser.has_sufficient_balance(Decimal::from(500)));
        assert!(!advertiser.has_sufficient_balance(Decimal::from(2000)));
        assert_eq!(advertiser.available_balance(), Decimal::from(1500));
    }
}
