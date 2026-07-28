pub mod completion;
pub mod initialization;
pub mod methods;
pub mod validation;

pub use completion::{
    PaymentCompletionResult, PaymentCompletionService, PaymentInitializationService,
    PaymentProcessingService, PaymentStatusService, TBankPaymentStatusResponse,
};
pub use initialization::{
    PaymentInitializationResponse, TBankInitRequest, TBankInitResponse,
};
pub use methods::{PaymentMethodConfig, PaymentMethodManager};
pub use validation::PaymentValidator;

use crate::types::acquiring::methods::AcquiringPaymentMethod as PaymentMethod;
use crate::types::acquiring::payment::{
    AcquiringPayment, AcquiringPaymentInitializationRequest as PaymentInitializationRequest,
};
use crate::types::common::errors::TBankError;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

/// Main acquiring payment processor for physical persons
/// Handles all aspects of payment processing through T-Bank Acquiring API
/// Supports Card, SBP, QR, ApplePay, GooglePay, SamsungPay methods (BankTransfer excluded)
pub struct AcquiringPaymentProcessor {
    initialization_service: Arc<PaymentInitializationService>,
    completion_service: Arc<PaymentCompletionService>,
    status_service: Arc<PaymentStatusService>,
    processing_service: Arc<PaymentProcessingService>,
    method_manager: PaymentMethodManager,
}

impl AcquiringPaymentProcessor {
    /// Create a new acquiring payment processor
    pub fn new(terminal_key: String, password: String, base_url: String) -> Self {
        use completion::{PaymentCompletionConfig, PaymentInitializationService, PaymentProcessingService, PaymentStatusService};
        
        let config = PaymentCompletionConfig {
            terminal_key: terminal_key.clone(),
            password: password.clone(),
            base_url: base_url.clone(),
            timeout_seconds: 30,
            max_retries: 3,
        };

        let initialization_service = Arc::new(PaymentInitializationService::new(config.clone()));
        let status_service = Arc::new(PaymentStatusService::new(config.clone()));
        let processing_service = Arc::new(PaymentProcessingService::new(config.clone()));
        
        // Keep the old completion service for backward compatibility
        let completion_service = Arc::new(PaymentCompletionService::new(
            terminal_key,
            password,
            base_url,
        ));

        let method_manager = PaymentMethodManager::new();

        Self {
            initialization_service,
            completion_service,
            status_service,
            processing_service,
            method_manager,
        }
    }

    /// Initialize a new acquiring payment for physical persons
    pub async fn initialize_payment(
        &self,
        request: PaymentInitializationRequest,
        amount: Decimal,
        description: String,
        customer_email: Option<String>,
    ) -> Result<PaymentInitializationResponse, TBankError> {
        // Validate payment method
        self.method_manager
            .validate_method(&request.payment_method, amount)
            .map_err(|e| TBankError::ValidationError(e))?;

        // Initialize payment through T-Bank Acquiring API
        self.initialization_service
            .initialize_payment(&request)
            .await
    }

    /// Process payment completion
    pub async fn process_completion(
        &self,
        payment_id: &str,
        webhook_data: Option<serde_json::Value>,
    ) -> Result<PaymentCompletionResult, TBankError> {
        let completion = self
            .completion_service
            .process_completion(payment_id, webhook_data)
            .await?;

        Ok(completion)
    }

    /// Get available payment methods for the given amount
    /// Excludes BankTransfer as per requirements (only for legal entities)
    /// Requirements: 3.7
    pub fn get_available_methods(&self, amount: Decimal) -> Vec<PaymentMethod> {
        let all_methods = self.method_manager.get_available_methods(amount);
        // Ensure BankTransfer is not included (it's already excluded in the enum)
        all_methods
    }

    /// Get all supported payment methods for acquiring (physical persons)
    /// Returns: Card, SBP, QR, ApplePay, GooglePay, SamsungPay
    /// Requirements: 3.7
    pub fn get_supported_methods() -> Vec<PaymentMethod> {
        vec![
            PaymentMethod::Card,
            PaymentMethod::SBP,
            PaymentMethod::QR,
            PaymentMethod::ApplePay,
            PaymentMethod::GooglePay,
            PaymentMethod::SamsungPay,
        ]
    }

    /// Check if a payment method is supported
    pub fn is_method_supported(&self, method: &PaymentMethod) -> bool {
        self.method_manager.is_method_supported(method)
    }

    /// Validate payment parameters according to T-Bank Acquiring API requirements
    /// Validates: amount (positive), order_id (format), payment_method (supported)
    /// Requirements: 3.1, 3.7
    pub fn validate_payment_parameters(
        &self,
        amount: Decimal,
        payment_method: &PaymentMethod,
        order_id: Option<&str>,
    ) -> Result<(), TBankError> {
        PaymentValidator::validate_payment_parameters(amount, payment_method, order_id)
    }

    /// Validate complete payment initialization request
    /// Requirements: 3.1
    pub fn validate_initialization_request(
        &self,
        request: &PaymentInitializationRequest,
    ) -> Result<(), TBankError> {
        PaymentValidator::validate_initialization_request(request)
    }

    /// Check if payment can be retried
    pub fn can_retry_payment(&self, error_code: Option<&str>) -> bool {
        self.completion_service.can_retry_payment(error_code)
    }

    /// Get user-friendly error message
    pub fn get_error_message(&self, error_code: &str) -> String {
        self.completion_service.handle_error_code(error_code)
    }

    /// Update payment status (for webhook processing)
    pub async fn update_payment_status(
        &self,
        payment_id: Uuid,
        new_status: crate::types::acquiring::payment::AcquiringPaymentStatus,
    ) -> Result<(), TBankError> {
        // This method would typically update the payment status in the database
        // For now, we'll implement a placeholder that logs the status change
        tracing::info!(
            payment_id = ?payment_id,
            new_status = ?new_status,
            "Updating acquiring payment status"
        );

        // TODO: Implement actual database update logic
        // This should:
        // 1. Validate the status transition
        // 2. Update the payment record in the database
        // 3. Create audit log entry
        // 4. Trigger any necessary business logic (notifications, etc.)

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::acquiring::methods::AcquiringPaymentMethod as PaymentMethod;

    #[test]
    fn test_acquiring_payment_processor_creation() {
        let processor = AcquiringPaymentProcessor::new(
            "test_terminal".to_string(),
            "test_password".to_string(),
            "https://securepay.tinkoff.ru/v2".to_string(),
        );

        assert!(processor.is_method_supported(&PaymentMethod::Card));
        assert!(processor.is_method_supported(&PaymentMethod::ApplePay));
        assert!(processor.is_method_supported(&PaymentMethod::GooglePay));
        assert!(processor.is_method_supported(&PaymentMethod::SamsungPay));
    }

    #[test]
    fn test_validate_payment_parameters() {
        let processor = AcquiringPaymentProcessor::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        // Valid parameters
        assert!(processor
            .validate_payment_parameters(
                Decimal::from(1000),
                &PaymentMethod::Card,
                Some("order_123")
            )
            .is_ok());

        // Invalid amount (zero)
        assert!(processor
            .validate_payment_parameters(Decimal::ZERO, &PaymentMethod::Card, Some("order_123"))
            .is_err());

        // Invalid amount (negative)
        assert!(processor
            .validate_payment_parameters(
                Decimal::from(-100),
                &PaymentMethod::Card,
                Some("order_123")
            )
            .is_err());

        // Invalid order ID (empty)
        assert!(processor
            .validate_payment_parameters(Decimal::from(1000), &PaymentMethod::Card, Some(""))
            .is_err());

        // Invalid order ID (too long)
        assert!(processor
            .validate_payment_parameters(
                Decimal::from(1000),
                &PaymentMethod::Card,
                Some("this_order_id_is_way_too_long_and_exceeds_36_characters")
            )
            .is_err());

        // Invalid order ID (invalid characters)
        assert!(processor
            .validate_payment_parameters(
                Decimal::from(1000),
                &PaymentMethod::Card,
                Some("order@123")
            )
            .is_err());

        // Valid order ID with allowed characters
        assert!(processor
            .validate_payment_parameters(
                Decimal::from(1000),
                &PaymentMethod::Card,
                Some("order-123_test")
            )
            .is_ok());
    }

    #[test]
    fn test_get_available_methods() {
        let processor = AcquiringPaymentProcessor::new(
            "test".to_string(),
            "test".to_string(),
            "https://test.com".to_string(),
        );

        let methods = processor.get_available_methods(Decimal::from(1000));
        assert_eq!(methods.len(), 6); // All 6 methods should be available
        assert!(methods.contains(&PaymentMethod::Card));
        assert!(methods.contains(&PaymentMethod::SBP));
        assert!(methods.contains(&PaymentMethod::QR));
        assert!(methods.contains(&PaymentMethod::ApplePay));
        assert!(methods.contains(&PaymentMethod::GooglePay));
        assert!(methods.contains(&PaymentMethod::SamsungPay));
    }

    #[test]
    fn test_get_supported_methods() {
        let supported = AcquiringPaymentProcessor::get_supported_methods();
        assert_eq!(supported.len(), 6);
        assert!(supported.contains(&PaymentMethod::Card));
        assert!(supported.contains(&PaymentMethod::SBP));
        assert!(supported.contains(&PaymentMethod::QR));
        assert!(supported.contains(&PaymentMethod::ApplePay));
        assert!(supported.contains(&PaymentMethod::GooglePay));
        assert!(supported.contains(&PaymentMethod::SamsungPay));
        // Ensure BankTransfer is not included (it's not in the enum anyway)
    }
}
