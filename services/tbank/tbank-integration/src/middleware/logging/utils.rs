/// Extract endpoint pattern for metrics (remove IDs and query parameters)
pub fn extract_endpoint_pattern(uri: &str) -> String {
    let path = uri.split('?').next().unwrap_or(uri);

    // Replace common ID patterns with placeholders
    let patterns = [
        (
            r"/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
            "/{uuid}",
        ),
        (r"/\b\d+\b", "/{id}"),
        (r"/\b[0-9a-f]{32}\b", "/{hash}"),
        (r"/\b[A-Za-z0-9+/]{22}==\b", "/{token}"),
    ];

    let mut normalized_path = path.to_string();
    for (pattern, replacement) in &patterns {
        if let Ok(regex) = regex::Regex::new(pattern) {
            normalized_path = regex
                .replace_all(&normalized_path, *replacement)
                .to_string();
        }
    }

    normalized_path
}

/// HTTP status code classification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusClass {
    Success,     // 2xx
    ClientError, // 4xx
    ServerError, // 5xx
    Other,       // 1xx, 3xx
}

/// Get status class from HTTP status code
pub fn get_status_class(status_code: u16) -> StatusClass {
    match status_code {
        200..=299 => StatusClass::Success,
        400..=499 => StatusClass::ClientError,
        500..=599 => StatusClass::ServerError,
        _ => StatusClass::Other,
    }
}

/// Format duration for logging
pub fn format_duration(duration: std::time::Duration) -> (u64, f64) {
    let duration_ms = duration.as_millis() as u64;
    let duration_secs = duration.as_secs_f64();
    (duration_ms, duration_secs)
}