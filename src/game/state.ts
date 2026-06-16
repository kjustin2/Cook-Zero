// Central game-state factory. Builds the `G` object every system reads/writes,
// including a sensible starting kitchen so day 1 is immediately playable.

import type { Derived, GameState, Mods, PlacedItem } from "./types";
import { RECIPES } from "./catalog";
import { createGrid, place } from "./grid";
import { recomputeDerived } from "./adjacency";
import { loadMeta } from "../core/save";
import {
  COMBO_BASE_WINDOW,
  GRID_COLS,
  GRID_ROWS,
  QUOTAS,
  REP_START,
  SHIFT_LEN,
} from "./balance";

let UID = 1;
export const nextUid = (): number => UID++;

export function defaultMods(): Mods {
  return {
    moveSpeed: 1,
    cookSpeed: 1,
    patience: 1,
    perfectWindow: 0,
    tip: 0,
    comboWindow: COMBO_BASE_WINDOW,
    repGain: 1,
  };
}

function defaultDerived(): Derived {
  return {
    moveSpeed: 1,
    patience: 1,
    perfectWindow: 0,
    tip: 0,
    comboWindow: COMBO_BASE_WINDOW,
    repGainMult: 1,
    vibe: 0,
    spawnMult: 1,
  };
}

export function makeItem(defId: string, col: number, row: number, rot = 0): PlacedItem {
  return { uid: nextUid(), defId, col, row, rot, effCookSpeed: 1, effSlots: 0 };
}

const START_LAYOUT: Array<[string, number, number]> = [
  ["prep", 4, 1],
  ["grill", 3, 2],
  ["fryer", 5, 2],
  ["fan", 4, 2], // sits between grill + fryer → boosts both
  ["drink", 6, 1],
  ["bin_bun", 2, 4],
  ["bin_patty", 3, 4],
  ["bin_cheese", 4, 4],
  ["bin_potato", 5, 4],
  ["trash", 7, 3],
  ["plant", 1, 0],
  ["lamp", 7, 0],
];

export function createState(seed: number): GameState {
  const grid = createGrid(GRID_COLS, GRID_ROWS);
  for (const [defId, col, row] of START_LAYOUT) {
    place(grid, makeItem(defId, col, row));
  }

  const s: GameState = {
    phase: "title",
    prevPhase: "title",
    t: 0,
    paused: false,
    seed,

    day: 1,
    dayTime: SHIFT_LEN,
    quota: QUOTAS[0],
    coins: 0,
    dayCoins: 0,
    lastDayPassed: false,
    modifier: null,
    dayStars: 0,

    rep: REP_START,
    priceLevel: 2, // "Standard"
    combo: 0,
    comboTimer: 0,

    mods: defaultMods(),
    derived: defaultDerived(),
    upgrades: {},

    grid,
    inventory: { plant: 1, lamp: 1 },
    recipes: RECIPES,
    helper: { hired: false, level: 1, wage: 0, x: 0, z: 0, targetUid: null, cooldown: 0 },

    chef: { x: 0, z: 5.0, vx: 0, vz: 0, face: 0, walk: 0, interactCD: 0, fire: 0, dashT: 0, dashCD: 0, dashX: 0, dashZ: 0 },
    customers: [],
    carry: null,
    spawnTimer: 1.5,

    stats: { served: 0, perfect: 0, expired: 0, trashed: 0, bestCombo: 0 },
    dayStats: { served: 0, perfect: 0, expired: 0 },
    floats: [],

    hint: "",
    build: { active: false, brush: null, cursorCol: 4, cursorRow: 2, rot: 0, movingUid: null },
    manageTab: "shop",
    shopOffer: [],
    upgradeOffer: [],
    toast: null,
    cutscene: null,
    dayCard: null,
    muted: loadMeta().muted,
    quality: loadMeta().quality,
    tutorial: -1,
  };

  recomputeDerived(s);
  return s;
}

/** Reset run-scoped fields for a fresh run (keeps the same object identity). */
export function resetRun(s: GameState, seed: number): void {
  const fresh = createState(seed);
  Object.assign(s, fresh);
}
