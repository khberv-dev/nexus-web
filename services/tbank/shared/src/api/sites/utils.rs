use rand::Rng;

/// Generate a verification token for domain ownership verification
/// Format: adquest-verify-{32 hex characters}
pub fn generate_verification_token() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..16).map(|_| rng.gen()).collect();
    let hex_string = random_bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    format!("adquest-verify-{}", hex_string)
}

/// Generate a public key for widget integration
/// Format: pk_{32 hex characters}
pub fn generate_public_key() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..16).map(|_| rng.gen()).collect();
    let hex_string = random_bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    format!("pk_{}", hex_string)
}

/// Generate a site key (private key for backend)
/// Format: sk_{32 hex characters}
pub fn generate_site_key() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..16).map(|_| rng.gen()).collect();
    let hex_string = random_bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    format!("sk_{}", hex_string)
}

/// Generate a secret key (private key)
/// Format: sk_secret_{48 hex characters}
pub fn generate_secret_key() -> String {
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..24).map(|_| rng.gen()).collect();
    let hex_string = random_bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    format!("sk_secret_{}", hex_string)
}

/// Verify DNS TXT record for domain verification
/// Returns true if the verification token is found in DNS TXT records
/// Checks the domain directly (e.g., 2gc.ru) for TXT record with format: adquest-verification=<token>
pub async fn verify_dns_txt_record(domain: &str, expected_token: &str) -> Result<bool, String> {
    use trust_dns_resolver::TokioAsyncResolver;
    use trust_dns_resolver::config::*;

    // Create resolver
    let resolver = TokioAsyncResolver::tokio(
        ResolverConfig::default(),
        ResolverOpts::default(),
    );

    // Lookup TXT records for the domain directly (no prefix)
    // CRM generates and checks: 2gc.ru TXT "adquest-verification=<token>"
    match resolver.txt_lookup(domain).await {
        Ok(txt_records) => {
            // Check if any TXT record contains adquest-verification=<token>
            let expected_record = format!("adquest-verification={}", expected_token);
            
            for record in txt_records.iter() {
                let txt_data = record
                    .txt_data()
                    .iter()
                    .map(|data| String::from_utf8_lossy(data).to_string())
                    .collect::<Vec<String>>()
                    .join("");
                
                // Check if TXT record matches the expected format
                if txt_data == expected_record {
                    return Ok(true);
                }
            }
            Ok(false)
        }
        Err(e) => {
            // DNS lookup failed
            Err(format!("DNS lookup failed: {}", e))
        }
    }
}

/// Validate domain format
pub fn is_valid_domain(domain: &str) -> bool {
    // Basic domain validation
    if domain.is_empty() || domain.len() > 253 {
        return false;
    }

    // Check for valid characters and structure
    let domain_regex = regex::Regex::new(r"^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$").unwrap();
    domain_regex.is_match(&domain.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_verification_token() {
        let token = generate_verification_token();
        assert!(token.starts_with("adquest-verify-"));
        assert_eq!(token.len(), 48); // "adquest-verify-" + 32 hex chars
    }

    #[test]
    fn test_generate_public_key() {
        let key = generate_public_key();
        assert!(key.starts_with("pk_"));
        assert_eq!(key.len(), 35); // "pk_" + 32 hex chars
    }

    #[test]
    fn test_generate_site_key() {
        let key = generate_site_key();
        assert!(key.starts_with("sk_"));
        assert_eq!(key.len(), 35); // "sk_" + 32 hex chars
    }

    #[test]
    fn test_generate_secret_key() {
        let key = generate_secret_key();
        assert!(key.starts_with("sk_secret_"));
        assert_eq!(key.len(), 58); // "sk_secret_" + 48 hex chars
    }

    #[test]
    fn test_is_valid_domain() {
        assert!(is_valid_domain("example.com"));
        assert!(is_valid_domain("sub.example.com"));
        assert!(is_valid_domain("test-site.example.co.uk"));
        
        assert!(!is_valid_domain(""));
        assert!(!is_valid_domain("invalid"));
        assert!(!is_valid_domain("-example.com"));
        assert!(!is_valid_domain("example-.com"));
    }
}
