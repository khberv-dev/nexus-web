use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use super::methods::AcquiringPaymentMethod;
use crate::types::{Currency, TBankError, TBankResult};

/// Acquiring payment data structure for physical persons
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AcquiringPayment {
    pub id: Option<Uuid>,
    pub order_id: String,
    pub tbank_payment_id: Option<String>,
    pub amount: Decimal,
    pub currency: Currency,
    pub payment_method: AcquiringPaymentMethod,
    pub status: AcquiringPaymentStatus,
    pub description: Option<String>,
    pub customer_email: Option<String>,
    pub customer_phone: Option<String>,
    pub payment_url: Option<String>,
    pub qr_code: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub commission_amount: Option<Decimal>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Request structure for acquiring payment initialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcquiringPaymentInitializationRequest {
    pub order_id: String,
    pub amount: Decimal,
    pub currency: Currency,
    pub payment_method: AcquiringPaymentMethod,
    pub description: Option<String>,
    pub customer_email: Option<String>,
    pub customer_phone: Option<String>,
    pub success_url: Option<String>,
    pub failure_url: Option<String>,
    pub notification_url: Option<String>,
}

impl AcquiringPaymentInitializationRequest {
    /// Validate the request
    pub fn validate(&self) -> Result<(), String> {
        if self.amount <= Decimal::ZERO {
            return Err("Amount must be positive".to_string());
        }

        if self.order_id.is_empty() {
            return Err("Order ID is required".to_string());
        }

        // Validate currency for acquiring operations
        if !self.currency.supports_acquiring() {
            return Err(format!(
                "Currency {} is not supported for acquiring operations",
                self.currency
            ));
        }

        // Validate payment method for amount
        super::methods::PaymentMethodValidator::validate_for_amount(
            &self.payment_method,
            self.amount,
        )?;

        // Validate customer email format if provided
        if let Some(ref email) = self.customer_email {
            if !email.contains('@') || email.trim().is_empty() {
                return Err("Invalid customer email format".to_string());
            }
        }

        // Validate customer phone format if provided (Russian format)
        if let Some(ref phone) = self.customer_phone {
            if !phone.starts_with("+7") || phone.len() != 12 {
                return Err("Customer phone must be in format +7XXXXXXXXXX".to_string());
            }
        }

        Ok(())
    }

    /// Convert to AcquiringPayment
    pub fn into_payment(self) -> AcquiringPayment {
        AcquiringPayment::new_with_default_expiration(
            self.order_id,
            self.amount,
            self.currency,
            self.payment_method,
        )
    }
}

/// Acquiring payment status lifecycle
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum AcquiringPaymentStatus {
    Initialized,
    Pending,
    Completed,
    Failed,
    Cancelled,
    Expired,
}

impl AcquiringPayment {
    /// Create AcquiringPayment from database row
    pub fn from_row(row: &sqlx::postgres::PgRow) -> TBankResult<Self> {
        let currency_str: String = row
            .try_get("currency")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let payment_method_str: String = row
            .try_get("payment_method")
            .map_err(|e| TBankError::DatabaseError(e))?;
        let status_str: String = row
            .try_get("status")
            .map_err(|e| TBankError::DatabaseError(e))?;

        let currency = currency_str
            .parse()
            .map_err(|e| TBankError::ValidationError(format!("Invalid currency: {}", e)))?;
        let payment_method = payment_method_str
            .parse()
            .map_err(|e| TBankError::ValidationError(format!("Invalid payment method: {}", e)))?;
        let status = status_str
            .parse()
            .map_err(|e| TBankError::ValidationError(format!("Invalid status: {}", e)))?;

        Ok(AcquiringPayment {
            id: row
                .try_get("id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            order_id: row
                .try_get("order_id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            tbank_payment_id: row
                .try_get("tbank_payment_id")
                .map_err(|e| TBankError::DatabaseError(e))?,
            amount: row
                .try_get("amount")
                .map_err(|e| TBankError::DatabaseError(e))?,
            currency,
            payment_method,
            status,
            description: row
                .try_get("description")
                .map_err(|e| TBankError::DatabaseError(e))?,
            customer_email: row
                .try_get("customer_email")
                .map_err(|e| TBankError::DatabaseError(e))?,
            customer_phone: row
                .try_get("customer_phone")
                .map_err(|e| TBankError::DatabaseError(e))?,
            payment_url: row
                .try_get("payment_url")
                .map_err(|e| TBankError::DatabaseError(e))?,
            qr_code: row
                .try_get("qr_code")
                .map_err(|e| TBankError::DatabaseError(e))?,
            expires_at: row
                .try_get("expires_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
            commission_amount: row
                .try_get("commission_amount")
                .map_err(|e| TBankError::DatabaseError(e))?,
            completed_at: row
                .try_get("completed_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
            created_at: row
                .try_get("created_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
            updated_at: row
                .try_get("updated_at")
                .map_err(|e| TBankError::DatabaseError(e))?,
        })
    }

    /// Create a new acquiring payment
    pub fn new(
        order_id: String,
        amount: Decimal,
        currency: Currency,
        payment_method: AcquiringPaymentMethod,
        expires_at: DateTime<Utc>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            order_id,
            tbank_payment_id: None,
            amount,
            currency,
            payment_method,
            status: AcquiringPaymentStatus::Initialized,
            description: None,
            customer_email: None,
            customer_phone: None,
            payment_url: None,
            qr_code: None,
            expires_at,
            commission_amount: None,
            completed_at: None,
            created_at: Some(now),
            updated_at: Some(now),
        }
    }

    /// Create payment with default 1-hour expiration
    pub fn new_with_default_expiration(
        order_id: String,
        amount: Decimal,
        currency: Currency,
        payment_method: AcquiringPaymentMethod,
    ) -> Self {
        let expires_at = Utc::now() + chrono::Duration::hours(1);
        Self::new(order_id, amount, currency, payment_method, expires_at)
    }

    /// Validate payment data
    pub fn validate(&self) -> Result<(), String> {
        if self.amount <= Decimal::ZERO {
            return Err("Payment amount must be positive".to_string());
        }

        if self.order_id.is_empty() {
            return Err("Order ID is required".to_string());
        }

        if self.expires_at <= Utc::now() {
            return Err("Payment expiration must be in the future".to_string());
        }

        Ok(())
    }

    /// Check if status transition is valid
    pub fn can_transition_to(&self, new_status: &AcquiringPaymentStatus) -> bool {
        use AcquiringPaymentStatus::*;

        match (&self.status, new_status) {
            (Initialized, Pending) => true,
            (Pending, Completed) => true,
            (Pending, Failed) => true,
            (Pending, Cancelled) => true,
            (Initialized, Failed) => true,
            (Initialized, Cancelled) => true,
            (Initialized, Expired) => true,
            (Pending, Expired) => true,
            _ => false,
        }
    }

    /// Update payment status
    pub fn update_status(&mut self, new_status: AcquiringPaymentStatus) -> Result<(), String> {
        if !self.can_transition_to(&new_status) {
            return Err(format!(
                "Invalid payment status transition from {:?} to {:?}",
                self.status, new_status
            ));
        }

        self.status = new_status.clone();
        self.updated_at = Some(Utc::now());

        if matches!(new_status, AcquiringPaymentStatus::Completed) {
            self.completed_at = Some(Utc::now());
        }

        Ok(())
    }

    /// Check if payment is expired
    pub fn is_expired(&self) -> bool {
        matches!(self.status, AcquiringPaymentStatus::Expired) || self.expires_at < Utc::now()
    }

    /// Check if payment is completed
    pub fn is_completed(&self) -> bool {
        matches!(self.status, AcquiringPaymentStatus::Completed)
    }

    /// Check if payment is failed
    pub fn is_failed(&self) -> bool {
        matches!(self.status, AcquiringPaymentStatus::Failed)
    }

    /// Check if payment can be retried
    pub fn can_retry(&self) -> bool {
        matches!(
            self.status,
            AcquiringPaymentStatus::Failed
                | AcquiringPaymentStatus::Expired
                | AcquiringPaymentStatus::Cancelled
        )
    }
}

/// Acquiring payment completion information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcquiringPaymentCompletion {
    pub transaction_id: String,
    pub status: AcquiringPaymentStatus,
    pub commission_amount: Option<Decimal>,
    pub completion_time: DateTime<Utc>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

impl std::fmt::Display for AcquiringPaymentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AcquiringPaymentStatus::Initialized => write!(f, "Initialized"),
            AcquiringPaymentStatus::Pending => write!(f, "Pending"),
            AcquiringPaymentStatus::Completed => write!(f, "Completed"),
            AcquiringPaymentStatus::Failed => write!(f, "Failed"),
            AcquiringPaymentStatus::Cancelled => write!(f, "Cancelled"),
            AcquiringPaymentStatus::Expired => write!(f, "Expired"),
        }
    }
}

impl std::str::FromStr for AcquiringPaymentStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Initialized" => Ok(AcquiringPaymentStatus::Initialized),
            "Pending" => Ok(AcquiringPaymentStatus::Pending),
            "Completed" => Ok(AcquiringPaymentStatus::Completed),
            "Failed" => Ok(AcquiringPaymentStatus::Failed),
            "Cancelled" => Ok(AcquiringPaymentStatus::Cancelled),
            "Expired" => Ok(AcquiringPaymentStatus::Expired),
            _ => Err(format!("Invalid acquiring payment status: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_acquiring_payment_creation() {
        let order_id = "order_123".to_string();
        let payment = AcquiringPayment::new_with_default_expiration(
            order_id.clone(),
            Decimal::from(1000),
            Currency::RUB,
            AcquiringPaymentMethod::Card,
        );

        assert_eq!(payment.status, AcquiringPaymentStatus::Initialized);
        assert_eq!(payment.order_id, order_id);
        assert!(payment.expires_at > Utc::now());
    }

    #[test]
    fn test_acquiring_payment_status_transitions() {
        let mut payment = AcquiringPayment::new_with_default_expiration(
            "order_123".to_string(),
            Decimal::from(1000),
            Currency::RUB,
            AcquiringPaymentMethod::Card,
        );

        assert!(payment
            .update_status(AcquiringPaymentStatus::Pending)
            .is_ok());
        assert!(payment
            .update_status(AcquiringPaymentStatus::Completed)
            .is_ok());
        assert!(payment.is_completed());
        assert!(payment.completed_at.is_some());
    }

    #[test]
    fn test_acquiring_payment_status_parsing() {
        assert_eq!(
            AcquiringPaymentStatus::from_str("Initialized").unwrap(),
            AcquiringPaymentStatus::Initialized
        );
        assert_eq!(
            AcquiringPaymentStatus::from_str("Completed").unwrap(),
            AcquiringPaymentStatus::Completed
        );
        assert!(AcquiringPaymentStatus::from_str("Invalid").is_err());
    }

    #[test]
    fn test_acquiring_payment_expiration() {
        let mut payment = AcquiringPayment::new(
            "order_123".to_string(),
            Decimal::from(1000),
            Currency::RUB,
            AcquiringPaymentMethod::Card,
            Utc::now() - chrono::Duration::hours(1), // Already expired
        );

        assert!(payment.is_expired());

        // Update status to expired to allow retry
        payment
            .update_status(AcquiringPaymentStatus::Expired)
            .unwrap();
        assert!(payment.can_retry());
    }

    #[test]
    fn test_acquiring_payment_request_validation() {
        let request = AcquiringPaymentInitializationRequest {
            order_id: "order_123".to_string(),
            amount: Decimal::from(1000),
            currency: Currency::RUB,
            payment_method: AcquiringPaymentMethod::Card,
            description: Some("Test payment".to_string()),
            customer_email: Some("test@example.com".to_string()),
            customer_phone: Some("+79161234567".to_string()),
            success_url: None,
            failure_url: None,
            notification_url: None,
        };

        assert!(request.validate().is_ok());

        // Test invalid currency
        let invalid_request = AcquiringPaymentInitializationRequest {
            currency: Currency::USD, // Not supported for acquiring
            ..request.clone()
        };
        assert!(invalid_request.validate().is_err());

        // Test invalid email
        let invalid_email_request = AcquiringPaymentInitializationRequest {
            customer_email: Some("invalid-email".to_string()),
            ..request.clone()
        };
        assert!(invalid_email_request.validate().is_err());

        // Test invalid phone
        let invalid_phone_request = AcquiringPaymentInitializationRequest {
            customer_phone: Some("123456789".to_string()),
            ..request
        };
        assert!(invalid_phone_request.validate().is_err());
    }
}
