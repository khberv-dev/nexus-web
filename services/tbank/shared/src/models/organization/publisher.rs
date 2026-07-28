use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;
use uuid::Uuid;

use super::VerificationStatus;

/// Payment method enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub enum PaymentMethod {
    BankTransfer,
    Paypal,
    Crypto,
}

/// Payment information
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct PaymentInfo {
    pub method: PaymentMethod,
    pub bank_account: Option<String>,
    pub bank_name: Option<String>,
    pub bik: Option<String>,
    pub tax_id: String, // INN
}

/// Publisher data model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct PublisherData {
    pub id: Uuid,
    pub organization_id: Uuid,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub sites: serde_json::Value, // Array of site IDs
    #[sqlx(json)]
    #[ts(type = "any")]
    pub payment_info: serde_json::Value,
    pub verification_status: VerificationStatus,
    pub verification_notes: Option<String>,
    pub verified_at: Option<DateTime<Utc>>,
    #[ts(type = "string")]
    pub total_revenue: Decimal,
    #[ts(type = "string")]
    pub pending_payout: Decimal,
    pub last_payout_at: Option<DateTime<Utc>>,
    #[sqlx(json)]
    #[ts(type = "any")]
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PublisherData {
    /// Get sites as Vec<Uuid>
    pub fn get_sites(&self) -> Vec<Uuid> {
        serde_json::from_value(self.sites.clone()).unwrap_or_default()
    }

    /// Get payment info
    pub fn get_payment_info(&self) -> Option<PaymentInfo> {
        serde_json::from_value(self.payment_info.clone()).ok()
    }

    /// Check if verified
    pub fn is_verified(&self) -> bool {
        self.verification_status == VerificationStatus::Verified
    }

    /// Check if has pending payout
    pub fn has_pending_payout(&self) -> bool {
        self.pending_payout > Decimal::ZERO
    }
}

/// Publisher onboarding request
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/organization/")]
pub struct PublisherOnboardingRequest {
    pub organization_name: String,
    pub site_url: String,
    pub site_category: String,
    pub monthly_visitors: u32,
    pub payment_info: PaymentInfo,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_publisher_is_verified() {
        let publisher = PublisherData {
            id: Uuid::new_v4(),
            organization_id: Uuid::new_v4(),
            sites: serde_json::json!([]),
            payment_info: serde_json::json!({}),
            verification_status: VerificationStatus::Verified,
            verification_notes: None,
            verified_at: Some(Utc::now()),
            total_revenue: Decimal::ZERO,
            pending_payout: Decimal::ZERO,
            last_payout_at: None,
            metadata: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        assert!(publisher.is_verified());
    }
}
