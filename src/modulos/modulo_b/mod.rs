use axum::{routing::get, Router};

pub fn routes() -> Router {
    Router::new().route("/info", get(|| async { "Información desde Modulo B" }))
}
