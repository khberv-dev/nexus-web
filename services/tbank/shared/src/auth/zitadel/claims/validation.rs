use super::types::ZitadelClaims;

impl ZitadelClaims {
    /// Check if token is expired
    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        self.exp < now
    }

    /// Check if token is not yet valid
    pub fn is_not_yet_valid(&self) -> bool {
        if let Some(nbf) = self.nbf {
            let now = chrono::Utc::now().timestamp();
            nbf > now
        } else {
            false
        }
    }

    /// Check if token is valid (not expired and not before time has passed)
    pub fn is_valid(&self) -> bool {
        !self.is_expired() && !self.is_not_yet_valid()
    }

    /// Get time until token expires (in seconds)
    pub fn time_until_expiry(&self) -> Option<i64> {
        let now = chrono::Utc::now().timestamp();
        if self.exp > now {
            Some(self.exp - now)
        } else {
            None
        }
    }
}
