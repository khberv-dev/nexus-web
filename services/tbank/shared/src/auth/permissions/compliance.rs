use super::core::Permission;
use super::categories::PermissionCategory;

pub struct CompliancePermissions;

impl CompliancePermissions {
    /// Check if permission requires special logging (for 152-ФЗ compliance)
    pub fn requires_audit_logging(permission: &Permission) -> bool {
        matches!(
            permission,
            Permission::PersonalDataAccess
                | Permission::PersonalDataModify
                | Permission::PersonalDataDelete
                | Permission::PersonalDataExport
                | Permission::DataProcess
                | Permission::DataAnonymize
        )
    }

    /// Check if permission is related to ERIR compliance
    pub fn is_erir_related(permission: &Permission) -> bool {
        matches!(permission.category(), PermissionCategory::Erir)
    }
}

// Add the methods to Permission enum via extension
impl Permission {
    /// Check if permission requires special logging (for 152-ФЗ compliance)
    pub fn requires_audit_logging(&self) -> bool {
        CompliancePermissions::requires_audit_logging(self)
    }

    /// Check if permission is related to ERIR compliance
    pub fn is_erir_related(&self) -> bool {
        CompliancePermissions::is_erir_related(self)
    }
}