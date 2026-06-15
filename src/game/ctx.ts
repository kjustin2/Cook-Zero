// Shared hub passed to every system. Render + audio are referenced only through
// these interfaces so the game logic never imports Three.js directly (and can
// run headless against no-op implementations in tests).

import type { Input } from "../core/input";
import type { RNG } from "../core/rng";
import type { GameState } from "./types";

/** Visual feedback sink — implemented by the render layer. */
export interface Fx {
  /** Camera-facing floating label (also recorded in G.floats). */
  float(text: string, x: number, z: number, opts?: { color?: string; big?: boolean }): void;
  burst(x: number, z: number, color: number, count: number): void;
  sizzle(x: number, z: number): void;
  smoke(x: number, z: number): void;
  coins(x: number, z: number): void;
  ring(x: number, z: number, color: number): void;
  steam(x: number, z: number): void;
  sparkle(x: number, z: number): void;
  trail(x: number, z: number): void;
  confetti(): void;
  shake(amount: number): void;
}

/** Sound sink — implemented by the audio layer. */
export interface Sfx {
  grab(): void;
  place(): void;
  pull(perfect: boolean): void;
  chop(): void;
  serve(combo: number): void;
  coin(): void;
  error(): void;
  burn(): void;
  onFire(): void;
  ui(): void;
  build(): void;
  dash(): void;
}

export interface Music {
  setIntensity(level: number): void;
  start(): void;
  stop(): void;
}

export interface Ctx {
  G: GameState;
  input: Input;
  rng: RNG;
  fx: Fx;
  sfx: Sfx;
  music: Music;
}

/** A no-op Fx/Sfx pair for headless logic + tests. */
export const NULL_FX: Fx = {
  float() {},
  burst() {},
  sizzle() {},
  smoke() {},
  coins() {},
  ring() {},
  steam() {},
  sparkle() {},
  trail() {},
  confetti() {},
  shake() {},
};

export const NULL_SFX: Sfx = {
  grab() {},
  place() {},
  pull() {},
  chop() {},
  serve() {},
  coin() {},
  error() {},
  burn() {},
  onFire() {},
  ui() {},
  build() {},
  dash() {},
};

export const NULL_MUSIC: Music = {
  setIntensity() {},
  start() {},
  stop() {},
};
