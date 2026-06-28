// KeyPop — coquille Tauri (Rust).
// Toute l'UI/pédagogie est dans le frontend (../app). Rust ne gère que ce que
// le web ne peut pas : profils sur le disque, export PDF, widget (à venir).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use tauri::Manager;

/// Chemin du fichier profils dans le dossier de données de l'application.
fn profiles_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("profiles.json"))
}

/// Lit les profils (JSON). Renvoie "[]" si le fichier n'existe pas encore.
#[tauri::command]
fn load_profiles(app: tauri::AppHandle) -> Result<String, String> {
    let path = profiles_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(_) => Ok("[]".to_string()),
    }
}

/// Écrit les profils (JSON) sur le disque local. Aucune donnée ne sort de la machine.
#[tauri::command]
fn save_profiles(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let path = profiles_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

/// TODO: générer le bilan PDF d'un profil (vitesse, précision, précision par doigt,
/// touches à retravailler, historique) pour le suivi en séance d'ergothérapie.
/// Pistes : crate `genpdf` ou `printpdf`, données = profil + agrégats.
#[tauri::command]
fn export_report(_app: tauri::AppHandle, profile_id: String) -> Result<String, String> {
    let _ = profile_id;
    Err("export_report : génération PDF à implémenter".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_profiles,
            save_profiles,
            export_report
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de KeyPop");
}
