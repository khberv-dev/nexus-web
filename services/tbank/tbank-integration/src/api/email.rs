use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

use crate::{
    email::EmailTemplate,
    services::TBankServices,
    types::{TBankError, TBankResult},
};

/// Email test request
#[derive(Debug, Deserialize)]
pub struct EmailTestRequest {
    pub subject: Option<String>,
    pub message: Option<String>,
}

/// Email test response
#[derive(Debug, Serialize)]
pub struct EmailTestResponse {
    pub success: bool,
    pub message: String,
    pub email_enabled: bool,
    pub config_info: String,
}

/// Email status response
#[derive(Debug, Serialize)]
pub struct EmailStatusResponse {
    pub enabled: bool,
    pub config_info: String,
    pub connection_test: Option<bool>,
}

/// Create email router
pub fn create_email_router() -> Router<Arc<TBankServices>> {
    Router::new()
        .route("/status", get(get_email_status))
        .route("/test", post(send_test_email))
        .route("/test-connection", post(test_email_connection))
}

/// Get email configuration status
async fn get_email_status(
    State(services): State<Arc<TBankServices>>,
) -> Result<Json<EmailStatusResponse>, (StatusCode, Json<serde_json::Value>)> {
    info!("Getting email status");

    let enabled = services.email_sender.is_enabled();
    let config_info = services.email_sender.get_config_safe();

    let connection_test = if enabled {
        match services.email_sender.test_connection().await {
            Ok(()) => Some(true),
            Err(e) => {
                error!(error = %e, "Email connection test failed");
                Some(false)
            }
        }
    } else {
        None
    };

    let response = EmailStatusResponse {
        enabled,
        config_info,
        connection_test,
    };

    Ok(Json(response))
}

/// Send test email
async fn send_test_email(
    State(services): State<Arc<TBankServices>>,
    Json(request): Json<EmailTestRequest>,
) -> Result<Json<EmailTestResponse>, (StatusCode, Json<serde_json::Value>)> {
    info!("Sending test email");

    if !services.email_sender.is_enabled() {
        return Ok(Json(EmailTestResponse {
            success: false,
            message: "Email notifications are disabled".to_string(),
            email_enabled: false,
            config_info: services.email_sender.get_config_safe(),
        }));
    }

    let subject = request.subject.unwrap_or_else(|| "T-Bank Integration - Test Email".to_string());
    let message = request.message.unwrap_or_else(|| "This is a test email from T-Bank Integration API endpoint.".to_string());

    let html_body = Some(format!(
        r#"
        <html>
        <body>
            <h2>{}</h2>
            <p>{}</p>
            <hr>
            <p><small>Sent from T-Bank Integration API</small></p>
        </body>
        </html>
        "#,
        subject, message
    ));

    match services.email_sender.send_notification(&subject, &message, html_body.as_deref()).await {
        Ok(()) => {
            info!("Test email sent successfully");
            Ok(Json(EmailTestResponse {
                success: true,
                message: "Test email sent successfully".to_string(),
                email_enabled: true,
                config_info: services.email_sender.get_config_safe(),
            }))
        }
        Err(e) => {
            error!(error = %e, "Failed to send test email");
            Ok(Json(EmailTestResponse {
                success: false,
                message: format!("Failed to send test email: {}", e),
                email_enabled: true,
                config_info: services.email_sender.get_config_safe(),
            }))
        }
    }
}

/// Test email connection
async fn test_email_connection(
    State(services): State<Arc<TBankServices>>,
) -> Result<Json<EmailTestResponse>, (StatusCode, Json<serde_json::Value>)> {
    info!("Testing email connection");

    if !services.email_sender.is_enabled() {
        return Ok(Json(EmailTestResponse {
            success: false,
            message: "Email notifications are disabled".to_string(),
            email_enabled: false,
            config_info: services.email_sender.get_config_safe(),
        }));
    }

    match services.email_sender.test_connection().await {
        Ok(()) => {
            info!("Email connection test successful");
            Ok(Json(EmailTestResponse {
                success: true,
                message: "Email connection test successful".to_string(),
                email_enabled: true,
                config_info: services.email_sender.get_config_safe(),
            }))
        }
        Err(e) => {
            error!(error = %e, "Email connection test failed");
            Ok(Json(EmailTestResponse {
                success: false,
                message: format!("Email connection test failed: {}", e),
                email_enabled: true,
                config_info: services.email_sender.get_config_safe(),
            }))
        }
    }
}

/// Send notification email (internal helper)
pub async fn send_invoice_created_notification(
    services: &TBankServices,
    invoice_id: &str,
    counterparty_inn: &str,
    amount: rust_decimal::Decimal,
    description: &str,
) -> TBankResult<()> {
    if !services.email_sender.is_enabled() {
        return Ok(());
    }

    let (subject, text_body, html_body) = EmailTemplate::invoice_created(
        invoice_id,
        counterparty_inn,
        amount,
        description,
        chrono::Utc::now(),
    );

    services.email_sender.send_notification(&subject, &text_body, Some(&html_body)).await
}

/// Send payment completion notification (internal helper)
pub async fn send_payment_completed_notification(
    services: &TBankServices,
    payment_id: &str,
    order_id: &str,
    amount: rust_decimal::Decimal,
    status: &str,
) -> TBankResult<()> {
    if !services.email_sender.is_enabled() {
        return Ok(());
    }

    let (subject, text_body, html_body) = EmailTemplate::payment_completed(
        payment_id,
        order_id,
        amount,
        status,
        chrono::Utc::now(),
    );

    services.email_sender.send_notification(&subject, &text_body, Some(&html_body)).await
}

/// Send error notification (internal helper)
pub async fn send_error_notification(
    services: &TBankServices,
    error_type: &str,
    error_message: &str,
    context: Option<&serde_json::Value>,
) -> TBankResult<()> {
    if !services.email_sender.is_enabled() {
        return Ok(());
    }

    let (subject, text_body, html_body) = EmailTemplate::error_notification(
        error_type,
        error_message,
        context,
        chrono::Utc::now(),
    );

    services.email_sender.send_notification(&subject, &text_body, Some(&html_body)).await
}