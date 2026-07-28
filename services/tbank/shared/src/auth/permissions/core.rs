use serde::{Deserialize, Serialize};
use super::categories::PermissionCategory;

/// RBAC Permission types for ADQuest Platform
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Permission {
    // Challenge Engine permissions
    ChallengeGenerate,
    ChallengeValidate,
    ChallengeView,

    // ERIR Integration permissions
    ErirRegister,
    ErirValidate,
    ErirView,
    ErirAudit,
    ErirReport,
    ErirManage,
    ErirDelete,
    ErirUpdate,

    // Billing Engine permissions
    BillingProcess,
    BillingView,
    BillingAudit,
    BillingRefund,

    // Admin permissions
    AdminUserManage,
    AdminSystemConfig,
    AdminMetricsView,

    // Publisher permissions
    PublisherSiteManage,
    PublisherStatsView,
    PublisherPayoutView,

    // Advertiser permissions
    AdvertiserCampaignManage,
    AdvertiserStatsView,
    AdvertiserBillingView,

    // Russian Compliance permissions (152-ФЗ)
    PersonalDataAccess,
    PersonalDataModify,
    PersonalDataDelete,
    PersonalDataExport,

    // Audit permissions
    AuditView,
    AuditExport,

    // Compliance permissions
    ComplianceManage,
    ComplianceView,
    ComplianceReport,

    // Data processing permissions
    DataProcess,
    DataAnonymize,
}

impl Permission {
    /// Convert string to Permission enum
    pub fn from_string(s: &str) -> Option<Self> {
        match s {
            "challenge:generate" => Some(Permission::ChallengeGenerate),
            "challenge:validate" => Some(Permission::ChallengeValidate),
            "challenge:view" => Some(Permission::ChallengeView),
            "erir:register" => Some(Permission::ErirRegister),
            "erir:validate" => Some(Permission::ErirValidate),
            "erir:view" => Some(Permission::ErirView),
            "erir:audit" => Some(Permission::ErirAudit),
            "erir:report" => Some(Permission::ErirReport),
            "erir:manage" => Some(Permission::ErirManage),
            "erir:delete" => Some(Permission::ErirDelete),
            "erir:update" => Some(Permission::ErirUpdate),
            "billing:process" => Some(Permission::BillingProcess),
            "billing:view" => Some(Permission::BillingView),
            "billing:audit" => Some(Permission::BillingAudit),
            "billing:refund" => Some(Permission::BillingRefund),
            "admin:user_manage" => Some(Permission::AdminUserManage),
            "admin:system_config" => Some(Permission::AdminSystemConfig),
            "admin:metrics_view" => Some(Permission::AdminMetricsView),
            "publisher:site_manage" => Some(Permission::PublisherSiteManage),
            "publisher:stats_view" => Some(Permission::PublisherStatsView),
            "publisher:payout_view" => Some(Permission::PublisherPayoutView),
            "advertiser:campaign_manage" => Some(Permission::AdvertiserCampaignManage),
            "advertiser:stats_view" => Some(Permission::AdvertiserStatsView),
            "advertiser:billing_view" => Some(Permission::AdvertiserBillingView),
            "personal_data:access" => Some(Permission::PersonalDataAccess),
            "personal_data:modify" => Some(Permission::PersonalDataModify),
            "personal_data:delete" => Some(Permission::PersonalDataDelete),
            "personal_data:export" => Some(Permission::PersonalDataExport),
            "audit:view" => Some(Permission::AuditView),
            "audit:export" => Some(Permission::AuditExport),
            "compliance:manage" => Some(Permission::ComplianceManage),
            "compliance:view" => Some(Permission::ComplianceView),
            "compliance:report" => Some(Permission::ComplianceReport),
            "data:process" => Some(Permission::DataProcess),
            "data:anonymize" => Some(Permission::DataAnonymize),
            _ => None,
        }
    }

    /// Convert Permission enum to string
    pub fn to_string(&self) -> &'static str {
        match self {
            Permission::ChallengeGenerate => "challenge:generate",
            Permission::ChallengeValidate => "challenge:validate",
            Permission::ChallengeView => "challenge:view",
            Permission::ErirRegister => "erir:register",
            Permission::ErirValidate => "erir:validate",
            Permission::ErirView => "erir:view",
            Permission::ErirAudit => "erir:audit",
            Permission::ErirReport => "erir:report",
            Permission::ErirManage => "erir:manage",
            Permission::ErirDelete => "erir:delete",
            Permission::ErirUpdate => "erir:update",
            Permission::BillingProcess => "billing:process",
            Permission::BillingView => "billing:view",
            Permission::BillingAudit => "billing:audit",
            Permission::BillingRefund => "billing:refund",
            Permission::AdminUserManage => "admin:user_manage",
            Permission::AdminSystemConfig => "admin:system_config",
            Permission::AdminMetricsView => "admin:metrics_view",
            Permission::PublisherSiteManage => "publisher:site_manage",
            Permission::PublisherStatsView => "publisher:stats_view",
            Permission::PublisherPayoutView => "publisher:payout_view",
            Permission::AdvertiserCampaignManage => "advertiser:campaign_manage",
            Permission::AdvertiserStatsView => "advertiser:stats_view",
            Permission::AdvertiserBillingView => "advertiser:billing_view",
            Permission::PersonalDataAccess => "personal_data:access",
            Permission::PersonalDataModify => "personal_data:modify",
            Permission::PersonalDataDelete => "personal_data:delete",
            Permission::PersonalDataExport => "personal_data:export",
            Permission::AuditView => "audit:view",
            Permission::AuditExport => "audit:export",
            Permission::ComplianceManage => "compliance:manage",
            Permission::ComplianceView => "compliance:view",
            Permission::ComplianceReport => "compliance:report",
            Permission::DataProcess => "data:process",
            Permission::DataAnonymize => "data:anonymize",
        }
    }

    /// Get permission category
    pub fn category(&self) -> PermissionCategory {
        match self {
            Permission::ChallengeGenerate
            | Permission::ChallengeValidate
            | Permission::ChallengeView => PermissionCategory::Challenge,
            Permission::ErirRegister
            | Permission::ErirValidate
            | Permission::ErirView
            | Permission::ErirAudit
            | Permission::ErirReport
            | Permission::ErirManage
            | Permission::ErirDelete
            | Permission::ErirUpdate => PermissionCategory::Erir,
            Permission::BillingProcess
            | Permission::BillingView
            | Permission::BillingAudit
            | Permission::BillingRefund => PermissionCategory::Billing,
            Permission::AdminUserManage
            | Permission::AdminSystemConfig
            | Permission::AdminMetricsView => PermissionCategory::Admin,
            Permission::PublisherSiteManage
            | Permission::PublisherStatsView
            | Permission::PublisherPayoutView => PermissionCategory::Publisher,
            Permission::AdvertiserCampaignManage
            | Permission::AdvertiserStatsView
            | Permission::AdvertiserBillingView => PermissionCategory::Advertiser,
            Permission::PersonalDataAccess
            | Permission::PersonalDataModify
            | Permission::PersonalDataDelete
            | Permission::PersonalDataExport => PermissionCategory::PersonalData,
            Permission::AuditView | Permission::AuditExport => PermissionCategory::Audit,
            Permission::ComplianceManage
            | Permission::ComplianceView
            | Permission::ComplianceReport => PermissionCategory::Compliance,
            Permission::DataProcess | Permission::DataAnonymize => {
                PermissionCategory::DataProcessing
            }
        }
    }

    /// Get all available permissions
    pub fn all_permissions() -> Vec<Permission> {
        vec![
            Permission::ChallengeGenerate,
            Permission::ChallengeValidate,
            Permission::ChallengeView,
            Permission::ErirRegister,
            Permission::ErirValidate,
            Permission::ErirView,
            Permission::ErirAudit,
            Permission::ErirReport,
            Permission::ErirManage,
            Permission::ErirDelete,
            Permission::ErirUpdate,
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
            Permission::PersonalDataAccess,
            Permission::PersonalDataModify,
            Permission::PersonalDataDelete,
            Permission::PersonalDataExport,
            Permission::AuditView,
            Permission::AuditExport,
            Permission::ComplianceManage,
            Permission::ComplianceView,
            Permission::ComplianceReport,
            Permission::DataProcess,
            Permission::DataAnonymize,
        ]
    }
}