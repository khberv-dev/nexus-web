pub mod core;
pub mod formats;
pub mod presets;

pub use core::InvoiceNumberGenerator;
pub use formats::{NumberFormat, FormatBuilder};
pub use presets::GeneratorPresets;