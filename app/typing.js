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
  }

  get nextChar() { return this.text[this.pos]; }
  get done() { return this.pos >= this.text.length; }

  // Renvoie 'ok' | 'err' | 'ignore'.
  // Modèle DYS : on reste sur le caractère tant qu'il n'est pas juste.
  press(char) {
    if (this.done) return 'ignore';
    if (this.start == null) this.start = performance.now();
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

  // Résumé persistable pour l'historique / le bilan ergo.
  summary(meta = {}) {
    return {
      date: new Date().toISOString(),
      length: this.text.length,
      wpm: this.wpm,
      accuracy: this.accuracy,
      errors: this.errors,
      score: this.score,
      durationMs: Math.round(this.elapsedMs),
      ...meta
    };
  }
}
