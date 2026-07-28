use std::collections::HashMap;

use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use ring::{
    aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM},
    rand::{SecureRandom, SystemRandom},
};

use super::types::EncryptedData;

/// AES-256-GCM encryption service for 152-ФЗ compliance
#[derive(Clone)]
pub struct EncryptionService {
    key: LessSafeKey,
    rng: SystemRandom,
}

impl EncryptionService {
    /// Create new encryption service with provided key
    pub fn new(key_bytes: &[u8]) -> Result<Self> {
        if key_bytes.len() != 32 {
            return Err(anyhow::anyhow!("AES-256-GCM requires 32-byte key"));
        }

        let unbound_key = UnboundKey::new(&AES_256_GCM, key_bytes)
            .map_err(|e| anyhow::anyhow!("Failed to create encryption key: {:?}", e))?;

        let key = LessSafeKey::new(unbound_key);
        let rng = SystemRandom::new();

        Ok(Self { key, rng })
    }

    /// Create encryption service from base64-encoded key
    pub fn from_base64_key(key_base64: &str) -> Result<Self> {
        let key_bytes = general_purpose::STANDARD
            .decode(key_base64)
            .map_err(|e| anyhow::anyhow!("Invalid base64 key: {}", e))?;

        Self::new(&key_bytes)
    }

    /// Generate a new random 256-bit encryption key
    pub fn generate_key() -> Result<Vec<u8>> {
        let rng = SystemRandom::new();
        let mut key = vec![0u8; 32];
        rng.fill(&mut key)
            .map_err(|e| anyhow::anyhow!("Failed to generate key: {:?}", e))?;
        Ok(key)
    }

    /// Encrypt sensitive data with AES-256-GCM
    pub fn encrypt(&self, plaintext: &str) -> Result<EncryptedData> {
        // Generate random nonce
        let mut nonce_bytes = vec![0u8; 12]; // 96-bit nonce for GCM
        self.rng
            .fill(&mut nonce_bytes)
            .map_err(|e| anyhow::anyhow!("Failed to generate nonce: {:?}", e))?;

        let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes)
            .map_err(|e| anyhow::anyhow!("Invalid nonce: {:?}", e))?;

        // Encrypt the data
        let mut in_out = plaintext.as_bytes().to_vec();
        self.key
            .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;

        Ok(EncryptedData {
            ciphertext: general_purpose::STANDARD.encode(&in_out),
            nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            algorithm: "AES-256-GCM".to_string(),
            version: 1,
        })
    }

    /// Decrypt data encrypted with AES-256-GCM
    pub fn decrypt(&self, encrypted_data: &EncryptedData) -> Result<String> {
        // Validate algorithm
        if encrypted_data.algorithm != "AES-256-GCM" {
            return Err(anyhow::anyhow!(
                "Unsupported encryption algorithm: {}",
                encrypted_data.algorithm
            ));
        }

        // Validate version
        if encrypted_data.version != 1 {
            return Err(anyhow::anyhow!(
                "Unsupported encryption version: {}",
                encrypted_data.version
            ));
        }

        // Decode base64 data
        let ciphertext = general_purpose::STANDARD
            .decode(&encrypted_data.ciphertext)
            .map_err(|e| anyhow::anyhow!("Invalid base64 ciphertext: {}", e))?;

        let nonce_bytes = general_purpose::STANDARD
            .decode(&encrypted_data.nonce)
            .map_err(|e| anyhow::anyhow!("Invalid base64 nonce: {}", e))?;

        let nonce = Nonce::try_assume_unique_for_key(&nonce_bytes)
            .map_err(|e| anyhow::anyhow!("Invalid nonce: {:?}", e))?;

        // Decrypt the data
        let mut in_out = ciphertext;
        let plaintext_bytes = self
            .key
            .open_in_place(nonce, Aad::empty(), &mut in_out)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {:?}", e))?;

        String::from_utf8(plaintext_bytes.to_vec())
            .map_err(|e| anyhow::anyhow!("Invalid UTF-8 in decrypted data: {}", e))
    }

    /// Encrypt sensitive fields in a data structure
    pub fn encrypt_fields(
        &self,
        data: &mut HashMap<String, String>,
        fields: &[&str],
    ) -> Result<()> {
        for field in fields {
            if let Some(value) = data.get(*field) {
                let encrypted = self.encrypt(value)?;
                let encrypted_json = serde_json::to_string(&encrypted)
                    .map_err(|e| anyhow::anyhow!("Failed to serialize encrypted data: {}", e))?;
                data.insert(field.to_string(), encrypted_json);
            }
        }
        Ok(())
    }

    /// Decrypt sensitive fields in a data structure
    pub fn decrypt_fields(
        &self,
        data: &mut HashMap<String, String>,
        fields: &[&str],
    ) -> Result<()> {
        for field in fields {
            if let Some(encrypted_json) = data.get(*field) {
                // Try to parse as encrypted data
                if let Ok(encrypted_data) = serde_json::from_str::<EncryptedData>(encrypted_json) {
                    let decrypted = self.decrypt(&encrypted_data)?;
                    data.insert(field.to_string(), decrypted);
                }
                // If it's not encrypted JSON, leave it as is (backward compatibility)
            }
        }
        Ok(())
    }
}