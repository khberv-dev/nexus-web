use crate::types::{TBankError, TBankResult};
use serde::{Deserialize, Serialize};
use std::env;

/// Email configuration for T-Bank integration notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailConfig {
    pub enabled: bool,
    pub smtp_server: String,
    pub smtp_port: u16,
    pub username: String,
    pub password: String,
    pub from_address: String,
    pub from_name: String,
    pub to_addresses: Vec<String>,
    pub use_tls: bool,
    pub timeout_seconds: u64,
}

impl EmailConfig {
    /// Load email configuration from environment variables
    pub fn from_env() -> TBankResult<Self> {
        let enabled = env::var("TBANK_EMAIL_ENABLED")
            .unwrap_or_else(|_| "false".to_string())
            .parse()
            .unwrap_or(false);

        // If email is disabled, return minimal config
        if !enabled {
            return Ok(Self {
                enabled: false,
                smtp_server: String::new(),
                smtp_port: 587,
                username: String::new(),
                password: String::new(),
                from_address: String::new(),
                from_name: String::new(),
                to_addresses: Vec::new(),
                use_tls: true,
                timeout_seconds: 30,
            });
        }

        let smtp_server = env::var("TBANK_EMAIL_SMTP_SERVER")
            .map_err(|_| TBankError::ConfigurationError(
                "TBANK_EMAIL_SMTP_SERVER is required when email is enabled".to_string()
            ))?;

        let smtp_port = env::var("TBANK_EMAIL_SMTP_PORT")
            .unwrap_or_else(|_| "587".to_string())
            .parse()
            .map_err(|e| TBankError::ConfigurationError(
                format!("Invalid TBANK_EMAIL_SMTP_PORT: {}", e)
            ))?;

        let username = env::var("TBANK_EMAIL_USERNAME")
            .map_err(|_| TBankError::ConfigurationError(
                "TBANK_EMAIL_USERNAME is required when email is enabled".to_string()
            ))?;

        let password = env::var("TBANK_EMAIL_PASSWORD")
            .map_err(|_| TBankError::ConfigurationError(
                "TBANK_EMAIL_PASSWORD is required when email is enabled".to_string()
            ))?;

        let from_address = env::var("TBANK_EMAIL_FROM_ADDRESS")
            .map_err(|_| TBankError::ConfigurationError(
                "TBANK_EMAIL_FROM_ADDRESS is required when email is enabled".to_string()
            ))?;

        let from_name = env::var("TBANK_EMAIL_FROM_NAME")
            .unwrap_or_else(|_| "T-Bank Integration".to_string());

        let to_addresses = env::var("TBANK_EMAIL_TO_ADDRESSES")
            .map(|addrs| addrs.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|_| vec!["admin@ad-quest.ru".to_string()]);

        let use_tls = env::var("TBANK_EMAIL_USE_TLS")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true);

        let timeout_seconds = env::var("TBANK_EMAIL_TIMEOUT_SECONDS")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .unwrap_or(30);

        Ok(Self {
            enabled,
            smtp_server,
            smtp_port,
            username,
            password,
            from_address,
            from_name,
            to_addresses,
            use_tls,
            timeout_seconds,
        })
    }

    /// Validate email configuration
    pub fn validate(&self) -> TBankResult<()> {
        if !self.enabled {
            return Ok(());
        }

        if self.smtp_server.is_empty() {
            return Err(TBankError::ConfigurationError(
                "SMTP server cannot be empty".to_string()
            ));
        }

        if self.smtp_port == 0 {
            return Err(TBankError::ConfigurationError(
                "SMTP port must be greater than 0".to_string()
            ));
        }

        if self.username.is_empty() {
            return Err(TBankError::ConfigurationError(
                "SMTP username cannot be empty".to_string()
            ));
        }

        if self.password.is_empty() {
            return Err(TBankError::ConfigurationError(
                "SMTP password cannot be empty".to_string()
            ));
        }

        if self.from_address.is_empty() {
            return Err(TBankError::ConfigurationError(
                "From address cannot be empty".to_string()
            ));
        }

        // Validate from address format
        use crate::types::common::validators::EmailValidator;
        EmailValidator::validate(&self.from_address)?;

        // Validate to addresses
        if self.to_addresses.is_empty() {
            return Err(TBankError::ConfigurationError(
                "At least one recipient address is required".to_string()
            ));
        }

        for address in &self.to_addresses {
            EmailValidator::validate(address)?;
        }

        Ok(())
    }

    /// Get connection string for logging (without password)
    pub fn connection_string_safe(&self) -> String {
        if !self.enabled {
            return "Email disabled".to_string();
        }

        format!(
            "{}://{}:***@{}:{}",
            if self.use_tls { "smtps" } else { "smtp" },
            self.username,
            self.smtp_server,
            self.smtp_port
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_email_config_disabled() {
        env::set_var("TBANK_EMAIL_ENABLED", "false");
        
        let config = EmailConfig::from_env().unwrap();
        assert!(!config.enabled);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_email_config_validation() {
        let mut config = EmailConfig {
            enabled: true,
            smtp_server: "smtp.example.com".to_string(),
            smtp_port: 587,
            username: "user".to_string(),
            password: "pass".to_string(),
            from_address: "test@example.com".to_string(),
            from_name: "Test".to_string(),
            to_addresses: vec!["admin@example.com".to_string()],
            use_tls: true,
            timeout_seconds: 30,
        };

        // Valid config
        assert!(config.validate().is_ok());

        // Invalid from address
        config.from_address = "invalid-email".to_string();
        assert!(config.validate().is_err());

        // Reset and test empty to addresses
        config.from_address = "test@example.com".to_string();
        config.to_addresses = vec![];
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_connection_string_safe() {
        let config = EmailConfig {
            enabled: true,
            smtp_server: "smtp.example.com".to_string(),
            smtp_port: 587,
            username: "testuser".to_string(),
            password: "secret123".to_string(),
            from_address: "test@example.com".to_string(),
            from_name: "Test".to_string(),
            to_addresses: vec!["admin@example.com".to_string()],
            use_tls: true,
            timeout_seconds: 30,
        };

        let conn_str = config.connection_string_safe();
        assert!(conn_str.contains("testuser"));
        assert!(conn_str.contains("***"));
        assert!(!conn_str.contains("secret123"));
        assert!(conn_str.contains("smtp.example.com"));
    }
}