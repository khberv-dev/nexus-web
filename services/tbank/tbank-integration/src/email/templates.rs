use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value;

/// Email template for T-Bank integration notifications
pub struct EmailTemplate;

impl EmailTemplate {
    /// Generate invoice creation notification
    pub fn invoice_created(
        invoice_id: &str,
        counterparty_inn: &str,
        amount: Decimal,
        description: &str,
        created_at: DateTime<Utc>,
    ) -> (String, String, String) {
        let subject = format!("Новый счет создан: {}", invoice_id);
        
        let text_body = format!(
            r#"Создан новый B2B счет в системе T-Bank Integration

Детали счета:
- ID счета: {}
- ИНН контрагента: {}
- Сумма: {} руб.
- Описание: {}
- Дата создания: {}

Счет ожидает отправки контрагенту.

--
ADQuest T-Bank Integration Service"#,
            invoice_id,
            counterparty_inn,
            amount,
            description,
            created_at.format("%d.%m.%Y %H:%M:%S UTC")
        );

        let html_body = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Новый счет создан</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
        .content {{ background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px; }}
        .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }}
        .amount {{ color: #28a745; font-weight: bold; font-size: 1.2em; }}
        .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🧾 Новый счет создан</h2>
        </div>
        
        <div class="content">
            <p>Создан новый B2B счет в системе T-Bank Integration</p>
            
            <div class="details">
                <h3>Детали счета:</h3>
                <ul>
                    <li><strong>ID счета:</strong> {}</li>
                    <li><strong>ИНН контрагента:</strong> {}</li>
                    <li><strong>Сумма:</strong> <span class="amount">{} руб.</span></li>
                    <li><strong>Описание:</strong> {}</li>
                    <li><strong>Дата создания:</strong> {}</li>
                </ul>
            </div>
            
            <p>Счет ожидает отправки контрагенту.</p>
        </div>
        
        <div class="footer">
            <p>ADQuest T-Bank Integration Service</p>
        </div>
    </div>
</body>
</html>"#,
            invoice_id,
            counterparty_inn,
            amount,
            description,
            created_at.format("%d.%m.%Y %H:%M:%S UTC")
        );

        (subject, text_body, html_body)
    }

    /// Generate payment completion notification
    pub fn payment_completed(
        payment_id: &str,
        order_id: &str,
        amount: Decimal,
        status: &str,
        completed_at: DateTime<Utc>,
    ) -> (String, String, String) {
        let subject = format!("Платеж завершен: {}", payment_id);
        
        let text_body = format!(
            r#"Платеж завершен в системе T-Bank Acquiring

Детали платежа:
- ID платежа: {}
- ID заказа: {}
- Сумма: {} руб.
- Статус: {}
- Дата завершения: {}

--
ADQuest T-Bank Integration Service"#,
            payment_id,
            order_id,
            amount,
            status,
            completed_at.format("%d.%m.%Y %H:%M:%S UTC")
        );

        let html_body = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Платеж завершен</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
        .content {{ background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px; }}
        .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }}
        .amount {{ color: #28a745; font-weight: bold; font-size: 1.2em; }}
        .status {{ color: #007bff; font-weight: bold; }}
        .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>💳 Платеж завершен</h2>
        </div>
        
        <div class="content">
            <p>Платеж завершен в системе T-Bank Acquiring</p>
            
            <div class="details">
                <h3>Детали платежа:</h3>
                <ul>
                    <li><strong>ID платежа:</strong> {}</li>
                    <li><strong>ID заказа:</strong> {}</li>
                    <li><strong>Сумма:</strong> <span class="amount">{} руб.</span></li>
                    <li><strong>Статус:</strong> <span class="status">{}</span></li>
                    <li><strong>Дата завершения:</strong> {}</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>ADQuest T-Bank Integration Service</p>
        </div>
    </div>
</body>
</html>"#,
            payment_id,
            order_id,
            amount,
            status,
            completed_at.format("%d.%m.%Y %H:%M:%S UTC")
        );

        (subject, text_body, html_body)
    }

    /// Generate error notification
    pub fn error_notification(
        error_type: &str,
        error_message: &str,
        context: Option<&Value>,
        occurred_at: DateTime<Utc>,
    ) -> (String, String, String) {
        let subject = format!("Ошибка T-Bank Integration: {}", error_type);
        
        let context_str = context
            .map(|c| serde_json::to_string_pretty(c).unwrap_or_else(|_| "Invalid JSON".to_string()))
            .unwrap_or_else(|| "Нет дополнительной информации".to_string());
        
        let text_body = format!(
            r#"Произошла ошибка в системе T-Bank Integration

Детали ошибки:
- Тип ошибки: {}
- Сообщение: {}
- Время возникновения: {}

Контекст:
{}

Требуется проверка системы.

--
ADQuest T-Bank Integration Service"#,
            error_type,
            error_message,
            occurred_at.format("%d.%m.%Y %H:%M:%S UTC"),
            context_str
        );

        let html_body = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Ошибка системы</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #f8d7da; padding: 20px; border-radius: 5px; margin-bottom: 20px; color: #721c24; }}
        .content {{ background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px; }}
        .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }}
        .error {{ color: #dc3545; font-weight: bold; }}
        .context {{ background-color: #f1f3f4; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 0.9em; white-space: pre-wrap; }}
        .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>⚠️ Ошибка системы</h2>
        </div>
        
        <div class="content">
            <p>Произошла ошибка в системе T-Bank Integration</p>
            
            <div class="details">
                <h3>Детали ошибки:</h3>
                <ul>
                    <li><strong>Тип ошибки:</strong> <span class="error">{}</span></li>
                    <li><strong>Сообщение:</strong> {}</li>
                    <li><strong>Время возникновения:</strong> {}</li>
                </ul>
            </div>
            
            <h3>Контекст:</h3>
            <div class="context">{}</div>
            
            <p><strong>Требуется проверка системы.</strong></p>
        </div>
        
        <div class="footer">
            <p>ADQuest T-Bank Integration Service</p>
        </div>
    </div>
</body>
</html>"#,
            error_type,
            error_message,
            occurred_at.format("%d.%m.%Y %H:%M:%S UTC"),
            context_str
        );

        (subject, text_body, html_body)
    }

    /// Generate system status notification
    pub fn system_status(
        status: &str,
        message: &str,
        details: Option<&Value>,
        timestamp: DateTime<Utc>,
    ) -> (String, String, String) {
        let subject = format!("T-Bank Integration: {}", status);
        
        let details_str = details
            .map(|d| serde_json::to_string_pretty(d).unwrap_or_else(|_| "Invalid JSON".to_string()))
            .unwrap_or_else(|| "Нет дополнительных деталей".to_string());
        
        let text_body = format!(
            r#"Уведомление о статусе системы T-Bank Integration

Статус: {}
Сообщение: {}
Время: {}

Детали:
{}

--
ADQuest T-Bank Integration Service"#,
            status,
            message,
            timestamp.format("%d.%m.%Y %H:%M:%S UTC"),
            details_str
        );

        let (header_color, status_color) = match status.to_lowercase().as_str() {
            s if s.contains("error") || s.contains("failed") => ("#f8d7da", "#dc3545"),
            s if s.contains("warning") || s.contains("degraded") => ("#fff3cd", "#856404"),
            s if s.contains("success") || s.contains("healthy") => ("#d4edda", "#155724"),
            _ => ("#d1ecf1", "#0c5460"),
        };

        let html_body = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Статус системы</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: {}; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
        .content {{ background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px; }}
        .details {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }}
        .status {{ color: {}; font-weight: bold; font-size: 1.1em; }}
        .details-content {{ background-color: #f1f3f4; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 0.9em; white-space: pre-wrap; }}
        .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📊 Статус системы</h2>
        </div>
        
        <div class="content">
            <p>Уведомление о статусе системы T-Bank Integration</p>
            
            <div class="details">
                <ul>
                    <li><strong>Статус:</strong> <span class="status">{}</span></li>
                    <li><strong>Сообщение:</strong> {}</li>
                    <li><strong>Время:</strong> {}</li>
                </ul>
            </div>
            
            <h3>Детали:</h3>
            <div class="details-content">{}</div>
        </div>
        
        <div class="footer">
            <p>ADQuest T-Bank Integration Service</p>
        </div>
    </div>
</body>
</html>"#,
            header_color,
            status_color,
            status,
            message,
            timestamp.format("%d.%m.%Y %H:%M:%S UTC"),
            details_str
        );

        (subject, text_body, html_body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use rust_decimal::Decimal;

    #[test]
    fn test_invoice_created_template() {
        let (subject, text_body, html_body) = EmailTemplate::invoice_created(
            "INV-123",
            "1234567890",
            Decimal::from(1000),
            "Test invoice",
            Utc::now(),
        );

        assert!(subject.contains("INV-123"));
        assert!(text_body.contains("INV-123"));
        assert!(text_body.contains("1234567890"));
        assert!(text_body.contains("1000"));
        assert!(html_body.contains("INV-123"));
        assert!(html_body.contains("1234567890"));
    }

    #[test]
    fn test_payment_completed_template() {
        let (subject, text_body, html_body) = EmailTemplate::payment_completed(
            "PAY-123",
            "ORDER-456",
            Decimal::from(500),
            "CONFIRMED",
            Utc::now(),
        );

        assert!(subject.contains("PAY-123"));
        assert!(text_body.contains("PAY-123"));
        assert!(text_body.contains("ORDER-456"));
        assert!(text_body.contains("500"));
        assert!(text_body.contains("CONFIRMED"));
        assert!(html_body.contains("PAY-123"));
    }

    #[test]
    fn test_error_notification_template() {
        let context = serde_json::json!({
            "request_id": "req-123",
            "endpoint": "/api/v1/invoice"
        });

        let (subject, text_body, html_body) = EmailTemplate::error_notification(
            "API Error",
            "Failed to create invoice",
            Some(&context),
            Utc::now(),
        );

        assert!(subject.contains("API Error"));
        assert!(text_body.contains("Failed to create invoice"));
        assert!(text_body.contains("req-123"));
        assert!(html_body.contains("API Error"));
    }

    #[test]
    fn test_system_status_template() {
        let details = serde_json::json!({
            "uptime": "24h",
            "requests_processed": 1000
        });

        let (subject, text_body, html_body) = EmailTemplate::system_status(
            "Healthy",
            "System is operating normally",
            Some(&details),
            Utc::now(),
        );

        assert!(subject.contains("Healthy"));
        assert!(text_body.contains("System is operating normally"));
        assert!(text_body.contains("uptime"));
        assert!(html_body.contains("Healthy"));
    }
}