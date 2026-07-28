use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use ts_rs::TS;
use utoipa::ToSchema;
use uuid::Uuid;

use super::targeting::{AdContent, UtmParams};

// Core Challenge Models
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct ChallengeRequest {
    pub site_key: String,
    pub user_agent: Option<String>,
    #[ts(type = "string")]
    pub ip_address: IpAddr,
    pub utm_params: Option<UtmParams>,
    pub trace_id: String, // OpenTelemetry trace ID
    pub referrer: Option<String>, // Domain validation
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct ChallengeResponse {
    pub challenge_id: Uuid,
    pub challenge_type: ChallengeType,
    pub ad_content: AdContent,
    pub question: String,
    pub options: Vec<String>,
    pub expires_at: DateTime<Utc>,
    pub erid: String, // ЕРИР compliance
    pub trace_id: String,
    // PoW fields
    pub pow_challenge: Option<PoWChallenge>,
    pub difficulty: Option<u32>,
    pub target_prefix: Option<String>,
    pub salt: Option<String>,
    pub proof_of_work: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct PoWChallenge {
    pub salt: String,
    pub difficulty: u32,
    pub target_prefix: String,
    pub challenge_id: String,
    pub timestamp: i64,
}

// Widget-specific models for frontend integration
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct WidgetChallengeResponse {
    pub session_id: String,
    pub erid: Option<String>,
    pub creative: Option<WidgetCreative>,
    pub fallback_captcha: Option<WidgetFallbackCaptcha>,
    pub expires_at: DateTime<Utc>,
    pub min_view_time: u32,
    pub challenge_id: Option<String>,
    pub trace_id: String,
    pub pow_challenge: Option<PoWChallenge>,
    pub mode: WidgetMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct WidgetCreative {
    #[serde(rename = "type")]
    pub creative_type: String,
    pub content: WidgetCreativeContent,
    pub question: Option<WidgetCreativeQuestion>,
    pub min_view_time: Option<u32>,
    pub click_url: String,
    pub campaign_id: String,
    pub advertiser_id: String,
    pub utm: Option<UtmParams>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct WidgetCreativeContent {
    pub title: String,
    pub description: Option<String>,
    pub media_url: String,
    pub thumbnail_url: Option<String>,
    pub duration: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct WidgetCreativeQuestion {
    pub text: String,
    #[serde(rename = "type")]
    pub question_type: String,
    pub options: Option<Vec<String>>,
    pub explanation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct WidgetFallbackCaptcha {
    pub captcha_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(skip)]
    pub challenge_data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    // Legacy fields for backward compatibility
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub question: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema, PartialEq)]
#[serde(rename_all = "lowercase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum WidgetMode {
    Advertisement,
    Captcha,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct ValidationRequest {
    pub challenge_id: Uuid,
    pub answer: String,
    pub completion_time_ms: u32,
    pub trace_id: String,
    
    // Enhanced metrics (Phase 1) - all optional for backward compatibility
    #[serde(skip_serializing_if = "Option::is_none")]
    pub behavioral: Option<super::metrics::BehavioralMetrics>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ad_metrics: Option<super::metrics::AdMetrics>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_context: Option<super::metrics::DeviceContext>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<super::metrics::DeviceFingerprint>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct ValidationResponse {
    pub success: bool,
    pub token: Option<String>,
    pub cpv_transaction_id: Option<Uuid>,
    pub quality_score: f64,
    pub trace_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub enum ChallengeType {
    MultipleChoice,
    ImageSelection,
    TextInput,
    VideoQuestion,
    InteractiveAd, // New type for interactive advertising
}

// Enhanced Challenge Model
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct Challenge {
    pub id: Uuid,
    pub site_id: Uuid,
    pub campaign_id: Uuid,
    pub challenge_type: ChallengeType,
    pub question: String,
    pub correct_answer: String,
    pub options: Vec<String>,
    pub ad_content: AdContent,
    #[ts(type = "string")]
    pub cpv_rate: Decimal,
    pub erid: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub trace_id: String,
    pub fraud_score: f64,
    pub quality_indicators: QualityIndicators,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct QualityIndicators {
    pub completion_time_ms: Option<u32>,
    pub user_agent_score: f64,
    pub ip_reputation_score: f64,
    pub behavioral_score: f64,
    pub device_fingerprint_score: f64,
}

// Enhanced Site Model
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct Site {
    pub id: Uuid,
    #[deprecated(note = "Use public_key for widget integration or secret_key for server auth")]
    pub site_key: String, // DEPRECATED: kept for backward compatibility
    pub public_key: Option<String>, // pk_* format - for widget/client-side use
    pub secret_key: Option<String>, // sk_secret_* format - for server-to-server auth
    pub domain: String,
    pub publisher_id: Uuid,
    pub is_active: bool,
    pub quality_coefficient: f64,
    pub rate_limit_rules: Vec<super::rate_limit::RateLimitRule>,
    pub fraud_score: f64,
    pub last_fraud_check: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}