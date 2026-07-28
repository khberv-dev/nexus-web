pub mod config;
pub mod sender;
pub mod templates;

#[cfg(test)]
mod tests;

pub use config::EmailConfig;
pub use sender::EmailSender;
pub use templates::*;