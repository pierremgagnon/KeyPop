# KeyPop

Apprentissage de la dactylographie **adapté aux élèves DYS** (dyspraxie, dysgraphie, dyslexie),
pensé pour un usage en **ergothérapie** et en autonomie.

- 🧩 **Adapté DYS** : priorité à la précision avant la vitesse, progression en petits modules
  répétables, codage couleur par doigt, dictée audio, police OpenDyslexic.
- ⌨️ **AZERTY natif** : détection automatique de la disposition (PC / Mac, 60 / 75 / 100 %).
- 🔒 **Données 100 % locales** : aucun compte, aucune collecte, aucun serveur (RGPD par conception).
  Profils multiples par poste, retrouvés en un clic.
- 💻 **Multiplateforme** : un seul codebase → application **Windows / macOS / Linux** (Tauri + Rust)
  **et** site web (le même frontend HTML/JS).
- 🆓 **Libre & gratuit** (OSS).

## Architecture en une phrase

> Toute l'interface et la pédagogie sont en **HTML/JS** (dossier [`app/`](app/)). **Rust** ([`src-tauri/`](src-tauri/))
> n'ajoute que ce que le web ne peut pas faire : fichier de profil sur le disque, export PDF du bilan,
> widget bureau, intégration système. Le même frontend se déploie tel quel comme **site web**.

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour le détail.

## Lancer le projet

### 1. En tant que site web (aucune compilation)

Le frontend utilise des modules ES → il faut le servir via HTTP (pas en `file://`).

```bash
# n'importe quel serveur statique, p. ex. :
python3 -m http.server 1420
# puis ouvrir http://localhost:1420
```

### 2. En tant qu'application de bureau (Tauri)

Prérequis : [Rust](https://rustup.rs) + [dépendances système Tauri](https://tauri.app/start/prerequisites/),
puis le CLI :

```bash
cargo install tauri-cli --version "^2"

# développement (fenêtre native + rechargement)
cargo tauri dev

# build des binaires Windows / macOS / Linux
cargo tauri build
```

> ℹ️ Avant le premier `build`, ajoute les icônes : `cargo tauri icon ./app-icon.png`
> (voir [`src-tauri/icons/README.md`](src-tauri/icons/README.md)).

## Structure

```
keypop/
├── index.html              # point d'entrée (web + frontend Tauri)
├── app/                    # tout le frontend (UI + pédagogie), partagé web/desktop
│   ├── app.js              # bootstrap, routage, rendu des écrans
│   ├── storage.js          # profils : invoke() Rust si Tauri, sinon localStorage
│   ├── keyboards.js        # dispositions AZERTY, codage par doigt, détection
│   ├── typing.js           # moteur de session de frappe (précision, vitesse, score)
│   ├── lessons.js          # niveaux & leçons
│   └── styles.css          # thèmes jour / nuit
├── src-tauri/              # coquille Rust / Tauri
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/default.json
│   └── src/main.rs         # commandes : load/save profiles, export_report
└── docs/ARCHITECTURE.md
```

## Statut

Démarrage de projet. Le **frontend fonctionne** (frappe réelle, clavier AZERTY, profils locaux,
mode jour/nuit). Côté Rust, `load_profiles` / `save_profiles` sont fonctionnels ;
`export_report` (bilan PDF) et le widget bureau sont à implémenter — voir les `TODO`.

## Licence

MIT — voir [`LICENSE`](LICENSE). (Passer en GPL/AGPL si tu veux un copyleft fort.)
