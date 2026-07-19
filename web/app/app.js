// app.js — bootstrap, routage, rendu des écrans. Frontend partagé web/desktop.

import { LAYOUTS, layoutIdFor, rowsForLayout, FINGER_COLORS, FINGER_LABELS, keyInfoForChar, detectLayout, resolveTypedChar } from './keyboards.js';
import { TypingSession } from './typing.js';
import {
  loadProfiles, saveProfiles, newProfile,
  getCurrentId, setCurrentId, exportReport,
  loadPractitionerPaths, savePractitionerPaths,
  loadCatalogueCache, saveCatalogueCache
} from './storage.js';
import {
  emptyPath, addExercise, updateExercise, removeExercise, moveExercise, pathGroups, normalizePathExercises,
  exportPathBlob, validatePathJson, loadBundledCatalogue, fetchRemoteCatalogue,
  mergeCatalogue, importPathIntoProfile, loadDefaultPath, DEFAULT_PATH_ID
} from './paths.js';
import { t, getLang, setLang, LANGS } from './i18n.js';

const root = document.getElementById('app');

// Extension des fichiers de chemins exportés/importés — contenu JSON, mais l'extension et
// l'interface ne doivent jamais mentionner « JSON » à l'utilisateur.
const PATH_FILE_EXT = '.kp';

function langSwitcherHtml() {
  const cur = getLang();
  return `<select class="lang-select" id="langSelect" aria-label="${t('common.chooseLanguage')}">
    ${LANGS.map(l => `<option value="${l.code}" ${l.code === cur ? 'selected' : ''}>${l.label}</option>`).join('')}
  </select>`;
}

function attachLangSwitcher() {
  const sel = root.querySelector('#langSelect');
  if (sel) sel.addEventListener('change', (e) => { setLang(e.target.value); applyDocumentLang(); render(); });
}

function applyDocumentLang() {
  document.documentElement.lang = getLang();
  document.title = t('common.windowTitle');
}

const state = {
  profiles: [],
  profile: null,
  layout: { family: 'azerty', os: 'pc' },
  session: null,
  keyHandler: null,
  exerciseNarratorOn: null, // null = mode standard (suit p.options.audio), sinon bool imposé par l'exercice du chemin
  editingPathId: null,      // chemin en cours d'édition dans l'espace praticien
  lessonTimerId: null,      // setInterval de la limite de temps (Réglages > Durée de la leçon)
  keyTestOn: false,         // Réglages > Clavier > Test clavier (overlay de diagnostic, non persisté)
  keyTestHandler: null
};

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initials = (p) => {
  const a = (p.name || '?').trim().charAt(0).toUpperCase();
  const b = (p.lastName || '').trim().charAt(0).toUpperCase();
  return (a + b) || '?';
};
const fullName = (p) => [p.name, p.lastName].filter(Boolean).join(' ');

function applyTheme() {
  document.body.dataset.theme = (state.profile && state.profile.theme) || 'day';
}

async function persist() {
  const i = state.profiles.findIndex(p => p.id === state.profile.id);
  if (i >= 0) state.profiles[i] = state.profile;
  await saveProfiles(state.profiles);
}

// Le programme standard KeyPop est un chemin comme les autres (web/catalogue/default.kp),
// importé automatiquement — pas de contenu de leçon en dur dans le code. S'occupe aussi de la
// migration silencieuse des profils créés avant l'unification chemins/programme standard.
async function ensureDefaultPath(p) {
  if (!p.paths) p.paths = [];
  let def = p.paths.find(x => x.id === DEFAULT_PATH_ID);
  if (!def) {
    try {
      const defaultPath = await loadDefaultPath();
      importPathIntoProfile(p, defaultPath, { source: 'default' });
      def = p.paths.find(x => x.id === DEFAULT_PATH_ID);
    } catch (e) { console.warn('ensureDefaultPath', e); }
  }
  if (!p.activePathId && def) p.activePathId = def.id;
}

function detachKeys() {
  if (state.keyHandler) { document.removeEventListener('keydown', state.keyHandler); state.keyHandler = null; }
  detachKeyTest();
}

// ---------- Réglages > Clavier > Test clavier ----------
// Overlay de diagnostic : affiche brièvement chaque frappe — la touche telle que la disposition
// choisie (PC/Mac/auto) la simule (voir keyboards.js: resolveTypedChar), pas le caractère brut
// de l'OS — pour vérifier ce qu'une leçon recevrait vraiment avec cette disposition.
let keyTestOverlayEl = null;
let keyTestOverlayTimer = null;
const KEY_TEST_IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS', 'ContextMenu']);

function keyTestLabel(e) {
  if (e.key === 'Enter') return '⏎';
  if (e.key === 'Backspace') return '⌫';
  if (e.key === 'Tab') return '⇥';
  if (e.key === 'Escape') return 'Esc';
  const ch = resolveTypedChar(activeKeyboardLayoutId(), e);
  if (ch === ' ') return '␣';
  return ch != null ? ch : '·'; // '·' = combo non mappé sur la disposition simulée
}

function showKeyTestOverlay(e) {
  if (KEY_TEST_IGNORED.has(e.key)) return; // touche morte seule (Maj, Ctrl…) : rien à montrer
  if (!keyTestOverlayEl) {
    keyTestOverlayEl = document.createElement('div');
    keyTestOverlayEl.className = 'key-test-overlay';
    document.body.appendChild(keyTestOverlayEl);
  }
  const layoutLabel = LAYOUTS[activeKeyboardLayoutId()].label;
  keyTestOverlayEl.innerHTML = `<div class="key-test-char">${esc(keyTestLabel(e))}</div><div class="key-test-code">${esc(e.code)} · ${esc(layoutLabel)}</div>`;
  keyTestOverlayEl.classList.remove('show');
  void keyTestOverlayEl.offsetWidth; // force reflow pour rejouer la transition à chaque frappe
  keyTestOverlayEl.classList.add('show');
  clearTimeout(keyTestOverlayTimer);
  keyTestOverlayTimer = setTimeout(() => keyTestOverlayEl.classList.remove('show'), 700);
}

function attachKeyTest() {
  state.keyTestHandler = (e) => showKeyTestOverlay(e);
  document.addEventListener('keydown', state.keyTestHandler);
}

function detachKeyTest() {
  if (state.keyTestHandler) { document.removeEventListener('keydown', state.keyTestHandler); state.keyTestHandler = null; }
  clearTimeout(keyTestOverlayTimer);
  if (keyTestOverlayEl) { keyTestOverlayEl.remove(); keyTestOverlayEl = null; }
}

// ---------- Routage ----------
function navigate(hash) { if (location.hash !== hash) location.hash = hash; else render(); }

function render() {
  detachKeys();
  clearLessonTimer();
  const h = location.hash || '#/gate';
  if (h.startsWith('#/practitioner')) return renderPractitioner();
  if (!state.profile && h !== '#/gate') return navigate('#/gate');
  if (h.startsWith('#/home')) return renderHome();
  if (h.startsWith('#/exercise')) return renderExercise();
  if (h.startsWith('#/stats')) return renderStats();
  if (h.startsWith('#/catalogue')) return renderCatalogue();
  if (h.startsWith('#/settings')) return renderSettings();
  return renderGate();
}

// ---------- Écran : choix du profil ----------
function renderGate() {
  applyThemeDefault();
  const cards = state.profiles.map(p => `
    <div class="profile-card" data-id="${p.id}" role="button" tabindex="0">
      <button class="profile-delete" data-del="${p.id}" title="${t('gate.deleteProfileTitle')}" aria-label="${t('gate.deleteProfileAria', { name: esc(fullName(p)) })}">✕</button>
      <span class="avatar">${esc(initials(p))}</span>
      <span class="profile-name">${esc(fullName(p))}</span>
      <span class="profile-sub">${t('gate.profileSub')}</span>
    </div>`).join('');

  root.innerHTML = `
    <div class="screen gate">
      <div class="gate-top">
        <div class="brand"><span class="logo">K</span> KeyPop</div>
        <div class="gate-top-actions">
          ${langSwitcherHtml()}
          <a class="practitioner-link" href="#/practitioner">${t('gate.practitionerLink')}</a>
        </div>
      </div>
      <h1>${t('gate.title')}</h1>
      <p class="muted">${t('gate.subtitle')}</p>
      <div class="profile-grid">
        ${cards}
        <button class="profile-card add" id="addProfile"><span class="plus">+</span><span class="profile-name">${t('gate.newProfile')}</span></button>
      </div>
    </div>`;

  root.querySelectorAll('.profile-card[data-id]').forEach(el => {
    el.addEventListener('click', () => selectProfile(el.dataset.id));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProfile(el.dataset.id); }
    });
  });
  root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    const target = state.profiles.find(x => x.id === e.currentTarget.dataset.del);
    if (!target) return;
    if (!await showConfirm(t('gate.deleteProfileConfirm', { name: fullName(target) }))) return;
    state.profiles = state.profiles.filter(x => x.id !== target.id);
    await saveProfiles(state.profiles);
    if (getCurrentId() === target.id) setCurrentId('');
    renderGate();
  }));
  root.querySelector('#addProfile').addEventListener('click', createProfileFlow);
  attachLangSwitcher();
}

function applyThemeDefault() { if (!state.profile) document.body.dataset.theme = 'day'; }

// window.confirm()/alert() ne produisent aucune boîte native dans la webview Tauri (silencieux,
// résolution immédiate) — on utilise nos propres modales pour que ces actions fonctionnent
// réellement sur toutes les plateformes.
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <p class="modal-message">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="modal-actions">
          <button class="primary" id="cOk">${t('common.ok')}</button>
          <button class="ghost" id="cCancel">${t('common.cancel')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    function close(result) { document.body.removeChild(overlay); resolve(result); }
    overlay.querySelector('#cOk').addEventListener('click', () => close(true));
    overlay.querySelector('#cCancel').addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(true);
      if (e.key === 'Escape') close(false);
    });
    overlay.querySelector('#cOk').focus();
  });
}

function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <p class="modal-message">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="modal-actions">
          <button class="primary" id="aOk">${t('common.ok')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    function close() { document.body.removeChild(overlay); resolve(); }
    overlay.querySelector('#aOk').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') close(); });
    overlay.querySelector('#aOk').focus();
  });
}

function createProfileFlow() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${t('modalNewProfile.title')}</h2>
      <label class="modal-label">${t('modalNewProfile.nameLabel')}
        <input id="mName" class="modal-input" type="text" placeholder="${t('modalNewProfile.namePlaceholder')}" autocomplete="off">
      </label>
      <label class="modal-label">${t('modalNewProfile.lastNameLabel')}
        <input id="mLastName" class="modal-input" type="text" placeholder="${t('modalNewProfile.lastNamePlaceholder')}" autocomplete="off">
      </label>
      <div class="modal-actions">
        <button class="primary" id="mOk">${t('modalNewProfile.create')}</button>
        <button class="ghost" id="mCancel">${t('common.cancel')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector('#mName');
  const lastNameInput = overlay.querySelector('#mLastName');
  nameInput.focus();

  function close() { document.body.removeChild(overlay); }

  async function confirm() {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const lastName = lastNameInput.value.trim();
    if (!lastName) { lastNameInput.focus(); return; }
    close();
    const p = newProfile(name, lastName);
    await ensureDefaultPath(p);
    state.profiles.push(p);
    await saveProfiles(state.profiles);
    selectProfile(p.id);
  }

  overlay.querySelector('#mOk').addEventListener('click', confirm);
  overlay.querySelector('#mCancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') close();
  });
}

// ---------- Écran : espace ergothérapeute ----------
function downloadPath(path) {
  const blob = exportPathBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${path.id}${PATH_FILE_EXT}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function newPathFlow(drafts) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${t('modalNewPath.title')}</h2>
      <label class="modal-label">${t('modalNewPath.titleLabel')}
        <input id="pTitle" class="modal-input" type="text" placeholder="${t('modalNewPath.titlePlaceholder')}" autocomplete="off">
      </label>
      <label class="modal-label">${t('modalNewPath.descLabel')} <span class="muted">${t('common.optional')}</span>
        <input id="pDesc" class="modal-input" type="text" placeholder="${t('modalNewPath.descPlaceholder')}">
      </label>
      <div class="modal-actions">
        <button class="primary" id="pOk">${t('modalNewPath.create')}</button>
        <button class="ghost" id="pCancel">${t('common.cancel')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const titleInput = overlay.querySelector('#pTitle');
  titleInput.focus();

  function close() { document.body.removeChild(overlay); }

  function confirmCreate() {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    const desc = overlay.querySelector('#pDesc').value.trim();
    close();
    const path = emptyPath(title, desc);
    drafts.push(path);
    savePractitionerPaths(drafts);
    state.editingPathId = path.id;
    renderPractitioner();
  }

  overlay.querySelector('#pOk').addEventListener('click', confirmCreate);
  overlay.querySelector('#pCancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmCreate();
    if (e.key === 'Escape') close();
  });
}

function renderPractitioner() {
  applyThemeDefault();
  const drafts = loadPractitionerPaths().map(normalizePathExercises);

  if (state.editingPathId) {
    const path = drafts.find(pp => pp.id === state.editingPathId);
    if (path) return renderPathEditor(path, drafts);
    state.editingPathId = null;
  }

  root.innerHTML = `
    <div class="screen practitioner">
      <header class="topbar">
        <a class="brand" href="#/gate"><span class="logo">K</span> KeyPop</a>
        <div class="topbar-right">
          ${langSwitcherHtml()}
          <a class="ghost" href="#/gate">${t('practitioner.backToTitle')}</a>
        </div>
      </header>
      <h1>${t('practitioner.heading')}</h1>
      <p class="muted">${t('practitioner.subtitle')}</p>

      <div class="profile-grid" style="justify-content:flex-start">
        ${drafts.map(p => `
          <div class="stat path-card">
            <div class="resume-title">${esc(p.title)}</div>
            <div class="muted">${t('practitioner.exerciseCount', { n: p.exercises.length, v: p.version })}</div>
            <div class="path-card-actions">
              <button class="ghost" data-edit="${esc(p.id)}">${t('practitioner.edit')}</button>
              <button class="ghost" data-export="${esc(p.id)}">${t('practitioner.export')}</button>
              <button class="ghost" data-delete="${esc(p.id)}">${t('practitioner.delete')}</button>
            </div>
          </div>`).join('') || `<p class="muted">${t('practitioner.noPaths')}</p>`}
      </div>

      <button class="primary" id="newPathBtn">${t('practitioner.newPathBtn')}</button>
    </div>`;

  root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    state.editingPathId = b.dataset.edit; renderPractitioner();
  }));
  root.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    const path = drafts.find(pp => pp.id === b.dataset.export);
    if (path) downloadPath(path);
  }));
  root.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', async () => {
    if (!await showConfirm(t('practitioner.deletePathConfirm'))) return;
    savePractitionerPaths(drafts.filter(pp => pp.id !== b.dataset.delete));
    renderPractitioner();
  }));
  root.querySelector('#newPathBtn').addEventListener('click', () => newPathFlow(drafts));
  attachLangSwitcher();
}

// Le narrateur d'un exercice a 3 états : libre (suit le réglage de l'élève), verrouillé activé,
// verrouillé désactivé. Un clic fait tourner les 3 dans cet ordre.
function narratorChipLabel(ex) {
  if (!ex.narratorLocked) return t('pathEditor.narratorFree');
  return ex.narrator !== false ? t('pathEditor.narratorLockedOn') : t('pathEditor.narratorLockedOff');
}
function cycleNarratorState(ex) {
  if (!ex.narratorLocked) { ex.narratorLocked = true; ex.narrator = true; }
  else if (ex.narrator !== false) { ex.narrator = false; }
  else { ex.narratorLocked = false; ex.narrator = true; }
}

function renderPathEditor(path, drafts) {
  applyThemeDefault();

  root.innerHTML = `
    <div class="screen practitioner">
      <header class="topbar">
        <a class="ghost" id="backList" href="#">${t('pathEditor.backToList')}</a>
        <div class="topbar-right">
          ${langSwitcherHtml()}
          <button class="ghost" id="exportBtn">${t('pathEditor.exportBtn')}</button>
        </div>
      </header>

      <label class="modal-label">${t('pathEditor.titleLabel')}
        <input id="eTitle" class="modal-input" type="text" value="${esc(path.title)}">
      </label>
      <label class="modal-label">${t('pathEditor.descLabel')} <span class="muted">${t('common.optional')}</span>
        <input id="eDesc" class="modal-input" type="text" value="${esc(path.description || '')}">
      </label>

      <div class="path-editor">
        ${path.exercises.map((ex, i) => `
          <div class="exercise-row">
            <span class="ex-index">${i + 1}</span>
            <textarea class="modal-input ex-text" data-idx="${i}" rows="2">${esc(ex.text)}</textarea>
            <input class="modal-input ex-group" data-idx="${i}" type="text" value="${esc(ex.group || '')}" placeholder="${t('pathEditor.groupPlaceholder')}">
            <input class="modal-input ex-hint" data-idx="${i}" type="text" value="${esc(ex.hint || '')}" placeholder="${t('pathEditor.hintPlaceholder')}">
            <button class="chip ${ex.narratorLocked ? 'on' : ''}" data-narrator="${i}">${narratorChipLabel(ex)}</button>
            <button class="chip ${ex.keyboardLocked ? 'on' : ''}" data-kblock="${i}">${ex.keyboardLocked ? t('pathEditor.keyboardLocked') : t('pathEditor.keyboardFree')}</button>
            <button class="round" data-up="${i}" title="${t('pathEditor.moveUp')}">↑</button>
            <button class="round" data-down="${i}" title="${t('pathEditor.moveDown')}">↓</button>
            <button class="round" data-remove="${i}" title="${t('pathEditor.remove')}">✕</button>
          </div>`).join('') || `<p class="muted">${t('pathEditor.noExercises')}</p>`}
      </div>

      <div class="add-exercise">
        <textarea id="newExText" class="modal-input" rows="2" placeholder="${t('pathEditor.newExPlaceholder')}"></textarea>
        <input id="newExGroup" class="modal-input ex-group" type="text" placeholder="${t('pathEditor.groupPlaceholder')}">
        <input id="newExHint" class="modal-input ex-hint" type="text" placeholder="${t('pathEditor.hintPlaceholder')}">
        <button class="chip" id="newExNarrator">${t('pathEditor.narratorFree')}</button>
        <button class="chip" id="newExKeyboard">${t('pathEditor.keyboardFree')}</button>
        <button class="primary" id="addExBtn">${t('pathEditor.addExBtn')}</button>
      </div>
    </div>`;

  function persistEditor() { savePractitionerPaths(drafts); }

  root.querySelector('#backList').addEventListener('click', (e) => {
    e.preventDefault(); state.editingPathId = null; renderPractitioner();
  });
  root.querySelector('#exportBtn').addEventListener('click', () => downloadPath(path));

  root.querySelector('#eTitle').addEventListener('change', (e) => {
    path.title = e.target.value.trim(); persistEditor();
  });
  root.querySelector('#eDesc').addEventListener('change', (e) => {
    path.description = e.target.value.trim(); persistEditor();
  });

  root.querySelectorAll('.ex-text').forEach(ta => ta.addEventListener('change', (e) => {
    updateExercise(path, +e.target.dataset.idx, { text: e.target.value });
    persistEditor();
  }));
  root.querySelectorAll('.ex-group').forEach(inp => inp.addEventListener('change', (e) => {
    updateExercise(path, +e.target.dataset.idx, { group: e.target.value });
    persistEditor();
  }));
  root.querySelectorAll('.ex-hint').forEach(inp => inp.addEventListener('change', (e) => {
    updateExercise(path, +e.target.dataset.idx, { hint: e.target.value });
    persistEditor();
  }));
  root.querySelectorAll('[data-narrator]').forEach(b => b.addEventListener('click', (e) => {
    const i = +e.target.dataset.narrator;
    const ex = path.exercises[i];
    cycleNarratorState(ex);
    updateExercise(path, i, { narrator: ex.narrator, narratorLocked: ex.narratorLocked });
    persistEditor();
    renderPathEditor(path, drafts);
  }));
  root.querySelectorAll('[data-kblock]').forEach(b => b.addEventListener('click', (e) => {
    const i = +e.target.dataset.kblock;
    updateExercise(path, i, { keyboardLocked: !path.exercises[i].keyboardLocked });
    persistEditor();
    renderPathEditor(path, drafts);
  }));
  root.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', (e) => {
    moveExercise(path, +e.target.dataset.up, -1); persistEditor(); renderPathEditor(path, drafts);
  }));
  root.querySelectorAll('[data-down]').forEach(b => b.addEventListener('click', (e) => {
    moveExercise(path, +e.target.dataset.down, 1); persistEditor(); renderPathEditor(path, drafts);
  }));
  root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', (e) => {
    removeExercise(path, +e.target.dataset.remove); persistEditor(); renderPathEditor(path, drafts);
  }));

  const newEx = { narrator: true, narratorLocked: false, keyboardLocked: false };
  root.querySelector('#newExNarrator').addEventListener('click', (e) => {
    cycleNarratorState(newEx);
    e.target.classList.toggle('on', newEx.narratorLocked);
    e.target.textContent = narratorChipLabel(newEx);
  });
  root.querySelector('#newExKeyboard').addEventListener('click', (e) => {
    newEx.keyboardLocked = !newEx.keyboardLocked;
    e.target.classList.toggle('on', newEx.keyboardLocked);
    e.target.textContent = newEx.keyboardLocked ? t('pathEditor.keyboardLocked') : t('pathEditor.keyboardFree');
  });
  root.querySelector('#addExBtn').addEventListener('click', () => {
    const ta = root.querySelector('#newExText');
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    const group = root.querySelector('#newExGroup').value.trim();
    const hint = root.querySelector('#newExHint').value.trim();
    addExercise(path, text, { narrator: newEx.narrator, narratorLocked: newEx.narratorLocked, keyboardLocked: newEx.keyboardLocked, group, hint });
    persistEditor();
    renderPathEditor(path, drafts);
  });
  attachLangSwitcher();
}

async function selectProfile(id) {
  state.profile = state.profiles.find(p => p.id === id) || null;
  if (!state.profile) return;
  setCurrentId(id);
  applyTheme();
  const hadDefault = state.profile.paths.some(x => x.id === DEFAULT_PATH_ID);
  await ensureDefaultPath(state.profile);
  if (!hadDefault) await persist(); // migration silencieuse d'un profil créé avant l'unification
  const pending = state.profile.pendingExercise;
  navigate(pending && state.profile.options.saveStateOnClose ? '#/exercise' : '#/home');
}

// ---------- Écran : accueil ----------
function renderHome() {
  applyTheme();
  const p = state.profile;
  const activePath = (p.paths || []).find(x => x.id === p.activePathId) || (p.paths || [])[0];
  const groups = activePath ? pathGroups(activePath) : [];
  const hasGroups = groups.some(g => g.title);
  const exIndex = activePath ? activePath.progress.exerciseIndex : 0;
  const finished = !activePath || exIndex >= activePath.exercises.length;
  const currentGroup = !finished && hasGroups ? groups.find(g => exIndex >= g.startIndex && exIndex <= g.endIndex) : null;

  const last = p.history[p.history.length - 1];
  const totalScore = p.history.reduce((s, h) => s + (h.score || 0), 0);

  const resumeSubtitle = finished
    ? t('home.pathFinished')
    : (currentGroup && currentGroup.hint
      ? t('home.exerciseOfHint', { i: exIndex + 1, n: activePath.exercises.length, hint: esc(currentGroup.hint) })
      : t('home.exerciseOf', { i: exIndex + 1, n: activePath.exercises.length }));

  root.innerHTML = `
    <div class="screen home">
      <header class="topbar">
        <div class="brand"><span class="logo">K</span> KeyPop</div>
        <div class="topbar-right">
          ${langSwitcherHtml()}
          <span class="pill score">${totalScore} ${t('home.pts')}</span>
          <button class="ghost" id="themeBtn">${p.theme === 'night' ? t('home.themeNight') : t('home.themeDay')}</button>
          <a class="ghost" href="#/settings">⚙ ${t('home.settings')}</a>
          <button class="ghost" id="switchBtn">${t('home.switchProfile')}</button>
          <span class="avatar">${esc(initials(p))}</span>
        </div>
      </header>

      <h1>${t('home.greeting', { name: esc(p.name) })}</h1>
      <p class="muted">${t('home.subtitle')}</p>

      <div class="resume-card">
        <div>
          ${currentGroup && currentGroup.title ? `<div class="kicker">${esc(currentGroup.title)}</div>` : ''}
          <div class="resume-title">${activePath ? esc(activePath.title) : ''}</div>
          <div class="muted">${resumeSubtitle}</div>
        </div>
        <button class="primary" id="startBtn" ${finished ? 'disabled' : ''}>${t('home.continue')}</button>
      </div>

      <div class="stat-row">
        <div class="stat"><div class="muted">${t('home.accuracy')}</div><div class="big">${last ? last.accuracy : '—'}<small>%</small></div></div>
        <div class="stat"><div class="muted">${t('home.speed')}</div><div class="big">${last ? last.wpm : '—'}<small> ${t('exercise.liveSpeed')}</small></div></div>
        <div class="stat"><div class="muted">${t('home.sessions')}</div><div class="big">${p.history.length}</div></div>
        <a class="stat link" href="#/stats"><div class="muted">${t('home.see')}</div><div class="big">${t('home.statsLink')}</div></a>
      </div>

      ${hasGroups ? `
      <div class="path">
        ${groups.map((g, i) => {
          const st = exIndex > g.endIndex ? 'done' : (exIndex >= g.startIndex && exIndex <= g.endIndex) ? 'current' : 'locked';
          return `<div class="node ${st}">
            <span class="dot">${st === 'done' ? '✓' : (i + 1)}</span>
            <span class="node-label">${esc(g.title.replace('La rangée ', '').replace('Les ', ''))}</span>
          </div>`;
        }).join('')}
      </div>` : ''}

      ${(p.paths && p.paths.length) ? `
        <div class="panel">
          <div class="panel-title">${t('home.myPaths')}</div>
          <div class="profile-grid" style="justify-content:flex-start">
            ${p.paths.map(cp => `
              <div class="stat path-card">
                <div class="resume-title">${esc(cp.title)}</div>
                <div class="muted">${t('home.exerciseProgress', { done: Math.min(cp.progress.exerciseIndex, cp.exercises.length), total: cp.exercises.length })}</div>
                ${p.activePathId === cp.id
                  ? `<button class="ghost" disabled>${t('home.currentPath')}</button>`
                  : `<button class="primary" data-start-path="${esc(cp.id)}">${t('home.choosePathBtn')}</button>`}
              </div>`).join('')}
          </div>
        </div>` : ''}

      <div class="path-import">
        <button class="ghost" id="importJsonBtn">${t('home.importPathBtn')}</button>
        <a class="ghost" href="#/catalogue">${t('home.browseCatalogue')}</a>
        <input type="file" id="importFileInput" accept="${PATH_FILE_EXT}" style="display:none">
      </div>
    </div>`;

  const startBtn = root.querySelector('#startBtn');
  if (!finished) startBtn.addEventListener('click', () => navigate('#/exercise'));
  root.querySelector('#switchBtn').addEventListener('click', () => { state.profile = null; navigate('#/gate'); });
  root.querySelector('#themeBtn').addEventListener('click', async () => {
    p.theme = p.theme === 'night' ? 'day' : 'night'; applyTheme(); await persist(); renderHome();
  });

  root.querySelectorAll('[data-start-path]').forEach(b => b.addEventListener('click', async () => {
    p.activePathId = b.dataset.startPath;
    await persist();
    navigate('#/exercise');
  }));

  root.querySelector('#importJsonBtn').addEventListener('click', () => root.querySelector('#importFileInput').click());
  root.querySelector('#importFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const path = validatePathJson(raw);
      importPathIntoProfile(p, path, { source: 'file' });
      await persist();
      renderHome();
    } catch (err) {
      const reason = err.i18nKey ? t(err.i18nKey, err.i18nParams) : err.message;
      await showAlert(t('home.importFailed', { reason }));
    }
  });
  attachLangSwitcher();
}

// ---------- Écran : exercice (fonctionnel) ----------
// Étiquette d'un exercice pour le sélecteur de leçon : préfixée par son groupe s'il en a un
// (ex. « La rangée de repos — Leçon 2 »), sinon juste « Leçon N ».
function exerciseOptionLabels(path) {
  const labels = [];
  pathGroups(path).forEach(g => {
    for (let i = g.startIndex; i <= g.endIndex; i++) {
      labels[i] = g.title
        ? `${g.title} — ${t('exercise.lessonOptionLabel', { n: i - g.startIndex + 1 })}`
        : t('exercise.lessonOptionLabel', { n: i + 1 });
    }
  });
  return labels;
}

function renderExercise() {
  applyTheme();
  clearLessonTimer();
  const p = state.profile;
  const activePath = (p.paths || []).find(x => x.id === p.activePathId);
  if (!activePath || activePath.progress.exerciseIndex >= activePath.exercises.length) {
    return navigate('#/home');
  }
  const currentEx = activePath.exercises[activePath.progress.exerciseIndex];
  state.session = new TypingSession(currentEx.text);
  state.session.targetIntervalMs = p.options.metronome ? metronomeIntervalMs(p.options.metronomeWpm) : null;
  state.session.adaptiveMetronome = !!p.options.metronomeAdaptive;
  state.session.onErrorMode = p.options.onErrorMode || 'block';
  state.exerciseNarratorOn = currentEx.narratorLocked ? (currentEx.narrator !== false) : null;

  // Reprise d'un exercice interrompu à la fermeture précédente (voir Réglages > À la fermeture).
  const pending = p.pendingExercise;
  if (pending && pending.activePathId === p.activePathId && pending.exerciseIndex === activePath.progress.exerciseIndex) {
    const resumePos = Math.min(pending.pos, state.session.text.length);
    for (let i = 0; i < resumePos; i++) state.session.states[i] = 'ok';
    state.session.pos = resumePos;
    state.session.errors = pending.errors || 0;
  }
  p.pendingExercise = null;

  const headTitle = esc(activePath.title);
  const headSub = t('exercise.exerciseOf', { i: activePath.progress.exerciseIndex + 1, n: activePath.exercises.length });
  const audioChipHtml = currentEx.narratorLocked
    ? `<span class="chip static">${currentEx.narrator !== false ? t('exercise.narratorOnForExercise') : t('exercise.narratorOffForExercise')}</span>`
    : `<button class="chip ${p.options.audio ? 'on' : ''}" id="audioChip">${t('exercise.audioChip')}</button>`;
  const keyboardLocked = !!currentEx.keyboardLocked;
  const keyboardOn = keyboardLocked ? false : !!p.options.keyboard;
  const keyboardChipHtml = keyboardLocked
    ? `<span class="chip static">${t('exercise.keyboardOffForExercise')}</span>`
    : `<button class="chip ${p.options.keyboard ? 'on' : ''}" id="kbChip">${t('exercise.keyboardChip')}</button>`;

  const lessonPickersHtml = p.options.showLessonPicker ? `
    <div class="lesson-pickers">
      <select id="exercisePicker" aria-label="${t('exercise.chooseLesson')}">
        ${exerciseOptionLabels(activePath).map((label, i) => `<option value="${i}" ${i === activePath.progress.exerciseIndex ? 'selected' : ''}>${esc(label)}</option>`).join('')}
      </select>
    </div>` : '';

  const headBtnsHtml = `
    ${p.options.showRestart ? `<button class="round" id="restartBtn" title="${t('exercise.restart')}">↻</button>` : ''}
    ${p.options.showPause ? `<button class="round" id="pauseBtn" title="${t('exercise.pause')}">⏸</button>` : ''}
  `;

  root.innerHTML = `
    <div class="screen exercise">
      <header class="ex-head">
        <a class="round" href="#/home">✕</a>
        <div>
          <div class="ex-title">${headTitle}</div>
          <div class="muted">${headSub}</div>
          ${lessonPickersHtml}
        </div>
        ${headBtnsHtml}
        ${p.options.showStatusBar ? `
        <div class="ex-live">
          <span id="liveAcc" class="mono">100%</span><span class="muted"> ${t('exercise.liveAccuracy')}</span>
          <span id="liveWpm" class="mono">0</span><span class="muted"> ${t('exercise.liveSpeed')}</span>
          <span id="liveScore" class="mono">0</span><span class="muted"> ${t('exercise.livePts')}</span>
          ${p.options.timeLimitMin ? `<span id="liveTime" class="mono"></span>` : ''}
        </div>` : ''}
      </header>

      <div class="type-card">
        <div class="muted small">${t('exercise.typePrompt')}</div>
        <div class="type-text-wrap"><div class="type-text view-${p.options.viewMode}" id="typeText" style="font-size:${Math.round(32 * (p.options.textSize || 100) / 100)}px"></div></div>
        <div class="pause-overlay" id="pauseOverlay" hidden>${t('exercise.paused')}</div>
      </div>

      ${p.options.showToolbar ? `
      <div class="chips">
        ${audioChipHtml}
        <button class="chip ${p.options.openDyslexic ? 'on' : ''}" id="odChip">${t('exercise.odChip')}</button>
        ${keyboardChipHtml}
        <button class="chip ${p.options.metronome ? 'on' : ''}" id="metroChip">${t('exercise.metronomeChip')}</button>
        ${p.options.metronome ? metronomePaceSelectHtml(p.options.metronomeWpm) : ''}
        <span class="chip static">${t('exercise.layoutChip', { label: LAYOUTS[activeKeyboardLayoutId()].label })}</span>
        <span class="chip static">${t('exercise.sizeChip', { size: esc(p.options.size) })}</span>
      </div>` : ''}

      ${keyboardOn ? '<div class="keyboard" id="keyboard"></div>' : ''}
      ${p.options.showTips ? `<div class="ex-foot muted" id="exFoot">${t('exercise.footHint')}</div>` : ''}
    </div>`;

  document.body.classList.toggle('od-font', !!p.options.openDyslexic);
  renderTypeText();
  renderKeyboard();
  speakNextWordMaybe();
  startLessonTimer();

  const restartBtn = root.querySelector('#restartBtn');
  if (restartBtn) restartBtn.addEventListener('click', () => renderExercise());

  const pauseBtn = root.querySelector('#pauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', () => togglePause());

  const exercisePicker = root.querySelector('#exercisePicker');
  if (exercisePicker) exercisePicker.addEventListener('change', async (e) => {
    activePath.progress.exerciseIndex = +e.target.value;
    await persist();
    renderExercise();
  });

  const audioChip = root.querySelector('#audioChip');
  if (audioChip) audioChip.addEventListener('click', async (e) => {
    p.options.audio = !p.options.audio; e.target.classList.toggle('on', p.options.audio); await persist();
    if (p.options.audio) speakNextWordMaybe();
  });
  const odChip = root.querySelector('#odChip');
  if (odChip) odChip.addEventListener('click', async (e) => {
    p.options.openDyslexic = !p.options.openDyslexic;
    e.target.classList.toggle('on', p.options.openDyslexic);
    document.body.classList.toggle('od-font', p.options.openDyslexic);
    await persist();
  });
  const kbChip = root.querySelector('#kbChip');
  if (kbChip) kbChip.addEventListener('click', async (e) => {
    p.options.keyboard = !p.options.keyboard;
    e.target.classList.toggle('on', p.options.keyboard);
    let kb = root.querySelector('#keyboard');
    if (p.options.keyboard) {
      if (!kb) {
        kb = document.createElement('div');
        kb.className = 'keyboard';
        kb.id = 'keyboard';
        root.querySelector('.chips').insertAdjacentElement('afterend', kb);
      }
      renderKeyboard();
    } else if (kb) {
      kb.remove();
    }
    await persist();
  });

  function attachMetroPace(sel) {
    sel.addEventListener('change', async (e) => {
      p.options.metronomeWpm = +e.target.value;
      state.session.targetIntervalMs = metronomeIntervalMs(p.options.metronomeWpm);
      await persist();
    });
  }
  const metroPaceInit = root.querySelector('#metroPace');
  if (metroPaceInit) attachMetroPace(metroPaceInit);

  const metroChip = root.querySelector('#metroChip');
  if (metroChip) metroChip.addEventListener('click', async (e) => {
    p.options.metronome = !p.options.metronome;
    e.target.classList.toggle('on', p.options.metronome);
    state.session.targetIntervalMs = p.options.metronome ? metronomeIntervalMs(p.options.metronomeWpm) : null;
    let sel = root.querySelector('#metroPace');
    if (p.options.metronome) {
      if (!sel) {
        const tmp = document.createElement('div');
        tmp.innerHTML = metronomePaceSelectHtml(p.options.metronomeWpm);
        sel = tmp.firstElementChild;
        e.target.insertAdjacentElement('afterend', sel);
        attachMetroPace(sel);
      }
    } else if (sel) {
      sel.remove();
    }
    await persist();
  });

  state.keyHandler = (e) => onExerciseKey(e);
  document.addEventListener('keydown', state.keyHandler);
}

const METRONOME_PRESETS = [5, 10, 15, 20, 25, 30, 40, 50];
function metronomeIntervalMs(wpm) { return 12000 / (wpm || 10); }
function metronomePaceSelectHtml(currentWpm) {
  return `<select class="lang-select" id="metroPace" aria-label="${t('exercise.metronomePaceAria')}">
    ${METRONOME_PRESETS.map(w => `<option value="${w}" ${w === currentWpm ? 'selected' : ''}>${t('exercise.metronomePaceOption', { wpm: w })}</option>`).join('')}
  </select>`;
}

function renderTypeText() {
  const s = state.session;
  const el = root.querySelector('#typeText');
  if (!el) return;
  const showHighlight = !state.profile || state.profile.options.showHighlight !== false;
  let html = '';
  s.text.forEach((ch, i) => {
    const disp = ch === ' ' ? '&nbsp;' : esc(ch);
    if (i < s.pos) {
      const st = s.states[i];
      const cls = !showHighlight ? '' : (st === 'err' ? 'was-err' : st === 'slow' ? 'was-slow' : '');
      html += `<span class="done ${cls}">${disp}</span>`;
    }
    else if (i === s.pos) html += `<span class="cur">${disp}</span>`;
    else html += `<span class="todo">${disp}</span>`;
  });
  html += '<span class="caret"></span>';
  el.innerHTML = html;
  applyViewMode();
}

// Positionne le texte selon la vue choisie (Réglages > Vue de la leçon) :
// - multiline : retour à la ligne naturel (comportement par défaut du navigateur)
// - mobile : une seule ligne, le curseur reste visible en faisant défiler le texte
// - static : une seule ligne, le curseur reste fixe et c'est le texte qui défile dessous
function applyViewMode() {
  const p = state.profile;
  const el = root.querySelector('#typeText');
  const wrap = root.querySelector('.type-text-wrap');
  if (!p || !el || !wrap) return;
  const mode = p.options.viewMode || 'mobile';
  el.style.transform = '';
  if (mode === 'static') {
    const cur = el.querySelector('.cur') || el.querySelector('.caret');
    if (cur) {
      const wrapRect = wrap.getBoundingClientRect();
      const curRect = cur.getBoundingClientRect();
      const fixedX = 16;
      const shift = (curRect.left - wrapRect.left) - fixedX;
      el.style.transform = `translateX(${-shift}px)`;
    }
  } else if (mode === 'mobile') {
    const cur = el.querySelector('.cur') || el.querySelector('.caret');
    if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
}

function activeKeyboardLayoutId() {
  const p = state.profile;
  return (p && p.options.keyboardLayout) || layoutIdFor(state.layout.os);
}

function renderKeyboard() {
  const kb = root.querySelector('#keyboard');
  if (!kb) return;
  const next = state.session.nextChar;
  const nextKeyInfo = keyInfoForChar(next);
  let html = '';
  rowsForLayout(activeKeyboardLayoutId()).forEach((row, ri) => {
    html += '<div class="krow">';
    row.forEach((key, ki) => {
      const bg = key.faded ? 'var(--key-faded)' : FINGER_COLORS[key.finger];
      const isNext = nextKeyInfo && nextKeyInfo.ri === ri && nextKeyInfo.ki === ki;
      const wpx = Math.round(key.w * 46 + (key.w - 1) * 6);
      html += `<div class="key ${key.faded ? 'faded' : ''} ${isNext ? 'next' : ''}" style="width:${wpx}px;background:${key.faded ? '' : bg}">
        ${key.sub ? `<span class="ksub">${esc(key.sub)}</span>` : ''}
        <span>${esc(key.main)}</span>
        ${key.bump ? '<span class="kbump"></span>' : ''}
      </div>`;
    });
    html += '</div>';
  });
  kb.innerHTML = html;
}

function updateLive() {
  const s = state.session;
  const acc = root.querySelector('#liveAcc'); if (acc) acc.textContent = s.accuracy + '%';
  const wpm = root.querySelector('#liveWpm'); if (wpm) wpm.textContent = s.wpm;
  const sc = root.querySelector('#liveScore'); if (sc) sc.textContent = s.score;
}

function onExerciseKey(e) {
  const s = state.session;
  const p = state.profile;
  if (!s || s.done || s.paused) return;
  if (e.metaKey) return;

  if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey) {
    if (!p.options.backspaceEnabled) return;
    e.preventDefault();
    if (s.backspace()) { renderTypeText(); renderKeyboard(); updateLive(); }
    return;
  }

  // Résolu à partir du code physique + de la disposition choisie (PC/Mac/auto), pas du
  // caractère réel produit par l'OS — permet de s'exercer sur une disposition simulée,
  // différente du clavier physique de l'appareil (voir keyboards.js: resolveTypedChar).
  const ch = resolveTypedChar(activeKeyboardLayoutId(), e);
  if (ch == null) return; // touche non imprimable, ou combo non mappé sur la disposition simulée
  e.preventDefault();

  const res = s.press(ch);
  renderTypeText();
  renderKeyboard();
  updateLive();

  const foot = root.querySelector('#exFoot');
  if (res === 'err' && s.onErrorMode !== 'ignore' && foot) { foot.textContent = t('exercise.errFeedback'); foot.classList.add('warn'); }
  else if (foot) { foot.classList.remove('warn'); }

  if (s.done) finishExercise();
  else if (ch === ' ') { speakNextWordMaybe(); checkpointPendingExercise(); }
}

// Sauvegarde légère de la position en cours (pour la reprise à la fermeture), à chaque mot —
// pas à chaque frappe, pour ne pas écrire sur disque trop souvent.
function checkpointPendingExercise() {
  const p = state.profile, s = state.session;
  const activePath = (p.paths || []).find(x => x.id === p.activePathId);
  if (!p.options.saveStateOnClose || !s || s.done || !activePath) return;
  p.pendingExercise = {
    activePathId: p.activePathId,
    exerciseIndex: activePath.progress.exerciseIndex,
    pos: s.pos,
    errors: s.errors
  };
  persist();
}

function clearLessonTimer() {
  if (state.lessonTimerId != null) { clearInterval(state.lessonTimerId); state.lessonTimerId = null; }
}

function startLessonTimer() {
  const p = state.profile;
  if (!p.options.timeLimitMin) return;
  const limitMs = p.options.timeLimitMin * 60000;
  state.lessonTimerId = setInterval(() => {
    const s = state.session;
    if (!s || s.done || s.paused) return;
    const remainingMs = limitMs - s.elapsedMs;
    const liveTime = root.querySelector('#liveTime');
    if (liveTime) liveTime.textContent = t('exercise.timeLeft', { min: Math.max(0, Math.ceil(remainingMs / 60000)) });
    if (remainingMs <= 0) finishExercise({ timeUp: true });
  }, 1000);
}

function togglePause() {
  const s = state.session;
  if (!s || s.done) return;
  const overlay = root.querySelector('#pauseOverlay');
  const btn = root.querySelector('#pauseBtn');
  if (s.paused) {
    s.resume();
    if (overlay) overlay.hidden = true;
    if (btn) btn.textContent = '⏸';
    state.keyHandler = (e) => onExerciseKey(e);
    document.addEventListener('keydown', state.keyHandler);
  } else {
    s.pause();
    if (overlay) overlay.hidden = false;
    if (btn) btn.textContent = '▶';
    detachKeys();
  }
}

function speakNextWordMaybe() {
  const p = state.profile, s = state.session;
  if (!('speechSynthesis' in window) || !s) return;
  const narratorOn = state.exerciseNarratorOn === null ? p.options.audio : state.exerciseNarratorOn;
  if (!narratorOn) return;
  const rest = s.text.slice(s.pos).join('');
  const word = rest.split(' ')[0];
  if (!word) return;
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'fr-FR'; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

const dispChar = (ch) => ch === ' ' ? t('exercise.space') : esc(ch);

function goalsResultHtml(s, p) {
  if (!p.options.goalsEnabled) return '';
  const g = s.goalsResult({ minWpm: p.options.goalMinWpm, maxErrorPct: p.options.goalMaxErrorPct, maxSlowdownPct: p.options.goalMaxSlowdownPct });
  const reco = p.options.showRecommendations
    ? `<div class="result-reco">${g.met ? t('exercise.recoAdvance') : t('exercise.recoRepeat')}</div>`
    : '';
  return `<div class="result-goal ${g.met ? 'met' : 'unmet'}">${g.met ? t('exercise.goalMet') : t('exercise.goalUnmet')}</div>${reco}`;
}

function showResultCard(s, { title, actionsHtml, goalsHtml }) {
  const card = root.querySelector('.type-card');
  if (!card) return;
  const fastest = s.fastestKeyInterval;
  const slowest = s.slowestKeyInterval;

  card.insertAdjacentHTML('afterend', `
    <div class="result">
      <div class="result-title">${title}</div>
      ${goalsHtml || ''}
      <div class="result-stats">
        <span><b>${s.accuracy}%</b> ${t('exercise.liveAccuracy')}</span>
        <span><b>${s.wpm}</b> ${t('exercise.resultWpm')}</span>
        <span><b>${s.avgKeyIntervalMs}</b> ${t('exercise.resultMsBetween')}</span>
        <span><b>+${s.score}</b> ${t('exercise.livePts')}</span>
        ${fastest ? `<span class="key-stat fastest"><span class="key-dot"></span><b>${fastest.ms} ms</b> ${t('exercise.resultFastest')} (« ${dispChar(fastest.char)} »)</span>` : ''}
        ${slowest ? `<span class="key-stat slowest"><span class="key-dot"></span><b>${slowest.ms} ms</b> ${t('exercise.resultSlowest')} (« ${dispChar(slowest.char)} »)</span>` : ''}
      </div>
      <div class="result-actions">${actionsHtml}</div>
    </div>`);

  const letters = root.querySelectorAll('#typeText > span:not(.caret)');
  if (fastest && letters[fastest.pos]) letters[fastest.pos].classList.add('key-highlight-fastest');
  if (slowest && letters[slowest.pos]) letters[slowest.pos].classList.add('key-highlight-slowest');
}

async function finishExercise(opts = {}) {
  detachKeys();
  clearLessonTimer();
  const s = state.session, p = state.profile;
  const incomplete = !s.done;
  p.pendingExercise = null;

  if (incomplete && !p.options.saveIncompleteStats) {
    await persist();
    return navigate('#/home');
  }

  const activePath = (p.paths || []).find(x => x.id === p.activePathId);
  p.history.push(s.summary({ path: activePath.id, exerciseIndex: activePath.progress.exerciseIndex, incomplete }));
  if (!incomplete) activePath.progress.exerciseIndex++;
  const finishedPath = activePath.progress.exerciseIndex >= activePath.exercises.length;
  await persist();

  proceedAfterLesson(s, { activePath, finishedPath, timeUp: !!opts.timeUp });
}

function proceedAfterLesson(s, { activePath, finishedPath, timeUp }) {
  const p = state.profile;
  const action = p.options.postLessonAction;

  if (!p.options.showResults) {
    if (action === 'stats') return navigate('#/stats');
    if (action === 'logout') { state.profile = null; return navigate('#/gate'); }
    if (finishedPath) return navigate('#/home');
    return navigate('#/exercise');
  }

  const title = timeUp ? t('exercise.resultTitleTimeUp') : finishedPath ? t('exercise.resultTitlePathDone') : t('exercise.resultTitleGood');
  let actionsHtml;
  if (action === 'stats') {
    actionsHtml = `<a class="primary" href="#/stats">${t('exercise.goToStats')}</a>`;
  } else if (action === 'logout') {
    actionsHtml = `<button class="primary" id="logoutBtn">${t('exercise.logout')}</button>`;
  } else if (finishedPath) {
    actionsHtml = `<a class="primary" href="#/home">${t('exercise.returnToPaths')}</a>`;
  } else {
    actionsHtml = `<button class="primary" id="nextBtn">${t('exercise.nextExercise')}</button><a class="ghost" href="#/home">${t('exercise.home')}</a>`;
  }

  showResultCard(s, { title, actionsHtml, goalsHtml: goalsResultHtml(s, p) });

  const nb = root.querySelector('#nextBtn');
  if (nb) nb.addEventListener('click', () => navigate('#/exercise'));
  const lb = root.querySelector('#logoutBtn');
  if (lb) lb.addEventListener('click', () => { state.profile = null; navigate('#/gate'); });
}

// ---------- Écran : statistiques ----------
function renderStats() {
  applyTheme();
  const p = state.profile;
  const hist = p.history.slice(-14);
  const avg = (k) => hist.length ? Math.round(hist.reduce((s, h) => s + (h[k] || 0), 0) / hist.length) : 0;
  const maxWpm = Math.max(1, ...hist.map(h => h.wpm || 0));
  const dateLocale = getLang() === 'en' ? 'en-US' : 'fr-FR';

  root.innerHTML = `
    <div class="screen stats">
      <header class="topbar">
        <a class="brand" href="#/home"><span class="logo">K</span> KeyPop</a>
        <div class="topbar-right">
          ${langSwitcherHtml()}
          <button class="ghost" id="pdfBtn">${t('stats.pdfBtn')}</button>
          <span class="avatar">${esc(initials(p))}</span>
        </div>
      </header>
      <h1>${t('stats.heading', { name: esc(fullName(p)) })}</h1>
      <p class="muted">${t('stats.subtitle', { n: p.history.length })}</p>

      <div class="stat-row">
        <div class="stat"><div class="muted">${t('stats.avgAccuracy')}</div><div class="big">${avg('accuracy')}<small>%</small></div></div>
        <div class="stat"><div class="muted">${t('stats.avgSpeed')}</div><div class="big">${avg('wpm')}<small> ${t('exercise.liveSpeed')}</small></div></div>
        <div class="stat"><div class="muted">${t('stats.totalScore')}</div><div class="big">${p.history.reduce((s, h) => s + (h.score || 0), 0)}</div></div>
      </div>

      <div class="panel">
        <div class="panel-title">${t('stats.progressChart')}</div>
        <div class="chart">
          ${hist.length ? hist.map(h => `<div class="bar" style="height:${Math.max(6, Math.round((h.wpm / maxWpm) * 100))}%"></div>`).join('')
            : `<div class="muted">${t('stats.noSessions')}</div>`}
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">${t('stats.history')}</div>
        ${p.history.slice().reverse().slice(0, 8).map(h => `
          <div class="hist-row">
            <span>${new Date(h.date).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span class="mono">${h.wpm} ${t('exercise.liveSpeed')}</span>
            <span class="mono">${h.accuracy}%</span>
            <span class="mono">+${h.score}</span>
          </div>`).join('') || '<div class="muted">—</div>'}
      </div>
      <a class="ghost back" href="#/home">${t('stats.backHome')}</a>
    </div>`;

  root.querySelector('#pdfBtn').addEventListener('click', () => exportReport(p.id).catch(() => {}));
  attachLangSwitcher();
}

// ---------- Écran : catalogue de chemins ----------
async function renderCatalogue() {
  applyTheme();

  root.innerHTML = `
    <div class="screen catalogue">
      <header class="topbar">
        <a class="brand" href="#/home"><span class="logo">K</span> KeyPop</a>
        <div class="topbar-right">
          ${langSwitcherHtml()}
          <button class="ghost" id="refreshBtn">${t('catalogue.refresh')}</button>
        </div>
      </header>
      <h1>${t('catalogue.heading')}</h1>
      <p class="muted" id="catalogueStatus">${t('catalogue.loading')}</p>
      <div class="profile-grid" id="catalogueList" style="justify-content:flex-start"></div>
      <a class="ghost back" href="#/home">${t('catalogue.backHome')}</a>
    </div>`;

  root.querySelector('#refreshBtn').addEventListener('click', () => updateCatalogue());
  attachLangSwitcher();
  await paintCatalogue();
}

async function paintCatalogue() {
  const p = state.profile;
  const status = root.querySelector('#catalogueStatus');
  let bundled = [];
  try { bundled = await loadBundledCatalogue(); } catch (e) { console.warn('catalogue bundled', e); }
  const catalogue = mergeCatalogue(bundled, loadCatalogueCache());
  if (status) status.textContent = t('catalogue.availableCount', { n: catalogue.length });

  const list = root.querySelector('#catalogueList');
  if (!list) return;
  list.innerHTML = catalogue.map(c => {
    const owned = (p.paths || []).find(x => x.id === c.id);
    const isNewer = owned && (c.version || 1) > (owned.version || 1);
    let btnLabel = t('catalogue.importBtn');
    if (owned && !isNewer) btnLabel = t('catalogue.alreadyImported');
    else if (isNewer) btnLabel = t('catalogue.updateBtn', { v: c.version });
    return `
      <div class="stat path-card catalogue-card">
        <div class="resume-title">${esc(c.title)}</div>
        <div class="muted small">${esc(c.description || '')}</div>
        <div class="muted">${t('catalogue.exerciseCount', { n: c.exercises.length })}</div>
        <button class="${owned && !isNewer ? 'ghost' : 'primary'}" data-import="${esc(c.id)}" ${owned && !isNewer ? 'disabled' : ''}>${btnLabel}</button>
      </div>`;
  }).join('') || `<p class="muted">${t('catalogue.noPaths')}</p>`;

  list.querySelectorAll('[data-import]').forEach(b => b.addEventListener('click', () => {
    const c = catalogue.find(x => x.id === b.dataset.import);
    if (c) handleCatalogueImport(c);
  }));
}

async function handleCatalogueImport(path) {
  const p = state.profile;
  const existing = (p.paths || []).find(x => x.id === path.id);
  let resetProgress = false;
  if (existing && (path.version || 1) > (existing.version || 1)) {
    const keepProgress = await showConfirm(t('catalogue.newVersionConfirm', { title: path.title }));
    resetProgress = !keepProgress;
  }
  importPathIntoProfile(p, path, { source: 'catalogue', resetProgress });
  await persist();
  await paintCatalogue();
}

async function updateCatalogue() {
  const status = root.querySelector('#catalogueStatus');
  if (status) status.textContent = t('catalogue.searching');
  try {
    const remote = await fetchRemoteCatalogue();
    let bundled = [];
    try { bundled = await loadBundledCatalogue(); } catch (e) { /* ignore */ }
    saveCatalogueCache(mergeCatalogue(bundled, loadCatalogueCache(), remote));
  } catch (e) {
    console.warn('updateCatalogue', e);
    if (status) status.textContent = t('catalogue.fetchError');
    return;
  }
  await paintCatalogue();
}

// ---------- Écran : réglages ----------
function settingCheckboxHtml(key, label, checked) {
  return `<label class="setting-row"><input type="checkbox" data-opt="${key}" ${checked ? 'checked' : ''}> ${label}</label>`;
}
function settingNumberHtml(key, label, value, { min, max, step, suffix } = {}) {
  return `<label class="setting-row">${label}
    <input type="number" class="setting-number" data-opt="${key}" value="${value}"${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}${step !== undefined ? ` step="${step}"` : ''}>
    ${suffix ? `<span class="muted">${suffix}</span>` : ''}
  </label>`;
}
function settingRadioHtml(key, current, options) {
  return `<div class="setting-radio" data-opt-radio="${key}">
    ${options.map(o => `<button type="button" class="chip ${o.value === current ? 'on' : ''}" data-opt-value="${o.value}">${o.label}</button>`).join('')}
  </div>`;
}

function renderSettings() {
  applyTheme();
  const p = state.profile;
  const o = p.options;
  const layoutValue = o.keyboardLayout || '__auto__';

  root.innerHTML = `
    <div class="screen settings">
      <header class="topbar">
        <a class="brand" href="#/home"><span class="logo">K</span> KeyPop</a>
        <div class="topbar-right">
          ${langSwitcherHtml()}
          <a class="ghost" href="#/home">${t('settings.backHome')}</a>
        </div>
      </header>
      <h1>${t('settings.heading')}</h1>
      <p class="muted">${t('settings.subtitle')}</p>

      <div class="panel">
        <div class="panel-title">${t('settings.keyboard.title')}</div>
        <div class="setting-radio-row">
          ${settingRadioHtml('keyboardLayout', layoutValue, [
            { value: '__auto__', label: t('settings.keyboard.auto') },
            { value: 'azerty-pc', label: LAYOUTS['azerty-pc'].label },
            { value: 'azerty-mac', label: LAYOUTS['azerty-mac'].label }
          ])}
          <button type="button" class="chip ${state.keyTestOn ? 'on' : ''}" id="keyTestToggle">⌨️ ${t('settings.keyboard.test')}</button>
        </div>
        ${state.keyTestOn ? `<p class="muted key-test-hint">${t('settings.keyboard.testHint')}</p>` : ''}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.goals.title')}</div>
        ${settingCheckboxHtml('goalsEnabled', t('settings.goals.enable'), o.goalsEnabled)}
        ${o.goalsEnabled ? `
          ${settingNumberHtml('goalMinWpm', t('settings.goals.minSpeed'), o.goalMinWpm, { min: 0, step: 1, suffix: t('exercise.liveSpeed') })}
          ${settingNumberHtml('goalMaxErrorPct', t('settings.goals.maxErrors'), o.goalMaxErrorPct, { min: 0, max: 100, step: 5, suffix: '%' })}
          ${settingNumberHtml('goalMaxSlowdownPct', t('settings.goals.maxSlowdowns'), o.goalMaxSlowdownPct, { min: 0, max: 100, step: 5, suffix: '%' })}
        ` : ''}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.view.title')}</div>
        ${settingRadioHtml('viewMode', o.viewMode, [
          { value: 'static', label: t('settings.view.static') },
          { value: 'mobile', label: t('settings.view.mobile') },
          { value: 'multiline', label: t('settings.view.multiline') }
        ])}
        ${settingNumberHtml('textSize', t('settings.view.textSize'), o.textSize, { min: 60, max: 160, step: 10, suffix: '%' })}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.onError.title')}</div>
        ${settingRadioHtml('onErrorMode', o.onErrorMode, [
          { value: 'block', label: t('settings.onError.block') },
          { value: 'correct', label: t('settings.onError.correct') },
          { value: 'ignore', label: t('settings.onError.ignore') }
        ])}
        ${settingCheckboxHtml('backspaceEnabled', t('settings.onError.backspace'), o.backspaceEnabled)}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.duration.title')}</div>
        <label class="setting-row"><input type="checkbox" id="timeLimitToggle" ${o.timeLimitMin != null ? 'checked' : ''}> ${t('settings.duration.enable')}</label>
        ${o.timeLimitMin != null ? `
          ${settingNumberHtml('timeLimitMin', t('settings.duration.minutes'), o.timeLimitMin, { min: 1, max: 60, step: 1 })}
          ${settingCheckboxHtml('saveIncompleteStats', t('settings.duration.saveIncomplete'), o.saveIncompleteStats)}
        ` : ''}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.metronome.title')}</div>
        ${settingCheckboxHtml('metronome', t('exercise.metronomeChip'), o.metronome)}
        ${o.metronome ? `
          ${settingCheckboxHtml('metronomeAdaptive', t('settings.metronome.adaptive'), o.metronomeAdaptive)}
          ${!o.metronomeAdaptive ? settingNumberHtml('metronomeWpm', t('settings.metronome.target'), o.metronomeWpm, { min: 5, max: 100, step: 5, suffix: t('exercise.liveSpeed') }) : ''}
        ` : ''}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.endOfLesson.title')}</div>
        ${settingCheckboxHtml('showResults', t('settings.endOfLesson.showResults'), o.showResults)}
        ${o.showResults ? settingCheckboxHtml('showRecommendations', t('settings.endOfLesson.showRecommendations'), o.showRecommendations) : ''}
        ${settingRadioHtml('postLessonAction', o.postLessonAction, [
          { value: 'continue', label: t('settings.endOfLesson.continue') },
          { value: 'stats', label: t('settings.endOfLesson.stats') },
          { value: 'logout', label: t('settings.endOfLesson.logout') }
        ])}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.onClose.title')}</div>
        ${settingCheckboxHtml('saveStateOnClose', t('settings.onClose.resume'), o.saveStateOnClose)}
      </div>

      <div class="panel">
        <div class="panel-title">${t('settings.display.title')}</div>
        <div class="settings-grid">
          ${settingCheckboxHtml('showStatusBar', t('settings.display.statusBar'), o.showStatusBar)}
          ${settingCheckboxHtml('showTips', t('settings.display.tips'), o.showTips)}
          ${settingCheckboxHtml('showHighlight', t('settings.display.highlight'), o.showHighlight)}
          ${settingCheckboxHtml('showToolbar', t('settings.display.toolbar'), o.showToolbar)}
          ${settingCheckboxHtml('showLessonPicker', t('settings.display.lessonPicker'), o.showLessonPicker)}
          ${settingCheckboxHtml('showPause', t('settings.display.pause'), o.showPause)}
          ${settingCheckboxHtml('showRestart', t('settings.display.restart'), o.showRestart)}
        </div>
      </div>
    </div>`;

  root.querySelectorAll('input[type=checkbox][data-opt]').forEach(el => el.addEventListener('change', async () => {
    p.options[el.dataset.opt] = el.checked;
    await persist();
    renderSettings();
  }));
  root.querySelectorAll('input[type=number][data-opt]').forEach(el => el.addEventListener('change', async () => {
    const raw = el.value.trim();
    p.options[el.dataset.opt] = raw === '' ? null : Number(raw);
    await persist();
    renderSettings();
  }));
  root.querySelectorAll('[data-opt-radio]').forEach(group => {
    const key = group.dataset.optRadio;
    group.querySelectorAll('[data-opt-value]').forEach(btn => btn.addEventListener('click', async () => {
      const v = btn.dataset.optValue;
      p.options[key] = v === '__auto__' ? null : v;
      await persist();
      renderSettings();
    }));
  });
  const timeLimitToggle = root.querySelector('#timeLimitToggle');
  if (timeLimitToggle) timeLimitToggle.addEventListener('change', async (e) => {
    p.options.timeLimitMin = e.target.checked ? 5 : null;
    await persist();
    renderSettings();
  });
  root.querySelector('#keyTestToggle').addEventListener('click', () => {
    state.keyTestOn = !state.keyTestOn;
    renderSettings();
  });
  attachLangSwitcher();

  detachKeyTest();
  if (state.keyTestOn) attachKeyTest();
}

// ---------- Démarrage ----------
async function boot() {
  applyDocumentLang();
  state.layout = await detectLayout();
  state.profiles = await loadProfiles();
  const cur = getCurrentId();
  if (cur) state.profile = state.profiles.find(p => p.id === cur) || null;
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeunload', saveStateOnCloseBestEffort);
  if (state.profile) {
    const hadDefault = state.profile.paths.some(x => x.id === DEFAULT_PATH_ID);
    await ensureDefaultPath(state.profile);
    if (!hadDefault) await persist(); // migration silencieuse d'un profil créé avant l'unification
    const pending = state.profile.pendingExercise;
    navigate(pending && state.profile.options.saveStateOnClose ? '#/exercise' : '#/home');
  } else {
    navigate('#/gate');
  }
  render();
}

// Best-effort : capte l'intention de fermer la fenêtre pour figer la position en cours. Le
// checkpoint principal se fait déjà à chaque mot (checkpointPendingExercise) — ceci ne fait que
// rattraper les derniers caractères tapés depuis le dernier checkpoint.
function saveStateOnCloseBestEffort() {
  const p = state.profile, s = state.session;
  const activePath = p && (p.paths || []).find(x => x.id === p.activePathId);
  if (!p || !s || s.done || !p.options.saveStateOnClose || !activePath) return;
  p.pendingExercise = {
    activePathId: p.activePathId,
    exerciseIndex: activePath.progress.exerciseIndex,
    pos: s.pos,
    errors: s.errors
  };
  const idx = state.profiles.findIndex(x => x.id === p.id);
  if (idx >= 0) state.profiles[idx] = p;
  try { localStorage.setItem('keypop.profiles', JSON.stringify(state.profiles)); } catch (e) { /* ignore */ }
}

boot();
