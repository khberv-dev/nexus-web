use axum::{
    extract::Query,
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::services::TBankServices;

/// Company validation API endpoints
/// Simple validation endpoint for CRM to check company requisites format

#[derive(Debug, Deserialize)]
pub struct ValidateCompanyQuery {
    pub inn: String,
    #[serde(default)]
    pub kpp: Option<String>,
    #[serde(default)]
    pub ogrn: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ValidateCompanyResponse {
    pub valid: bool,
    pub inn: String,
    pub kpp: Option<String>,
    pub ogrn: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
}

/// Validate company requisites format
/// GET /api/v1/company/validate?inn=7707083893&kpp=770701001&ogrn=1027700132195
pub async fn validate_company(
    Query(query): Query<ValidateCompanyQuery>,
) -> Result<Json<ValidateCompanyResponse>, StatusCode> {
    tracing::info!("Validating company requisites: INN={}", query.inn);
    
    let mut errors = Vec::new();
    
    // Validate INN format
    let inn_valid = validate_inn(&query.inn, &mut errors);
    
    // Validate KPP format if provided
    if let Some(ref kpp) = query.kpp {
        validate_kpp(kpp, &mut errors);
    }
    
    // Validate OGRN format if provided
    if let Some(ref ogrn) = query.ogrn {
        validate_ogrn(ogrn, &mut errors);
    }
    
    let valid = errors.is_empty();
    
    if valid {
        tracing::info!("Company requisites are valid: INN={}", query.inn);
    } else {
        tracing::warn!("Company requisites validation failed: INN={}, errors={:?}", query.inn, errors);
    }
    
    let response = ValidateCompanyResponse {
        valid,
        inn: query.inn.clone(),
        kpp: query.kpp.clone(),
        ogrn: query.ogrn.clone(),
        errors: if errors.is_empty() { None } else { Some(errors) },
        full_name: if valid {
            // Return placeholder - CRM should use external service (DaData, FNS) for real data
            Some(format!("Компания с ИНН {}", query.inn))
        } else {
            None
        },
    };
    
    Ok(Json(response))
}

/// Validate INN format
fn validate_inn(inn: &str, errors: &mut Vec<String>) -> bool {
    // Check if INN contains only digits
    if !inn.chars().all(|c| c.is_ascii_digit()) {
        errors.push("ИНН должен содержать только цифры".to_string());
        return false;
    }
    
    // Check INN length (10 for legal entities, 12 for individuals)
    let len = inn.len();
    if len != 10 && len != 12 {
        errors.push("ИНН должен содержать 10 цифр (для юридических лиц) или 12 цифр (для ИП)".to_string());
        return false;
    }
    
    // Check for test/invalid INNs
    if inn == "0000000000" || inn == "000000000000" {
        errors.push("ИНН не может состоять только из нулей".to_string());
        return false;
    }
    
    // Check for common test INNs
    if inn.starts_with("123456789") || inn.starts_with("111111111") {
        errors.push("Указан тестовый ИНН. Используйте реальный ИНН компании".to_string());
        return false;
    }
    
    // Validate INN checksum for 10-digit INN (legal entities)
    if len == 10 {
        if !validate_inn_10_checksum(inn) {
            errors.push("Неверная контрольная сумма ИНН".to_string());
            return false;
        }
    }
    
    // Validate INN checksum for 12-digit INN (individuals)
    if len == 12 {
        if !validate_inn_12_checksum(inn) {
            errors.push("Неверная контрольная сумма ИНН".to_string());
            return false;
        }
    }
    
    true
}

/// Validate 10-digit INN checksum (legal entities)
fn validate_inn_10_checksum(inn: &str) -> bool {
    let coefficients = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    let digits: Vec<u32> = inn.chars().filter_map(|c| c.to_digit(10)).collect();
    
    if digits.len() != 10 {
        return false;
    }
    
    let sum: u32 = coefficients.iter()
        .zip(digits.iter())
        .map(|(c, d)| c * d)
        .sum();
    
    let checksum = (sum % 11) % 10;
    checksum == digits[9]
}

/// Validate 12-digit INN checksum (individuals)
fn validate_inn_12_checksum(inn: &str) -> bool {
    let coefficients_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    let coefficients_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    let digits: Vec<u32> = inn.chars().filter_map(|c| c.to_digit(10)).collect();
    
    if digits.len() != 12 {
        return false;
    }
    
    // Check 11th digit
    let sum_11: u32 = coefficients_11.iter()
        .zip(digits.iter())
        .map(|(c, d)| c * d)
        .sum();
    let checksum_11 = (sum_11 % 11) % 10;
    
    if checksum_11 != digits[10] {
        return false;
    }
    
    // Check 12th digit
    let sum_12: u32 = coefficients_12.iter()
        .zip(digits.iter())
        .map(|(c, d)| c * d)
        .sum();
    let checksum_12 = (sum_12 % 11) % 10;
    
    checksum_12 == digits[11]
}

/// Validate KPP format
fn validate_kpp(kpp: &str, errors: &mut Vec<String>) -> bool {
    // Check length
    if kpp.len() > 20 {
        errors.push("КПП не может быть длиннее 20 символов".to_string());
        return false;
    }
    
    // Standard KPP is 9 digits
    if kpp.len() == 9 {
        if !kpp.chars().all(|c| c.is_ascii_digit()) {
            errors.push("КПП должен содержать только цифры".to_string());
            return false;
        }
    }
    
    true
}

/// Validate OGRN format
fn validate_ogrn(ogrn: &str, errors: &mut Vec<String>) -> bool {
    // Check length
    if ogrn.len() > 100 {
        errors.push("ОГРН не может быть длиннее 100 символов".to_string());
        return false;
    }
    
    // Standard OGRN is 13 digits (legal entities) or 15 digits (individuals - OGRNIP)
    if ogrn.len() == 13 || ogrn.len() == 15 {
        if !ogrn.chars().all(|c| c.is_ascii_digit()) {
            errors.push("ОГРН должен содержать только цифры".to_string());
            return false;
        }
        
        // Validate OGRN checksum
        if !validate_ogrn_checksum(ogrn) {
            errors.push("Неверная контрольная сумма ОГРН".to_string());
            return false;
        }
    }
    
    true
}

/// Validate OGRN checksum
fn validate_ogrn_checksum(ogrn: &str) -> bool {
    let len = ogrn.len();
    if len != 13 && len != 15 {
        return true; // Skip validation for non-standard lengths
    }
    
    let digits: Vec<u32> = ogrn.chars().filter_map(|c| c.to_digit(10)).collect();
    if digits.len() != len {
        return false;
    }
    
    // Convert first n-1 digits to number
    let mut number: u64 = 0;
    for i in 0..len-1 {
        number = number * 10 + digits[i] as u64;
    }
    
    // Calculate checksum
    let divisor = if len == 13 { 11 } else { 13 };
    let checksum = (number % divisor) % 10;
    
    checksum == digits[len-1] as u64
}

/// Create company validation router
pub fn create_company_validation_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/validate", get(validate_company))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_inn_10() {
        let mut errors = Vec::new();
        
        // Valid INN
        assert!(validate_inn("7707083893", &mut errors));
        assert!(errors.is_empty());
        
        // Invalid length
        errors.clear();
        assert!(!validate_inn("123", &mut errors));
        assert!(!errors.is_empty());
        
        // Non-digits
        errors.clear();
        assert!(!validate_inn("770708389A", &mut errors));
        assert!(!errors.is_empty());
        
        // Test INN
        errors.clear();
        assert!(!validate_inn("1234567890", &mut errors));
        assert!(!errors.is_empty());
    }

    #[test]
    fn test_validate_inn_12() {
        let mut errors = Vec::new();
        
        // Valid INN (example)
        assert!(validate_inn("773390489400", &mut errors));
        assert!(errors.is_empty());
    }

    #[test]
    fn test_validate_kpp() {
        let mut errors = Vec::new();
        
        // Valid KPP
        assert!(validate_kpp("770701001", &mut errors));
        assert!(errors.is_empty());
        
        // Too long
        errors.clear();
        assert!(!validate_kpp("123456789012345678901", &mut errors));
        assert!(!errors.is_empty());
    }

    #[test]
    fn test_validate_ogrn() {
        let mut errors = Vec::new();
        
        // Valid OGRN
        assert!(validate_ogrn("1027700132195", &mut errors));
        assert!(errors.is_empty());
        
        // Too long
        errors.clear();
        let long_ogrn = "1".repeat(101);
        assert!(!validate_ogrn(&long_ogrn, &mut errors));
        assert!(!errors.is_empty());
    }
}
