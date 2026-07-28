#[cfg(test)]
mod tests {
    use crate::auth::permissions::{Permission, PermissionCategory};

    #[test]
    fn test_permission_string_conversion() {
        let permission = Permission::ChallengeGenerate;
        let permission_str = permission.to_string();
        let converted_back = Permission::from_string(permission_str).unwrap();
        assert_eq!(permission, converted_back);
    }

    #[test]
    fn test_all_permissions_convertible() {
        for permission in Permission::all_permissions() {
            let permission_str = permission.to_string();
            let converted_back = Permission::from_string(permission_str);
            assert!(converted_back.is_some());
            assert_eq!(permission, converted_back.unwrap());
        }
    }

    #[test]
    fn test_role_permissions() {
        let advertiser_permissions = Permission::permissions_for_role("adquest.advertiser");
        assert!(advertiser_permissions.contains(&Permission::ChallengeGenerate));
        assert!(advertiser_permissions.contains(&Permission::AdvertiserCampaignManage));
        assert!(!advertiser_permissions.contains(&Permission::AdminUserManage));

        let admin_permissions = Permission::permissions_for_role("adquest.admin");
        assert!(admin_permissions.contains(&Permission::AdminUserManage));
        assert!(admin_permissions.contains(&Permission::BillingProcess));
    }

    #[test]
    fn test_permission_categories() {
        assert_eq!(
            Permission::ChallengeGenerate.category(),
            PermissionCategory::Challenge
        );
        assert_eq!(
            Permission::ErirRegister.category(),
            PermissionCategory::Erir
        );
        assert_eq!(
            Permission::BillingProcess.category(),
            PermissionCategory::Billing
        );
        assert_eq!(
            Permission::PersonalDataAccess.category(),
            PermissionCategory::PersonalData
        );
    }

    #[test]
    fn test_audit_logging_requirements() {
        assert!(Permission::PersonalDataAccess.requires_audit_logging());
        assert!(Permission::PersonalDataModify.requires_audit_logging());
        assert!(!Permission::ChallengeGenerate.requires_audit_logging());
        assert!(!Permission::BillingView.requires_audit_logging());
    }

    #[test]
    fn test_erir_related_permissions() {
        assert!(Permission::ErirRegister.is_erir_related());
        assert!(Permission::ErirValidate.is_erir_related());
        assert!(!Permission::ChallengeGenerate.is_erir_related());
        assert!(!Permission::BillingProcess.is_erir_related());
    }

    #[test]
    fn test_unknown_role_permissions() {
        let unknown_permissions = Permission::permissions_for_role("unknown.role");
        assert!(unknown_permissions.is_empty());
    }

    #[test]
    fn test_permission_category_descriptions() {
        assert_eq!(PermissionCategory::Challenge.to_string(), "challenge");
        assert_eq!(
            PermissionCategory::PersonalData.description(),
            "Personal data processing (152-ФЗ)"
        );
        assert_eq!(
            PermissionCategory::Erir.description(),
            "ERIR compliance and advertising registry"
        );
    }
}