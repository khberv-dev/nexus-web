use serde_json::Value;
use tracing;

use super::types::ZitadelClaims;

impl ZitadelClaims {
    /// Extract roles from Zitadel token (supports both array and map formats)
    /// 
    /// Supports multiple formats:
    /// 1. Legacy array: `"urn:zitadel:iam:org:project:roles": ["role1", "role2"]`
    /// 2. New map with orgs: `"urn:zitadel:iam:org:project:PROJECT_ID:roles": {"role": {"org_id": "domain"}}`
    /// 3. Old map with bool: `"urn:zitadel:iam:org:project:PROJECT_ID:roles": {"role": true}`
    pub fn extract_roles(&self) -> Vec<String> {
        let mut roles = Vec::new();
        
        // First, try to get roles from the legacy field
        if let Some(roles_value) = &self.roles {
            match roles_value {
                Value::Array(arr) => {
                    // Legacy array format: ["role1", "role2"]
                    for item in arr {
                        if let Some(role) = item.as_str() {
                            roles.push(role.to_string());
                        }
                    }
                    tracing::debug!("Extracted {} roles from legacy array format", arr.len());
                }
                Value::Object(map) => {
                    // Map format in the legacy field: {"role": true} or {"role": {"org": "domain"}}
                    for (role_name, role_value) in map {
                        match role_value {
                            Value::Object(_) => {
                                // New format: {"org_id": "domain"}
                                roles.push(role_name.clone());
                            }
                            Value::Bool(true) => {
                                // Old format: true
                                roles.push(role_name.clone());
                            }
                            _ => {
                                tracing::warn!("Unexpected role value format for role '{}': {:?}", role_name, role_value);
                            }
                        }
                    }
                    tracing::debug!("Extracted {} roles from legacy map format", map.len());
                }
                _ => {
                    tracing::warn!("Unexpected roles field format: {:?}", roles_value);
                }
            }
        }
        
        // Then, extract roles from project-specific map format
        // Format: "urn:zitadel:iam:org:project:PROJECT_ID:roles": {"role_name": RoleValue}
        for (key, value) in &self.extra_fields {
            if key.starts_with("urn:zitadel:iam:org:project:") && key.ends_with(":roles") {
                if let Some(roles_map) = value.as_object() {
                    // Extract role names (keys of the map)
                    for (role_name, role_value) in roles_map {
                        // Check if role value is an object (new format) or boolean (old format)
                        match role_value {
                            Value::Object(_) => {
                                // New format: {"org_id": "domain"}
                                roles.push(role_name.clone());
                            }
                            Value::Bool(true) => {
                                // Old format: true
                                roles.push(role_name.clone());
                            }
                            _ => {
                                // Skip other formats
                                tracing::warn!("Unexpected role value format for role '{}': {:?}", role_name, role_value);
                            }
                        }
                    }
                    tracing::debug!("Extracted {} roles from project-specific claim '{}': {:?}", 
                        roles_map.len(), key, roles_map.keys().collect::<Vec<_>>());
                }
            }
        }
        
        // Remove duplicates
        roles.sort();
        roles.dedup();
        
        tracing::info!("Total roles extracted: {:?}", roles);
        roles
    }
}
