// Procedural Web Audio sound effects. No samples — everything is synthesized so
// there are zero asset dependencies. Implements the game's Sfx interface.

import type { Sfx } from "../game/ctx";

export class WebSfx implements Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ctx(): AudioContext | null {
    if (this.ac) return this.ac;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ac = new Ctor();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ac.destination);
    } catch {
      this.ac = null;
    }
    return this.ac;
  }

  /** Resume the context after a user gesture (browsers gate autoplay). */
  unlock(): void {
    const ac = this.ctx();
    if (ac && ac.state === "suspended") void ac.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.3, slideTo?: number): void {
    const ac = this.ctx();
    if (!ac || !this.master || this.muted) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.3, hp = 800): void {
    const ac = this.ctx();
    if (!ac || !this.master || this.muted) return;
    const t = ac.currentTime;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = hp;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  grab(): void {
    this.tone(420, 0.08, "triangle", 0.22, 620);
  }
  place(): void {
    this.tone(280, 0.09, "sine", 0.26, 180);
    this.noise(0.06, 0.12, 1200);
  }
  pull(perfect: boolean): void {
    if (perfect) {
      this.tone(660, 0.1, "triangle", 0.26, 990);
      this.tone(990, 0.16, "sine", 0.2, 1320);
    } else {
      this.tone(520, 0.1, "triangle", 0.22, 720);
    }
  }
  chop(): void {
    this.noise(0.05, 0.22, 2200);
    this.tone(180, 0.05, "square", 0.12, 120);
  }
  serve(combo: number): void {
    const base = 523 * Math.pow(1.0595, Math.min(combo, 12) * 2);
    this.tone(base, 0.1, "triangle", 0.26, base * 1.5);
    this.tone(base * 1.5, 0.16, "sine", 0.18);
  }
  coin(): void {
    this.tone(988, 0.06, "square", 0.18);
    this.tone(1319, 0.12, "square", 0.16);
  }
  error(): void {
    this.tone(200, 0.18, "sawtooth", 0.22, 120);
  }
  burn(): void {
    this.noise(0.3, 0.2, 400);
  }
  onFire(): void {
    this.tone(330, 0.2, "sawtooth", 0.2, 660);
    this.tone(660, 0.3, "triangle", 0.18, 990);
  }
  ui(): void {
    this.tone(560, 0.06, "sine", 0.16, 720);
  }
  build(): void {
    this.tone(440, 0.07, "square", 0.16, 560);
    this.noise(0.04, 0.08, 1500);
  }
  dash(): void {
    this.noise(0.16, 0.16, 600);
    this.tone(520, 0.14, "sine", 0.14, 240);
  }
}
