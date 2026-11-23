//! LYVAN Payout - desktop shell.
//!
//! Deliberately minimal: all calculation logic is in `packages/engine` (TypeScript). This crate only
//! opens the window and registers the local plugins the UI uses:
//! - `store`  - settings and saved calculations (`%APPDATA%\se.lyvan.payout\store.json`)
//! - `dialog` - the "save as" dialog for CSV export
//! - `fs`     - writing the exported file to the path the user picked
//!
//! There is no network plugin and no custom command (see `capabilities/default.json`).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running LYVAN Payout");
}
