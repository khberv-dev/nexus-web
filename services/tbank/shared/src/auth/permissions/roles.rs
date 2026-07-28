use super::core::Permission;

pub struct RolePermissions;

impl RolePermissions {
    /// Get all permissions for a given role
    pub fn permissions_for_role(role: &str) -> Vec<Permission> {
        match role {
            "adquest.advertiser" => vec![
                Permission::ChallengeGenerate,
                Permission::ChallengeView,
                Permission::AdvertiserCampaignManage,
                Permission::AdvertiserStatsView,
                Permission::AdvertiserBillingView,
                Permission::ErirRegister,
                Permission::ErirView,
            ],
            "adquest.publisher" => vec![
                Permission::ChallengeValidate,
                Permission::ChallengeView,
                Permission::PublisherSiteManage,
                Permission::PublisherStatsView,
                Permission::PublisherPayoutView,
            ],
            "adquest.admin" => vec![
                Permission::ChallengeGenerate,
                Permission::ChallengeValidate,
                Permission::ChallengeView,
                Permission::ErirRegister,
                Permission::ErirView,
                Permission::ErirAudit,
                Permission::BillingProcess,
                Permission::BillingView,
                Permission::BillingAudit,
                Permission::BillingRefund,
                Permission::AdminUserManage,
                Permission::AdminSystemConfig,
                Permission::AdminMetricsView,
                Permission::PublisherSiteManage,
                Permission::PublisherStatsView,
                Permission::PublisherPayoutView,
                Permission::AdvertiserCampaignManage,
                Permission::AdvertiserStatsView,
                Permission::AdvertiserBillingView,
            ],
            "adquest.moderator" => vec![
                Permission::ChallengeView,
                Permission::ErirView,
                Permission::ErirAudit,
                Permission::BillingView,
                Permission::BillingAudit,
                Permission::AdminMetricsView,
            ],
            "adquest.compliance.officer" => vec![
                Permission::ErirRegister,
                Permission::ErirView,
                Permission::ErirAudit,
                Permission::BillingAudit,
                Permission::AdminMetricsView,
                Permission::PersonalDataAccess,
                Permission::PersonalDataExport,
                Permission::AuditView,
                Permission::AuditExport,
                Permission::ComplianceManage,
                Permission::ComplianceReport,
            ],
            "adquest.data.processor" => vec![
                Permission::PersonalDataAccess,
                Permission::PersonalDataModify,
                Permission::PersonalDataDelete,
                Permission::AuditView,
                Permission::DataProcess,
                Permission::DataAnonymize,
            ],
            "adquest.audit.viewer" => vec![
                Permission::AuditView,
                Permission::AuditExport,
                Permission::BillingAudit,
                Permission::ErirAudit,
                Permission::ComplianceView,
            ],
            "adquest.erir.manager" => vec![
                Permission::ErirRegister,
                Permission::ErirValidate,
                Permission::ErirReport,
                Permission::ErirManage,
                Permission::ErirView,
                Permission::ErirAudit,
                Permission::ErirDelete,
                Permission::ErirUpdate,
            ],
            _ => vec![],
        }
    }
}

// Add the method to Permission enum via extension
impl Permission {
    /// Get all permissions for a given role
    pub fn permissions_for_role(role: &str) -> Vec<Permission> {
        RolePermissions::permissions_for_role(role)
    }
}