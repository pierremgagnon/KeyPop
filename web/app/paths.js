// paths.js — chemins d'exercices personnalisés (créés par l'ergothérapeute, suivis par l'élève).
// Logique pure : pas de DOM, pas de storage direct (voir storage.js pour la persistance).

const RAW_BASE = 'https://raw.githubusercontent.com/pierremgagnon/KeyPop/master/web/catalogue';

export function slugId(title) {
  const base = (title || 'chemin')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'chemin';
  const suffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4);
  return `${base}-${suffix}`;
}

export function emptyPath(title, description) {
  return {
    id: slugId(title),
    title: (title || '').trim(),
    description: (description || '').trim(),
    version: 1,
    exercises: []
  };
}

// narratorLocked = false (par défaut) : le narrateur suit le réglage de l'élève (chip « Dictée
// audio »), comme une leçon standard. narratorLocked = true : la valeur `narrator` est fixe et
// non modifiable par l'élève pour cet exercice (verrouillage explicite par le praticien).
export function addExercise(path, text, { narrator = true, narratorLocked = true, keyboardLocked = false, group = '', hint = '' } = {}) {
  path.exercises.push({
    text: String(text || '').trim(),
    narrator: !!narrator, narratorLocked: !!narratorLocked, keyboardLocked: !!keyboardLocked,
    group: String(group || ''), hint: String(hint || '')
  });
  path.version = (path.version || 1) + 1;
  return path;
}

export function updateExercise(path, index, { text, narrator, narratorLocked, keyboardLocked, group, hint }) {
  const ex = path.exercises[index];
  if (!ex) return path;
  if (text !== undefined) ex.text = String(text).trim();
  if (narrator !== undefined) ex.narrator = !!narrator;
  if (narratorLocked !== undefined) ex.narratorLocked = !!narratorLocked;
  if (keyboardLocked !== undefined) ex.keyboardLocked = !!keyboardLocked;
  if (group !== undefined) ex.group = String(group || '');
  if (hint !== undefined) ex.hint = String(hint || '');
  path.version = (path.version || 1) + 1;
  return path;
}

// Complète les champs manquants d'un chemin (rétrocompatibilité avec des brouillons créés avant
// l'ajout de narratorLocked/group/hint), sans rien valider ni rejeter — pour des données locales
// de confiance (brouillons du praticien). Pour de l'import externe, voir validatePathJson.
export function normalizePathExercises(path) {
  (path.exercises || []).forEach(ex => {
    if (ex.narratorLocked === undefined) ex.narratorLocked = true; // ancien comportement : toujours verrouillé
    if (ex.narrator === undefined) ex.narrator = true;
    if (ex.keyboardLocked === undefined) ex.keyboardLocked = false;
    if (ex.group === undefined) ex.group = '';
    if (ex.hint === undefined) ex.hint = '';
  });
  return path;
}

// Regroupe les exercices consécutifs qui partagent le même `group` (chaîne vide = pas de
// groupe). Sert à afficher une progression par « niveau » quand un chemin en définit
// (le chemin par défaut le fait ; un chemin personnalisé peut le faire ou non).
export function pathGroups(path) {
  const groups = [];
  (path.exercises || []).forEach((ex, i) => {
    const title = ex.group || '';
    const last = groups[groups.length - 1];
    if (last && last.title === title) { last.endIndex = i; last.count++; }
    else groups.push({ title, hint: ex.hint || '', startIndex: i, endIndex: i, count: 1 });
  });
  return groups;
}

export function removeExercise(path, index) {
  if (index < 0 || index >= path.exercises.length) return path;
  path.exercises.splice(index, 1);
  path.version = (path.version || 1) + 1;
  return path;
}

export function moveExercise(path, index, dir) {
  const to = index + dir;
  if (to < 0 || to >= path.exercises.length) return path;
  const [ex] = path.exercises.splice(index, 1);
  path.exercises.splice(to, 0, ex);
  path.version = (path.version || 1) + 1;
  return path;
}

export function exportPathBlob(path) {
  return new Blob([JSON.stringify(path, null, 2)], { type: 'application/json' });
}

// Vérifie la forme minimale d'un chemin importé (fichier .kp ou catalogue). Renvoie un chemin
// normalisé ou lève une erreur portant une clé i18n (voir pathImport.* dans les fichiers de
// langue) — ce module ne connaît pas la langue courante, c'est à l'appelant de traduire.
function fail(code, params) {
  const err = new Error(code);
  err.i18nKey = code;
  err.i18nParams = params;
  throw err;
}

export function validatePathJson(obj) {
  if (!obj || typeof obj !== 'object') fail('pathImport.errorInvalidFile');
  if (typeof obj.title !== 'string' || !obj.title.trim()) fail('pathImport.errorMissingTitle');
  if (!Array.isArray(obj.exercises) || !obj.exercises.length) fail('pathImport.errorNoExercises');
  const exercises = obj.exercises.map((ex, i) => {
    if (!ex || typeof ex.text !== 'string' || !ex.text.trim()) {
      fail('pathImport.errorInvalidExercise', { n: i + 1 });
    }
    return {
      text: ex.text,
      narrator: ex.narrator !== false,
      // Rétrocompatibilité : les chemins créés avant l'ajout de narratorLocked traitaient déjà
      // `narrator` comme une valeur fixe non modifiable par l'élève — on préserve ce comportement
      // pour eux (absent = verrouillé).
      narratorLocked: ex.narratorLocked !== false,
      keyboardLocked: ex.keyboardLocked === true,
      group: typeof ex.group === 'string' ? ex.group : '',
      hint: typeof ex.hint === 'string' ? ex.hint : ''
    };
  });
  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : slugId(obj.title),
    title: obj.title.trim(),
    description: typeof obj.description === 'string' ? obj.description.trim() : '',
    version: Number.isFinite(obj.version) ? obj.version : 1,
    exercises
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function loadCatalogueFrom(baseUrl) {
  const index = await fetchJson(`${baseUrl}/index.json`);
  const files = Array.isArray(index.paths) ? index.paths : [];
  const paths = await Promise.all(files.map(f => fetchJson(`${baseUrl}/${f}`)));
  return paths.map(validatePathJson);
}

// Catalogue embarqué avec l'app (fonctionne hors-ligne, site statique ou webview Tauri).
export function loadBundledCatalogue() {
  return loadCatalogueFrom('./catalogue');
}

// Le programme standard KeyPop lui-même : un chemin comme les autres (voir
// web/catalogue/default.kp), importé automatiquement pour chaque nouveau profil — pas de
// contenu de leçon en dur dans le code.
export const DEFAULT_PATH_ID = 'default';
export function loadDefaultPath() {
  return fetchJson('./catalogue/default.kp').then(validatePathJson);
}

// Catalogue à jour, récupéré depuis le repo GitHub — jamais appelé automatiquement.
export function fetchRemoteCatalogue() {
  return loadCatalogueFrom(RAW_BASE);
}

// Fusionne plusieurs listes de chemins, dédupliquées par id (garde la version la plus haute).
export function mergeCatalogue(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const p of (list || [])) {
      const cur = byId.get(p.id);
      if (!cur || (p.version || 1) > (cur.version || 1)) byId.set(p.id, p);
    }
  }
  return [...byId.values()];
}

// Ajoute (ou met à jour) un chemin dans la bibliothèque d'un profil élève.
// - Absent : ajouté avec une progression à zéro.
// - Présent, même version : ignoré (déjà importé).
// - Présent, version supérieure : remplacé ; la progression est conservée par défaut
//   (clampée à la nouvelle longueur), sauf si opts.resetProgress est demandé.
export function importPathIntoProfile(profile, path, opts = {}) {
  if (!profile.paths) profile.paths = [];
  const existing = profile.paths.find(p => p.id === path.id);
  if (!existing) {
    profile.paths.push({
      ...path,
      source: opts.source || 'json',
      progress: { exerciseIndex: 0 }
    });
    return { status: 'added' };
  }
  if ((path.version || 1) <= (existing.version || 1)) {
    return { status: 'unchanged' };
  }
  const keepProgress = opts.resetProgress !== true;
  const prevIndex = existing.progress ? existing.progress.exerciseIndex : 0;
  Object.assign(existing, path);
  existing.progress = {
    exerciseIndex: keepProgress ? Math.min(prevIndex, path.exercises.length) : 0
  };
  return { status: 'updated' };
}
