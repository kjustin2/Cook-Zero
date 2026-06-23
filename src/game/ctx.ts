// Shared hub passed to every system. Render + audio are referenced only through
// these interfaces so the game logic never imports Three.js directly (and runs
// headless against no-op implementations in tests).

import type { Input } from "../core/input";
import type { RNG } from "../core/rng";
import type { GameState } from "./types";

/** Visual feedback sink — implemented by the render layer. */
export interface Fx {
  /** Camera-facing floating text/emoji that rises and fades at a world spot. */
  float(text: string, x: number, z: number, opts?: { color?: string; big?: boolean }): void;
  burst(x: number, z: number, color: number, count: number): void;
  sizzle(x: number, z: number): void;
  steam(x: number, z: number): void;
  sparkle(x: number, z: number): void;
  smoke(x: number, z: number): void;
  /** Spinning coins/stars popping up from a serve. */
  coins(x: number, z: number, n?: number): void;
  /** Little love hearts floating off a happy guest. */
  hearts(x: number, z: number): void;
  ring(x: number, z: number, color: number): void;
  /** A faint puff at the chef's feet on a dash. */
  trail(x: number, z: number): void;
  /** A big celebration shower (level complete / win). */
  confetti(): void;
  shake(amount: number): void;
  /** A subtle camera dolly-in kick toward the action (serves). */
  punch(amount: number): void;
  /** Remove every active particle/floater/coin/heart/ring (for clean scenario cuts). */
  clear(): void;
}

/** Sound sink — implemented by the audio layer. All procedural, zero assets. */
export interface Sfx {
  grab(): void;
  place(): void;
  pull(perfect: boolean): void;
  pour(): void;
  scoop(): void;
  serve(combo: number): void;
  coin(): void;
  yay(): void;
  sad(): void;
  toss(): void;
  ui(): void;
  dash(): void;
  star(): void;
  fanfare(): void;
  bark(): void;
}

export interface Music {
  start(): void;
  stop(): void;
  /** 0 = calm, 1 = on-a-roll bounce. */
  setIntensity(level: number): void;
  cue(name: "menu" | "cooking" | "story" | "win"): void;
}

export interface Ctx {
  G: GameState;
  input: Input;
  rng: RNG;
  fx: Fx;
  sfx: Sfx;
  music: Music;
}

// ── No-op implementations for headless logic + tests ─────────────────────────

export const NULL_FX: Fx = {
  float() {},
  burst() {},
  sizzle() {},
  steam() {},
  sparkle() {},
  smoke() {},
  coins() {},
  hearts() {},
  ring() {},
  trail() {},
  confetti() {},
  shake() {},
  punch() {},
  clear() {},
};

export const NULL_SFX: Sfx = {
  grab() {},
  place() {},
  pull() {},
  pour() {},
  scoop() {},
  serve() {},
  coin() {},
  yay() {},
  sad() {},
  toss() {},
  ui() {},
  dash() {},
  star() {},
  fanfare() {},
  bark() {},
};

export const NULL_MUSIC: Music = {
  start() {},
  stop() {},
  setIntensity() {},
  cue() {},
};
