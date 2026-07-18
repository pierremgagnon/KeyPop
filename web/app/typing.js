// typing.js — moteur de session de frappe, orienté précision (adapté DYS).

export class TypingSession {
  constructor(text) {
    this.text = Array.from(text);     // gère correctement les accents
    this.pos = 0;
    this.errors = 0;                  // erreurs totales (toutes tentatives)
    this.errorAt = {};                // { index: nbErreurs } pour le bilan
    this.states = this.text.map(() => 'pending'); // pending | ok | slow | err
    this.start = null;
    this.end = null;
    this.keyTimes = [];               // horodatage de chaque frappe, pour le rythme moyen
    this.targetIntervalMs = null;     // métronome (fixe) : ms max entre 2 frappes pour rester "à temps" (null = désactivé)
    this.adaptiveMetronome = false;   // métronome (adaptatif) : compare au rythme propre de l'élève plutôt qu'à une cible fixe
    this.onErrorMode = 'block';       // 'block' (reste sur l'erreur) | 'ignore' (avance quand même) | 'correct' (comme block, retour arrière permis)
    this.pausedAt = null;
    this.pausedMs = 0;                // durée totale passée en pause, exclue du calcul du temps écoulé
  }

  get nextChar() { return this.text[this.pos]; }
  get done() { return this.pos >= this.text.length; }
  get paused() { return this.pausedAt != null; }

  pause() { if (this.pausedAt == null && this.start != null && !this.done) this.pausedAt = performance.now(); }
  resume() {
    if (this.pausedAt != null) {
      this.pausedMs += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  // Moyenne glissante des derniers intervalles (hors intervalle en cours de jugement) —
  // sert de cible de rythme quand le métronome est en mode adaptatif.
  _rollingIntervalMs(window = 8) {
    const kt = this.keyTimes;
    if (kt.length < 3) return null; // pas assez d'historique pour juger le rythme
    const start = Math.max(1, kt.length - 1 - window);
    let sum = 0, n = 0;
    for (let i = start; i < kt.length - 1; i++) { sum += kt[i].time - kt[i - 1].time; n++; }
    return n ? sum / n : null;
  }

  // Renvoie 'ok' | 'slow' | 'err' | 'ignore'.
  // Modèle DYS : par défaut on reste sur le caractère tant qu'il n'est pas juste
  // (onErrorMode = 'block'/'correct'). 'slow' = juste mais au-delà du temps imparti par le
  // métronome (n'efface jamais une erreur déjà enregistrée).
  press(char) {
    if (this.done) return 'ignore';
    const now = performance.now();
    if (this.start == null) this.start = now;
    const prevTime = this.keyTimes.length ? this.keyTimes[this.keyTimes.length - 1].time : null;
    this.keyTimes.push({ time: now, pos: this.pos }); // pos = lettre visée par cette frappe
    const expected = this.text[this.pos];
    if (char === expected) {
      if (this.states[this.pos] === 'err') {
        // déjà fautive plus tôt : le rythme n'a plus d'importance, l'état reste 'err'.
      } else {
        const target = this.adaptiveMetronome ? this._rollingIntervalMs() : this.targetIntervalMs;
        this.states[this.pos] = (target && prevTime != null && (now - prevTime) > target) ? 'slow' : 'ok';
      }
      const result = this.states[this.pos];
      this.pos++;
      if (this.done) this.end = performance.now();
      return result;
    }
    this.errors++;
    this.errorAt[this.pos] = (this.errorAt[this.pos] || 0) + 1;
    this.states[this.pos] = 'err';
    if (this.onErrorMode === 'ignore') {
      this.pos++;
      if (this.done) this.end = performance.now();
    }
    return 'err';
  }

  // Retour arrière : n'efface pas le compteur d'erreurs (le bilan reste honnête), juste la
  // position courante. Ne fait rien si désactivé côté appelant (onErrorMode/backspaceEnabled).
  backspace() {
    if (this.pos === 0) return false;
    this.pos--;
    this.states[this.pos] = 'pending';
    return true;
  }

  // Vérifie les buts du cours (voir Réglages > Buts du cours). Les pourcentages sont calculés
  // par rapport à la longueur du texte (proxy simple pour "% mots").
  goalsResult({ minWpm, maxErrorPct, maxSlowdownPct }) {
    const len = this.text.length || 1;
    const slowCount = this.states.filter(s => s === 'slow').length;
    const errorPct = Math.round((this.errors / len) * 100);
    const slowdownPct = Math.round((slowCount / len) * 100);
    const speedOk = this.wpm >= minWpm;
    const errorsOk = errorPct <= maxErrorPct;
    const slowdownOk = slowdownPct <= maxSlowdownPct;
    return { met: speedOk && errorsOk && slowdownOk, speedOk, errorsOk, slowdownOk, errorPct, slowdownPct };
  }

  get elapsedMs() {
    if (this.start == null) return 0;
    const end = this.end || (this.pausedAt || performance.now());
    return Math.max(0, end - this.start - this.pausedMs);
  }
  get elapsedMin() { return this.elapsedMs / 60000; }

  // Mots/min normalisés (1 mot = 5 frappes), convention dactylo.
  get wpm() {
    const m = this.elapsedMin;
    if (!m) return 0;
    return Math.max(0, Math.round((this.pos / 5) / m));
  }

  get accuracy() {
    const correct = this.pos;
    const total = correct + this.errors;
    return total ? Math.round((correct / total) * 100) : 100;
  }

  get score() {
    return Math.max(0, this.pos * 10 - this.errors * 2);
  }

  // Temps moyen entre deux frappes consécutives (rythme), en ms.
  get avgKeyIntervalMs() {
    if (this.keyTimes.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < this.keyTimes.length; i++) sum += this.keyTimes[i].time - this.keyTimes[i - 1].time;
    return Math.round(sum / (this.keyTimes.length - 1));
  }

  // Intervalle le plus court/long entre deux frappes consécutives.
  // pos/char désignent la lettre visée par la frappe qui clôt l'intervalle
  // (utile pour repérer la lettre la plus rapide/lente à atteindre).
  _extremeKeyInterval(isBetter) {
    if (this.keyTimes.length < 2) return null;
    let best = null;
    for (let i = 1; i < this.keyTimes.length; i++) {
      const ms = this.keyTimes[i].time - this.keyTimes[i - 1].time;
      if (best === null || isBetter(ms, best.ms)) {
        const pos = this.keyTimes[i].pos;
        best = { ms: Math.round(ms), pos, char: this.text[pos] };
      }
    }
    return best;
  }
  get fastestKeyInterval() { return this._extremeKeyInterval((a, b) => a < b); }
  get slowestKeyInterval() { return this._extremeKeyInterval((a, b) => a > b); }

  // Résumé persistable pour l'historique / le bilan ergo.
  summary(meta = {}) {
    const fastest = this.fastestKeyInterval;
    const slowest = this.slowestKeyInterval;
    return {
      date: new Date().toISOString(),
      length: this.text.length,
      wpm: this.wpm,
      accuracy: this.accuracy,
      errors: this.errors,
      score: this.score,
      avgKeyIntervalMs: this.avgKeyIntervalMs,
      fastestKeyIntervalMs: fastest ? fastest.ms : null,
      fastestKeyPos: fastest ? fastest.pos : null,
      fastestKeyChar: fastest ? fastest.char : null,
      slowestKeyIntervalMs: slowest ? slowest.ms : null,
      slowestKeyPos: slowest ? slowest.pos : null,
      slowestKeyChar: slowest ? slowest.char : null,
      durationMs: Math.round(this.elapsedMs),
      ...meta
    };
  }
}
