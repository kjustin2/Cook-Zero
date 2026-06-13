// All sound is synthesized with WebAudio — zero asset files.
// Lazily initialized on first user gesture (browser autoplay policy).

const STEP_COUNT = 16;
const BPM = 118;
const STEP_LEN = 60 / BPM / 4; // 16th notes

const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const audio = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  sizzleGain: null,
  muted: false,
  nextStep: 0,
  stepIdx: 0,
  intensity: 0,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.3;
    this.musicBus.connect(this.master);

    // Looping noise routed through a bandpass = grill sizzle. Gain rides activity.
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(1);
    noise.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 0.6;
    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0;
    noise.connect(bp).connect(this.sizzleGain).connect(this.master);
    noise.start();

    this.nextStep = this.ctx.currentTime + 0.1;
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  },

  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  // One oscillator note with an exponential decay envelope.
  _tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.15, vol = 0.3, when = 0, bus = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  _noiseHit({ dur = 0.08, vol = 0.2, freq = 6000, type = 'highpass', when = 0, bus = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(Math.max(0.1, dur));
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(bus || this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  },

  // ---- SFX vocabulary ----
  pickup()  { this._tone({ type: 'square', f0: 520, f1: 760, dur: 0.07, vol: 0.12 }); },
  place()   { this._tone({ type: 'triangle', f0: 220, f1: 140, dur: 0.1, vol: 0.22 }); },
  ding()    {
    this._tone({ type: 'sine', f0: 1320, dur: 0.35, vol: 0.18 });
    this._tone({ type: 'sine', f0: 1980, dur: 0.25, vol: 0.08 });
  },
  perfect() {
    this._tone({ type: 'sine', f0: 1568, dur: 0.12, vol: 0.16 });
    this._tone({ type: 'sine', f0: 2093, dur: 0.3, vol: 0.16, when: 0.08 });
  },
  coin(combo = 0) {
    const base = 740 * Math.pow(1.06, Math.min(combo, 10));
    this._tone({ type: 'square', f0: base, dur: 0.08, vol: 0.13 });
    this._tone({ type: 'square', f0: base * 1.5, dur: 0.14, vol: 0.13, when: 0.07 });
    this._noiseHit({ dur: 0.05, vol: 0.06, freq: 9000 });
  },
  buzzer()  {
    this._tone({ type: 'sawtooth', f0: 150, f1: 90, dur: 0.32, vol: 0.22 });
    this._tone({ type: 'sawtooth', f0: 151, f1: 88, dur: 0.32, vol: 0.18 });
  },
  tick()    { this._tone({ type: 'square', f0: 1900, dur: 0.03, vol: 0.05 }); },
  trash()   { this._noiseHit({ dur: 0.18, vol: 0.18, freq: 900, type: 'lowpass' }); },
  whoosh()  { this._noiseHit({ dur: 0.4, vol: 0.22, freq: 1400, type: 'bandpass' }); },
  click()   { this._tone({ type: 'square', f0: 900, dur: 0.05, vol: 0.1 }); },
  fanfare() {
    const seq = [60, 64, 67, 72];
    seq.forEach((n, i) => this._tone({ type: 'square', f0: note(n + 12), dur: 0.22, vol: 0.14, when: i * 0.13 }));
    this._tone({ type: 'square', f0: note(76 + 12), dur: 0.5, vol: 0.14, when: 0.55 });
  },
  fail() {
    const seq = [62, 58, 55, 50];
    seq.forEach((n, i) => this._tone({ type: 'sawtooth', f0: note(n), dur: 0.3, vol: 0.13, when: i * 0.22 }));
  },

  // ---- music scheduler (kick/hat/snare/bass, layers driven by intensity) ----
  _kick(when)  {
    this._tone({ type: 'sine', f0: 150, f1: 48, dur: 0.13, vol: 0.5, when, bus: this.musicBus });
  },
  _hat(when, open)   {
    this._noiseHit({ dur: open ? 0.09 : 0.03, vol: 0.1, freq: 8500, when, bus: this.musicBus });
  },
  _snare(when) {
    this._noiseHit({ dur: 0.12, vol: 0.22, freq: 1800, when, bus: this.musicBus });
    this._tone({ type: 'triangle', f0: 210, f1: 160, dur: 0.1, vol: 0.12, when, bus: this.musicBus });
  },
  _bass(when, n) {
    this._tone({ type: 'triangle', f0: note(n), dur: 0.16, vol: 0.3, when, bus: this.musicBus });
  },

  // Called every frame from main. sizzleLevel = number of active grill slots.
  update(G) {
    if (!this.ctx) return;
    const target = Math.min(0.14, (G.sizzleLevel || 0) * 0.05);
    this.sizzleGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.15);

    this.intensity =
      G.state === 'playing' && !G.paused ? 1 + (G.combo >= 3 ? 1 : 0) + (G.combo >= 5 ? 1 : 0) :
      G.state === 'title' || G.state === 'upgrade' ? 1 : 0;

    if (this.intensity === 0 || this.muted) {
      this.nextStep = this.ctx.currentTime + 0.1;
      return;
    }
    const BASS_PAT = { 0: 33, 3: 33, 6: 36, 10: 31, 12: 33, 14: 38 };
    while (this.nextStep < this.ctx.currentTime + 0.12) {
      const s = this.stepIdx;
      const when = this.nextStep - this.ctx.currentTime;
      if (s % 4 === 0) this._kick(when);
      if (s % 2 === 0) this._hat(when, s % 8 === 6);
      if (this.intensity >= 2 && (s === 4 || s === 12)) this._snare(when);
      if (this.intensity >= 2 && BASS_PAT[s] !== undefined) this._bass(when, BASS_PAT[s] + (this.intensity >= 3 ? 12 : 0));
      if (this.intensity >= 3 && s % 4 === 2) this._hat(when, true);
      this.stepIdx = (s + 1) % STEP_COUNT;
      this.nextStep += STEP_LEN;
    }
  },
};
