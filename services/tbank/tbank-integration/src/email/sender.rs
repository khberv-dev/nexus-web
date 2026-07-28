use crate::email::config::EmailConfig;
use crate::types::{TBankError, TBankResult};
use lettre::message::{header, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use std::time::Duration;
use tracing::{debug, error, info, warn};

/// Email sender for T-Bank integration notifications
pub struct EmailSender {
    config: EmailConfig,
    transport: Option<SmtpTransport>,
}

impl EmailSender {
    /// Create a new email sender
    pub fn new(config: EmailConfig) -> TBankResult<Self> {
        config.validate()?;

        let transport = if config.enabled {
            Some(Self::create_transport(&config)?)
        } else {
            None
        };

        Ok(Self { config, transport })
    }

    /// Create SMTP transport
    fn create_transport(config: &EmailConfig) -> TBankResult<SmtpTransport> {
        debug!(
            server = %config.smtp_server,
            port = config.smtp_port,
            use_tls = config.use_tls,
            "Creating SMTP transport"
        );

        let credentials = Credentials::new(config.username.clone(), config.password.clone());

        let transport = if config.use_tls {
            SmtpTransport::starttls_relay(&config.smtp_server)
                .map_err(|e| TBankError::ConfigurationError(format!("SMTP TLS setup failed: {}", e)))?
                .port(config.smtp_port)
                .credentials(credentials)
                .timeout(Some(Duration::from_secs(config.timeout_seconds)))
                .build()
        } else {
            SmtpTransport::builder_dangerous(&config.smtp_server)
                .port(config.smtp_port)
                .credentials(credentials)
                .timeout(Some(Duration::from_secs(config.timeout_seconds)))
                .build()
        };

        info!(
            connection = %config.connection_string_safe(),
            "SMTP transport created successfully"
        );

        Ok(transport)
    }

    /// Send email notification
    pub async fn send_notification(
        &self,
        subject: &str,
        text_body: &str,
        html_body: Option<&str>,
    ) -> TBankResult<()> {
        if !self.config.enabled {
            debug!("Email notifications are disabled, skipping send");
            return Ok(());
        }

        let transport = self.transport.as_ref().ok_or_else(|| {
            TBankError::ConfigurationError("SMTP transport not initialized".to_string())
        })?;

        debug!(
            subject = %subject,
            recipients = ?self.config.to_addresses,
            "Sending email notification"
        );

        for to_address in &self.config.to_addresses {
            match self.send_single_email(transport, to_address, subject, text_body, html_body).await {
                Ok(()) => {
                    info!(
                        to = %to_address,
                        subject = %subject,
                        "Email sent successfully"
                    );
                }
                Err(e) => {
                    error!(
                        to = %to_address,
                        subject = %subject,
                        error = %e,
                        "Failed to send email"
                    );
                    // Continue sending to other recipients
                }
            }
        }

        Ok(())
    }

    /// Send email to a single recipient
    async fn send_single_email(
        &self,
        transport: &SmtpTransport,
        to_address: &str,
        subject: &str,
        text_body: &str,
        html_body: Option<&str>,
    ) -> TBankResult<()> {
        let message = self.build_message(to_address, subject, text_body, html_body)?;

        // Send email in blocking task to avoid blocking async runtime
        let transport = transport.clone();
        let result = tokio::task::spawn_blocking(move || transport.send(&message))
            .await
            .map_err(|e| TBankError::NetworkError(format!("Email send task failed: {}", e)))?;

        result.map_err(|e| TBankError::NetworkError(format!("SMTP send failed: {}", e)))?;

        Ok(())
    }

    /// Build email message
    fn build_message(
        &self,
        to_address: &str,
        subject: &str,
        text_body: &str,
        html_body: Option<&str>,
    ) -> TBankResult<Message> {
        let mut message_builder = Message::builder()
            .from(
                format!("{} <{}>", self.config.from_name, self.config.from_address)
                    .parse()
                    .map_err(|e| TBankError::ValidationError(format!("Invalid from address: {}", e)))?,
            )
            .to(to_address
                .parse()
                .map_err(|e| TBankError::ValidationError(format!("Invalid to address: {}", e)))?)
            .subject(subject);

        let message = if let Some(html) = html_body {
            // Multipart message with both text and HTML
            message_builder
                .multipart(
                    MultiPart::alternative()
                        .singlepart(
                            SinglePart::builder()
                                .header(header::ContentType::TEXT_PLAIN)
                                .body(text_body.to_string()),
                        )
                        .singlepart(
                            SinglePart::builder()
                                .header(header::ContentType::TEXT_HTML)
                                .body(html.to_string()),
                        ),
                )
                .map_err(|e| TBankError::ValidationError(format!("Failed to build multipart message: {}", e)))?
        } else {
            // Text-only message
            message_builder
                .body(text_body.to_string())
                .map_err(|e| TBankError::ValidationError(format!("Failed to build text message: {}", e)))?
        };

        Ok(message)
    }

    /// Test email connection
    pub async fn test_connection(&self) -> TBankResult<()> {
        if !self.config.enabled {
            return Ok(());
        }

        let transport = self.transport.as_ref().ok_or_else(|| {
            TBankError::ConfigurationError("SMTP transport not initialized".to_string())
        })?;

        debug!("Testing SMTP connection");

        // Test connection in blocking task
        let transport = transport.clone();
        let result = tokio::task::spawn_blocking(move || transport.test_connection())
            .await
            .map_err(|e| TBankError::NetworkError(format!("Connection test task failed: {}", e)))?;

        result.map_err(|e| TBankError::NetworkError(format!("SMTP connection test failed: {}", e)))?;

        info!("SMTP connection test successful");
        Ok(())
    }

    /// Send test email
    pub async fn send_test_email(&self) -> TBankResult<()> {
        if !self.config.enabled {
            warn!("Email is disabled, cannot send test email");
            return Ok(());
        }

        let subject = "T-Bank Integration - Test Email";
        let text_body = "This is a test email from T-Bank Integration service.\n\nIf you received this email, the email configuration is working correctly.";
        let html_body = Some(r#"
            <html>
            <body>
                <h2>T-Bank Integration - Test Email</h2>
                <p>This is a test email from T-Bank Integration service.</p>
                <p>If you received this email, the email configuration is working correctly.</p>
                <hr>
                <p><small>Sent from ADQuest T-Bank Integration Service</small></p>
            </body>
            </html>
        "#);

        self.send_notification(subject, text_body, html_body).await
    }

    /// Get email configuration (safe for logging)
    pub fn get_config_safe(&self) -> String {
        self.config.connection_string_safe()
    }

    /// Check if email is enabled
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> EmailConfig {
        EmailConfig {
            enabled: true,
            smtp_server: "smtp.example.com".to_string(),
            smtp_port: 587,
            username: "test@example.com".to_string(),
            password: "password".to_string(),
            from_address: "test@example.com".to_string(),
            from_name: "Test Sender".to_string(),
            to_addresses: vec!["recipient@example.com".to_string()],
            use_tls: true,
            timeout_seconds: 30,
        }
    }

    #[test]
    fn test_email_sender_disabled() {
        let mut config = create_test_config();
        config.enabled = false;

        let sender = EmailSender::new(config).unwrap();
        assert!(!sender.is_enabled());
    }

    #[test]
    fn test_build_message_text_only() {
        let config = create_test_config();
        let sender = EmailSender::new(config).unwrap();

        let message = sender
            .build_message(
                "test@example.com",
                "Test Subject",
                "Test body",
                None,
            )
            .unwrap();

        // Message should be built successfully
        // We can't easily test the content without accessing private fields
        assert!(message.headers().get_raw("Subject").is_some());
    }

    #[test]
    fn test_build_message_multipart() {
        let config = create_test_config();
        let sender = EmailSender::new(config).unwrap();

        let message = sender
            .build_message(
                "test@example.com",
                "Test Subject",
                "Test body",
                Some("<html><body>Test HTML</body></html>"),
            )
            .unwrap();

        // Message should be built successfully
        assert!(message.headers().get_raw("Subject").is_some());
    }

    #[test]
    fn test_invalid_email_addresses() {
        let config = create_test_config();
        let sender = EmailSender::new(config).unwrap();

        // Invalid to address
        let result = sender.build_message(
            "invalid-email",
            "Test",
            "Body",
            None,
        );
        assert!(result.is_err());
    }
}