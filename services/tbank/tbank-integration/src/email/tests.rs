use crate::email::{EmailConfig, EmailSender, EmailTemplate};
use crate::types::TBankError;
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::json;
use std::env;
use tokio_test;

/// Test email configuration errors
#[tokio::test]
async fn test_email_config_errors() {
    // Test missing SMTP server
    env::set_var("TBANK_EMAIL_ENABLED", "true");
    env::remove_var("TBANK_EMAIL_SMTP_SERVER");
    env::remove_var("TBANK_EMAIL_USERNAME");
    env::remove_var("TBANK_EMAIL_PASSWORD");
    env::remove_var("TBANK_EMAIL_FROM_ADDRESS");

    let result = EmailConfig::from_env();
    assert!(result.is_err());
    
    if let Err(TBankError::ConfigurationError(msg)) = result {
        assert!(msg.contains("TBANK_EMAIL_SMTP_SERVER is required"));
    } else {
        panic!("Expected ConfigurationError for missing SMTP server");
    }
}

#[tokio::test]
async fn test_email_sender_invalid_config() {
    let invalid_config = EmailConfig {
        enabled: true,
        smtp_server: String::new(), // Empty server
        smtp_port: 587,
        username: "test".to_string(),
        password: "test".to_string(),
        from_address: "invalid-email".to_string(), // Invalid email
        from_name: "Test".to_string(),
        to_addresses: vec![],  // Empty recipients
        use_tls: true,
        timeout_seconds: 30,
    };

    let result = EmailSender::new(invalid_config);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_email_validation_errors() {
    use crate::types::common::validators::EmailValidator;

    // Test various invalid email formats
    let invalid_emails = vec![
        "",                           // Empty
        "invalid",                    // No @
        "@domain.com",               // No local part
        "user@",                     // No domain
        "user@@domain.com",          // Multiple @
        "user@domain",               // No TLD
        ".user@domain.com",          // Starts with dot
        "user.@domain.com",          // Ends with dot
        "us..er@domain.com",         // Consecutive dots
        "user@.domain.com",          // Domain starts with dot
        "user@domain.com.",          // Domain ends with dot
        "user@domain..com",          // Consecutive dots in domain
        "a".repeat(65) + "@domain.com", // Local part too long
        "user@" + &"a".repeat(250) + ".com", // Domain too long
    ];

    for email in invalid_emails {
        let result = EmailValidator::validate(email);
        assert!(result.is_err(), "Email should be invalid: {}", email);
    }
}

#[tokio::test]
async fn test_email_template_generation() {
    // Test invoice created template
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

    // Test payment completed template
    let (subject, text_body, html_body) = EmailTemplate::payment_completed(
        "PAY-456",
        "ORDER-789",
        Decimal::from(500),
        "CONFIRMED",
        Utc::now(),
    );

    assert!(subject.contains("PAY-456"));
    assert!(text_body.contains("PAY-456"));
    assert!(text_body.contains("ORDER-789"));
    assert!(text_body.contains("500"));
    assert!(text_body.contains("CONFIRMED"));
    assert!(html_body.contains("PAY-456"));

    // Test error notification template
    let context = json!({
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
    assert!(html_body.contains("req-123"));
}

#[tokio::test]
async fn test_email_sender_disabled() {
    let disabled_config = EmailConfig {
        enabled: false,
        smtp_server: String::new(),
        smtp_port: 587,
        username: String::new(),
        password: String::new(),
        from_address: String::new(),
        from_name: String::new(),
        to_addresses: vec![],
        use_tls: true,
        timeout_seconds: 30,
    };

    let sender = EmailSender::new(disabled_config).unwrap();
    assert!(!sender.is_enabled());

    // Should not fail when disabled
    let result = sender.send_notification(
        "Test Subject",
        "Test Body",
        Some("<html><body>Test HTML</body></html>"),
    ).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_email_connection_errors() {
    // Test with invalid SMTP server
    let invalid_config = EmailConfig {
        enabled: true,
        smtp_server: "invalid.smtp.server.that.does.not.exist".to_string(),
        smtp_port: 587,
        username: "test@example.com".to_string(),
        password: "password".to_string(),
        from_address: "test@example.com".to_string(),
        from_name: "Test".to_string(),
        to_addresses: vec!["recipient@example.com".to_string()],
        use_tls: true,
        timeout_seconds: 5, // Short timeout for test
    };

    let result = EmailSender::new(invalid_config);
    // Should succeed in creating sender (connection is tested later)
    assert!(result.is_ok());

    let sender = result.unwrap();
    
    // Connection test should fail
    let connection_result = sender.test_connection().await;
    assert!(connection_result.is_err());
    
    if let Err(TBankError::NetworkError(msg)) = connection_result {
        assert!(msg.contains("connection") || msg.contains("failed"));
    } else {
        panic!("Expected NetworkError for invalid SMTP server");
    }
}

#[tokio::test]
async fn test_email_message_building_errors() {
    let config = EmailConfig {
        enabled: true,
        smtp_server: "smtp.example.com".to_string(),
        smtp_port: 587,
        username: "test@example.com".to_string(),
        password: "password".to_string(),
        from_address: "invalid-from-address".to_string(), // Invalid from address
        from_name: "Test".to_string(),
        to_addresses: vec!["test@example.com".to_string()],
        use_tls: true,
        timeout_seconds: 30,
    };

    // Should fail validation during sender creation
    let result = EmailSender::new(config);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_email_large_content() {
    let config = EmailConfig {
        enabled: true,
        smtp_server: "smtp.example.com".to_string(),
        smtp_port: 587,
        username: "test@example.com".to_string(),
        password: "password".to_string(),
        from_address: "test@example.com".to_string(),
        from_name: "Test".to_string(),
        to_addresses: vec!["recipient@example.com".to_string()],
        use_tls: true,
        timeout_seconds: 30,
    };

    let sender = EmailSender::new(config).unwrap();

    // Test with very large content
    let large_subject = "A".repeat(1000);
    let large_body = "B".repeat(100000); // 100KB
    let large_html = format!("<html><body>{}</body></html>", "C".repeat(100000));

    // Should handle large content gracefully
    // Note: This won't actually send due to invalid SMTP server, but should build message
    let result = sender.send_notification(&large_subject, &large_body, Some(&large_html)).await;
    // Expect network error, not validation error
    if let Err(e) = result {
        // Should be network error, not validation error
        assert!(matches!(e, TBankError::NetworkError(_)));
    }
}

#[tokio::test]
async fn test_email_special_characters() {
    let config = EmailConfig {
        enabled: true,
        smtp_server: "smtp.example.com".to_string(),
        smtp_port: 587,
        username: "test@example.com".to_string(),
        password: "password".to_string(),
        from_address: "test@example.com".to_string(),
        from_name: "Test Sender 🚀".to_string(), // Unicode characters
        to_addresses: vec!["recipient@example.com".to_string()],
        use_tls: true,
        timeout_seconds: 30,
    };

    let sender = EmailSender::new(config).unwrap();

    // Test with special characters and Unicode
    let subject = "Тест с русскими символами и эмодзи 📧";
    let body = "Содержимое письма с различными символами: ñáéíóú, 中文, العربية, 🎉🚀💻";
    let html = format!("<html><body><h1>{}</h1><p>{}</p></body></html>", subject, body);

    // Should handle Unicode characters properly
    let result = sender.send_notification(subject, body, Some(&html)).await;
    // Expect network error due to invalid SMTP, but message should build correctly
    if let Err(e) = result {
        assert!(matches!(e, TBankError::NetworkError(_)));
    }
}

#[tokio::test]
async fn test_email_concurrent_sending() {
    let config = EmailConfig {
        enabled: true,
        smtp_server: "smtp.example.com".to_string(),
        smtp_port: 587,
        username: "test@example.com".to_string(),
        password: "password".to_string(),
        from_address: "test@example.com".to_string(),
        from_name: "Test".to_string(),
        to_addresses: vec![
            "recipient1@example.com".to_string(),
            "recipient2@example.com".to_string(),
            "recipient3@example.com".to_string(),
        ],
        use_tls: true,
        timeout_seconds: 30,
    };

    let sender = EmailSender::new(config).unwrap();

    // Test concurrent email sending
    let mut handles = vec![];
    
    for i in 0..5 {
        let sender_clone = sender.clone();
        let handle = tokio::spawn(async move {
            sender_clone.send_notification(
                &format!("Test Subject {}", i),
                &format!("Test Body {}", i),
                None,
            ).await
        });
        handles.push(handle);
    }

    // Wait for all tasks to complete
    for handle in handles {
        let result = handle.await.unwrap();
        // All should fail with network error due to invalid SMTP
        assert!(result.is_err());
    }
}

/// Integration test with environment variables
#[tokio::test]
async fn test_email_integration_with_env() {
    // Set up test environment
    env::set_var("TBANK_EMAIL_ENABLED", "true");
    env::set_var("TBANK_EMAIL_SMTP_SERVER", "smtp.example.com");
    env::set_var("TBANK_EMAIL_SMTP_PORT", "587");
    env::set_var("TBANK_EMAIL_USERNAME", "test@example.com");
    env::set_var("TBANK_EMAIL_PASSWORD", "password");
    env::set_var("TBANK_EMAIL_FROM_ADDRESS", "test@example.com");
    env::set_var("TBANK_EMAIL_FROM_NAME", "Test Sender");
    env::set_var("TBANK_EMAIL_TO_ADDRESSES", "recipient@example.com");
    env::set_var("TBANK_EMAIL_USE_TLS", "true");
    env::set_var("TBANK_EMAIL_TIMEOUT_SECONDS", "30");

    let config = EmailConfig::from_env().unwrap();
    assert!(config.enabled);
    assert_eq!(config.smtp_server, "smtp.example.com");
    assert_eq!(config.smtp_port, 587);
    assert_eq!(config.username, "test@example.com");
    assert_eq!(config.from_address, "test@example.com");
    assert_eq!(config.to_addresses, vec!["recipient@example.com"]);
    assert!(config.use_tls);
    assert_eq!(config.timeout_seconds, 30);

    let sender = EmailSender::new(config).unwrap();
    assert!(sender.is_enabled());

    // Clean up environment
    env::remove_var("TBANK_EMAIL_ENABLED");
    env::remove_var("TBANK_EMAIL_SMTP_SERVER");
    env::remove_var("TBANK_EMAIL_SMTP_PORT");
    env::remove_var("TBANK_EMAIL_USERNAME");
    env::remove_var("TBANK_EMAIL_PASSWORD");
    env::remove_var("TBANK_EMAIL_FROM_ADDRESS");
    env::remove_var("TBANK_EMAIL_FROM_NAME");
    env::remove_var("TBANK_EMAIL_TO_ADDRESSES");
    env::remove_var("TBANK_EMAIL_USE_TLS");
    env::remove_var("TBANK_EMAIL_TIMEOUT_SECONDS");
}