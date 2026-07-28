use super::{Environment, TBankConfig};

impl Environment {
    pub fn is_sandbox(&self) -> bool {
        matches!(self, Environment::Sandbox)
    }

    pub fn is_production(&self) -> bool {
        matches!(self, Environment::Production)
    }
}

impl TBankConfig {
    pub fn get_environment_indicator(&self) -> &'static str {
        match self.environment {
            Environment::Sandbox => "SANDBOX",
            Environment::Production => "PRODUCTION",
        }
    }

    pub fn should_validate_webhooks(&self) -> bool {
        self.environment.is_production()
    }

    pub fn get_test_data_enabled(&self) -> bool {
        self.environment.is_sandbox()
    }
}
