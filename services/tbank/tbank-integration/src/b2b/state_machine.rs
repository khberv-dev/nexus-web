use chrono::{DateTime, Utc};
use std::collections::HashMap;
use tracing::{debug, info, warn};

use crate::types::b2b::invoice::B2BInvoiceStatus;
use crate::types::{TBankError, TBankResult};

/// B2B Invoice status state machine for managing valid transitions
/// Follows the flow: Draft → Sent → Viewed → Paid/Overdue → Cancelled/Refunded
pub struct B2BInvoiceStateMachine {
    valid_transitions: HashMap<B2BInvoiceStatus, Vec<B2BInvoiceStatus>>,
}

impl B2BInvoiceStateMachine {
    /// Create new B2B invoice state machine with valid transitions
    pub fn new() -> Self {
        let mut valid_transitions = HashMap::new();

        // From Draft status
        valid_transitions.insert(
            B2BInvoiceStatus::Draft,
            vec![B2BInvoiceStatus::Sent, B2BInvoiceStatus::Cancelled],
        );

        // From Sent status
        valid_transitions.insert(
            B2BInvoiceStatus::Sent,
            vec![
                B2BInvoiceStatus::Viewed,
                B2BInvoiceStatus::Paid,
                B2BInvoiceStatus::Overdue,
                B2BInvoiceStatus::Cancelled,
            ],
        );

        // From Viewed status
        valid_transitions.insert(
            B2BInvoiceStatus::Viewed,
            vec![
                B2BInvoiceStatus::Paid,
                B2BInvoiceStatus::Overdue,
                B2BInvoiceStatus::Cancelled,
            ],
        );

        // From Paid status
        valid_transitions.insert(B2BInvoiceStatus::Paid, vec![B2BInvoiceStatus::Refunded]);

        // From Overdue status
        valid_transitions.insert(
            B2BInvoiceStatus::Overdue,
            vec![B2BInvoiceStatus::Paid, B2BInvoiceStatus::Cancelled],
        );

        // Terminal states (no transitions allowed)
        valid_transitions.insert(B2BInvoiceStatus::Cancelled, vec![]);
        valid_transitions.insert(B2BInvoiceStatus::Refunded, vec![]);

        Self { valid_transitions }
    }

    /// Validate if transition from current status to new status is allowed
    pub fn validate_transition(
        &self,
        current_status: B2BInvoiceStatus,
        new_status: B2BInvoiceStatus,
    ) -> TBankResult<()> {
        debug!(
            current_status = ?current_status,
            new_status = ?new_status,
            "Validating B2B invoice status transition"
        );

        // Allow same status (no change)
        if current_status == new_status {
            debug!("Status transition validation passed (no change)");
            return Ok(());
        }

        // Check if transition is valid
        let allowed_transitions = self.valid_transitions.get(&current_status).ok_or_else(|| {
            TBankError::ValidationError(format!("Unknown current status: {:?}", current_status))
        })?;

        if allowed_transitions.contains(&new_status) {
            info!(
                current_status = ?current_status,
                new_status = ?new_status,
                "B2B invoice status transition validated successfully"
            );
            Ok(())
        } else {
            warn!(
                current_status = ?current_status,
                new_status = ?new_status,
                allowed_transitions = ?allowed_transitions,
                "Invalid B2B invoice status transition attempted"
            );
            Err(TBankError::ValidationError(format!(
                "Invalid status transition from {:?} to {:?}. Allowed transitions: {:?}",
                current_status, new_status, allowed_transitions
            )))
        }
    }

    /// Get all valid next statuses for current status
    pub fn get_valid_next_statuses(
        &self,
        current_status: B2BInvoiceStatus,
    ) -> Vec<B2BInvoiceStatus> {
        self.valid_transitions
            .get(&current_status)
            .cloned()
            .unwrap_or_default()
    }

    /// Check if status is terminal (no further transitions allowed)
    pub fn is_terminal_status(&self, status: B2BInvoiceStatus) -> bool {
        matches!(
            status,
            B2BInvoiceStatus::Cancelled | B2BInvoiceStatus::Refunded
        )
    }

    /// Check if status allows payment processing
    pub fn allows_payment(&self, status: B2BInvoiceStatus) -> bool {
        matches!(
            status,
            B2BInvoiceStatus::Sent | B2BInvoiceStatus::Viewed | B2BInvoiceStatus::Overdue
        )
    }

    /// Check if status allows cancellation
    pub fn allows_cancellation(&self, status: B2BInvoiceStatus) -> bool {
        matches!(
            status,
            B2BInvoiceStatus::Draft
                | B2BInvoiceStatus::Sent
                | B2BInvoiceStatus::Viewed
                | B2BInvoiceStatus::Overdue
        )
    }

    /// Check if status allows refund
    pub fn allows_refund(&self, status: B2BInvoiceStatus) -> bool {
        matches!(status, B2BInvoiceStatus::Paid)
    }

    /// Get status description for logging and display
    pub fn get_status_description(&self, status: B2BInvoiceStatus) -> &'static str {
        match status {
            B2BInvoiceStatus::Draft => "Invoice created but not yet sent",
            B2BInvoiceStatus::Sent => "Invoice sent to counterparty",
            B2BInvoiceStatus::Viewed => "Invoice viewed by counterparty",
            B2BInvoiceStatus::Paid => "Invoice paid successfully",
            B2BInvoiceStatus::Overdue => "Invoice payment is overdue",
            B2BInvoiceStatus::Cancelled => "Invoice cancelled",
            B2BInvoiceStatus::Refunded => "Invoice payment refunded",
        }
    }

    /// Suggest automatic status transitions based on business rules
    pub fn suggest_automatic_transition(
        &self,
        current_status: B2BInvoiceStatus,
        due_date: chrono::NaiveDate,
        current_time: DateTime<Utc>,
    ) -> Option<B2BInvoiceStatus> {
        let current_date = current_time.date_naive();

        match current_status {
            // Automatically mark as overdue if past due date
            B2BInvoiceStatus::Sent | B2BInvoiceStatus::Viewed => {
                if current_date > due_date {
                    Some(B2BInvoiceStatus::Overdue)
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    /// Get transition audit message
    pub fn get_transition_audit_message(
        &self,
        current_status: B2BInvoiceStatus,
        new_status: B2BInvoiceStatus,
        user_id: Option<&str>,
    ) -> String {
        let user_info = user_id
            .map(|id| format!(" by user {}", id))
            .unwrap_or_else(|| " automatically".to_string());

        format!(
            "B2B invoice status changed from {:?} to {:?}{}",
            current_status, new_status, user_info
        )
    }

    /// Validate business rules for specific transitions
    pub fn validate_business_rules(
        &self,
        current_status: B2BInvoiceStatus,
        new_status: B2BInvoiceStatus,
        invoice_amount: rust_decimal::Decimal,
        due_date: chrono::NaiveDate,
    ) -> TBankResult<()> {
        debug!(
            current_status = ?current_status,
            new_status = ?new_status,
            "Validating business rules for B2B invoice status transition"
        );

        match (current_status, new_status) {
            // Paid transition requires positive amount
            (_, B2BInvoiceStatus::Paid) => {
                if invoice_amount.is_zero() || invoice_amount.is_sign_negative() {
                    return Err(TBankError::ValidationError(
                        "Cannot mark invoice as paid with zero or negative amount".to_string(),
                    ));
                }
            }

            // Refund transition requires paid status and positive amount
            (B2BInvoiceStatus::Paid, B2BInvoiceStatus::Refunded) => {
                if invoice_amount.is_zero() || invoice_amount.is_sign_negative() {
                    return Err(TBankError::ValidationError(
                        "Cannot refund invoice with zero or negative amount".to_string(),
                    ));
                }
            }

            // Overdue transition should only happen after due date
            (_, B2BInvoiceStatus::Overdue) => {
                let current_date = Utc::now().date_naive();
                if current_date <= due_date {
                    warn!(
                        due_date = %due_date,
                        current_date = %current_date,
                        "Marking invoice as overdue before due date"
                    );
                }
            }

            _ => {}
        }

        debug!("Business rules validation passed for B2B invoice status transition");
        Ok(())
    }
}

impl Default for B2BInvoiceStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        let state_machine = B2BInvoiceStateMachine::new();

        // Test valid transitions
        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Draft, B2BInvoiceStatus::Sent)
            .is_ok());

        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Sent, B2BInvoiceStatus::Viewed)
            .is_ok());

        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Viewed, B2BInvoiceStatus::Paid)
            .is_ok());

        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Paid, B2BInvoiceStatus::Refunded)
            .is_ok());
    }

    #[test]
    fn test_invalid_transitions() {
        let state_machine = B2BInvoiceStateMachine::new();

        // Test invalid transitions
        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Draft, B2BInvoiceStatus::Paid)
            .is_err());

        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Cancelled, B2BInvoiceStatus::Sent)
            .is_err());

        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Refunded, B2BInvoiceStatus::Paid)
            .is_err());
    }

    #[test]
    fn test_same_status_allowed() {
        let state_machine = B2BInvoiceStateMachine::new();

        // Same status should always be allowed
        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Draft, B2BInvoiceStatus::Draft)
            .is_ok());

        assert!(state_machine
            .validate_transition(B2BInvoiceStatus::Paid, B2BInvoiceStatus::Paid)
            .is_ok());
    }

    #[test]
    fn test_terminal_statuses() {
        let state_machine = B2BInvoiceStateMachine::new();

        assert!(state_machine.is_terminal_status(B2BInvoiceStatus::Cancelled));
        assert!(state_machine.is_terminal_status(B2BInvoiceStatus::Refunded));
        assert!(!state_machine.is_terminal_status(B2BInvoiceStatus::Draft));
        assert!(!state_machine.is_terminal_status(B2BInvoiceStatus::Paid));
    }

    #[test]
    fn test_payment_allowed() {
        let state_machine = B2BInvoiceStateMachine::new();

        assert!(state_machine.allows_payment(B2BInvoiceStatus::Sent));
        assert!(state_machine.allows_payment(B2BInvoiceStatus::Viewed));
        assert!(state_machine.allows_payment(B2BInvoiceStatus::Overdue));
        assert!(!state_machine.allows_payment(B2BInvoiceStatus::Draft));
        assert!(!state_machine.allows_payment(B2BInvoiceStatus::Cancelled));
    }

    #[test]
    fn test_cancellation_allowed() {
        let state_machine = B2BInvoiceStateMachine::new();

        assert!(state_machine.allows_cancellation(B2BInvoiceStatus::Draft));
        assert!(state_machine.allows_cancellation(B2BInvoiceStatus::Sent));
        assert!(state_machine.allows_cancellation(B2BInvoiceStatus::Viewed));
        assert!(!state_machine.allows_cancellation(B2BInvoiceStatus::Paid));
        assert!(!state_machine.allows_cancellation(B2BInvoiceStatus::Cancelled));
    }

    #[test]
    fn test_refund_allowed() {
        let state_machine = B2BInvoiceStateMachine::new();

        assert!(state_machine.allows_refund(B2BInvoiceStatus::Paid));
        assert!(!state_machine.allows_refund(B2BInvoiceStatus::Draft));
        assert!(!state_machine.allows_refund(B2BInvoiceStatus::Sent));
        assert!(!state_machine.allows_refund(B2BInvoiceStatus::Cancelled));
    }
}
