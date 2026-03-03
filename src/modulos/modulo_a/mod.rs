use axum::{routing::get, Router};

pub fn routes() -> Router {
    Router::new().route("/saludo", get(|| async { "Hola desde Modulo A" }))
}
