use chrono::{DateTime, Datelike, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, instrument, warn};
use uuid::Uuid;

use shared::metrics::MetricsCollector;

use crate::{
    audit::AuditLogger,
    counterparty::validator::InnKppValidator,
    client::TBankClient,
    database::b2b_queries,
    types::{B2BInvoice, B2BInvoiceStatus, Currency, TBankError, TBankResult},
};

/// Billing engine integration for automatic B2B invoice creation
#[derive(Clone)]
pub struct BillingEngineIntegration {
    tbank_client: Arc<TBankClient>,
    audit_logger: Arc<AuditLogger>,
    db_pool: Arc<sqlx::PgPool>,
    metrics: Arc<MetricsCollector>,
}

/// Event from billing-engine that triggers invoice creation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignBillingEvent {
    pub campaign_id: Uuid,
    pub advertiser_id: Uuid,
    pub advertiser_inn: String,
    pub advertiser_kpp: Option<String>,
    pub advertiser_name: String,
    pub total_amount: rust_decimal::Decimal,
    pub currency: Currency,
    pub billing_period_start: DateTime<Utc>,
    pub billing_period_end: DateTime<Utc>,
    pub description: String,
    pub due_date: DateTime<Utc>,
    pub trace_id: String,
}

/// Response from CPV transaction processing (mock for now)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CPVTransactionResponse {
    pub transaction_id: String,
    pub final_amount: String,
    pub trace_id: String,
}

/// Response from automatic invoice creation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoInvoiceResponse {
    pub invoice_id: Uuid,
    pub invoice_number: String,
    pub tbank_invoice_id: Option<String>,
    pub status: B2BInvoiceStatus,
    pub pdf_url: Option<String>,
    pub payment_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Configuration for billing integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingIntegrationConfig {
    pub auto_create_invoices: bool,
    pub default_due_days: i32,
    pub min_invoice_amount: rust_decimal::Decimal,
    pub max_invoice_amount: rust_decimal::Decimal,
    pub require_counterparty_verification: bool,
}

impl Default for BillingIntegrationConfig {
    fn default() -> Self {
        Self {
            auto_create_invoices: true,
            default_due_days: 30,
            min_invoice_amount: rust_decimal::Decimal::new(100, 2), // 1.00 RUB
            max_invoice_amount: rust_decimal::Decimal::new(10_000_000, 2), // 100,000.00 RUB
            require_counterparty_verification: true,
        }
    }
}

impl BillingEngineIntegration {
    /// Create new billing engine integration
    pub fn new(
        tbank_client: Arc<TBankClient>,
        audit_logger: Arc<AuditLogger>,
        db_pool: Arc<sqlx::PgPool>,
        metrics: Arc<MetricsCollector>,
    ) -> Self {
        Self {
            tbank_client,
            audit_logger,
            db_pool,
            metrics,
        }
    }

    /// Process campaign billing event and create B2B invoice automatically
    #[instrument(skip(self, event))]
    pub async fn process_campaign_billing_event(
        &self,
        event: &CampaignBillingEvent,
        config: &BillingIntegrationConfig,
    ) -> TBankResult<AutoInvoiceResponse> {
        info!(
            campaign_id = %event.campaign_id,
            advertiser_id = %event.advertiser_id,
            amount = %event.total_amount,
            "Processing campaign billing event for automatic invoice creation"
        );

        // Validate event data
        self.validate_billing_event(event, config).await?;

        // Check if invoice already exists for this campaign and billing period
        if let Some(existing_invoice) = self.find_existing_invoice(event).await? {
            warn!(
                campaign_id = %event.campaign_id,
                existing_invoice_id = %existing_invoice.id.unwrap_or_default(),
                "Invoice already exists for this campaign billing period"
            );

            return Ok(AutoInvoiceResponse {
                invoice_id: existing_invoice.id.expect("Invoice ID should be set"),
                invoice_number: existing_invoice.invoice_number,
                tbank_invoice_id: existing_invoice.tbank_invoice_id,
                status: existing_invoice.status,
                pdf_url: existing_invoice.pdf_url,
                payment_url: existing_invoice.incoming_invoice_url,
                created_at: existing_invoice
                    .created_at
                    .expect("Created at should be set"),
            });
        }

        // Verify counterparty if required
        if config.require_counterparty_verification {
            self.verify_counterparty(&event.advertiser_inn, event.advertiser_kpp.as_deref())
                .await?;
        }

        // Create B2B invoice
        let invoice = self.create_b2b_invoice_from_event(event, config).await?;

        // Send invoice via T-Bank API
        let tbank_response = self.send_invoice_to_tbank(&invoice).await?;

        // Update invoice with T-Bank response data
        let updated_invoice = self
            .update_invoice_with_tbank_data(&invoice, &tbank_response)
            .await?;

        // Log successful invoice creation
        self.audit_logger
            .log_billing_integration_event(
                event.campaign_id,
                updated_invoice.id.expect("Invoice ID should be set"),
                "auto_invoice_created",
                &event.trace_id,
            )
            .await?;

        // Update metrics - using a generic HTTP request metric for now
        self.metrics.record_http_request(
            "POST",
            "billing_integration",
            200,
            1.0,
            "tbank-integration",
        );

        Ok(AutoInvoiceResponse {
            invoice_id: updated_invoice.id.expect("Invoice ID should be set"),
            invoice_number: updated_invoice.invoice_number,
            tbank_invoice_id: updated_invoice.tbank_invoice_id,
            status: updated_invoice.status,
            pdf_url: updated_invoice.pdf_url,
            payment_url: updated_invoice.incoming_invoice_url,
            created_at: updated_invoice
                .created_at
                .expect("Created at should be set"),
        })
    }

    /// Handle CPV transaction completion and trigger billing if needed
    #[instrument(skip(self, cpv_response))]
    pub async fn handle_cpv_transaction_completion(
        &self,
        cpv_response: &CPVTransactionResponse,
        config: &BillingIntegrationConfig,
    ) -> TBankResult<Option<AutoInvoiceResponse>> {
        info!(
            transaction_id = %cpv_response.transaction_id,
            final_amount = %cpv_response.final_amount,
            "Handling CPV transaction completion for potential billing"
        );

        // Check if this transaction should trigger billing
        if !self.should_trigger_billing(cpv_response, config).await? {
            return Ok(None);
        }

        // Get campaign and advertiser information from transaction
        let campaign_info = self
            .get_campaign_info_from_transaction(cpv_response)
            .await?;

        // Create billing event from CPV transaction
        let billing_event = CampaignBillingEvent {
            campaign_id: campaign_info.campaign_id,
            advertiser_id: campaign_info.advertiser_id,
            advertiser_inn: campaign_info.advertiser_inn,
            advertiser_kpp: campaign_info.advertiser_kpp,
            advertiser_name: campaign_info.advertiser_name,
            total_amount: cpv_response.final_amount.parse().map_err(|e| {
                TBankError::ValidationError(format!("Invalid amount format: {}", e))
            })?,
            currency: Currency::RUB, // Assuming RUB for now
            billing_period_start: campaign_info.billing_period_start,
            billing_period_end: campaign_info.billing_period_end,
            description: format!(
                "Campaign billing for transaction {}",
                cpv_response.transaction_id
            ),
            due_date: Utc::now() + chrono::Duration::days(config.default_due_days as i64),
            trace_id: cpv_response.trace_id.clone(),
        };

        // Process the billing event
        let invoice_response = self
            .process_campaign_billing_event(&billing_event, config)
            .await?;

        Ok(Some(invoice_response))
    }

    /// Validate billing event data
    async fn validate_billing_event(
        &self,
        event: &CampaignBillingEvent,
        config: &BillingIntegrationConfig,
    ) -> TBankResult<()> {
        // Validate amount range
        if event.total_amount < config.min_invoice_amount {
            return Err(TBankError::ValidationError(format!(
                "Invoice amount {} is below minimum {}",
                event.total_amount, config.min_invoice_amount
            )));
        }

        if event.total_amount > config.max_invoice_amount {
            return Err(TBankError::ValidationError(format!(
                "Invoice amount {} exceeds maximum {}",
                event.total_amount, config.max_invoice_amount
            )));
        }

        // Validate INN format
        InnKppValidator::validate_inn(&event.advertiser_inn)
            .map_err(|e| TBankError::ValidationError(format!("Invalid INN: {}", e)))?;

        // Validate KPP format if provided
        if let Some(kpp) = &event.advertiser_kpp {
            InnKppValidator::validate_kpp(kpp)
                .map_err(|e| TBankError::ValidationError(format!("Invalid KPP: {}", e)))?;
        }

        // Validate billing period
        if event.billing_period_end <= event.billing_period_start {
            return Err(TBankError::ValidationError(
                "Billing period end must be after start".to_string(),
            ));
        }

        // Validate due date
        if event.due_date <= Utc::now() {
            return Err(TBankError::ValidationError(
                "Due date must be in the future".to_string(),
            ));
        }

        Ok(())
    }

    /// Find existing invoice for campaign and billing period
    async fn find_existing_invoice(
        &self,
        event: &CampaignBillingEvent,
    ) -> TBankResult<Option<B2BInvoice>> {
        // This would query the database for existing invoices
        // For now, return None (no existing invoice)
        // In a real implementation, you would check by campaign_id and billing period
        Ok(None)
    }

    /// Verify counterparty exists or create new one
    async fn verify_counterparty(&self, inn: &str, kpp: Option<&str>) -> TBankResult<()> {
        // Use centralized validation
        InnKppValidator::validate_inn_kpp(inn, kpp)
            .map_err(|e| TBankError::ValidationError(format!("Counterparty validation failed: {}", e)))?;

        // This would integrate with the counterparty verification module
        // For now, validation is sufficient
        Ok(())
    }

    /// Create B2B invoice from billing event
    async fn create_b2b_invoice_from_event(
        &self,
        event: &CampaignBillingEvent,
        _config: &BillingIntegrationConfig,
    ) -> TBankResult<B2BInvoice> {
        let invoice_number = self.generate_invoice_number(event).await?;

        let invoice = B2BInvoice {
            id: Some(Uuid::new_v4()),
            invoice_number,
            tbank_invoice_id: None,
            counterparty_inn: event.advertiser_inn.clone(),
            counterparty_kpp: event.advertiser_kpp.clone(),
            counterparty_name: event.advertiser_name.clone(),
            due_date: event.due_date.date_naive(),
            invoice_date: Some(Utc::now().date_naive()),
            account_number: None,
            total_amount: event.total_amount,
            status: B2BInvoiceStatus::Draft,
            pdf_url: None,
            incoming_invoice_url: None,
            comment: Some(event.description.clone()),
            custom_payment_purpose: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };

        // Store invoice in database
        b2b_queries::create_b2b_invoice(&*self.db_pool, &invoice).await?;

        Ok(invoice)
    }

    /// Send invoice to T-Bank API
    async fn send_invoice_to_tbank(&self, _invoice: &B2BInvoice) -> TBankResult<serde_json::Value> {
        // This would call the T-Bank API to send the invoice
        // For now, return a mock response
        Ok(serde_json::json!({
            "invoice_id": "tbank_12345",
            "pdf_url": "https://business.tbank.ru/invoice/12345.pdf",
            "payment_url": "https://business.tbank.ru/pay/12345"
        }))
    }

    /// Update invoice with T-Bank response data
    async fn update_invoice_with_tbank_data(
        &self,
        invoice: &B2BInvoice,
        tbank_response: &serde_json::Value,
    ) -> TBankResult<B2BInvoice> {
        let tbank_invoice_id = tbank_response["invoice_id"].as_str().map(|s| s.to_string());
        let pdf_url = tbank_response["pdf_url"].as_str().map(|s| s.to_string());
        let payment_url = tbank_response["payment_url"]
            .as_str()
            .map(|s| s.to_string());

        // Update invoice in database
        b2b_queries::update_b2b_invoice_tbank_data(
            &*self.db_pool,
            invoice.id.expect("Invoice ID should be set"),
            tbank_invoice_id.as_deref(),
            pdf_url.as_deref(),
            payment_url.as_deref(),
            B2BInvoiceStatus::Sent,
        )
        .await?;

        // Return updated invoice
        let mut updated_invoice = invoice.clone();
        updated_invoice.tbank_invoice_id = tbank_invoice_id;
        updated_invoice.pdf_url = pdf_url;
        updated_invoice.incoming_invoice_url = payment_url;
        updated_invoice.status = B2BInvoiceStatus::Sent;
        updated_invoice.updated_at = Some(Utc::now());

        Ok(updated_invoice)
    }

    /// Check if CPV transaction should trigger billing
    async fn should_trigger_billing(
        &self,
        _cpv_response: &CPVTransactionResponse,
        config: &BillingIntegrationConfig,
    ) -> TBankResult<bool> {
        // Check configuration
        if !config.auto_create_invoices {
            return Ok(false);
        }

        // Check if amount meets minimum threshold
        let amount: rust_decimal::Decimal = _cpv_response
            .final_amount
            .parse()
            .map_err(|e| TBankError::ValidationError(format!("Invalid amount format: {}", e)))?;

        Ok(amount >= config.min_invoice_amount)
    }

    /// Get campaign information from CPV transaction
    async fn get_campaign_info_from_transaction(
        &self,
        _cpv_response: &CPVTransactionResponse,
    ) -> TBankResult<CampaignInfo> {
        // This would query the database to get campaign and advertiser information
        // For now, return mock data
        Ok(CampaignInfo {
            campaign_id: Uuid::new_v4(),
            advertiser_id: Uuid::new_v4(),
            advertiser_inn: "7707083893".to_string(),
            advertiser_kpp: Some("770701001".to_string()),
            advertiser_name: "Test Advertiser LLC".to_string(),
            billing_period_start: Utc::now() - chrono::Duration::days(30),
            billing_period_end: Utc::now(),
        })
    }

    /// Generate unique invoice number
    async fn generate_invoice_number(&self, event: &CampaignBillingEvent) -> TBankResult<String> {
        let year = event.billing_period_end.year();
        let month = event.billing_period_end.month();

        // Generate sequential number (in real implementation, this would be atomic)
        let sequence = chrono::Utc::now().timestamp_millis() % 10000;

        Ok(format!("INV-{}-{:02}-{:04}", year, month, sequence))
    }

}

/// Campaign information for billing
#[derive(Debug, Clone)]
struct CampaignInfo {
    pub campaign_id: Uuid,
    pub advertiser_id: Uuid,
    pub advertiser_inn: String,
    pub advertiser_kpp: Option<String>,
    pub advertiser_name: String,
    pub billing_period_start: DateTime<Utc>,
    pub billing_period_end: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    // Note: INN/KPP validation tests moved to counterparty::validator module
    // Use InnKppValidator::validate_inn() and InnKppValidator::validate_kpp() instead

    #[tokio::test]
    async fn test_validate_billing_event() {
        let integration = create_test_integration();
        let config = BillingIntegrationConfig::default();

        let valid_event = CampaignBillingEvent {
            campaign_id: Uuid::new_v4(),
            advertiser_id: Uuid::new_v4(),
            advertiser_inn: "7707083893".to_string(),
            advertiser_kpp: Some("770701001".to_string()),
            advertiser_name: "Test Company".to_string(),
            total_amount: Decimal::new(10000, 2), // 100.00
            currency: Currency::RUB,
            billing_period_start: Utc::now() - chrono::Duration::days(30),
            billing_period_end: Utc::now(),
            description: "Test billing".to_string(),
            due_date: Utc::now() + chrono::Duration::days(30),
            trace_id: "test_trace".to_string(),
        };

        assert!(integration
            .validate_billing_event(&valid_event, &config)
            .await
            .is_ok());

        // Test invalid amount (too small)
        let mut invalid_event = valid_event.clone();
        invalid_event.total_amount = Decimal::new(50, 2); // 0.50
        assert!(integration
            .validate_billing_event(&invalid_event, &config)
            .await
            .is_err());

        // Test invalid INN
        let mut invalid_event = valid_event.clone();
        invalid_event.advertiser_inn = "invalid_inn".to_string();
        assert!(integration
            .validate_billing_event(&invalid_event, &config)
            .await
            .is_err());
    }

    fn create_test_integration() -> BillingEngineIntegration {
        // This would create a test instance with mock dependencies
        // For now, we'll create a minimal instance for testing validation methods
        use shared::metrics::MetricsCollector;
        use std::sync::Arc;

        let metrics = Arc::new(MetricsCollector::new().unwrap());
        let db_pool = Arc::new(create_test_db_pool());

        // Note: In real tests, you would use proper mock objects
        BillingEngineIntegration {
            tbank_client: Arc::new(create_mock_tbank_client()),
            audit_logger: Arc::new(create_mock_audit_logger()),
            db_pool,
            metrics,
        }
    }

    // TODO: Implement proper test infrastructure
    // Mock functions removed - use proper test setup with real dependencies
    // or implement proper mocking when needed
}
