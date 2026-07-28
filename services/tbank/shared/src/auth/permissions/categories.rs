use serde::{Deserialize, Serialize};

/// Permission categories for grouping related permissions
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PermissionCategory {
    Challenge,
    Erir,
    Billing,
    Admin,
    Publisher,
    Advertiser,
    PersonalData,
    Audit,
    Compliance,
    DataProcessing,
}

impl PermissionCategory {
    pub fn to_string(&self) -> &'static str {
        match self {
            PermissionCategory::Challenge => "challenge",
            PermissionCategory::Erir => "erir",
            PermissionCategory::Billing => "billing",
            PermissionCategory::Admin => "admin",
            PermissionCategory::Publisher => "publisher",
            PermissionCategory::Advertiser => "advertiser",
            PermissionCategory::PersonalData => "personal_data",
            PermissionCategory::Audit => "audit",
            PermissionCategory::Compliance => "compliance",
            PermissionCategory::DataProcessing => "data_processing",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            PermissionCategory::Challenge => "Challenge generation and validation",
            PermissionCategory::Erir => "ERIR compliance and advertising registry",
            PermissionCategory::Billing => "Billing and financial operations",
            PermissionCategory::Admin => "System administration",
            PermissionCategory::Publisher => "Publisher site management",
            PermissionCategory::Advertiser => "Advertiser campaign management",
            PermissionCategory::PersonalData => "Personal data processing (152-ФЗ)",
            PermissionCategory::Audit => "Audit log access and export",
            PermissionCategory::Compliance => "Compliance management and reporting",
            PermissionCategory::DataProcessing => "Data processing and anonymization",
        }
    }
}