/// Structured logging configuration
#[derive(Debug, Clone)]
pub struct LoggingConfig {
    pub enable_request_logging: bool,
    pub enable_response_logging: bool,
    pub log_request_body: bool,
    pub log_response_body: bool,
    pub max_body_size: usize,
    pub sensitive_headers: Vec<String>,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            enable_request_logging: true,
            enable_response_logging: true,
            log_request_body: false,  // Disabled by default for security
            log_response_body: false, // Disabled by default for performance
            max_body_size: 1024,      // 1KB max
            sensitive_headers: vec![
                "authorization".to_string(),
                "cookie".to_string(),
                "x-api-key".to_string(),
                "terminal-key".to_string(),
            ],
        }
    }
}

impl LoggingConfig {
    /// Create a new logging configuration
    pub fn new() -> Self {
        Self::default()
    }

    /// Enable or disable request logging
    pub fn with_request_logging(mut self, enabled: bool) -> Self {
        self.enable_request_logging = enabled;
        self
    }

    /// Enable or disable response logging
    pub fn with_response_logging(mut self, enabled: bool) -> Self {
        self.enable_response_logging = enabled;
        self
    }

    /// Enable or disable request body logging
    pub fn with_request_body_logging(mut self, enabled: bool) -> Self {
        self.log_request_body = enabled;
        self
    }

    /// Enable or disable response body logging
    pub fn with_response_body_logging(mut self, enabled: bool) -> Self {
        self.log_response_body = enabled;
        self
    }

    /// Set maximum body size for logging
    pub fn with_max_body_size(mut self, size: usize) -> Self {
        self.max_body_size = size;
        self
    }

    /// Add sensitive headers that should not be logged
    pub fn with_sensitive_headers(mut self, headers: Vec<String>) -> Self {
        self.sensitive_headers = headers;
        self
    }

    /// Check if a header is sensitive and should not be logged
    pub fn is_sensitive_header(&self, header_name: &str) -> bool {
        self.sensitive_headers
            .iter()
            .any(|h| h.eq_ignore_ascii_case(header_name))
    }
}