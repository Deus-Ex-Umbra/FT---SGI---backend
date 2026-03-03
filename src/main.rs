// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod modulos;

use axum::Router;

#[tokio::main]
async fn main() {
    // 1. Levantas el servidor Axum en un hilo secundario
    tokio::spawn(async {
        let app = Router::new()
            .route("/api/health", axum::routing::get(|| async { "API Activa" }))
            .nest("/api/modulo_a", modulos::modulo_a::routes())
            .nest("/api/modulo_b", modulos::modulo_b::routes());
            
        let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
        println!("Axum server is running on http://127.0.0.1:8080");
        axum::serve(listener, app).await.unwrap();
    });

    // 2. Levantas la interfaz gráfica de Tauri (React) en el hilo principal
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error al iniciar Tauri");
}
