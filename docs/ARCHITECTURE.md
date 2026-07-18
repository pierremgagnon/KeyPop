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
| `app.js`        | Bootstrap, routage par hash (`#/gate`, `#/home`, `#/exercise`, `#/stats`, `#/catalogue`, `#/settings`, `#/practitioner`), rendu. |
| `typing.js`     | `TypingSession` : avance caractère par caractère, **reste sur l'erreur** par défaut (précision avant vitesse, configurable), calcule précision / mots-min / score / objectifs, gère pause et métronome (fixe ou adaptatif). |
| `keyboards.js`  | Dispositions AZERTY (`LAYOUTS`: PC/Mac — mêmes lettres, rangée de modificateurs différente), map touche → doigt + couleur, `detectLayout()` via `navigator.keyboard.getLayoutMap()`. |
| `paths.js`      | Chemins d'exercices (modèle de données, regroupement, catalogue embarqué + GitHub, import/export) — voir ci-dessous. Aucun contenu pédagogique en dur : même le programme standard est un chemin, chargé depuis `web/catalogue/default.kp`. |
| `storage.js`    | Profils & historique (Tauri ou localStorage), réglages praticien/catalogue (localStorage). |
| `i18n.js`       | Sélection de langue (`getLang`/`setLang`, mémorisée en localStorage) et traduction (`t(clé, variables)`). |
| `i18n/fr.js`, `i18n/en.js` | Fichiers de langue — objets imbriqués clé → texte, un fichier par langue. Le français est le fallback si une clé manque ailleurs. |
| `styles.css`    | Variables de thème jour / nuit. |

### Internationalisation

`app.js` ne contient aucun texte d'interface en dur : chaque libellé passe par `t('section.cle', { vars })`,
résolu dans `i18n/<langue>.js`. Pour ajouter une langue : dupliquer `i18n/fr.js`, traduire les valeurs,
l'enregistrer dans `LOCALES` et `LANGS` (`i18n.js`). Un sélecteur (`<select>`) est affiché sur chaque écran
via `langSwitcherHtml()` / `attachLangSwitcher()`. Le contenu pédagogique (titres de niveaux, texte des
leçons) n'est **pas** traduit — la méthode est construite autour du clavier AZERTY et changer de langue
d'interface ne change pas le clavier physique de l'élève.

### Écran Réglages (`#/settings`)

Tous les réglages avancés vivent dans `profile.options` (voir `newProfile()` dans `storage.js`
pour la liste complète et ses valeurs par défaut) et sont édités par `renderSettings()` dans
`app.js`, via trois générateurs de contrôle réutilisables (`settingCheckboxHtml`,
`settingNumberHtml`, `settingRadioHtml`) branchés à une délégation d'événements générique
(`[data-opt]` / `[data-opt-radio]`) qui met à jour `profile.options[clé]`, persiste, puis
réaffiche l'écran. Ces réglages sont ensuite consommés par `renderExercise()` /
`onExerciseKey()` / `finishExercise()` (vue de leçon, comportement sur erreur, limite de temps,
métronome adaptatif, objectifs de leçon, actions de fin de leçon, visibilité des éléments).

### Chemins — le programme standard en est un (espace ergothérapeute)

Tout ce que tape l'élève vient d'un **chemin** : une suite d'exercices. Le programme standard
KeyPop (`web/catalogue/default.kp`, id `"default"`) n'est qu'un chemin de plus, importé
automatiquement dans `profile.paths[]` à la création du profil (`ensureDefaultPath()` dans
`app.js` — aussi appelée à la connexion pour migrer en douceur les profils créés avant cette
unification). `profile.activePathId` sélectionne le chemin actif ; changer de chemin = choisir une
autre carte dans « Mes chemins » sur l'accueil, il n'y a plus de notion séparée de « progression
standard ». Un praticien peut créer d'autres chemins (écran `#/practitioner`, sans mot de passe —
accessible depuis un bouton sur l'écran titre). Modèle JSON interne (`paths.js`) :

```json
{ "id": "ferme-ab12", "title": "…", "version": 1,
  "exercises": [{ "text": "…", "narrator": true, "narratorLocked": false, "keyboardLocked": false,
                   "group": "La rangée de repos", "hint": "q s d f g · h j k l m" }] }
```

- **`narratorLocked`** (défaut `true` pour compat avec les chemins créés avant son ajout) :
  si `false`, l'exercice suit le réglage audio de l'élève (chip « Dictée audio », togglable),
  comme `default.kp` ; si `true`, `narrator` est une valeur fixe imposée par le praticien.
  **`keyboardLocked`** ne verrouille que sur off (pas d'équivalent « forcé activé »).
- **`group`/`hint`** (optionnels) : exercices consécutifs partageant le même `group` sont
  regroupés visuellement (nœuds de progression sur l'accueil, préfixe dans le sélecteur de leçon)
  — voir `pathGroups()`. `default.kp` les utilise pour ses 7 groupes (repos → phrases) ;
  un chemin personnalisé peut s'en passer.
- **Export** : `Blob` + `<a download>`, extension `.kp` (contenu JSON, mais ni le format ni
  l'extension ne sont mentionnés dans l'interface — aucune commande Rust nécessaire, fonctionne
  pareil en site web et webview Tauri).
- **Import élève** (écran `#/home`) : fichier `.kp` (`<input type=file>` + `FileReader`) ou
  catalogue (`#/catalogue`), stocké dans `profile.paths[]`. Les erreurs de validation (`paths.js`,
  `validatePathJson`) sont levées sous forme de clé i18n (`err.i18nKey` / `err.i18nParams`), pas de
  texte en dur — c'est l'appelant qui traduit avec `t()`. `default.kp` n'apparaît pas dans le
  catalogue « à importer » (absent de `web/catalogue/index.json`) puisqu'il l'est déjà d'office.
- **Catalogue** (chemins optionnels, distincts de `default.kp`) : embarqué dans `web/catalogue/`
  (fonctionne hors-ligne), avec un bouton « mettre à jour » qui va chercher `web/catalogue/` sur
  `raw.githubusercontent.com` — jamais automatique. Les chemins déjà importés se mettent à jour
  par `id` + `version` ; la progression en cours est conservée sauf choix contraire de l'élève.

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

Aucune donnée ne quitte l'appareil. Un profil = `{ id, name, lastName, paths[], activePathId,
history[] }`, stocké en JSON local. Pas de télémétrie, pas de compte, pas de réseau.
