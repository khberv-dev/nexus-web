use crate::{models::organization::AgencyData, ADQuestError};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

/// Agency repository
pub struct AgencyRepository {
    pool: PgPool,
}

impl AgencyRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Create agency data
    pub async fn create(
        &self,
        organization_id: Uuid,
        commission: Decimal,
        white_label_enabled: bool,
        white_label_settings: serde_json::Value,
    ) -> Result<AgencyData, ADQuestError> {
        let id = Uuid::new_v4();

        let agency = sqlx::query_as::<_, AgencyData>(
            r#"
            INSERT INTO agencies (
                id, organization_id, clients, commission,
                white_label_enabled, white_label_settings,
                total_commission_earned, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(organization_id)
        .bind(serde_json::json!([]))
        .bind(commission)
        .bind(white_label_enabled)
        .bind(white_label_settings)
        .bind(Decimal::ZERO)
        .bind(serde_json::json!({}))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to create agency data: {}", e))
        })?;

        Ok(agency)
    }

    /// Get agency by organization ID
    pub async fn get_by_organization_id(
        &self,
        organization_id: Uuid,
    ) -> Result<Option<AgencyData>, ADQuestError> {
        let agency = sqlx::query_as::<_, AgencyData>(
            r#"
            SELECT * FROM agencies
            WHERE organization_id = $1
            "#,
        )
        .bind(organization_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to get agency: {}", e)))?;

        Ok(agency)
    }

    /// Add client to agency
    pub async fn add_client(
        &self,
        organization_id: Uuid,
        client_organization_id: Uuid,
    ) -> Result<AgencyData, ADQuestError> {
        let agency = sqlx::query_as::<_, AgencyData>(
            r#"
            UPDATE agencies
            SET 
                clients = clients || $2::jsonb,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(serde_json::json!([client_organization_id]))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to add client: {}", e)))?;

        Ok(agency)
    }

    /// Remove client from agency
    pub async fn remove_client(
        &self,
        organization_id: Uuid,
        client_organization_id: Uuid,
    ) -> Result<AgencyData, ADQuestError> {
        // Get current clients
        let agency = self
            .get_by_organization_id(organization_id)
            .await?
            .ok_or_else(|| ADQuestError::NotFound("Agency not found".to_string()))?;

        let mut clients: Vec<Uuid> = agency.get_clients();
        clients.retain(|&id| id != client_organization_id);

        let agency = sqlx::query_as::<_, AgencyData>(
            r#"
            UPDATE agencies
            SET 
                clients = $2,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(serde_json::to_value(clients).unwrap_or(serde_json::json!([])))
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to remove client: {}", e)))?;

        Ok(agency)
    }

    /// Update commission
    pub async fn update_commission(
        &self,
        organization_id: Uuid,
        commission: Decimal,
    ) -> Result<AgencyData, ADQuestError> {
        let agency = sqlx::query_as::<_, AgencyData>(
            r#"
            UPDATE agencies
            SET 
                commission = $2,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(commission)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ADQuestError::Internal(format!("Failed to update commission: {}", e)))?;

        Ok(agency)
    }

    /// Add commission earned
    pub async fn add_commission_earned(
        &self,
        organization_id: Uuid,
        amount: Decimal,
    ) -> Result<AgencyData, ADQuestError> {
        let agency = sqlx::query_as::<_, AgencyData>(
            r#"
            UPDATE agencies
            SET 
                total_commission_earned = total_commission_earned + $2,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(amount)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to add commission earned: {}", e))
        })?;

        Ok(agency)
    }

    /// Update white-label settings
    pub async fn update_white_label(
        &self,
        organization_id: Uuid,
        enabled: bool,
        settings: serde_json::Value,
    ) -> Result<AgencyData, ADQuestError> {
        let agency = sqlx::query_as::<_, AgencyData>(
            r#"
            UPDATE agencies
            SET 
                white_label_enabled = $2,
                white_label_settings = $3,
                updated_at = NOW()
            WHERE organization_id = $1
            RETURNING *
            "#,
        )
        .bind(organization_id)
        .bind(enabled)
        .bind(settings)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to update white-label settings: {}", e))
        })?;

        Ok(agency)
    }

    /// Get agencies with white-label enabled
    pub async fn get_white_label_agencies(&self) -> Result<Vec<AgencyData>, ADQuestError> {
        let agencies = sqlx::query_as::<_, AgencyData>(
            r#"
            SELECT * FROM agencies
            WHERE white_label_enabled = true
            ORDER BY created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to get white-label agencies: {}", e))
        })?;

        Ok(agencies)
    }

    /// Get top agencies by commission earned
    pub async fn get_top_by_commission(
        &self,
        limit: i64,
    ) -> Result<Vec<AgencyData>, ADQuestError> {
        let agencies = sqlx::query_as::<_, AgencyData>(
            r#"
            SELECT * FROM agencies
            ORDER BY total_commission_earned DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            ADQuestError::Internal(format!("Failed to get top agencies: {}", e))
        })?;

        Ok(agencies)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests would require a test database setup
}
