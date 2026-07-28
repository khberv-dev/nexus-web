use crate::types::acquiring::methods::AcquiringPaymentMethod as PaymentMethod;
use serde::{Deserialize, Serialize};

/// Payment method configuration and validation for T-Bank Acquiring API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentMethodConfig {
    pub method: PaymentMethod,
    pub enabled: bool,
    pub min_amount: Option<rust_decimal::Decimal>,
    pub max_amount: Option<rust_decimal::Decimal>,
}

impl PaymentMethodConfig {
    /// Create a new payment method configuration
    pub fn new(method: PaymentMethod) -> Self {
        Self {
            method,
            enabled: true,
            min_amount: None,
            max_amount: None,
        }
    }

    /// Check if payment method is available for the given amount
    pub fn is_available_for_amount(&self, amount: rust_decimal::Decimal) -> bool {
        if !self.enabled {
            return false;
        }

        if let Some(min) = self.min_amount {
            if amount < min {
                return false;
            }
        }

        if let Some(max) = self.max_amount {
            if amount > max {
                return false;
            }
        }

        true
    }
}

/// Payment method manager for T-Bank Acquiring API
pub struct PaymentMethodManager {
    methods: Vec<PaymentMethodConfig>,
}

impl PaymentMethodManager {
    /// Create a new payment method manager with default configuration
    pub fn new() -> Self {
        let methods = vec![
            PaymentMethodConfig::new(PaymentMethod::Card),
            PaymentMethodConfig::new(PaymentMethod::SBP),
            PaymentMethodConfig::new(PaymentMethod::QR),
            PaymentMethodConfig::new(PaymentMethod::ApplePay),
            PaymentMethodConfig::new(PaymentMethod::GooglePay),
            PaymentMethodConfig::new(PaymentMethod::SamsungPay),
        ];

        Self { methods }
    }

    /// Get all available payment methods for the given amount
    pub fn get_available_methods(&self, amount: rust_decimal::Decimal) -> Vec<PaymentMethod> {
        self.methods
            .iter()
            .filter(|config| config.is_available_for_amount(amount))
            .map(|config| config.method.clone())
            .collect()
    }

    /// Check if a payment method is supported
    pub fn is_method_supported(&self, method: &PaymentMethod) -> bool {
        self.methods
            .iter()
            .any(|config| &config.method == method && config.enabled)
    }

    /// Validate payment method for T-Bank Acquiring API
    pub fn validate_method(
        &self,
        method: &PaymentMethod,
        amount: rust_decimal::Decimal,
    ) -> Result<(), String> {
        let config = self
            .methods
            .iter()
            .find(|config| &config.method == method)
            .ok_or_else(|| format!("Payment method {:?} is not supported", method))?;

        if !config.is_available_for_amount(amount) {
            return Err(format!(
                "Payment method {:?} is not available for amount {}",
                method, amount
            ));
        }

        Ok(())
    }

    /// Get payment method specific parameters for T-Bank API
    pub fn get_method_parameters(
        &self,
        method: &PaymentMethod,
    ) -> std::collections::HashMap<String, String> {
        let mut params = std::collections::HashMap::new();

        match method {
            PaymentMethod::Card => {
                params.insert("PayType".to_string(), "O".to_string()); // One-step payment
            }
            PaymentMethod::SBP => {
                params.insert("PayType".to_string(), "SBP".to_string());
            }
            PaymentMethod::QR => {
                params.insert("PayType".to_string(), "QR".to_string());
            }
            PaymentMethod::ApplePay => {
                params.insert("PayType".to_string(), "ApplePay".to_string());
            }
            PaymentMethod::GooglePay => {
                params.insert("PayType".to_string(), "GooglePay".to_string());
            }
            PaymentMethod::SamsungPay => {
                params.insert("PayType".to_string(), "SamsungPay".to_string());
            }
        }

        params
    }
}

impl Default for PaymentMethodManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn test_payment_method_config() {
        let config = PaymentMethodConfig::new(PaymentMethod::Card);
        assert!(config.enabled);
        assert!(config.is_available_for_amount(Decimal::from(100)));
    }

    #[test]
    fn test_payment_method_manager() {
        let manager = PaymentMethodManager::new();
        let amount = Decimal::from(1000);

        let available_methods = manager.get_available_methods(amount);
        assert_eq!(available_methods.len(), 6); // All methods should be available

        assert!(manager.is_method_supported(&PaymentMethod::Card));
        assert!(manager.is_method_supported(&PaymentMethod::ApplePay));
        assert!(manager.is_method_supported(&PaymentMethod::GooglePay));
        assert!(manager.is_method_supported(&PaymentMethod::SamsungPay));
    }

    #[test]
    fn test_method_validation() {
        let manager = PaymentMethodManager::new();
        let amount = Decimal::from(1000);

        assert!(manager
            .validate_method(&PaymentMethod::Card, amount)
            .is_ok());
        assert!(manager
            .validate_method(&PaymentMethod::ApplePay, amount)
            .is_ok());
    }

    #[test]
    fn test_method_parameters() {
        let manager = PaymentMethodManager::new();

        let card_params = manager.get_method_parameters(&PaymentMethod::Card);
        assert_eq!(card_params.get("PayType"), Some(&"O".to_string()));

        let apple_pay_params = manager.get_method_parameters(&PaymentMethod::ApplePay);
        assert_eq!(
            apple_pay_params.get("PayType"),
            Some(&"ApplePay".to_string())
        );
    }
}
