use serde::{Deserialize, Serialize};

/// Supported currencies for T-Bank operations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub enum Currency {
    /// Russian Ruble
    RUB,
    /// US Dollar
    USD,
    /// Euro
    EUR,
}

impl Currency {
    /// Get all supported currencies
    pub fn all() -> Vec<Currency> {
        vec![Currency::RUB, Currency::USD, Currency::EUR]
    }

    /// Get currency code for T-Bank API
    pub fn to_api_code(&self) -> &'static str {
        match self {
            Currency::RUB => "RUB",
            Currency::USD => "USD",
            Currency::EUR => "EUR",
        }
    }

    /// Get currency symbol
    pub fn to_symbol(&self) -> &'static str {
        match self {
            Currency::RUB => "руб.",
            Currency::USD => "$",
            Currency::EUR => "€",
        }
    }

    /// Get currency name in Russian
    pub fn to_russian_name(&self) -> &'static str {
        match self {
            Currency::RUB => "Российский рубль",
            Currency::USD => "Доллар США",
            Currency::EUR => "Евро",
        }
    }

    /// Get currency name in English
    pub fn to_english_name(&self) -> &'static str {
        match self {
            Currency::RUB => "Russian Ruble",
            Currency::USD => "US Dollar",
            Currency::EUR => "Euro",
        }
    }

    /// Get number of decimal places for the currency
    pub fn decimal_places(&self) -> u32 {
        match self {
            Currency::RUB => 2,
            Currency::USD => 2,
            Currency::EUR => 2,
        }
    }

    /// Check if currency is supported for B2B operations
    pub fn supports_b2b(&self) -> bool {
        match self {
            Currency::RUB => true,
            Currency::USD => true,
            Currency::EUR => true,
        }
    }

    /// Check if currency is supported for acquiring operations
    pub fn supports_acquiring(&self) -> bool {
        match self {
            Currency::RUB => true,
            Currency::USD => false, // T-Bank acquiring typically supports RUB only
            Currency::EUR => false, // T-Bank acquiring typically supports RUB only
        }
    }

    /// Get ISO 4217 numeric code
    pub fn to_numeric_code(&self) -> u16 {
        match self {
            Currency::RUB => 643,
            Currency::USD => 840,
            Currency::EUR => 978,
        }
    }
}

impl Default for Currency {
    fn default() -> Self {
        Currency::RUB
    }
}

impl std::fmt::Display for Currency {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_api_code())
    }
}

impl std::str::FromStr for Currency {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "RUB" => Ok(Currency::RUB),
            "USD" => Ok(Currency::USD),
            "EUR" => Ok(Currency::EUR),
            _ => Err(format!("Invalid currency: {}", s)),
        }
    }
}

/// Currency validation utilities
pub struct CurrencyValidator;

impl CurrencyValidator {
    /// Validate currency for specific operation type
    pub fn validate_for_operation(currency: &Currency, operation_type: &str) -> Result<(), String> {
        match operation_type {
            "b2b" => {
                if !currency.supports_b2b() {
                    return Err(format!(
                        "Currency {} is not supported for B2B operations",
                        currency
                    ));
                }
            }
            "acquiring" => {
                if !currency.supports_acquiring() {
                    return Err(format!(
                        "Currency {} is not supported for acquiring operations",
                        currency
                    ));
                }
            }
            _ => {
                return Err(format!("Unknown operation type: {}", operation_type));
            }
        }
        Ok(())
    }

    /// Validate amount precision for currency
    pub fn validate_amount_precision(
        currency: &Currency,
        amount: rust_decimal::Decimal,
    ) -> Result<(), String> {
        let max_scale = currency.decimal_places();
        if amount.scale() > max_scale {
            return Err(format!(
                "Amount precision exceeds maximum {} decimal places for currency {}",
                max_scale, currency
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    #[test]
    fn test_currency_parsing() {
        assert_eq!(Currency::from_str("RUB").unwrap(), Currency::RUB);
        assert_eq!(Currency::from_str("usd").unwrap(), Currency::USD);
        assert_eq!(Currency::from_str("EUR").unwrap(), Currency::EUR);
        assert!(Currency::from_str("JPY").is_err());
    }

    #[test]
    fn test_currency_properties() {
        assert_eq!(Currency::RUB.to_symbol(), "руб.");
        assert_eq!(Currency::USD.to_symbol(), "$");
        assert_eq!(Currency::EUR.to_symbol(), "€");

        assert_eq!(Currency::RUB.to_numeric_code(), 643);
        assert_eq!(Currency::USD.to_numeric_code(), 840);
        assert_eq!(Currency::EUR.to_numeric_code(), 978);
    }

    #[test]
    fn test_currency_support() {
        assert!(Currency::RUB.supports_b2b());
        assert!(Currency::RUB.supports_acquiring());

        assert!(Currency::USD.supports_b2b());
        assert!(!Currency::USD.supports_acquiring());

        assert!(Currency::EUR.supports_b2b());
        assert!(!Currency::EUR.supports_acquiring());
    }

    #[test]
    fn test_currency_validation() {
        assert!(CurrencyValidator::validate_for_operation(&Currency::RUB, "b2b").is_ok());
        assert!(CurrencyValidator::validate_for_operation(&Currency::RUB, "acquiring").is_ok());
        assert!(CurrencyValidator::validate_for_operation(&Currency::USD, "b2b").is_ok());
        assert!(CurrencyValidator::validate_for_operation(&Currency::USD, "acquiring").is_err());
    }

    #[test]
    fn test_amount_precision_validation() {
        let valid_amount = Decimal::from_str("100.50").unwrap();
        let invalid_amount = Decimal::from_str("100.123").unwrap();

        assert!(CurrencyValidator::validate_amount_precision(&Currency::RUB, valid_amount).is_ok());
        assert!(
            CurrencyValidator::validate_amount_precision(&Currency::RUB, invalid_amount).is_err()
        );
    }

    #[test]
    fn test_default_currency() {
        assert_eq!(Currency::default(), Currency::RUB);
    }

    #[test]
    fn test_all_currencies() {
        let all = Currency::all();
        assert_eq!(all.len(), 3);
        assert!(all.contains(&Currency::RUB));
        assert!(all.contains(&Currency::USD));
        assert!(all.contains(&Currency::EUR));
    }
}
