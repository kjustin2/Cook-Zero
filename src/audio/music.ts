// Procedural background music — a warm, bouncy, zero-asset step sequencer in a
// sunny major key. A look-ahead scheduler plays a bass + plucky melody; the
// streak ("intensity") speeds it up and brightens it, and cue() swaps the mood
// (menu / cooking / story / win). No-ops safely with no AudioContext.

import type { Music } from "../game/ctx";

type Cue = "menu" | "cooking" | "story" | "win";

// C major pentatonic across two octaves (Hz), plus a bass root pool.
const SCALE = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0];
const BASS = [130.8, 174.6, 196.0, 146.8]; // I - IV - V - ii feel

const CUES: Record<Cue, { bpm: number; gain: number; bright: number }> = {
  menu: { bpm: 92, gain: 0.12, bright: 0.4 },
  cooking: { bpm: 120, gain: 0.16, bright: 0.7 },
  story: { bpm: 80, gain: 0.1, bright: 0.3 },
  win: { bpm: 138, gain: 0.18, bright: 1.0 },
};

export class WebMusic implements Music {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private cueName: Cue = "menu";
  private intensity = 0;
  muted = false;
  private vol = 0.8; // 0–1 user level
  private playing = false;

  private masterGain(): number {
    return this.muted ? 0 : this.vol;
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
    if (this.master) this.master.gain.value = this.masterGain();
  }
  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.masterGain();
  }

  start(): void {
    if (this.playing) return;
    const ac = this.ctx();
    if (!ac) return;
    this.playing = true;
    this.nextNoteTime = ac.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(1, level));
  }

  cue(name: Cue): void {
    this.cueName = name;
    this.start(); // idempotent; ensures the bed plays for every mood (incl. story)
  }

  private schedule(): void {
    const ac = this.ac;
    if (!ac || !this.master) return;
    const cfg = CUES[this.cueName];
    const bpm = cfg.bpm * (1 + this.intensity * 0.18);
    const spb = 60 / bpm / 2; // eighth-note steps
    while (this.nextNoteTime < ac.currentTime + 0.12) {
      this.playStep(this.nextNoteTime, cfg);
      this.nextNoteTime += spb;
      this.step = (this.step + 1) % 16;
    }
  }

  private playStep(t: number, cfg: { gain: number; bright: number }): void {
    const ac = this.ac!;
    const master = this.master!;
    const s = this.step;
    const vol = cfg.gain * (this.muted ? 0 : 1);

    if (s % 4 === 0) {
      const root = BASS[(s / 4) % BASS.length];
      this.voice(ac, master, root, t, 0.32, "triangle", vol * 0.8, 600);
    }
    const density = 0.4 + this.intensity * 0.5;
    if (s % 2 === 0 || Math.random() < density) {
      const note = SCALE[(s * 2 + (s % 3)) % SCALE.length];
      this.voice(ac, master, note, t, 0.18, "triangle", vol * (0.5 + cfg.bright * 0.4), 1400 + this.intensity * 1800);
    }
    if (this.intensity > 0.5 && s % 2 === 1) {
      this.voice(ac, master, 5200, t, 0.04, "square", vol * 0.05, 6000);
    }
  }

  private voice(ac: AudioContext, out: GainNode, freq: number, t: number, dur: number, type: OscillatorType, gain: number, cutoff: number): void {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = cutoff;
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filt);
    filt.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
