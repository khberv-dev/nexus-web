use crate::{
    models::organization::{PublisherData, VerificationStatus},
    ADQuestError,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

/// Publisher repository
pub struct PublisherRepository {
    pool: PgPool,
}

impl PublisherRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create publisher data
    pub async fn create(
        &self,
        organization_id: Uuid,
        payment_info: serde_json::Value,
    ) -> Result<PublisherData, ADQuestError> {
        let id = Uuid::new_v4();

        let publisher = sqlx::query_as::<_, PublisherData>(
            r#"
            INSERT INTO publishers (
                id, organization_id, sites, payment_info, 
                verification_status, total_revenue, pending_payout, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(organization_id)
        .bind(serde_json::json!([]))
        .bind(payment_info)
        .bind(VerificationStatus::Pending)
        .bind(Decimal::ZERO)
        .bind(Decimal::ZERO)
        .bind(serde_json::json!({}))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to create publisher data: {}", e))
        })?;

        Ok(publisher)
    }

    /// Get publisher by organization ID
    pub async fn get_by_organization_id(
        &self,
        organization_id: Uuid,
    ) -> Result<Option<PublisherData>, ADQuestError> {
        let publisher = sqlx::query_as::<_, PublisherData>(
            r#"
            SELECT * FROM publishers
            WHERE organization_id = $1
            "#,
        )
        .bind(organization_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to get publisher: {}", e)))?;

        Ok(publisher)
    }

    /// Update verification status
    pub async fn update_verification_status(
        &self,
        organization_id: Uuid,
        status: VerificationStatus,
        notes: Option<&str>,
    ) -> Result<PublisherData, ADQuestError> {
        let verified_at = if status == VerificationStatus::Verified {
            Some(chrono::Utc::now())
        } else {
            None
        };

        let publisher = sqlx::query_as::<_, PublisherData>(
            r#"
            UPDATE publishers
            SET 
                verification_status = $2,
                verification_notes = $3,
                verified_at = $4,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(status)
        .bind(notes)
        .bind(verified_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to update verification status: {}", e))
        })?;

        Ok(publisher)
    }

    /// Add site to publisher
    pub async fn add_site(
        &self,
        organization_id: Uuid,
        site_id: Uuid,
    ) -> Result<PublisherData, ADQuestError> {
        let publisher = sqlx::query_as::<_, PublisherData>(
            r#"
            UPDATE publishers
            SET 
                sites = sites || $2::jsonb,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(serde_json::json!([site_id]))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to add site: {}", e)))?;

        Ok(publisher)
    }

    /// Update revenue
    pub async fn update_revenue(
        &self,
        organization_id: Uuid,
        revenue_delta: Decimal,
    ) -> Result<PublisherData, ADQuestError> {
        let publisher = sqlx::query_as::<_, PublisherData>(
            r#"
            UPDATE publishers
            SET 
                total_revenue = total_revenue + $2,
                pending_payout = pending_payout + $2,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(revenue_delta)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to update revenue: {}", e)))?;

        Ok(publisher)
    }

    /// Process payout
    pub async fn process_payout(
        &self,
        organization_id: Uuid,
        amount: Decimal,
    ) -> Result<PublisherData, ADQuestError> {
        let publisher = sqlx::query_as::<_, PublisherData>(
            r#"
            UPDATE publishers
            SET 
                pending_payout = pending_payout - $2,
                last_payout_at = NOW(),
                updated_at = NOW()
            WHERE organization_id = $1 AND pending_payout >= $2
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(amount)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to process payout: {}", e)))?;

        Ok(publisher)
    }

    /// Get publishers by verification status
    pub async fn get_by_verification_status(
        &self,
        status: VerificationStatus,
    ) -> Result<Vec<PublisherData>, ADQuestError> {
        let publishers = sqlx::query_as::<_, PublisherData>(
            r#"
            SELECT * FROM publishers
            WHERE verification_status = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(status)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!(
                "Failed to get publishers by verification status: {}",
                e
            ))
        })?;

        Ok(publishers)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests would require a test database setup
}
