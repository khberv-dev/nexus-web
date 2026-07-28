use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

use super::LegalEntity;

/// White-label settings
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct WhiteLabelSettings {
    pub logo: Option<String>,
    pub primary_color: Option<String>,
    pub domain: Option<String>,
    #[ts(type = "any")]
    pub custom_branding: Option<serde_json::Value>,
}

/// Agency data model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct AgencyData {
    pub id: Uuid,
    pub organization_id: Uuid,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub clients: serde_json::Value, // Array of client organization IDs
    #[ts(type = "string")]
    pub commission: Decimal,
    pub white_label_enabled: bool,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub white_label_settings: serde_json::Value,
    #[ts(type = "string")]
    pub total_commission_earned: Decimal,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl AgencyData {
    /// Get clients as Vec<Uuid>
    pub fn get_clients(&self) -> Vec<Uuid> {
        serde_json::from_value(self.clients.clone()).unwrap_or_default()
    }

    /// Get white-label settings
    pub fn get_white_label_settings(&self) -> Option<WhiteLabelSettings> {
        if self.white_label_enabled {
            serde_json::from_value(self.white_label_settings.clone()).ok()
        } else {
            None
        }
    }

    /// Calculate commission amount
    pub fn calculate_commission(&self, amount: Decimal) -> Decimal {
        amount * self.commission / Decimal::from(100)
    }

    /// Check if has white-label enabled
    pub fn has_white_label(&self) -> bool {
        self.white_label_enabled
    }
}

/// Agency onboarding request
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct AgencyOnboardingRequest {
    pub organization_name: String,
    pub legal_entity: LegalEntity,
    #[ts(type = "string")]
    pub commission: Decimal,
    pub white_label: bool,
    pub white_label_settings: Option<WhiteLabelSettings>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_commission() {
        let agency = AgencyData {
            id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            clients: serde_json::json!([]),
            commission: Decimal::from(15), // 15%
            white_label_enabled: false,
            white_label_settings: serde_json::json!({}),
            total_commission_earned: Decimal::ZERO,
            metadata: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let amount = Decimal::from(1000);
        let commission = agency.calculate_commission(amount);
        assert_eq!(commission, Decimal::from(150));
    }
}
