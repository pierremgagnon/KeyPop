// typing.js — moteur de session de frappe, orienté précision (adapté DYS).

export class TypingSession {
  constructor(text) {
    this.text = Array.from(text);     // gère correctement les accents
    this.pos = 0;
    this.errors = 0;                  // erreurs totales (toutes tentatives)
    this.errorAt = {};                // { index: nbErreurs } pour le bilan
    this.states = this.text.map(() => 'pending'); // pending | ok | err
    this.start = null;
    this.end = null;
    this.keyTimes = [];               // horodatage de chaque frappe, pour le rythme moyen
  }

  get nextChar() { return this.text[this.pos]; }
  get done() { return this.pos >= this.text.length; }

  // Renvoie 'ok' | 'err' | 'ignore'.
  // Modèle DYS : on reste sur le caractère tant qu'il n'est pas juste.
  press(char) {
    if (this.done) return 'ignore';
    const now = performance.now();
    if (this.start == null) this.start = now;
    this.keyTimes.push({ time: now, pos: this.pos }); // pos = lettre visée par cette frappe
    const expected = this.text[this.pos];
    if (char === expected) {
      this.states[this.pos] = this.states[this.pos] === 'err' ? 'err' : 'ok';
      this.pos++;
      if (this.done) this.end = performance.now();
      return 'ok';
    }
    this.errors++;
    this.errorAt[this.pos] = (this.errorAt[this.pos] || 0) + 1;
    this.states[this.pos] = 'err';
    return 'err';
  }

  get elapsedMs() {
    if (this.start == null) return 0;
    return (this.end || performance.now()) - this.start;
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
