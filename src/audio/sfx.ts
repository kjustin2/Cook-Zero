// Procedural Web Audio sound effects — bright, bouncy, kid-friendly. No samples;
// everything is synthesized so there are zero asset dependencies. Implements the
// game's Sfx interface and no-ops safely when there's no AudioContext.

import type { Sfx } from "../game/ctx";

export class WebSfx implements Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private vol = 0.85; // 0–1 user level; folded into the master gain

  private masterGain(): number {
    return 0.6 * this.vol;
  }

  private ctx(): AudioContext | null {
    if (this.ac) return this.ac;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ac = new Ctor();
      this.master = this.ac.createGain();
      this.master.gain.value = this.masterGain();
      this.master.connect(this.ac.destination);
    } catch {
      this.ac = null;
    }
    return this.ac;
  }

  unlock(): void {
    const ac = this.ctx();
    if (ac && ac.state === "suspended") void ac.resume();
  }
  setMuted(m: boolean): void {
    this.muted = m;
  }
  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.masterGain();
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.3, slideTo?: number, delay = 0): void {
    const ac = this.ctx();
    if (!ac || !this.master || this.muted) return;
    const t = ac.currentTime + delay;
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

  /** A quick rising arpeggio (used for happy/celebration sounds). */
  private arp(notes: number[], step = 0.07, type: OscillatorType = "triangle", gain = 0.24): void {
    notes.forEach((f, i) => this.tone(f, 0.18, type, gain, f * 1.4, i * step));
  }

  grab(): void {
    this.tone(440, 0.08, "triangle", 0.2, 640);
  }
  place(): void {
    this.tone(280, 0.09, "sine", 0.24, 180);
    this.noise(0.05, 0.1, 1200);
  }
  pull(perfect: boolean): void {
    if (perfect) this.arp([660, 880, 1175], 0.05, "triangle", 0.22);
    else this.tone(540, 0.1, "triangle", 0.2, 760);
  }
  pour(): void {
    this.noise(0.22, 0.1, 600);
    this.tone(420, 0.2, "sine", 0.12, 540);
  }
  scoop(): void {
    this.tone(700, 0.12, "sine", 0.18, 980);
    this.tone(980, 0.1, "triangle", 0.12);
  }
  serve(combo: number): void {
    const base = 523 * Math.pow(1.0595, Math.min(combo, 10) * 2);
    this.tone(base, 0.1, "triangle", 0.26, base * 1.5);
    this.tone(base * 1.5, 0.16, "sine", 0.18);
  }
  coin(): void {
    this.tone(988, 0.06, "square", 0.16);
    this.tone(1319, 0.12, "square", 0.14);
  }
  yay(): void {
    this.arp([523, 659, 784, 1047], 0.06, "triangle", 0.22);
  }
  sad(): void {
    this.tone(420, 0.18, "sine", 0.18, 280);
    this.tone(300, 0.22, "sine", 0.14, 200, 0.12);
  }
  toss(): void {
    this.noise(0.16, 0.16, 500);
    this.tone(200, 0.12, "sine", 0.1, 120);
  }
  ui(): void {
    this.tone(560, 0.06, "sine", 0.14, 720);
  }
  dash(): void {
    this.noise(0.16, 0.14, 600);
    this.tone(520, 0.14, "sine", 0.12, 240);
  }
  star(): void {
    this.arp([784, 988, 1318], 0.05, "triangle", 0.2);
  }
  fanfare(): void {
    this.arp([523, 659, 784, 1047, 1319], 0.09, "triangle", 0.26);
    this.tone(1047, 0.5, "sine", 0.16, 1047, 0.45);
  }
  bark(): void {
    // a happy little "yip-yip"
    this.tone(520, 0.08, "square", 0.18, 360);
    this.tone(620, 0.08, "square", 0.16, 420, 0.1);
  }
}
