# Icônes

Tauri a besoin d'icônes pour produire les binaires. Génère-les depuis une seule image :

```bash
# une image carrée ≥ 1024×1024 px, fond transparent de préférence
cargo tauri icon ./app-icon.png
```

La commande crée ici `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns` (macOS)
et `icon.ico` (Windows), référencés dans `../tauri.conf.json`.

> Tant que les icônes ne sont pas générées, `cargo tauri dev` fonctionne, mais
> `cargo tauri build` peut échouer faute d'icône.
