// Procedural 3310 ceramic piezo buzzer synthesizer (Web Audio API)

export class PiezoSynth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.bandpass = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  unlock() {
    if (typeof window === 'undefined') return;
    if (
      !this.ctx &&
      typeof navigator !== 'undefined' &&
      navigator.userActivation &&
      !navigator.userActivation.isActive &&
      !navigator.userActivation.hasBeenActive
    ) {
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      // Slight bandpass resonance gives classic 3310 ceramic piezo timbre
      this.bandpass = this.ctx.createBiquadFilter();
      this.bandpass.type = 'bandpass';
      this.bandpass.frequency.value = 2350;
      this.bandpass.Q.value = 0.85;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.14;

      this.bandpass.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _tone(freq, startOffset, duration, gainPeak = 0.85) {
    if (!this.enabled) return;
    if (!this.ctx || !this.bandpass || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const attackEnd = Math.min(duration * 0.4, 0.004);
    const sustainEnd = Math.max(attackEnd, duration - 0.008);

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gainPeak, now + attackEnd);
    env.gain.setValueAtTime(gainPeak, now + sustainEnd);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env);
    env.connect(this.bandpass);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playKeyClick() {
    this._tone(1680, 0, 0.022, 0.35);
  }

  playNav() {
    this._tone(1320, 0, 0.032, 0.45);
  }

  playSelect() {
    this._tone(1568, 0, 0.04, 0.5);
    this._tone(2093, 0.045, 0.055, 0.55);
  }

  playBack() {
    this._tone(1318, 0, 0.04, 0.45);
    this._tone(988, 0.042, 0.055, 0.45);
  }

  playStart() {
    // Short cheerful retro game start motif
    this._tone(1318.5, 0.0, 0.055, 0.6);
    this._tone(1568.0, 0.06, 0.055, 0.6);
    this._tone(2093.0, 0.12, 0.095, 0.7);
  }

  playEat() {
    // Classic Snake quick upward two-chirp blip
    this._tone(1480, 0.0, 0.038, 0.65);
    this._tone(2217, 0.04, 0.052, 0.72);
  }

  playBonusSpawn() {
    this._tone(1760, 0.0, 0.035, 0.42);
    this._tone(2349, 0.045, 0.04, 0.42);
  }

  playBonusEat() {
    // Classic jubilant 4-note bonus critter arpeggio
    this._tone(1568, 0.0, 0.045, 0.7);
    this._tone(1976, 0.048, 0.045, 0.7);
    this._tone(2349, 0.096, 0.045, 0.75);
    this._tone(3136, 0.145, 0.11, 0.8);
  }

  playGameOver() {
    // Classic descending crash buzz-jingle
    this._tone(784, 0.0, 0.11, 0.75);
    this._tone(698, 0.12, 0.11, 0.72);
    this._tone(587, 0.24, 0.12, 0.7);
    this._tone(440, 0.37, 0.26, 0.75);
  }

  playVictory() {
    const notes = [
      [1318.5, 0.0, 0.08],
      [1568.0, 0.09, 0.08],
      [2093.0, 0.18, 0.08],
      [2637.0, 0.27, 0.12],
      [2093.0, 0.41, 0.08],
      [2637.0, 0.50, 0.24],
    ];
    for (const [f, t, d] of notes) {
      this._tone(f, t, d, 0.75);
    }
  }
}
