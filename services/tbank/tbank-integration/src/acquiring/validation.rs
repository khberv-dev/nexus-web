use crate::types::acquiring::methods::AcquiringPaymentMethod as PaymentMethod;
use crate::types::acquiring::payment::AcquiringPaymentInitializationRequest as PaymentInitializationRequest;
use crate::types::common::errors::TBankError;
use crate::types::common::validators::EmailValidator;
use rust_decimal::Decimal;

/// Payment validation utilities for acquiring operations
pub struct PaymentValidator;

impl PaymentValidator {
    /// Validate payment parameters according to T-Bank Acquiring API requirements
    /// Validates: amount (positive), order_id (format), payment_method (supported)
    /// Requirements: 3.1, 3.7
    pub fn validate_payment_parameters(
        amount: Decimal,
        payment_method: &PaymentMethod,
        order_id: Option<&str>,
    ) -> Result<(), TBankError> {
        // Validate amount - must be positive
        if amount <= Decimal::ZERO {
            return Err(TBankError::ValidationError(
                "Amount must be positive".to_string(),
            ));
        }

        // Validate payment method for amount
        crate::types::acquiring::methods::PaymentMethodValidator::validate_for_amount(
            payment_method,
            amount,
        )
        .map_err(|e| TBankError::ValidationError(e))?;

        // Validate order_id format if provided
        if let Some(id) = order_id {
            Self::validate_order_id(id)?;
        }

        Ok(())
    }

    /// Validate order ID format
    pub fn validate_order_id(order_id: &str) -> Result<(), TBankError> {
        if order_id.is_empty() {
            return Err(TBankError::ValidationError(
                "Order ID cannot be empty".to_string(),
            ));
        }
        if order_id.len() > 36 {
            return Err(TBankError::ValidationError(
                "Order ID must not exceed 36 characters".to_string(),
            ));
        }
        // Check for valid characters (alphanumeric, hyphens, underscores)
        if !order_id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return Err(TBankError::ValidationError(
                "Order ID can only contain alphanumeric characters, hyphens, and underscores"
                    .to_string(),
            ));
        }
        Ok(())
    }

    /// Validate complete payment initialization request
    /// Requirements: 3.1
    pub fn validate_initialization_request(
        request: &PaymentInitializationRequest,
    ) -> Result<(), TBankError> {
        // Validate basic parameters
        Self::validate_payment_parameters(
            request.amount,
            &request.payment_method,
            Some(&request.order_id),
        )?;

        // Validate currency for acquiring operations
        if !request.currency.supports_acquiring() {
            return Err(TBankError::ValidationError(format!(
                "Currency {} is not supported for acquiring operations",
                request.currency
            )));
        }

        // Validate customer email format if provided
        if let Some(ref email) = request.customer_email {
            Self::validate_email(email)?;
        }

        // Validate customer phone format if provided (Russian format)
        if let Some(ref phone) = request.customer_phone {
            Self::validate_phone(phone)?;
        }

        // Validate URLs if provided
        if let Some(ref url) = request.success_url {
            Self::validate_url(url, "Success URL")?;
        }

        if let Some(ref url) = request.failure_url {
            Self::validate_url(url, "Failure URL")?;
        }

        if let Some(ref url) = request.notification_url {
            Self::validate_url(url, "Notification URL")?;
        }

        Ok(())
    }

    /// Validate email format
    pub fn validate_email(email: &str) -> Result<(), TBankError> {
        EmailValidator::validate(email)
    }

    /// Validate phone format (Russian format)
    pub fn validate_phone(phone: &str) -> Result<(), TBankError> {
        if !phone.starts_with("+7") || phone.len() != 12 {
            return Err(TBankError::ValidationError(
                "Customer phone must be in format +7XXXXXXXXXX".to_string(),
            ));
        }
        // Check that all characters after +7 are digits
        if !phone[2..].chars().all(|c| c.is_ascii_digit()) {
            return Err(TBankError::ValidationError(
                "Customer phone must contain only digits after +7".to_string(),
            ));
        }
        Ok(())
    }

    /// Validate URL format
    pub fn validate_url(url: &str, url_type: &str) -> Result<(), TBankError> {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(TBankError::ValidationError(format!(
                "{} must be a valid HTTP/HTTPS URL",
                url_type
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::acquiring::methods::AcquiringPaymentMethod;
    use crate::types::acquiring::payment::AcquiringPaymentInitializationRequest as PaymentInitializationRequest;
    use crate::types::common::currency::Currency;
    use rust_decimal::Decimal;

    #[test]
    fn test_validate_payment_parameters() {
        // Valid parameters
        assert!(PaymentValidator::validate_payment_parameters(
            Decimal::from(1000),
            &AcquiringPaymentMethod::Card,
            Some("order_123")
        )
        .is_ok());

        // Invalid amount (zero)
        assert!(PaymentValidator::validate_payment_parameters(
            Decimal::ZERO,
            &AcquiringPaymentMethod::Card,
            Some("order_123")
        )
        .is_err());

        // Invalid amount (negative)
        assert!(PaymentValidator::validate_payment_parameters(
            Decimal::from(-100),
            &AcquiringPaymentMethod::Card,
            Some("order_123")
        )
        .is_err());
    }

    #[test]
    fn test_validate_order_id() {
        // Valid order IDs
        assert!(PaymentValidator::validate_order_id("order_123").is_ok());
        assert!(PaymentValidator::validate_order_id("order-123").is_ok());
        assert!(PaymentValidator::validate_order_id("ORDER123").is_ok());

        // Invalid order IDs
        assert!(PaymentValidator::validate_order_id("").is_err()); // Empty
        assert!(PaymentValidator::validate_order_id(
            "this_order_id_is_way_too_long_and_exceeds_36_characters"
        )
        .is_err()); // Too long
        assert!(PaymentValidator::validate_order_id("order@123").is_err()); // Invalid characters
        assert!(PaymentValidator::validate_order_id("order 123").is_err()); // Space not allowed
    }

    #[test]
    fn test_validate_email() {
        // Valid emails
        assert!(PaymentValidator::validate_email("test@example.com").is_ok());
        assert!(PaymentValidator::validate_email("user@domain.ru").is_ok());

        // Invalid emails
        assert!(PaymentValidator::validate_email("").is_err()); // Empty
        assert!(PaymentValidator::validate_email("invalid-email").is_err()); // No @
        assert!(PaymentValidator::validate_email("@domain.com").is_err()); // No local part
        assert!(PaymentValidator::validate_email("user@").is_err()); // No domain
        assert!(PaymentValidator::validate_email("user@@domain.com").is_err()); // Multiple @
    }

    #[test]
    fn test_validate_phone() {
        // Valid phones
        assert!(PaymentValidator::validate_phone("+79161234567").is_ok());
        assert!(PaymentValidator::validate_phone("+79999999999").is_ok());

        // Invalid phones
        assert!(PaymentValidator::validate_phone("").is_err()); // Empty
        assert!(PaymentValidator::validate_phone("79161234567").is_err()); // No +7
        assert!(PaymentValidator::validate_phone("+7916123456").is_err()); // Too short
        assert!(PaymentValidator::validate_phone("+791612345678").is_err()); // Too long
        assert!(PaymentValidator::validate_phone("+7916123456a").is_err()); // Non-digit
        assert!(PaymentValidator::validate_phone("+8916123456").is_err()); // Wrong country code
    }

    #[test]
    fn test_validate_url() {
        // Valid URLs
        assert!(PaymentValidator::validate_url("https://example.com", "Test URL").is_ok());
        assert!(PaymentValidator::validate_url("http://example.com", "Test URL").is_ok());

        // Invalid URLs
        assert!(PaymentValidator::validate_url("ftp://example.com", "Test URL").is_err()); // Wrong protocol
        assert!(PaymentValidator::validate_url("example.com", "Test URL").is_err()); // No protocol
        assert!(PaymentValidator::validate_url("", "Test URL").is_err()); // Empty
    }

    #[test]
    fn test_validate_initialization_request() {
        let valid_request = PaymentInitializationRequest {
            order_id: "order_123".to_string(),
            amount: Decimal::from(1000),
            currency: Currency::RUB,
            payment_method: AcquiringPaymentMethod::Card,
            description: Some("Test payment".to_string()),
            customer_email: Some("test@example.com".to_string()),
            customer_phone: Some("+79161234567".to_string()),
            success_url: Some("https://example.com/success".to_string()),
            failure_url: Some("https://example.com/failure".to_string()),
            notification_url: Some("https://example.com/webhook".to_string()),
        };

        assert!(PaymentValidator::validate_initialization_request(&valid_request).is_ok());

        // Test invalid currency
        let invalid_currency_request = PaymentInitializationRequest {
            currency: Currency::USD, // Not supported for acquiring
            ..valid_request.clone()
        };
        assert!(
            PaymentValidator::validate_initialization_request(&invalid_currency_request).is_err()
        );

        // Test invalid email
        let invalid_email_request = PaymentInitializationRequest {
            customer_email: Some("invalid-email".to_string()),
            ..valid_request.clone()
        };
        assert!(PaymentValidator::validate_initialization_request(&invalid_email_request).is_err());

        // Test invalid phone
        let invalid_phone_request = PaymentInitializationRequest {
            customer_phone: Some("123456789".to_string()),
            ..valid_request
        };
        assert!(PaymentValidator::validate_initialization_request(&invalid_phone_request).is_err());
    }
}
