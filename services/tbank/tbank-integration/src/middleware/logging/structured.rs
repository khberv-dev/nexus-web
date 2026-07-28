use tracing::Span;

/// Utility functions for adding structured context to logs
pub struct LogContext;

impl LogContext {
    /// Add T-Bank operation context to current span
    pub fn add_tbank_operation(operation: &str, api_type: &str) {
        Span::current().record("tbank_operation", operation);
        Span::current().record("tbank_api_type", api_type);
    }

    /// Add counterparty context to current span
    pub fn add_counterparty_context(inn: &str, kpp: Option<&str>) {
        Span::current().record("counterparty_inn", inn);
        if let Some(kpp_value) = kpp {
            Span::current().record("counterparty_kpp", kpp_value);
        }
    }

    /// Add invoice context to current span
    pub fn add_invoice_context(invoice_id: &str, amount: Option<f64>) {
        Span::current().record("invoice_id", invoice_id);
        if let Some(amount_value) = amount {
            Span::current().record("invoice_amount", amount_value);
        }
    }

    /// Add payment context to current span
    pub fn add_payment_context(payment_id: &str, method: &str, amount: Option<f64>) {
        Span::current().record("payment_id", payment_id);
        Span::current().record("payment_method", method);
        if let Some(amount_value) = amount {
            Span::current().record("payment_amount", amount_value);
        }
    }

    /// Add error context to current span
    pub fn add_error_context(error_type: &str, error_message: &str) {
        Span::current().record("error_type", error_type);
        Span::current().record("error_message", error_message);
    }

    /// Add user context to current span
    pub fn add_user_context(user_id: &str, organization_id: Option<&str>) {
        Span::current().record("user_id", user_id);
        if let Some(org_id) = organization_id {
            Span::current().record("organization_id", org_id);
        }
    }

    /// Add performance context to current span
    pub fn add_performance_context(duration_ms: u64, memory_usage: Option<u64>) {
        Span::current().record("duration_ms", duration_ms);
        if let Some(memory) = memory_usage {
            Span::current().record("memory_usage_bytes", memory);
        }
    }

    /// Add security context to current span
    pub fn add_security_context(ip_address: &str, user_agent: &str, auth_method: Option<&str>) {
        Span::current().record("client_ip", ip_address);
        Span::current().record("user_agent", user_agent);
        if let Some(auth) = auth_method {
            Span::current().record("auth_method", auth);
        }
    }
}