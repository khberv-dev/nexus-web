use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utoipa::ToSchema;

/// Behavioral metrics collected during user interaction
/// Used for fraud detection and quality assessment
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct BehavioralMetrics {
    /// Number of mouse movements detected
    pub mouse_movements: u32,
    
    /// Number of clicks detected
    pub clicks: u32,
    
    /// Number of scroll events detected
    pub scroll_events: u32,
    
    /// Time from widget render to first user interaction (ms)
    pub time_to_first_interaction: u32,
    
    /// Number of times user changed their answer
    pub answer_changes: u32,
    
    /// Number of times user lost focus (switched tabs/windows)
    pub focus_lost: u32,
}

/// Ad engagement metrics
/// Tracks how user interacts with advertisement content
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct AdMetrics {
    /// Timestamp when ad became visible (ms since epoch)
    pub view_start_time: u32,
    
    /// Total time ad was visible (ms)
    pub view_duration: u32,
    
    /// Percentage of ad that was viewed (0-100)
    pub view_percentage: f32,
    
    /// Whether user clicked on the ad
    pub ad_clicked: bool,
    
    /// Total time user hovered over ad (ms)
    pub ad_hover_time: u32,
}

/// Device context information
/// Provides environment details for fraud detection
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct DeviceContext {
    /// Screen width in pixels
    pub screen_width: u32,
    
    /// Screen height in pixels
    pub screen_height: u32,
    
    /// Viewport width in pixels
    pub viewport_width: u32,
    
    /// Viewport height in pixels
    pub viewport_height: u32,
    
    /// User's timezone (e.g., "Europe/Moscow")
    pub timezone: String,
    
    /// User's language (e.g., "ru-RU")
    pub language: String,
    
    /// Platform/OS (e.g., "Win32", "MacIntel")
    pub platform: String,
}

/// Device fingerprint (optional, opt-in only)
/// Unique device identification for advanced fraud detection
#[derive(Debug, Clone, Serialize, Deserialize, TS, ToSchema)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../adquest-api/types/shared/")]
pub struct DeviceFingerprint {
    /// Canvas fingerprint hash
    pub canvas: String,
    
    /// WebGL fingerprint hash
    pub webgl: String,
    
    /// List of detected fonts
    pub fonts: Vec<String>,
}
