use axum::{
    body::Body,
    http::{header::SET_COOKIE, HeaderValue, Request, Response, StatusCode},
    middleware::Next,
};

/// Middleware to ensure all cookies have secure flags
/// This middleware modifies Set-Cookie headers to include HttpOnly, Secure, and SameSite flags
pub async fn secure_cookies_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response<Body>, StatusCode> {
    let mut response = next.run(request).await;
    
    // Get mutable reference to headers
    let headers = response.headers_mut();
    
    // Process all Set-Cookie headers
    let cookie_headers: Vec<HeaderValue> = headers
        .get_all(SET_COOKIE)
        .iter()
        .map(|header| {
            let cookie_str = header.to_str().unwrap_or("");
            let secure_cookie = make_cookie_secure(cookie_str);
            HeaderValue::try_from(secure_cookie).unwrap_or_else(|_| header.clone())
        })
        .collect();
    
    // Remove existing Set-Cookie headers
    headers.remove(SET_COOKIE);
    
    // Add secure cookies back
    for cookie in cookie_headers {
        headers.append(SET_COOKIE, cookie);
    }
    
    Ok(response)
}

/// Make a cookie string secure by adding HttpOnly, Secure, and SameSite flags
fn make_cookie_secure(cookie: &str) -> String {
    let mut cookie = cookie.to_string();
    
    // Add HttpOnly if not present
    if !cookie.to_lowercase().contains("httponly") {
        cookie.push_str("; HttpOnly");
    }
    
    // Add Secure if not present
    if !cookie.to_lowercase().contains("secure") {
        cookie.push_str("; Secure");
    }
    
    // Add SameSite=Strict if not present
    if !cookie.to_lowercase().contains("samesite") {
        cookie.push_str("; SameSite=Strict");
    }
    
    cookie
}

/// Configuration for secure cookies
#[derive(Debug, Clone)]
pub struct SecureCookieConfig {
    pub http_only: bool,
    pub secure: bool,
    pub same_site: SameSite,
    pub max_age: Option<u64>, // seconds
    pub domain: Option<String>,
    pub path: Option<String>,
}

impl Default for SecureCookieConfig {
    fn default() -> Self {
        Self {
            http_only: true,
            secure: true,
            same_site: SameSite::Strict,
            max_age: Some(3600), // 1 hour
            domain: Some(".ad-quest.ru".to_string()),
            path: Some("/".to_string()),
        }
    }
}

#[derive(Debug, Clone)]
pub enum SameSite {
    Strict,
    Lax,
    None,
}

impl std::fmt::Display for SameSite {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SameSite::Strict => write!(f, "Strict"),
            SameSite::Lax => write!(f, "Lax"),
            SameSite::None => write!(f, "None"),
        }
    }
}

/// Create a secure cookie header value
pub fn create_secure_cookie(
    name: &str,
    value: &str,
    config: &SecureCookieConfig,
) -> HeaderValue {
    let mut cookie = format!("{}={}", name, value);
    
    if config.http_only {
        cookie.push_str("; HttpOnly");
    }
    
    if config.secure {
        cookie.push_str("; Secure");
    }
    
    cookie.push_str(&format!("; SameSite={}", config.same_site));
    
    if let Some(max_age) = config.max_age {
        cookie.push_str(&format!("; Max-Age={}", max_age));
    }
    
    if let Some(domain) = &config.domain {
        cookie.push_str(&format!("; Domain={}", domain));
    }
    
    if let Some(path) = &config.path {
        cookie.push_str(&format!("; Path={}", path));
    }
    
    HeaderValue::try_from(cookie).unwrap_or_else(|_| {
        HeaderValue::from_static("invalid-cookie")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_make_cookie_secure() {
        // Test basic cookie
        let cookie = "session_id=abc123";
        let secure = make_cookie_secure(cookie);
        assert!(secure.contains("HttpOnly"));
        assert!(secure.contains("Secure"));
        assert!(secure.contains("SameSite=Strict"));
    }

    #[test]
    fn test_cookie_already_secure() {
        let cookie = "session_id=abc123; HttpOnly; Secure; SameSite=Strict";
        let secure = make_cookie_secure(cookie);
        // Should not duplicate flags
        assert_eq!(secure.matches("HttpOnly").count(), 1);
        assert_eq!(secure.matches("Secure").count(), 1);
        assert_eq!(secure.matches("SameSite").count(), 1);
    }

    #[test]
    fn test_create_secure_cookie() {
        let config = SecureCookieConfig::default();
        let cookie = create_secure_cookie("access_token", "jwt123", &config);
        let cookie_str = cookie.to_str().unwrap();
        
        assert!(cookie_str.contains("access_token=jwt123"));
        assert!(cookie_str.contains("HttpOnly"));
        assert!(cookie_str.contains("Secure"));
        assert!(cookie_str.contains("SameSite=Strict"));
        assert!(cookie_str.contains("Max-Age=3600"));
        assert!(cookie_str.contains("Domain=.ad-quest.ru"));
        assert!(cookie_str.contains("Path=/"));
    }
}