# Architecture KeyPop

## Principe

Un seul produit, deux cibles, **un seul codebase** :

```
                ┌─────────────────────────────┐
                │     Frontend  (web/app/)         │   HTML / CSS / JS (modules ES)
                │  UI + pédagogie + moteur     │   → identique web & desktop
                └──────────────┬──────────────┘
                               │ storage.js choisit la couche
              ┌────────────────┴───────────────────┐
              ▼                                     ▼
   window.__TAURI__ présent ?            Navigateur (site web)
   → invoke() vers Rust                  → localStorage
   (fichier disque, PDF, widget)         (profils dans le navigateur)
```

`web/app/storage.js` détecte l'environnement : en application Tauri il appelle les commandes Rust
via `window.__TAURI__.core.invoke(...)`, sinon il retombe sur `localStorage`. **Aucune autre partie
du frontend ne sait sur quelle plateforme elle tourne.**

## Frontend (`web/app/`)

| Fichier         | Rôle |
|-----------------|------|
| `app.js`        | Bootstrap, routage par hash (`#/gate`, `#/home`, `#/exercise`, `#/stats`), rendu. |
| `typing.js`     | `TypingSession` : avance caractère par caractère, **reste sur l'erreur** (précision avant vitesse), calcule précision / mots-min / score. |
| `keyboards.js`  | Rangées AZERTY (PC/Mac), map touche → doigt + couleur, `detectLayout()` via `navigator.keyboard.getLayoutMap()`. |
| `lessons.js`    | Niveaux (repos → haut → milieu → bas → mots → bigrammes → phrases) et leurs leçons. |
| `paths.js`      | Chemins d'exercices personnalisés : modèle de données, catalogue (embarqué + GitHub), import/export JSON. |
| `storage.js`    | Profils & historique (Tauri ou localStorage), réglages narrateur/praticien/catalogue (localStorage). |
| `styles.css`    | Variables de thème jour / nuit. |

### Chemins personnalisés (espace ergothérapeute)

Un **chemin** est une suite d'exercices texte libre créée par le praticien (écran `#/practitioner`,
sans mot de passe — accessible depuis un lien discret sur l'écran titre), avec narration
activable/désactivable par exercice. Modèle JSON (`paths.js`) :

```json
{ "id": "ferme-ab12", "title": "…", "version": 1,
  "exercises": [{ "text": "…", "narrator": true }] }
```

- **Export** : `Blob` + `<a download>` (aucune commande Rust — fonctionne pareil en site web et
  webview Tauri).
- **Import élève** (écran `#/home`) : fichier JSON (`<input type=file>` + `FileReader`) ou
  catalogue (`#/catalogue`), stocké dans `profile.paths[]` ; `profile.activePathId` sélectionne le
  chemin actif (`null` = progression standard `LEVELS`).
- **Catalogue** : embarqué dans `web/catalogue/` (fonctionne hors-ligne), avec un bouton « mettre à
  jour » qui va chercher `web/catalogue/` sur `raw.githubusercontent.com` — jamais automatique.
  Les chemins déjà importés se mettent à jour par `id` + `version` ; la progression en cours est
  conservée sauf choix contraire de l'élève.
- **Narrateur** : un interrupteur global côté écran titre (`keypop.narratorGlobal`, localStorage)
  coupe toute narration ; dans un chemin, chaque exercice impose ensuite son propre réglage.

### Détection clavier

`detectLayout()` lit la disposition **physique** réelle de l'OS (API `KeyboardLayoutMap`) :
si la touche physique `KeyQ` produit `a`, c'est de l'AZERTY. Repli sur `navigator.language`.
La saisie utilise `event.key`, donc les accents AZERTY (é è à ç ù) arrivent corrects sans calcul.

## Backend Rust (`src-tauri/`)

Commandes exposées (`src/main.rs`, `invoke_handler`) :

| Commande          | État        | Rôle |
|-------------------|-------------|------|
| `load_profiles`   | ✅ fait     | Lit `profiles.json` dans le dossier de données de l'app. |
| `save_profiles`   | ✅ fait     | Écrit `profiles.json` (création du dossier si besoin). |
| `export_report`   | 🚧 à faire  | Générer le **bilan PDF** d'un profil (vitesse, précision, précision par doigt, touches à retravailler) pour le suivi ergo. |

### À brancher ensuite

- **Bilan PDF** (`export_report`) : crate `printpdf` ou `genpdf`, ou impression du DOM côté frontend
  puis sauvegarde via Rust. Données = `profile.history` + agrégats.
- **Widget bureau** : seconde fenêtre Tauri (`WebviewWindowBuilder`), `always_on_top`, sans décor,
  chargeant `web/app/widget.html` (à créer) — réutilise `storage.js`.
- **Dictée audio** : Web Speech API (`speechSynthesis`) côté frontend, voix `fr-FR`. Aucune dépendance Rust.
- **Détection clavier renforcée** : si l'API web ne suffit pas, exposer une commande Rust spécifique OS
  (Windows `GetKeyboardLayout`, macOS `TISCopyCurrentKeyboardInputSource`).

## Cibles de build

`cargo tauri build` produit, sur la machine correspondante :
- Windows : `.msi` / `.exe`
- macOS : `.dmg` / `.app`
- Linux : `.deb` / `.AppImage`

Le même dossier (`web/index.html` + `web/app/`) s'héberge tel quel comme **site web** statique.

## Données & RGPD

Aucune donnée ne quitte l'appareil. Un profil = `{ id, name, classe, progress, history[] }`,
stocké en JSON local. Pas de télémétrie, pas de compte, pas de réseau.
