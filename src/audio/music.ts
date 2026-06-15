// Procedural background music — a looping bass + pluck groove whose tempo,
// brightness and lead layer scale with combo intensity. Implements Music.

import type { Music } from "../game/ctx";

const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic (semitones)
const ROOT = 220; // A3
const BASS = [0, 0, 5, 7]; // bar root pattern (scale degrees)

export class WebMusic implements Music {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private intensity = 0;
  private running = false;

  private ctx(): AudioContext | null {
    if (this.ac) return this.ac;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ac = new Ctor();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.16;
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

  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(1, level));
  }

  start(): void {
    if (this.running) return;
    const ac = this.ctx();
    if (!ac) return;
    this.running = true;
    this.step = 0;
    this.nextTime = ac.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private freq(degree: number, octave = 0): number {
    const semi = SCALE[((degree % SCALE.length) + SCALE.length) % SCALE.length] + octave * 12;
    return ROOT * Math.pow(2, semi / 12);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, when: number): void {
    const ac = this.ac;
    if (!ac || !this.master) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private schedule(): void {
    const ac = this.ac;
    if (!ac || !this.running) return;
    const bpm = 96 + this.intensity * 48;
    const stepDur = 60 / bpm / 2; // eighth notes
    while (this.nextTime < ac.currentTime + 0.12) {
      const s = this.step % 16;
      // Bass on the beat.
      if (s % 4 === 0) {
        this.blip(this.freq(BASS[(s / 4) % BASS.length], -1), stepDur * 2, "triangle", 0.5, this.nextTime);
      }
      // Pluck arpeggio, denser as intensity rises.
      if (s % 2 === 0 || this.intensity > 0.4) {
        const deg = SCALE.length > 0 ? (s + (s % 3)) % SCALE.length : 0;
        this.blip(this.freq(deg, 0), stepDur * 0.9, "square", 0.12 + this.intensity * 0.06, this.nextTime);
      }
      // Lead sparkle when on fire.
      if (this.intensity > 0.7 && s % 4 === 2) {
        this.blip(this.freq((s + 2) % SCALE.length, 1), stepDur * 0.8, "triangle", 0.1, this.nextTime);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}
