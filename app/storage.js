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

export function newProfile(name, classe) {
  return {
    id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    classe: (classe || '').trim(),
    theme: 'day',
    progress: { levelIndex: 2, lessonIndex: 0 }, // démarre sur « rangée du milieu »
    options: { audio: true, openDyslexic: false, keyboard: 'azerty-pc', size: '100' },
    history: []
  };
}

// Petit utilitaire de profil « courant » (id mémorisé localement).
const CUR_KEY = 'keypop.currentId';
export function getCurrentId() { return localStorage.getItem(CUR_KEY) || null; }
export function setCurrentId(id) { localStorage.setItem(CUR_KEY, id); }

export async function exportReport(profileId) {
  if (isTauri) return invoke('export_report', { profileId });
  // Web : impression du DOM (l'utilisateur choisit « Enregistrer en PDF »).
  window.print();
  return 'print';
}
