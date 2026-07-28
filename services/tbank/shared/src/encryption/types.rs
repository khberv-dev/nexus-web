use serde::{Deserialize, Serialize};

/// Encrypted data container with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: String, // Base64 encoded
    pub nonce: String,      // Base64 encoded
    pub algorithm: String,  // "AES-256-GCM"
    pub version: u8,        // Encryption version for future compatibility
}