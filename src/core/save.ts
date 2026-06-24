// localStorage persistence. Two blobs:
//  • META  — best stats, settings, unlocked content, last restaurant config, and
//            whether the one-time tutorial has been seen. Always present.
//  • RUN   — an optional full snapshot of an in-progress run so the player can
//            quit to the menu and later tap "Continue" to pick up where they left
//            off (mirrors Rogue-Hero-3's run-save pattern). Versioned; old/foreign
//            snapshots are dropped gracefully (null), never thrown.

import type { GameState, RestaurantConfig } from "../game/types";
import { unlockedFor } from "../game/customize";

const KEY = "sizzle_rush_kid_save";
const RUN_KEY = "sizzle_rush_kid_run";
const RUN_VERSION = 3;

export interface MetaSave {
  bestDay: number; // furthest day reached
  bestStars: number; // best total stars in a run
  runs: number;
  muted: boolean;
  quality: "high" | "low";
  // ── Display + audio options (the "real game" settings menu) ──
  renderScale: number; // resolution multiplier on the device pixel ratio (0.5–2)
  musicVol: number; // 0–1 music level
  sfxVol: number; // 0–1 sound-effect level
  tutorialDone: boolean; // has the guided first shift been completed?
  unlocks: string[]; // content keys unlocked across all runs (customize.ts)
  config: RestaurantConfig | null; // last restaurant config (pre-fills setup)
}

const DEFAULT: MetaSave = {
  bestDay: 0,
  bestStars: 0,
  runs: 0,
  muted: false,
  quality: "high",
  renderScale: 1,
  musicVol: 0.8,
  sfxVol: 0.85,
  tutorialDone: false,
  unlocks: [],
  config: null,
};

export function loadMeta(): MetaSave {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<MetaSave>) : {};
    const meta: MetaSave = { ...DEFAULT, ...parsed };
    // Fold in any content the reached best-day should have unlocked, so unlocks
    // stay authoritative even if the table grows between builds.
    const set = new Set([...meta.unlocks, ...unlockedFor(meta.bestDay)]);
    meta.unlocks = [...set];
    return meta;
  } catch {
    return { ...DEFAULT, unlocks: unlockedFor(0) };
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* storage disabled — ignore */
  }
}

// ── In-progress run snapshot (Continue) ───────────────────────────────────────

interface RunBlob {
  v: number;
  g: GameState;
}

/** Snapshot the current run. Call at safe points (day start, quit-to-title). */
export function saveRun(g: GameState): void {
  try {
    // Cutscene carries a callback (non-serializable) — never snapshot mid-cinematic.
    const blob: RunBlob = { v: RUN_VERSION, g: { ...g, cutscene: null, paused: false } };
    localStorage.setItem(RUN_KEY, JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

/** Load a resumable run snapshot, or null if none/foreign/old. */
export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as Partial<RunBlob>;
    if (blob.v !== RUN_VERSION || !blob.g) return null;
    return blob.g as GameState;
  } catch {
    return null;
  }
}

export function hasRun(): boolean {
  return loadRun() !== null;
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}
