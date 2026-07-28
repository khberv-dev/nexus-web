use crate::{models::organization::AdvertiserData, ADQuestError};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

/// Advertiser repository
pub struct AdvertiserRepository {
    pool: PgPool,
}

impl AdvertiserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create advertiser data
    pub async fn create(
        &self,
        organization_id: Uuid,
        initial_balance: Option<Decimal>,
    ) -> Result<AdvertiserData, ADQuestError> {
        let id = Uuid::new_v4();
        let balance = initial_balance.unwrap_or(Decimal::ZERO);

        let advertiser = sqlx::query_as::<_, AdvertiserData>(
            r#"
            INSERT INTO advertisers (
                id, organization_id, campaigns, balance, credit_limit,
                erir_registered, erir_data, total_spent, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(organization_id)
        .bind(serde_json::json!([]))
        .bind(balance)
        .bind(Decimal::ZERO)
        .bind(false)
        .bind(serde_json::json!({}))
        .bind(Decimal::ZERO)
        .bind(serde_json::json!({}))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to create advertiser data: {}", e))
        })?;

        Ok(advertiser)
    }

    /// Get advertiser by organization ID
    pub async fn get_by_organization_id(
        &self,
        organization_id: Uuid,
    ) -> Result<Option<AdvertiserData>, ADQuestError> {
        let advertiser = sqlx::query_as::<_, AdvertiserData>(
            r#"
            SELECT * FROM advertisers
            WHERE organization_id = $1
            "#,
        )
        .bind(organization_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to get advertiser: {}", e)))?;

        Ok(advertiser)
    }

    /// Update balance
    pub async fn update_balance(
        &self,
        organization_id: Uuid,
        amount: Decimal,
    ) -> Result<AdvertiserData, ADQuestError> {
        let advertiser = sqlx::query_as::<_, AdvertiserData>(
            r#"
            UPDATE advertisers
            SET 
                balance = balance + $2,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(amount)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to update balance: {}", e)))?;

        Ok(advertiser)
    }

    /// Deduct from balance (for campaign spending)
    pub async fn deduct_balance(
        &self,
        organization_id: Uuid,
        amount: Decimal,
    ) -> Result<AdvertiserData, ADQuestError> {
        let advertiser = sqlx::query_as::<_, AdvertiserData>(
            r#"
            UPDATE advertisers
            SET 
                balance = balance - $2,
                total_spent = total_spent + $2,
                updated_at = NOW()
            WHERE organization_id = $1 AND balance >= $2
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(amount)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to deduct balance: {}", e))
        })?;

        Ok(advertiser)
    }

    /// Update ERIR registration
    pub async fn update_erir_registration(
        &self,
        organization_id: Uuid,
        erir_id: &str,
        erir_data: serde_json::Value,
    ) -> Result<AdvertiserData, ADQuestError> {
        let advertiser = sqlx::query_as::<_, AdvertiserData>(
            r#"
            UPDATE advertisers
            SET 
                erir_id = $2,
                erir_registered = true,
                erir_registration_date = NOW(),
                erir_data = $3,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(erir_id)
        .bind(erir_data)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to update ERIR registration: {}", e))
        })?;

        Ok(advertiser)
    }

    /// Add campaign to advertiser
    pub async fn add_campaign(
        &self,
        organization_id: Uuid,
        campaign_id: Uuid,
    ) -> Result<AdvertiserData, ADQuestError> {
        let advertiser = sqlx::query_as::<_, AdvertiserData>(
            r#"
            UPDATE advertisers
            SET 
                campaigns = campaigns || $2::jsonb,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(serde_json::json!([campaign_id]))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to add campaign: {}", e)))?;

        Ok(advertiser)
    }

    /// Update credit limit
    pub async fn update_credit_limit(
        &self,
        organization_id: Uuid,
        credit_limit: Decimal,
    ) -> Result<AdvertiserData, ADQuestError> {
        let advertiser = sqlx::query_as::<_, AdvertiserData>(
            r#"
            UPDATE advertisers
            SET 
                credit_limit = $2,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(credit_limit)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to update credit limit: {}", e))
        })?;

        Ok(advertiser)
    }

    /// Get advertisers with low balance
    pub async fn get_low_balance(
        &self,
        threshold: Decimal,
    ) -> Result<Vec<AdvertiserData>, ADQuestError> {
        let advertisers = sqlx::query_as::<_, AdvertiserData>(
            r#"
            SELECT * FROM advertisers
            WHERE balance < $1
            ORDER BY balance ASC
            "#,
        )
        .bind(threshold)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to get low balance advertisers: {}", e))
        })?;

        Ok(advertisers)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests would require a test database setup
}
