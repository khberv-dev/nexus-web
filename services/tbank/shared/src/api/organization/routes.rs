use axum::{
    routing::{delete, get, post, put},
    Router,
};
use sqlx::PgPool;

use super::handlers::{
    add_member_handler, assign_user_role_handler, create_organization_handler, 
    delete_organization_handler, get_members_handler, get_organization_handler, 
    get_user_organizations_handler, remove_member_handler, switch_organization_handler, 
    update_member_role_handler, update_organization_handler, get_organization_sites_handler,
};

/// Create organization routes
pub fn organization_routes(pool: PgPool) -> Router {
    Router::new()
        // Organization creation (public endpoint)
        .route("/register", post(create_organization_handler))
        // User role assignment after registration
        .route("/:id/assign-role", post(assign_user_role_handler))
        // Organization CRUD
        .route("/:id", get(get_organization_handler))
        .route("/:id", put(update_organization_handler))
        .route("/:id", delete(delete_organization_handler))
        // Organization sites
        .route("/:id/sites", get(get_organization_sites_handler))
        // Members management
        .route("/:id/members", get(get_members_handler))
        .route("/:id/members", post(add_member_handler))
        .route("/:id/members/:user_id", put(update_member_role_handler))
        .route("/:id/members/:user_id", delete(remove_member_handler))
        // User organizations
        .route("/user/organizations", get(get_user_organizations_handler))
        .route("/user/switch", post(switch_organization_handler))
        .with_state(pool)
}
