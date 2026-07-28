use serde::{Deserialize, Serialize};

/// Payment methods supported by T-Bank Acquiring API for physical persons
/// Note: BankTransfer is excluded as per requirements - only for legal entities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AcquiringPaymentMethod {
    /// Bank card payment (Visa, MasterCard, Mir)
    Card,
    /// Система быстрых платежей (Fast Payment System)
    SBP,
    /// QR code payment
    QR,
    /// Apple Pay mobile payment
    ApplePay,
    /// Google Pay mobile payment
    GooglePay,
    /// Samsung Pay mobile payment
    SamsungPay,
}

impl AcquiringPaymentMethod {
    /// Get all available payment methods
    pub fn all() -> Vec<AcquiringPaymentMethod> {
        vec![
            AcquiringPaymentMethod::Card,
            AcquiringPaymentMethod::SBP,
            AcquiringPaymentMethod::QR,
            AcquiringPaymentMethod::ApplePay,
            AcquiringPaymentMethod::GooglePay,
            AcquiringPaymentMethod::SamsungPay,
        ]
    }

    /// Check if payment method supports QR codes
    pub fn supports_qr(&self) -> bool {
        matches!(
            self,
            AcquiringPaymentMethod::QR | AcquiringPaymentMethod::SBP
        )
    }

    /// Check if payment method is mobile wallet
    pub fn is_mobile_wallet(&self) -> bool {
        matches!(
            self,
            AcquiringPaymentMethod::ApplePay
                | AcquiringPaymentMethod::GooglePay
                | AcquiringPaymentMethod::SamsungPay
        )
    }

    /// Get T-Bank API parameter value
    pub fn to_api_value(&self) -> &'static str {
        match self {
            AcquiringPaymentMethod::Card => "Card",
            AcquiringPaymentMethod::SBP => "SBP",
            AcquiringPaymentMethod::QR => "QR",
            AcquiringPaymentMethod::ApplePay => "ApplePay",
            AcquiringPaymentMethod::GooglePay => "GooglePay",
            AcquiringPaymentMethod::SamsungPay => "SamsungPay",
        }
    }

    /// Get human-readable Russian name
    pub fn to_russian_name(&self) -> &'static str {
        match self {
            AcquiringPaymentMethod::Card => "Банковская карта",
            AcquiringPaymentMethod::SBP => "Система быстрых платежей",
            AcquiringPaymentMethod::QR => "QR-код",
            AcquiringPaymentMethod::ApplePay => "Apple Pay",
            AcquiringPaymentMethod::GooglePay => "Google Pay",
            AcquiringPaymentMethod::SamsungPay => "Samsung Pay",
        }
    }

    /// Get method icon/emoji
    pub fn to_icon(&self) -> &'static str {
        match self {
            AcquiringPaymentMethod::Card => "💳",
            AcquiringPaymentMethod::SBP => "⚡",
            AcquiringPaymentMethod::QR => "📱",
            AcquiringPaymentMethod::ApplePay => "🍎",
            AcquiringPaymentMethod::GooglePay => "🔍",
            AcquiringPaymentMethod::SamsungPay => "📱",
        }
    }

    /// Check if method requires additional customer data
    pub fn requires_customer_data(&self) -> bool {
        // Mobile wallets typically require less customer data
        !self.is_mobile_wallet()
    }

    /// Get typical processing time in minutes
    pub fn typical_processing_time_minutes(&self) -> u32 {
        match self {
            AcquiringPaymentMethod::Card => 5,
            AcquiringPaymentMethod::SBP => 1,
            AcquiringPaymentMethod::QR => 2,
            AcquiringPaymentMethod::ApplePay => 2,
            AcquiringPaymentMethod::GooglePay => 2,
            AcquiringPaymentMethod::SamsungPay => 2,
        }
    }
}

impl std::fmt::Display for AcquiringPaymentMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_api_value())
    }
}

impl std::str::FromStr for AcquiringPaymentMethod {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Card" => Ok(AcquiringPaymentMethod::Card),
            "SBP" => Ok(AcquiringPaymentMethod::SBP),
            "QR" => Ok(AcquiringPaymentMethod::QR),
            "ApplePay" => Ok(AcquiringPaymentMethod::ApplePay),
            "GooglePay" => Ok(AcquiringPaymentMethod::GooglePay),
            "SamsungPay" => Ok(AcquiringPaymentMethod::SamsungPay),
            _ => Err(format!("Invalid acquiring payment method: {}", s)),
        }
    }
}

/// Payment method validation utilities
pub struct PaymentMethodValidator;

impl PaymentMethodValidator {
    /// Validate that payment method is supported
    pub fn is_supported(method: &AcquiringPaymentMethod) -> bool {
        AcquiringPaymentMethod::all().contains(method)
    }

    /// Validate payment method for specific amount
    pub fn validate_for_amount(
        method: &AcquiringPaymentMethod,
        amount: rust_decimal::Decimal,
    ) -> Result<(), String> {
        use rust_decimal::Decimal;
        use std::str::FromStr;

        // Minimum amounts for different payment methods
        let min_amount = match method {
            AcquiringPaymentMethod::Card => Decimal::from_str("1.00").unwrap(),
            AcquiringPaymentMethod::SBP => Decimal::from_str("0.01").unwrap(),
            AcquiringPaymentMethod::QR => Decimal::from_str("0.01").unwrap(),
            AcquiringPaymentMethod::ApplePay => Decimal::from_str("1.00").unwrap(),
            AcquiringPaymentMethod::GooglePay => Decimal::from_str("1.00").unwrap(),
            AcquiringPaymentMethod::SamsungPay => Decimal::from_str("1.00").unwrap(),
        };

        // Maximum amounts for different payment methods
        let max_amount = match method {
            AcquiringPaymentMethod::Card => Decimal::from_str("600000.00").unwrap(), // 600k RUB
            AcquiringPaymentMethod::SBP => Decimal::from_str("100000.00").unwrap(),  // 100k RUB
            AcquiringPaymentMethod::QR => Decimal::from_str("100000.00").unwrap(),   // 100k RUB
            AcquiringPaymentMethod::ApplePay => Decimal::from_str("300000.00").unwrap(), // 300k RUB
            AcquiringPaymentMethod::GooglePay => Decimal::from_str("300000.00").unwrap(), // 300k RUB
            AcquiringPaymentMethod::SamsungPay => Decimal::from_str("300000.00").unwrap(), // 300k RUB
        };

        if amount < min_amount {
            return Err(format!(
                "Amount {} is below minimum {} for payment method {}",
                amount, min_amount, method
            ));
        }

        if amount > max_amount {
            return Err(format!(
                "Amount {} exceeds maximum {} for payment method {}",
                amount, max_amount, method
            ));
        }

        Ok(())
    }

    /// Check if payment method is available for customer location
    pub fn is_available_for_location(method: &AcquiringPaymentMethod, country_code: &str) -> bool {
        match method {
            AcquiringPaymentMethod::Card => true, // Available worldwide
            AcquiringPaymentMethod::SBP => country_code == "RU", // Russia only
            AcquiringPaymentMethod::QR => country_code == "RU", // Russia only
            AcquiringPaymentMethod::ApplePay => {
                // Available in many countries
                matches!(country_code, "RU" | "US" | "GB" | "DE" | "FR" | "IT" | "ES")
            }
            AcquiringPaymentMethod::GooglePay => {
                // Available in many countries
                matches!(country_code, "RU" | "US" | "GB" | "DE" | "FR" | "IT" | "ES")
            }
            AcquiringPaymentMethod::SamsungPay => {
                // Available in many countries
                matches!(country_code, "RU" | "US" | "GB" | "DE" | "FR" | "KR")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    #[test]
    fn test_payment_method_parsing() {
        assert_eq!(
            AcquiringPaymentMethod::from_str("Card").unwrap(),
            AcquiringPaymentMethod::Card
        );
        assert_eq!(
            AcquiringPaymentMethod::from_str("SBP").unwrap(),
            AcquiringPaymentMethod::SBP
        );
        assert_eq!(
            AcquiringPaymentMethod::from_str("ApplePay").unwrap(),
            AcquiringPaymentMethod::ApplePay
        );
        assert_eq!(
            AcquiringPaymentMethod::from_str("GooglePay").unwrap(),
            AcquiringPaymentMethod::GooglePay
        );
        assert_eq!(
            AcquiringPaymentMethod::from_str("SamsungPay").unwrap(),
            AcquiringPaymentMethod::SamsungPay
        );
        assert!(AcquiringPaymentMethod::from_str("BankTransfer").is_err()); // Not supported
        assert!(AcquiringPaymentMethod::from_str("Invalid").is_err());
    }

    #[test]
    fn test_payment_method_properties() {
        assert!(AcquiringPaymentMethod::QR.supports_qr());
        assert!(AcquiringPaymentMethod::SBP.supports_qr());
        assert!(!AcquiringPaymentMethod::Card.supports_qr());

        assert!(AcquiringPaymentMethod::ApplePay.is_mobile_wallet());
        assert!(AcquiringPaymentMethod::GooglePay.is_mobile_wallet());
        assert!(AcquiringPaymentMethod::SamsungPay.is_mobile_wallet());
        assert!(!AcquiringPaymentMethod::Card.is_mobile_wallet());
    }

    #[test]
    fn test_payment_method_validation() {
        let card_method = AcquiringPaymentMethod::Card;
        let sbp_method = AcquiringPaymentMethod::SBP;

        // Test minimum amounts
        assert!(PaymentMethodValidator::validate_for_amount(
            &card_method,
            Decimal::from_str("1.00").unwrap()
        )
        .is_ok());
        assert!(PaymentMethodValidator::validate_for_amount(
            &card_method,
            Decimal::from_str("0.50").unwrap()
        )
        .is_err());

        assert!(PaymentMethodValidator::validate_for_amount(
            &sbp_method,
            Decimal::from_str("0.01").unwrap()
        )
        .is_ok());
        assert!(PaymentMethodValidator::validate_for_amount(
            &sbp_method,
            Decimal::from_str("0.005").unwrap()
        )
        .is_err());

        // Test maximum amounts
        assert!(PaymentMethodValidator::validate_for_amount(
            &sbp_method,
            Decimal::from_str("100000.00").unwrap()
        )
        .is_ok());
        assert!(PaymentMethodValidator::validate_for_amount(
            &sbp_method,
            Decimal::from_str("100001.00").unwrap()
        )
        .is_err());
    }

    #[test]
    fn test_location_availability() {
        assert!(PaymentMethodValidator::is_available_for_location(
            &AcquiringPaymentMethod::Card,
            "RU"
        ));
        assert!(PaymentMethodValidator::is_available_for_location(
            &AcquiringPaymentMethod::Card,
            "US"
        ));

        assert!(PaymentMethodValidator::is_available_for_location(
            &AcquiringPaymentMethod::SBP,
            "RU"
        ));
        assert!(!PaymentMethodValidator::is_available_for_location(
            &AcquiringPaymentMethod::SBP,
            "US"
        ));

        assert!(PaymentMethodValidator::is_available_for_location(
            &AcquiringPaymentMethod::ApplePay,
            "RU"
        ));
        assert!(PaymentMethodValidator::is_available_for_location(
            &AcquiringPaymentMethod::ApplePay,
            "US"
        ));
        assert!(!PaymentMethodValidator::is_available_for_location(
            &AcquiringPaymentMethod::ApplePay,
            "CN"
        ));
    }

    #[test]
    fn test_all_methods() {
        let all_methods = AcquiringPaymentMethod::all();
        assert_eq!(all_methods.len(), 6);
        assert!(all_methods.contains(&AcquiringPaymentMethod::Card));
        assert!(all_methods.contains(&AcquiringPaymentMethod::SBP));
        assert!(all_methods.contains(&AcquiringPaymentMethod::QR));
        assert!(all_methods.contains(&AcquiringPaymentMethod::ApplePay));
        assert!(all_methods.contains(&AcquiringPaymentMethod::GooglePay));
        assert!(all_methods.contains(&AcquiringPaymentMethod::SamsungPay));
    }

    #[test]
    fn test_russian_names() {
        assert_eq!(
            AcquiringPaymentMethod::Card.to_russian_name(),
            "Банковская карта"
        );
        assert_eq!(
            AcquiringPaymentMethod::SBP.to_russian_name(),
            "Система быстрых платежей"
        );
        assert_eq!(AcquiringPaymentMethod::QR.to_russian_name(), "QR-код");
    }

    #[test]
    fn test_processing_times() {
        assert_eq!(
            AcquiringPaymentMethod::SBP.typical_processing_time_minutes(),
            1
        );
        assert_eq!(
            AcquiringPaymentMethod::Card.typical_processing_time_minutes(),
            5
        );
        assert_eq!(
            AcquiringPaymentMethod::ApplePay.typical_processing_time_minutes(),
            2
        );
    }
}
