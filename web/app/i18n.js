// i18n.js — sélection de langue et traduction des textes de l'interface.

import fr from './i18n/fr.js';
import en from './i18n/en.js';

const LOCALES = { fr, en };
const FALLBACK_LANG = 'fr';
const LANG_KEY = 'keypop.lang';

export const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' }
];

let currentLang = null;

function detectDefaultLang() {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || FALLBACK_LANG;
  const short = nav.slice(0, 2).toLowerCase();
  return LOCALES[short] ? short : FALLBACK_LANG;
}

export function getLang() {
  if (currentLang) return currentLang;
  const saved = localStorage.getItem(LANG_KEY);
  currentLang = LOCALES[saved] ? saved : detectDefaultLang();
  return currentLang;
}

export function setLang(code) {
  if (!LOCALES[code]) return;
  currentLang = code;
  localStorage.setItem(LANG_KEY, code);
}

function lookup(dict, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

export function t(key, vars) {
  let str = lookup(LOCALES[getLang()], key);
  if (str === undefined) str = lookup(LOCALES[FALLBACK_LANG], key);
  if (str === undefined) return key;
  if (vars) {
    for (const k of Object.keys(vars)) str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
  }
  return str;
}
