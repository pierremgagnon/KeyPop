// storage.js — couche profils : Rust (Tauri) si dispo, sinon localStorage.
// Aucune donnée ne quitte l'appareil (RGPD).

const isTauri = typeof window !== 'undefined' && !!window.__TAURI__;
const LS_KEY = 'keypop.profiles';

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}

export async function loadProfiles() {
  try {
    if (isTauri) return JSON.parse(await invoke('load_profiles'));
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch (e) {
    console.warn('loadProfiles', e);
    return [];
  }
}

export async function saveProfiles(profiles) {
  const data = JSON.stringify(profiles);
  try {
    if (isTauri) await invoke('save_profiles', { data });
    else localStorage.setItem(LS_KEY, data);
  } catch (e) {
    console.warn('saveProfiles', e);
  }
}

export function newProfile(name, lastName) {
  return {
    id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    lastName: (lastName || '').trim(),
    theme: 'day',
    options: {
      audio: true, openDyslexic: false, keyboard: false, size: '100',
      keyboardLayout: null, // null = déduit de l'OS détecté (voir keyboards.js: layoutIdFor)
      metronome: false, metronomeWpm: 10, metronomeAdaptive: false,
      goalsEnabled: false, goalMinWpm: 10, goalMaxErrorPct: 90, goalMaxSlowdownPct: 45,
      viewMode: 'mobile', // 'static' | 'mobile' | 'multiline' — voir Réglages > Vue de la leçon
      textSize: 100,
      onErrorMode: 'block', // 'block' | 'correct' | 'ignore' — voir Réglages > Continuer la leçon
      backspaceEnabled: false,
      timeLimitMin: null, saveIncompleteStats: true,
      showResults: true, showRecommendations: true,
      postLessonAction: 'continue', // 'continue' | 'stats' | 'logout'
      saveStateOnClose: true,
      showStatusBar: true, showTips: true, showHighlight: true, showToolbar: true,
      showLessonPicker: true, showPause: true, showRestart: true
    },
    pendingExercise: null, // exercice interrompu à reprendre (voir saveStateOnClose)
    history: [],
    paths: [],           // chemins suivis (le programme par défaut + chemins importés) — voir paths.js
    activePathId: null   // renseigné juste après la création (voir app.js: createProfileFlow)
  };
}

// Petit utilitaire de profil « courant » (id mémorisé localement).
const CUR_KEY = 'keypop.currentId';
export function getCurrentId() { return localStorage.getItem(CUR_KEY) || null; }
export function setCurrentId(id) { localStorage.setItem(CUR_KEY, id); }

// ---------- Réglages & données propres à l'espace chemins (device local, hors profil) ----------

const PRACTITIONER_KEY = 'keypop.practitionerPaths';
export function loadPractitionerPaths() {
  try { return JSON.parse(localStorage.getItem(PRACTITIONER_KEY) || '[]'); }
  catch (e) { console.warn('loadPractitionerPaths', e); return []; }
}
export function savePractitionerPaths(paths) {
  localStorage.setItem(PRACTITIONER_KEY, JSON.stringify(paths));
}

const CATALOGUE_CACHE_KEY = 'keypop.catalogueCache';
export function loadCatalogueCache() {
  try { return JSON.parse(localStorage.getItem(CATALOGUE_CACHE_KEY) || '[]'); }
  catch (e) { console.warn('loadCatalogueCache', e); return []; }
}
export function saveCatalogueCache(paths) {
  localStorage.setItem(CATALOGUE_CACHE_KEY, JSON.stringify(paths));
}

export async function exportReport(profileId) {
  if (isTauri) return invoke('export_report', { profileId });
  // Web : impression du DOM (l'utilisateur choisit « Enregistrer en PDF »).
  window.print();
  return 'print';
}
