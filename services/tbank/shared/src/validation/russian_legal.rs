use crate::ADQuestError;
use serde::{Deserialize, Serialize};

/// Валидация российских юридических реквизитов согласно 152-ФЗ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RussianLegalValidator;

impl RussianLegalValidator {
    /// Валидация ИНН (Идентификационный номер налогоплательщика)
    pub fn validate_inn(inn: &str) -> Result<(), ADQuestError> {
        // Убираем пробелы и проверяем длину
        let inn = inn.trim().replace(" ", "");

        if inn.len() != 10 && inn.len() != 12 {
            return Err(ADQuestError::Validation(
                "ИНН должен содержать 10 цифр (юр. лицо) или 12 цифр (физ. лицо)".to_string(),
            ));
        }

        // Проверяем, что все символы - цифры
        if !inn.chars().all(|c| c.is_ascii_digit()) {
            return Err(ADQuestError::Validation(
                "ИНН должен содержать только цифры".to_string(),
            ));
        }

        let digits: Vec<u32> = inn.chars().map(|c| c.to_digit(10).unwrap()).collect();

        match inn.len() {
            10 => Self::validate_inn_10(&digits),
            12 => Self::validate_inn_12(&digits),
            _ => unreachable!(),
        }
    }

    /// Валидация 10-значного ИНН (юридические лица)
    fn validate_inn_10(digits: &[u32]) -> Result<(), ADQuestError> {
        let coefficients = [2, 4, 10, 3, 5, 9, 4, 6, 8];
        let mut sum = 0;

        for i in 0..9 {
            sum += digits[i] * coefficients[i];
        }

        let control_digit = (sum % 11) % 10;

        if control_digit != digits[9] {
            return Err(ADQuestError::Validation(
                "Неверная контрольная сумма ИНН".to_string(),
            ));
        }

        Ok(())
    }

    /// Валидация 12-значного ИНН (физические лица)
    fn validate_inn_12(digits: &[u32]) -> Result<(), ADQuestError> {
        // Первая контрольная сумма
        let coefficients1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
        let mut sum1 = 0;

        for i in 0..10 {
            sum1 += digits[i] * coefficients1[i];
        }

        let control_digit1 = (sum1 % 11) % 10;

        if control_digit1 != digits[10] {
            return Err(ADQuestError::Validation(
                "Неверная первая контрольная сумма ИНН".to_string(),
            ));
        }

        // Вторая контрольная сумма
        let coefficients2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
        let mut sum2 = 0;

        for i in 0..11 {
            sum2 += digits[i] * coefficients2[i];
        }

        let control_digit2 = (sum2 % 11) % 10;

        if control_digit2 != digits[11] {
            return Err(ADQuestError::Validation(
                "Неверная вторая контрольная сумма ИНН".to_string(),
            ));
        }

        Ok(())
    }

    /// Валидация КПП (Код причины постановки на учет)
    pub fn validate_kpp(kpp: &str) -> Result<(), ADQuestError> {
        let kpp = kpp.trim().replace(" ", "");

        if kpp.len() != 9 {
            return Err(ADQuestError::Validation(
                "КПП должен содержать 9 символов".to_string(),
            ));
        }

        // Первые 4 символа - цифры (код налогового органа)
        if !kpp[0..4].chars().all(|c| c.is_ascii_digit()) {
            return Err(ADQuestError::Validation(
                "Первые 4 символа КПП должны быть цифрами".to_string(),
            ));
        }

        // 5-6 символы - цифры или буквы (код причины постановки)
        if !kpp[4..6].chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err(ADQuestError::Validation(
                "5-6 символы КПП должны быть цифрами или буквами".to_string(),
            ));
        }

        // Последние 3 символа - цифры (порядковый номер)
        if !kpp[6..9].chars().all(|c| c.is_ascii_digit()) {
            return Err(ADQuestError::Validation(
                "Последние 3 символа КПП должны быть цифрами".to_string(),
            ));
        }

        Ok(())
    }

    /// Валидация ОГРН (Основной государственный регистрационный номер)
    pub fn validate_ogrn(ogrn: &str) -> Result<(), ADQuestError> {
        let ogrn = ogrn.trim().replace(" ", "");

        if ogrn.len() != 13 && ogrn.len() != 15 {
            return Err(ADQuestError::Validation(
                "ОГРН должен содержать 13 цифр (юр. лицо) или 15 цифр (ИП)".to_string(),
            ));
        }

        // Проверяем, что все символы - цифры
        if !ogrn.chars().all(|c| c.is_ascii_digit()) {
            return Err(ADQuestError::Validation(
                "ОГРН должен содержать только цифры".to_string(),
            ));
        }

        let digits: Vec<u64> = ogrn
            .chars()
            .map(|c| c.to_digit(10).unwrap() as u64)
            .collect();

        match ogrn.len() {
            13 => Self::validate_ogrn_13(&digits),
            15 => Self::validate_ogrn_15(&digits),
            _ => unreachable!(),
        }
    }

    /// Валидация 13-значного ОГРН (юридические лица)
    fn validate_ogrn_13(digits: &[u64]) -> Result<(), ADQuestError> {
        // Берем первые 12 цифр
        let mut number = 0u64;
        for digit in digits.iter().take(12) {
            number = number * 10 + digit;
        }

        let control_digit = (number % 11) % 10;

        if control_digit != digits[12] {
            return Err(ADQuestError::Validation(
                "Неверная контрольная сумма ОГРН".to_string(),
            ));
        }

        Ok(())
    }

    /// Валидация 15-значного ОГРН (индивидуальные предприниматели)
    fn validate_ogrn_15(digits: &[u64]) -> Result<(), ADQuestError> {
        // Берем первые 14 цифр
        let mut number = 0u64;
        for digit in digits.iter().take(14) {
            number = number * 10 + digit;
        }

        let control_digit = (number % 13) % 10;

        if control_digit != digits[14] {
            return Err(ADQuestError::Validation(
                "Неверная контрольная сумма ОГРНИП".to_string(),
            ));
        }

        Ok(())
    }

    /// Комплексная валидация российского юридического лица
    pub fn validate_legal_entity(
        inn: &str,
        kpp: Option<&str>,
        ogrn: Option<&str>,
    ) -> Result<(), ADQuestError> {
        // Валидируем ИНН
        Self::validate_inn(inn)?;

        // Для юридических лиц (ИНН 10 цифр) КПП обязателен
        if inn.trim().replace(" ", "").len() == 10 {
            match kpp {
                Some(kpp_value) => Self::validate_kpp(kpp_value)?,
                None => {
                    return Err(ADQuestError::Validation(
                        "КПП обязателен для юридических лиц".to_string(),
                    ))
                }
            }
        }

        // Валидируем ОГРН если предоставлен
        if let Some(ogrn_value) = ogrn {
            Self::validate_ogrn(ogrn_value)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_inn_10() {
        // Тестовый ИНН юридического лица
        assert!(RussianLegalValidator::validate_inn("7707083893").is_ok());
    }

    #[test]
    fn test_valid_inn_12() {
        // Тестовый ИНН физического лица
        assert!(RussianLegalValidator::validate_inn("500100732259").is_ok());
    }

    #[test]
    fn test_invalid_inn_length() {
        assert!(RussianLegalValidator::validate_inn("123456789").is_err());
        assert!(RussianLegalValidator::validate_inn("12345678901234").is_err());
    }

    #[test]
    fn test_invalid_inn_characters() {
        assert!(RussianLegalValidator::validate_inn("770708389a").is_err());
    }

    #[test]
    fn test_invalid_inn_checksum() {
        assert!(RussianLegalValidator::validate_inn("7707083894").is_err());
    }

    #[test]
    fn test_valid_kpp() {
        assert!(RussianLegalValidator::validate_kpp("770701001").is_ok());

        // Debug the failing case
        match RussianLegalValidator::validate_kpp("77AA01001") {
            Ok(_) => println!("77AA01001 is valid"),
            Err(e) => println!("77AA01001 failed: {}", e),
        }

        // This should be valid according to KPP format: NNNNCCNNN where N=digit, C=digit or letter
        // 77AA01001: 77AA0 (first 4 should be digits) - this is wrong!
        // Correct format should be: 7707AA001 (positions 4-5 can be letters)
        assert!(RussianLegalValidator::validate_kpp("7707AA001").is_ok());
    }

    #[test]
    fn test_invalid_kpp() {
        assert!(RussianLegalValidator::validate_kpp("77070100").is_err()); // Короткий
        assert!(RussianLegalValidator::validate_kpp("77070100a").is_err()); // Буква в конце
    }

    #[test]
    fn test_valid_ogrn_13() {
        assert!(RussianLegalValidator::validate_ogrn("1027700132195").is_ok());
    }

    #[test]
    fn test_valid_ogrn_15() {
        assert!(RussianLegalValidator::validate_ogrn("304500116000157").is_ok());
    }

    #[test]
    fn test_invalid_ogrn_checksum() {
        assert!(RussianLegalValidator::validate_ogrn("1027700132196").is_err());
    }

    #[test]
    fn test_legal_entity_validation() {
        // Валидное юридическое лицо
        assert!(RussianLegalValidator::validate_legal_entity(
            "7707083893",
            Some("770701001"),
            Some("1027700132195")
        )
        .is_ok());

        // Юридическое лицо без КПП - ошибка
        assert!(RussianLegalValidator::validate_legal_entity("7707083893", None, None).is_err());

        // Физическое лицо без КПП - нормально
        assert!(RussianLegalValidator::validate_legal_entity("500100732259", None, None).is_ok());
    }
}
