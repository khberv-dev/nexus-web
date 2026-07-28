use axum::http::HeaderMap;
use super::types::TBankPermission;

/// Extract T-Bank permissions from JWT claims or API key
pub fn extract_tbank_permissions(headers: &HeaderMap) -> Vec<TBankPermission> {
    // In a real implementation, this would extract permissions from JWT claims
    // For now, return default permissions based on authentication method
    if headers.get("x-api-key").is_some() {
        // API key users get basic permissions
        vec![
            TBankPermission::CreateInvoice,
            TBankPermission::ViewInvoice,
            TBankPermission::VerifyCounterparty,
            TBankPermission::ViewBalance,
        ]
    } else if headers.get("authorization").is_some() {
        // JWT users get extended permissions
        vec![
            TBankPermission::CreateInvoice,
            TBankPermission::ViewInvoice,
            TBankPermission::UpdateInvoice,
            TBankPermission::VerifyCounterparty,
            TBankPermission::ViewCounterparty,
            TBankPermission::InitiatePayment,
            TBankPermission::ViewPayment,
            TBankPermission::ViewBalance,
            TBankPermission::ViewStatement,
        ]
    } else {
        vec![]
    }
}

/// Check if user has specific T-Bank permission
pub fn has_tbank_permission(permissions: &[TBankPermission], required: &TBankPermission) -> bool {
    permissions.contains(required) || permissions.contains(&TBankPermission::SystemAdmin)
}

/// Map Zitadel roles to T-Bank permissions
pub fn map_zitadel_roles_to_tbank_permissions(roles: &[String]) -> Vec<TBankPermission> {
    let mut permissions = Vec::new();
    
    for role in roles {
        match role.as_str() {
            "tbank:admin" => {
                permissions.push(TBankPermission::SystemAdmin);
            }
            "tbank:invoice:create" => {
                permissions.push(TBankPermission::CreateInvoice);
            }
            "tbank:invoice:view" => {
                permissions.push(TBankPermission::ViewInvoice);
            }
            "tbank:invoice:update" => {
                permissions.push(TBankPermission::UpdateInvoice);
            }
            "tbank:invoice:cancel" => {
                permissions.push(TBankPermission::CancelInvoice);
            }
            "tbank:counterparty:verify" => {
                permissions.push(TBankPermission::VerifyCounterparty);
            }
            "tbank:counterparty:view" => {
                permissions.push(TBankPermission::ViewCounterparty);
            }
            "tbank:payment:initiate" => {
                permissions.push(TBankPermission::InitiatePayment);
            }
            "tbank:payment:view" => {
                permissions.push(TBankPermission::ViewPayment);
            }
            "tbank:payment:cancel" => {
                permissions.push(TBankPermission::CancelPayment);
            }
            "tbank:balance:view" => {
                permissions.push(TBankPermission::ViewBalance);
            }
            "tbank:statement:view" => {
                permissions.push(TBankPermission::ViewStatement);
            }
            "tbank:audit:view" => {
                permissions.push(TBankPermission::ViewAuditLogs);
            }
            "tbank:webhooks:manage" => {
                permissions.push(TBankPermission::ManageWebhooks);
            }
            _ => {
                // Unknown role, ignore
            }
        }
    }
    
    permissions
}