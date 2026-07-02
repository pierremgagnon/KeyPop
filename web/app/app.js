// app.js — bootstrap, routage, rendu des écrans. Frontend partagé web/desktop.

import { ROWS, FINGER_COLORS, FINGER_LABELS, keyInfoForChar, detectLayout } from './keyboards.js';
import { TypingSession } from './typing.js';
import { LEVELS, lessonText, nextPosition } from './lessons.js';
import {
  loadProfiles, saveProfiles, newProfile,
  getCurrentId, setCurrentId, exportReport
} from './storage.js';

const root = document.getElementById('app');

const state = {
  profiles: [],
  profile: null,
  layout: { family: 'azerty', os: 'pc' },
  session: null,
  keyHandler: null
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
  if (!state.profile && h !== '#/gate') return navigate('#/gate');
  if (h.startsWith('#/home')) return renderHome();
  if (h.startsWith('#/exercise')) return renderExercise();
  if (h.startsWith('#/stats')) return renderStats();
  return renderGate();
}

// ---------- Écran : choix du profil ----------
function renderGate() {
  applyThemeDefault();
  const cards = state.profiles.map(p => `
    <button class="profile-card" data-id="${p.id}">
      <span class="avatar">${esc(initials(p.name))}</span>
      <span class="profile-name">${esc(p.name)}</span>
      <span class="profile-sub">${esc(p.classe || 'élève')}</span>
    </button>`).join('');

  root.innerHTML = `
    <div class="screen gate">
      <div class="brand"><span class="logo">K</span> KeyPop</div>
      <h1>Qui apprend aujourd'hui&nbsp;?</h1>
      <p class="muted">Choisis ton profil — il reste sur cet ordinateur.</p>
      <div class="profile-grid">
        ${cards}
        <button class="profile-card add" id="addProfile"><span class="plus">+</span><span class="profile-name">Nouveau profil</span></button>
      </div>
    </div>`;

  root.querySelectorAll('.profile-card[data-id]').forEach(b =>
    b.addEventListener('click', () => selectProfile(b.dataset.id)));
  root.querySelector('#addProfile').addEventListener('click', createProfileFlow);
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
    </div>`;

  root.querySelector('#startBtn').addEventListener('click', () => navigate('#/exercise'));
  root.querySelector('#switchBtn').addEventListener('click', () => { state.profile = null; navigate('#/gate'); });
  root.querySelector('#themeBtn').addEventListener('click', async () => {
    p.theme = p.theme === 'night' ? 'day' : 'night'; applyTheme(); await persist(); renderHome();
  });
}

// ---------- Écran : exercice (fonctionnel) ----------
function renderExercise() {
  applyTheme();
  const p = state.profile;
  const { levelIndex, lessonIndex } = p.progress;
  const lvl = LEVELS[levelIndex];
  const text = lessonText(levelIndex, lessonIndex);
  state.session = new TypingSession(text);

  root.innerHTML = `
    <div class="screen exercise">
      <header class="ex-head">
        <a class="round" href="#/home">✕</a>
        <div>
          <div class="ex-title">${esc(lvl.title)}</div>
          <div class="muted">Leçon ${lessonIndex + 1} / ${lvl.lessons.length}</div>
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
        <button class="chip ${p.options.audio ? 'on' : ''}" id="audioChip">Dictée audio</button>
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

  root.querySelector('#audioChip').addEventListener('click', async (e) => {
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
  if (!p.options.audio || !('speechSynthesis' in window) || !s) return;
  const rest = s.text.slice(s.pos).join('');
  const word = rest.split(' ')[0];
  if (!word) return;
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'fr-FR'; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

async function finishExercise() {
  detachKeys();
  const s = state.session, p = state.profile;
  p.history.push(s.summary({ level: LEVELS[p.progress.levelIndex].id, lessonIndex: p.progress.lessonIndex }));
  p.progress = nextPosition(p.progress.levelIndex, p.progress.lessonIndex);
  await persist();

  const card = root.querySelector('.type-card');
  if (card) {
    card.insertAdjacentHTML('afterend', `
      <div class="result">
        <div class="result-title">Bien joué&nbsp;!</div>
        <div class="result-stats">
          <span><b>${s.accuracy}%</b> précision</span>
          <span><b>${s.wpm}</b> mots/min</span>
          <span><b>+${s.score}</b> pts</span>
        </div>
        <div class="result-actions">
          <button class="primary" id="nextBtn">Leçon suivante →</button>
          <a class="ghost" href="#/home">Accueil</a>
        </div>
      </div>`);
    const nb = root.querySelector('#nextBtn');
    if (nb) nb.addEventListener('click', () => navigate('#/exercise'));
  }
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
