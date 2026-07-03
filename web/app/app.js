// app.js — bootstrap, routage, rendu des écrans. Frontend partagé web/desktop.

import { ROWS, FINGER_COLORS, FINGER_LABELS, keyInfoForChar, detectLayout } from './keyboards.js';
import { TypingSession } from './typing.js';
import { LEVELS, lessonText, nextPosition } from './lessons.js';
import {
  loadProfiles, saveProfiles, newProfile,
  getCurrentId, setCurrentId, exportReport,
  getNarratorGlobal, setNarratorGlobal,
  loadPractitionerPaths, savePractitionerPaths,
  loadCatalogueCache, saveCatalogueCache
} from './storage.js';
import {
  emptyPath, addExercise, updateExercise, removeExercise, moveExercise,
  exportPathBlob, validatePathJson, loadBundledCatalogue, fetchRemoteCatalogue,
  mergeCatalogue, importPathIntoProfile
} from './paths.js';

const root = document.getElementById('app');

const state = {
  profiles: [],
  profile: null,
  layout: { family: 'azerty', os: 'pc' },
  session: null,
  keyHandler: null,
  exerciseNarratorOn: null, // null = mode standard (suit p.options.audio), sinon bool imposé par l'exercice du chemin
  editingPathId: null       // chemin en cours d'édition dans l'espace praticien
};

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initials = (n) => (n || '?').trim().charAt(0).toUpperCase() || '?';

function applyTheme() {
  document.body.dataset.theme = (state.profile && state.profile.theme) || 'day';
}

async function persist() {
  const i = state.profiles.findIndex(p => p.id === state.profile.id);
  if (i >= 0) state.profiles[i] = state.profile;
  await saveProfiles(state.profiles);
}

function detachKeys() {
  if (state.keyHandler) { document.removeEventListener('keydown', state.keyHandler); state.keyHandler = null; }
}

// ---------- Routage ----------
function navigate(hash) { if (location.hash !== hash) location.hash = hash; else render(); }

function render() {
  detachKeys();
  const h = location.hash || '#/gate';
  if (h.startsWith('#/practitioner')) return renderPractitioner();
  if (!state.profile && h !== '#/gate') return navigate('#/gate');
  if (h.startsWith('#/home')) return renderHome();
  if (h.startsWith('#/exercise')) return renderExercise();
  if (h.startsWith('#/stats')) return renderStats();
  if (h.startsWith('#/catalogue')) return renderCatalogue();
  return renderGate();
}

// ---------- Écran : choix du profil ----------
function renderGate() {
  applyThemeDefault();
  const narratorOn = getNarratorGlobal();
  const cards = state.profiles.map(p => `
    <button class="profile-card" data-id="${p.id}">
      <span class="avatar">${esc(initials(p.name))}</span>
      <span class="profile-name">${esc(p.name)}</span>
      <span class="profile-sub">${esc(p.classe || 'élève')}</span>
    </button>`).join('');

  root.innerHTML = `
    <div class="screen gate">
      <div class="gate-top">
        <div class="brand"><span class="logo">K</span> KeyPop</div>
        <button class="ghost" id="narratorGlobalBtn">${narratorOn ? '🔊 Narrateur activé' : '🔇 Narrateur désactivé'}</button>
      </div>
      <h1>Qui apprend aujourd'hui&nbsp;?</h1>
      <p class="muted">Choisis ton profil — il reste sur cet ordinateur.</p>
      <div class="profile-grid">
        ${cards}
        <button class="profile-card add" id="addProfile"><span class="plus">+</span><span class="profile-name">Nouveau profil</span></button>
      </div>
      <a class="muted small practitioner-link" href="#/practitioner">Espace ergothérapeute</a>
    </div>`;

  root.querySelectorAll('.profile-card[data-id]').forEach(b =>
    b.addEventListener('click', () => selectProfile(b.dataset.id)));
  root.querySelector('#addProfile').addEventListener('click', createProfileFlow);
  root.querySelector('#narratorGlobalBtn').addEventListener('click', () => {
    setNarratorGlobal(!narratorOn);
    renderGate();
  });
}

function applyThemeDefault() { if (!state.profile) document.body.dataset.theme = 'day'; }

function createProfileFlow() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Nouveau profil</h2>
      <label class="modal-label">Prénom de l'élève
        <input id="mName" class="modal-input" type="text" placeholder="ex. : Léa" autocomplete="off">
      </label>
      <label class="modal-label">Classe <span class="muted">(facultatif)</span>
        <input id="mClasse" class="modal-input" type="text" placeholder="ex. : CE2">
      </label>
      <div class="modal-actions">
        <button class="primary" id="mOk">Créer le profil</button>
        <button class="ghost" id="mCancel">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector('#mName');
  const classeInput = overlay.querySelector('#mClasse');
  nameInput.focus();

  function close() { document.body.removeChild(overlay); }

  async function confirm() {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const classe = classeInput.value.trim();
    close();
    const p = newProfile(name, classe);
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
  a.download = `${path.id}.json`;
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
      <h2>Nouveau chemin</h2>
      <label class="modal-label">Titre
        <input id="pTitle" class="modal-input" type="text" placeholder="ex. : Les animaux de la ferme" autocomplete="off">
      </label>
      <label class="modal-label">Description <span class="muted">(facultatif)</span>
        <input id="pDesc" class="modal-input" type="text" placeholder="ex. : vocabulaire simple">
      </label>
      <div class="modal-actions">
        <button class="primary" id="pOk">Créer le chemin</button>
        <button class="ghost" id="pCancel">Annuler</button>
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
  const drafts = loadPractitionerPaths();

  if (state.editingPathId) {
    const path = drafts.find(pp => pp.id === state.editingPathId);
    if (path) return renderPathEditor(path, drafts);
    state.editingPathId = null;
  }

  root.innerHTML = `
    <div class="screen practitioner">
      <header class="topbar">
        <a class="brand" href="#/gate"><span class="logo">K</span> KeyPop</a>
        <a class="ghost" href="#/gate">← Écran titre</a>
      </header>
      <h1>Espace ergothérapeute</h1>
      <p class="muted">Crée des chemins d'exercices, exporte-les en JSON pour tes élèves.</p>

      <div class="profile-grid" style="justify-content:flex-start">
        ${drafts.map(p => `
          <div class="stat path-card">
            <div class="resume-title">${esc(p.title)}</div>
            <div class="muted">${p.exercises.length} exercice(s) · v${p.version}</div>
            <div class="path-card-actions">
              <button class="ghost" data-edit="${esc(p.id)}">Modifier</button>
              <button class="ghost" data-export="${esc(p.id)}">Exporter JSON</button>
              <button class="ghost" data-delete="${esc(p.id)}">Supprimer</button>
            </div>
          </div>`).join('') || '<p class="muted">Aucun chemin pour l’instant.</p>'}
      </div>

      <button class="primary" id="newPathBtn">+ Nouveau chemin</button>
    </div>`;

  root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    state.editingPathId = b.dataset.edit; renderPractitioner();
  }));
  root.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    const path = drafts.find(pp => pp.id === b.dataset.export);
    if (path) downloadPath(path);
  }));
  root.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Supprimer ce chemin ? Cette action est irréversible.')) return;
    savePractitionerPaths(drafts.filter(pp => pp.id !== b.dataset.delete));
    renderPractitioner();
  }));
  root.querySelector('#newPathBtn').addEventListener('click', () => newPathFlow(drafts));
}

function renderPathEditor(path, drafts) {
  applyThemeDefault();

  root.innerHTML = `
    <div class="screen practitioner">
      <header class="topbar">
        <a class="ghost" id="backList" href="#">← Mes chemins</a>
        <button class="ghost" id="exportBtn">Exporter JSON</button>
      </header>

      <label class="modal-label">Titre
        <input id="eTitle" class="modal-input" type="text" value="${esc(path.title)}">
      </label>
      <label class="modal-label">Description <span class="muted">(facultatif)</span>
        <input id="eDesc" class="modal-input" type="text" value="${esc(path.description || '')}">
      </label>

      <div class="path-editor">
        ${path.exercises.map((ex, i) => `
          <div class="exercise-row">
            <span class="ex-index">${i + 1}</span>
            <textarea class="modal-input ex-text" data-idx="${i}" rows="2">${esc(ex.text)}</textarea>
            <button class="chip ${ex.narrator ? 'on' : ''}" data-narrator="${i}">${ex.narrator ? '🔊 Narrateur' : '🔇 Narrateur'}</button>
            <button class="round" data-up="${i}" title="Monter">↑</button>
            <button class="round" data-down="${i}" title="Descendre">↓</button>
            <button class="round" data-remove="${i}" title="Supprimer">✕</button>
          </div>`).join('') || '<p class="muted">Aucun exercice pour l’instant — ajoutes-en un ci-dessous.</p>'}
      </div>

      <div class="add-exercise">
        <textarea id="newExText" class="modal-input" rows="2" placeholder="Texte de l'exercice…"></textarea>
        <button class="chip on" id="newExNarrator">🔊 Narrateur</button>
        <button class="primary" id="addExBtn">+ Ajouter l'exercice</button>
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

  root.querySelectorAll('.ex-text').forEach(t => t.addEventListener('change', (e) => {
    updateExercise(path, +e.target.dataset.idx, { text: e.target.value });
    persistEditor();
  }));
  root.querySelectorAll('[data-narrator]').forEach(b => b.addEventListener('click', (e) => {
    const i = +e.target.dataset.narrator;
    updateExercise(path, i, { narrator: !path.exercises[i].narrator });
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

  let newNarrator = true;
  root.querySelector('#newExNarrator').addEventListener('click', (e) => {
    newNarrator = !newNarrator;
    e.target.classList.toggle('on', newNarrator);
    e.target.textContent = newNarrator ? '🔊 Narrateur' : '🔇 Narrateur';
  });
  root.querySelector('#addExBtn').addEventListener('click', () => {
    const ta = root.querySelector('#newExText');
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    addExercise(path, text, newNarrator);
    persistEditor();
    renderPathEditor(path, drafts);
  });
}

function selectProfile(id) {
  state.profile = state.profiles.find(p => p.id === id) || null;
  if (!state.profile) return;
  setCurrentId(id);
  applyTheme();
  navigate('#/home');
}

// ---------- Écran : accueil ----------
function renderHome() {
  applyTheme();
  const p = state.profile;
  const { levelIndex, lessonIndex } = p.progress;
  const lvl = LEVELS[levelIndex];
  const last = p.history[p.history.length - 1];
  const totalScore = p.history.reduce((s, h) => s + (h.score || 0), 0);

  root.innerHTML = `
    <div class="screen home">
      <header class="topbar">
        <div class="brand"><span class="logo">K</span> KeyPop</div>
        <div class="topbar-right">
          <span class="pill score">${totalScore} pts</span>
          <button class="ghost" id="themeBtn">${p.theme === 'night' ? '☾ nuit' : '☀ jour'}</button>
          <button class="ghost" id="switchBtn">changer de profil</button>
          <span class="avatar">${esc(initials(p.name))}</span>
        </div>
      </header>

      <h1>Salut, ${esc(p.name)}&nbsp;!</h1>
      <p class="muted">Prêt pour quelques minutes&nbsp;? On reprend en douceur.</p>

      <div class="resume-card">
        <div>
          <div class="kicker">Niveau ${levelIndex + 1}</div>
          <div class="resume-title">${esc(lvl.title)}</div>
          <div class="muted">Leçon ${lessonIndex + 1} sur ${lvl.lessons.length} · ${esc(lvl.hint)}</div>
        </div>
        <button class="primary" id="startBtn">Continuer →</button>
      </div>

      <div class="stat-row">
        <div class="stat"><div class="muted">Précision</div><div class="big">${last ? last.accuracy : '—'}<small>%</small></div></div>
        <div class="stat"><div class="muted">Vitesse</div><div class="big">${last ? last.wpm : '—'}<small> m/min</small></div></div>
        <div class="stat"><div class="muted">Séances</div><div class="big">${p.history.length}</div></div>
        <a class="stat link" href="#/stats"><div class="muted">Voir</div><div class="big">Stats →</div></a>
      </div>

      <div class="path">
        ${LEVELS.map((l, i) => `
          <div class="node ${i < levelIndex ? 'done' : i === levelIndex ? 'current' : 'locked'}">
            <span class="dot">${i < levelIndex ? '✓' : (i + 1)}</span>
            <span class="node-label">${esc(l.title.replace('La rangée ', '').replace('Les ', ''))}</span>
          </div>`).join('')}
      </div>

      ${(p.paths && p.paths.length) ? `
        <div class="panel">
          <div class="panel-title">Mes chemins</div>
          <div class="profile-grid" style="justify-content:flex-start">
            ${p.paths.map(cp => `
              <div class="stat path-card">
                <div class="resume-title">${esc(cp.title)}</div>
                <div class="muted">${Math.min(cp.progress.exerciseIndex, cp.exercises.length)}/${cp.exercises.length} exercices</div>
                <button class="primary" data-start-path="${esc(cp.id)}">${p.activePathId === cp.id ? 'Continuer →' : 'Choisir ce chemin →'}</button>
              </div>`).join('')}
          </div>
          ${p.activePathId ? `<button class="ghost" id="backToStandard">← Revenir à la progression standard</button>` : ''}
        </div>` : ''}

      <div class="path-import">
        <button class="ghost" id="importJsonBtn">Importer un chemin (JSON)</button>
        <a class="ghost" href="#/catalogue">Parcourir le catalogue</a>
        <input type="file" id="importFileInput" accept="application/json,.json" style="display:none">
      </div>
    </div>`;

  root.querySelector('#startBtn').addEventListener('click', () => navigate('#/exercise'));
  root.querySelector('#switchBtn').addEventListener('click', () => { state.profile = null; navigate('#/gate'); });
  root.querySelector('#themeBtn').addEventListener('click', async () => {
    p.theme = p.theme === 'night' ? 'day' : 'night'; applyTheme(); await persist(); renderHome();
  });

  root.querySelectorAll('[data-start-path]').forEach(b => b.addEventListener('click', async () => {
    p.activePathId = b.dataset.startPath;
    await persist();
    navigate('#/exercise');
  }));
  const backBtn = root.querySelector('#backToStandard');
  if (backBtn) backBtn.addEventListener('click', async () => { p.activePathId = null; await persist(); renderHome(); });

  root.querySelector('#importJsonBtn').addEventListener('click', () => root.querySelector('#importFileInput').click());
  root.querySelector('#importFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const path = validatePathJson(raw);
      importPathIntoProfile(p, path, { source: 'json' });
      await persist();
      renderHome();
    } catch (err) {
      alert('Import impossible : ' + err.message);
    }
  });
}

// ---------- Écran : exercice (fonctionnel) ----------
function renderExercise() {
  applyTheme();
  const p = state.profile;
  const activePath = p.activePathId ? (p.paths || []).find(x => x.id === p.activePathId) : null;
  if (activePath && activePath.progress.exerciseIndex >= activePath.exercises.length) {
    return navigate('#/home');
  }
  const { levelIndex, lessonIndex } = p.progress;
  const lvl = LEVELS[levelIndex];
  const currentEx = activePath ? activePath.exercises[activePath.progress.exerciseIndex] : null;
  const text = activePath ? currentEx.text : lessonText(levelIndex, lessonIndex);
  state.session = new TypingSession(text);
  state.exerciseNarratorOn = activePath ? currentEx.narrator !== false : null;

  const headTitle = activePath ? esc(activePath.title) : esc(lvl.title);
  const headSub = activePath
    ? `Exercice ${activePath.progress.exerciseIndex + 1} / ${activePath.exercises.length}`
    : `Leçon ${lessonIndex + 1} / ${lvl.lessons.length}`;
  const audioChipHtml = activePath
    ? `<span class="chip static">${currentEx.narrator !== false ? '🔊 Narrateur activé pour cet exercice' : '🔇 Narrateur désactivé pour cet exercice'}</span>`
    : `<button class="chip ${p.options.audio ? 'on' : ''}" id="audioChip">Dictée audio</button>`;

  root.innerHTML = `
    <div class="screen exercise">
      <header class="ex-head">
        <a class="round" href="#/home">✕</a>
        <div>
          <div class="ex-title">${headTitle}</div>
          <div class="muted">${headSub}</div>
        </div>
        <div class="ex-live">
          <span id="liveAcc" class="mono">100%</span><span class="muted"> précision</span>
          <span id="liveWpm" class="mono">0</span><span class="muted"> m/min</span>
          <span id="liveScore" class="mono">0</span><span class="muted"> pts</span>
        </div>
      </header>

      <div class="type-card">
        <div class="muted small">Tape le texte&nbsp;:</div>
        <div class="type-text" id="typeText"></div>
      </div>

      <div class="chips">
        ${audioChipHtml}
        <button class="chip ${p.options.openDyslexic ? 'on' : ''}" id="odChip">Police OpenDyslexic</button>
        <span class="chip static">Clavier : ${state.layout.family.toUpperCase()} · ${state.layout.os.toUpperCase()}</span>
        <span class="chip static">Disposition : ${esc(p.options.size)} %</span>
      </div>

      <div class="keyboard" id="keyboard"></div>
      <div class="ex-foot muted" id="exFoot">Garde les index sur F et J — repère-toi au toucher.</div>
    </div>`;

  document.body.classList.toggle('od-font', !!p.options.openDyslexic);
  renderTypeText();
  renderKeyboard();
  speakNextWordMaybe();

  const audioChip = root.querySelector('#audioChip');
  if (audioChip) audioChip.addEventListener('click', async (e) => {
    p.options.audio = !p.options.audio; e.target.classList.toggle('on', p.options.audio); await persist();
    if (p.options.audio) speakNextWordMaybe();
  });
  root.querySelector('#odChip').addEventListener('click', async (e) => {
    p.options.openDyslexic = !p.options.openDyslexic;
    e.target.classList.toggle('on', p.options.openDyslexic);
    document.body.classList.toggle('od-font', p.options.openDyslexic);
    await persist();
  });

  state.keyHandler = (e) => onExerciseKey(e);
  document.addEventListener('keydown', state.keyHandler);
}

function renderTypeText() {
  const s = state.session;
  const el = root.querySelector('#typeText');
  if (!el) return;
  let html = '';
  s.text.forEach((ch, i) => {
    const disp = ch === ' ' ? '&nbsp;' : esc(ch);
    if (i < s.pos) html += `<span class="done ${s.states[i] === 'err' ? 'was-err' : ''}">${disp}</span>`;
    else if (i === s.pos) html += `<span class="cur">${disp}</span>`;
    else html += `<span class="todo">${disp}</span>`;
  });
  html += '<span class="caret"></span>';
  el.innerHTML = html;
}

function renderKeyboard() {
  const kb = root.querySelector('#keyboard');
  if (!kb) return;
  const next = state.session.nextChar;
  const nextKeyInfo = keyInfoForChar(next);
  let html = '';
  ROWS.forEach((row, ri) => {
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
  if (!s || s.done) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  let ch = e.key;
  if (ch === 'Spacebar') ch = ' ';
  if (ch.length !== 1 && ch !== ' ') return; // ignore touches non imprimables
  e.preventDefault();

  const res = s.press(ch);
  renderTypeText();
  renderKeyboard();
  updateLive();

  const foot = root.querySelector('#exFoot');
  if (res === 'err' && foot) { foot.textContent = 'Presque — réessaie la touche surlignée.'; foot.classList.add('warn'); }
  else if (foot) { foot.classList.remove('warn'); }

  if (s.done) finishExercise();
  else if (ch === ' ') speakNextWordMaybe();
}

function speakNextWordMaybe() {
  const p = state.profile, s = state.session;
  if (!getNarratorGlobal() || !('speechSynthesis' in window) || !s) return;
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

const dispChar = (ch) => ch === ' ' ? 'espace' : esc(ch);

function showResultCard(s, { title, actionsHtml }) {
  const card = root.querySelector('.type-card');
  if (!card) return;
  const fastest = s.fastestKeyInterval;
  const slowest = s.slowestKeyInterval;

  card.insertAdjacentHTML('afterend', `
    <div class="result">
      <div class="result-title">${title}</div>
      <div class="result-stats">
        <span><b>${s.accuracy}%</b> précision</span>
        <span><b>${s.wpm}</b> mots/min</span>
        <span><b>${s.avgKeyIntervalMs}</b> ms entre 2 frappes</span>
        <span><b>+${s.score}</b> pts</span>
        ${fastest ? `<span class="key-stat fastest"><span class="key-dot"></span><b>${fastest.ms} ms</b> plus rapide (« ${dispChar(fastest.char)} »)</span>` : ''}
        ${slowest ? `<span class="key-stat slowest"><span class="key-dot"></span><b>${slowest.ms} ms</b> plus lente (« ${dispChar(slowest.char)} »)</span>` : ''}
      </div>
      <div class="result-actions">${actionsHtml}</div>
    </div>`);

  const letters = root.querySelectorAll('#typeText > span:not(.caret)');
  if (fastest && letters[fastest.pos]) letters[fastest.pos].classList.add('key-highlight-fastest');
  if (slowest && letters[slowest.pos]) letters[slowest.pos].classList.add('key-highlight-slowest');
}

async function finishExercise() {
  detachKeys();
  const s = state.session, p = state.profile;
  const activePath = p.activePathId ? (p.paths || []).find(x => x.id === p.activePathId) : null;

  if (activePath) {
    p.history.push(s.summary({ path: activePath.id, exerciseIndex: activePath.progress.exerciseIndex }));
    activePath.progress.exerciseIndex++;
    await persist();

    const finished = activePath.progress.exerciseIndex >= activePath.exercises.length;
    showResultCard(s, {
      title: finished ? 'Chemin terminé 🎉' : 'Bien joué !',
      actionsHtml: finished
        ? `<a class="primary" href="#/home">Retour aux chemins</a>`
        : `<button class="primary" id="nextBtn">Exercice suivant →</button><a class="ghost" href="#/home">Accueil</a>`
    });
    const nb = root.querySelector('#nextBtn');
    if (nb) nb.addEventListener('click', () => navigate('#/exercise'));
    return;
  }

  p.history.push(s.summary({ level: LEVELS[p.progress.levelIndex].id, lessonIndex: p.progress.lessonIndex }));
  p.progress = nextPosition(p.progress.levelIndex, p.progress.lessonIndex);
  await persist();

  showResultCard(s, {
    title: 'Bien joué&nbsp;!',
    actionsHtml: `<button class="primary" id="nextBtn">Leçon suivante →</button><a class="ghost" href="#/home">Accueil</a>`
  });
  const nb = root.querySelector('#nextBtn');
  if (nb) nb.addEventListener('click', () => navigate('#/exercise'));
}

// ---------- Écran : statistiques ----------
function renderStats() {
  applyTheme();
  const p = state.profile;
  const hist = p.history.slice(-14);
  const avg = (k) => hist.length ? Math.round(hist.reduce((s, h) => s + (h[k] || 0), 0) / hist.length) : 0;
  const maxWpm = Math.max(1, ...hist.map(h => h.wpm || 0));

  root.innerHTML = `
    <div class="screen stats">
      <header class="topbar">
        <a class="brand" href="#/home"><span class="logo">K</span> KeyPop</a>
        <div class="topbar-right">
          <button class="ghost" id="pdfBtn">Exporter le bilan PDF</button>
          <span class="avatar">${esc(initials(p.name))}</span>
        </div>
      </header>
      <h1>Statistiques — ${esc(p.name)}</h1>
      <p class="muted">${esc(p.classe || 'élève')} · ${p.history.length} séance(s)</p>

      <div class="stat-row">
        <div class="stat"><div class="muted">Précision moy.</div><div class="big">${avg('accuracy')}<small>%</small></div></div>
        <div class="stat"><div class="muted">Vitesse moy.</div><div class="big">${avg('wpm')}<small> m/min</small></div></div>
        <div class="stat"><div class="muted">Score total</div><div class="big">${p.history.reduce((s, h) => s + (h.score || 0), 0)}</div></div>
      </div>

      <div class="panel">
        <div class="panel-title">Progression — mots/min</div>
        <div class="chart">
          ${hist.length ? hist.map(h => `<div class="bar" style="height:${Math.max(6, Math.round((h.wpm / maxWpm) * 100))}%"></div>`).join('')
            : '<div class="muted">Aucune séance pour l\u2019instant — fais une leçon&nbsp;!</div>'}
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Historique</div>
        ${p.history.slice().reverse().slice(0, 8).map(h => `
          <div class="hist-row">
            <span>${new Date(h.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span class="mono">${h.wpm} m/min</span>
            <span class="mono">${h.accuracy}%</span>
            <span class="mono">+${h.score}</span>
          </div>`).join('') || '<div class="muted">—</div>'}
      </div>
      <a class="ghost back" href="#/home">← Accueil</a>
    </div>`;

  root.querySelector('#pdfBtn').addEventListener('click', () => exportReport(p.id).catch(() => {}));
}

// ---------- Écran : catalogue de chemins ----------
async function renderCatalogue() {
  applyTheme();

  root.innerHTML = `
    <div class="screen catalogue">
      <header class="topbar">
        <a class="brand" href="#/home"><span class="logo">K</span> KeyPop</a>
        <button class="ghost" id="refreshBtn">🔄 Rechercher des mises à jour</button>
      </header>
      <h1>Catalogue de chemins</h1>
      <p class="muted" id="catalogueStatus">Chargement…</p>
      <div class="profile-grid" id="catalogueList" style="justify-content:flex-start"></div>
      <a class="ghost back" href="#/home">← Accueil</a>
    </div>`;

  root.querySelector('#refreshBtn').addEventListener('click', () => updateCatalogue());
  await paintCatalogue();
}

async function paintCatalogue() {
  const p = state.profile;
  const status = root.querySelector('#catalogueStatus');
  let bundled = [];
  try { bundled = await loadBundledCatalogue(); } catch (e) { console.warn('catalogue bundled', e); }
  const catalogue = mergeCatalogue(bundled, loadCatalogueCache());
  if (status) status.textContent = `${catalogue.length} chemin(s) disponible(s).`;

  const list = root.querySelector('#catalogueList');
  if (!list) return;
  list.innerHTML = catalogue.map(c => {
    const owned = (p.paths || []).find(x => x.id === c.id);
    const isNewer = owned && (c.version || 1) > (owned.version || 1);
    let btnLabel = 'Importer';
    if (owned && !isNewer) btnLabel = 'Déjà importé ✓';
    else if (isNewer) btnLabel = `Mettre à jour (v${c.version})`;
    return `
      <div class="stat path-card catalogue-card">
        <div class="resume-title">${esc(c.title)}</div>
        <div class="muted small">${esc(c.description || '')}</div>
        <div class="muted">${c.exercises.length} exercice(s)</div>
        <button class="${owned && !isNewer ? 'ghost' : 'primary'}" data-import="${esc(c.id)}" ${owned && !isNewer ? 'disabled' : ''}>${btnLabel}</button>
      </div>`;
  }).join('') || '<p class="muted">Aucun chemin dans le catalogue.</p>';

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
    const keepProgress = confirm(
      `Une nouvelle version de « ${path.title} » est disponible.\n\nOK = garder ma progression actuelle\nAnnuler = recommencer ce chemin à zéro`
    );
    resetProgress = !keepProgress;
  }
  importPathIntoProfile(p, path, { source: 'catalogue', resetProgress });
  await persist();
  await paintCatalogue();
}

async function updateCatalogue() {
  const status = root.querySelector('#catalogueStatus');
  if (status) status.textContent = 'Recherche de mises à jour…';
  try {
    const remote = await fetchRemoteCatalogue();
    let bundled = [];
    try { bundled = await loadBundledCatalogue(); } catch (e) { /* ignore */ }
    saveCatalogueCache(mergeCatalogue(bundled, loadCatalogueCache(), remote));
  } catch (e) {
    console.warn('updateCatalogue', e);
    if (status) status.textContent = 'Impossible de contacter GitHub — réessaie plus tard.';
    return;
  }
  await paintCatalogue();
}

// ---------- Démarrage ----------
async function boot() {
  state.layout = await detectLayout();
  state.profiles = await loadProfiles();
  const cur = getCurrentId();
  if (cur) state.profile = state.profiles.find(p => p.id === cur) || null;
  window.addEventListener('hashchange', render);
  if (state.profile) navigate('#/home'); else navigate('#/gate');
  render();
}

boot();
