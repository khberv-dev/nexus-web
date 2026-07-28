use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct AdContent {
    pub title: String,
    pub description: String,
    pub image_url: Option<String>,
    pub video_url: Option<String>,
    pub click_url: String,
    pub advertiser_name: String,
    pub advertiser_inn: String,
    pub campaign_id: Uuid,
    pub creative_id: Uuid,
    pub targeting_data: Option<TargetingData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct TargetingData {
    pub geo_targeting: Option<GeoTargeting>,
    pub demographic_targeting: Option<DemographicTargeting>,
    pub behavioral_targeting: Option<BehavioralTargeting>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct GeoTargeting {
    pub countries: Vec<String>,
    pub regions: Vec<String>,
    pub cities: Vec<String>,
    pub exclude_countries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct DemographicTargeting {
    pub age_min: Option<u8>,
    pub age_max: Option<u8>,
    pub genders: Vec<String>,
    pub languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct BehavioralTargeting {
    pub interests: Vec<String>,
    pub device_types: Vec<String>,
    pub operating_systems: Vec<String>,
    pub browsers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct UtmParams {
    pub source: Option<String>,
    pub medium: Option<String>,
    pub campaign: Option<String>,
    pub term: Option<String>,
    pub content: Option<String>,
}