// Central game-state factory. Builds the `G` object every system reads/writes:
// the chef, the hand-placed stations along the back wall, the dining tables, and
// the derived knobs that the chosen "treats" feed. Everything is data-driven and
// fixed (no grid/build mode) so the diner is instantly playable and never empty.

import type { CookSlot, Derived, GameState, RestaurantConfig, Station, StationId, Table, TreatId } from "./types";
import { STATIONS, stationDef } from "./catalog";
import { bloomCount } from "./garden";
import { cloneConfig, defaultConfig } from "./customize";
import { loadMeta } from "../core/save";
import { CHEF_SPEED, DAY_LEN, MAX_DAY } from "./balance";

/** Where each station sits along the back of the diner (x, z, facing). */
const STATION_SPOTS: Record<StationId, [number, number]> = {
  meat: [-9.6, -8],
  grill: [-7.0, -8],
  potato: [-4.4, -8],
  fryer: [-1.8, -8],
  soda: [0.8, -8],
  icecream: [3.4, -8],
  sausage: [6.2, -8],
  hotgrill: [8.8, -8],
  trash: [11.2, -6.4],
};

/** Six dining tables in two cosy rows, pulled toward the kitchen so the serve
 *  run is brisk, not a slog. Guests face the camera so we read them. */
export const TABLE_SPOTS: Array<[number, number]> = [
  [-6.5, -3.4], [0, -3.4], [6.5, -3.4],
  [-6.5, 0.6], [0, 0.6], [6.5, 0.6],
];

/** Flower planters along the front of the diner — they grow across the run. */
const PLANT_SPOTS: Array<[number, number]> = [
  [-7.2, 5.2], [-2.4, 5.6], [2.4, 5.6], [7.2, 5.2],
];

export const emptySlot = (): CookSlot => ({
  food: null, t: 0, readyT: 0, goldenT: 0, crispT: 0, burnT: 0, pop: 0,
});

function makeStation(id: StationId): Station {
  const def = stationDef(id);
  const [x, z] = STATION_SPOTS[id];
  const slots: CookSlot[] = [];
  for (let i = 0; i < def.slots; i++) slots.push(emptySlot());
  return { id, kind: def.kind, x, z, ry: 0, slots };
}

function makeTables(count: number): Table[] {
  const n = Math.max(1, Math.min(TABLE_SPOTS.length, count));
  return TABLE_SPOTS.slice(0, n).map(([x, z]) => ({
    x, z, seatX: x, seatZ: z - 0.55, occupied: 0,
  }));
}

export const countTreat = (treats: TreatId[], id: TreatId): number =>
  treats.reduce((n, t) => n + (t === id ? 1 : 0), 0);

function baseDerived(): Derived {
  return {
    moveSpeed: CHEF_SPEED,
    reachMult: 1,
    levelTime: DAY_LEN[0],
    cookSpeedMult: 1,
    patienceMult: 1,
    coinMult: 1,
    sparkle: false,
    helper: false,
  };
}

/** Recompute the derived knobs from the chosen treats + the current day. */
export function recomputeDerived(s: GameState): void {
  const d = baseDerived();
  const t = s.treats;
  const dayIdx = Math.max(0, Math.min(MAX_DAY - 1, s.day - 1));
  d.moveSpeed = CHEF_SPEED * Math.pow(1.22, countTreat(t, "fast"));
  d.reachMult = 1 + 0.35 * countTreat(t, "reach");
  d.cookSpeedMult = Math.pow(1.28, countTreat(t, "quickcook"));
  // Comfy chairs (treat) + a blooming garden both make guests wait more happily.
  d.patienceMult = 1 + 0.22 * countTreat(t, "patient") + 0.04 * bloomCount(s);
  d.levelTime = DAY_LEN[dayIdx] + 18 * countTreat(t, "time");
  // Decorations make the diner cosier — each happy guest is worth more score.
  d.coinMult = 1 + 0.5 * s.config.decorLevel;
  d.sparkle = countTreat(t, "sparkle") > 0;
  d.helper = countTreat(t, "helper") > 0;
  s.derived = d;
}

export function createState(seed: number): GameState {
  const meta = loadMeta();
  const config: RestaurantConfig = meta.config ? cloneConfig(meta.config) : defaultConfig();
  const s: GameState = {
    phase: "title",
    t: 0,
    paused: false,

    day: 1,
    maxDay: MAX_DAY,

    chef: {
      x: 0, z: -5.5, facing: 0, vx: 0, vz: 0, carry: null,
      dashT: 0, dashCd: 0, cookT: 0, cheer: 0,
    },
    stations: STATIONS.map((d) => makeStation(d.id)),
    tables: makeTables(config.tableCount),
    customers: [],
    pet: { kind: config.pet.kind, x: 5, z: 3.5, vx: 0, vz: 0, tx: 5, tz: 3.5, retargetT: 2.5, happy: 0.6, wag: 0, followT: 0, hop: 0, barkT: 3 },
    plants: PLANT_SPOTS.map(([x, z], i) => ({ x, z, kind: config.plants[i]?.kind ?? i % 4, growth: 0, stage: 0 })),

    dayTime: DAY_LEN[0],
    dayLen: DAY_LEN[0],
    goal: 0,
    servedToday: 0,
    happyToday: 0,
    spawnTimer: 1.4,
    spawnQueue: 0,
    spawnGap: 5,
    nextUid: 1,

    coins: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    fire: 0,

    treats: [],
    treatChoices: [],
    derived: baseDerived(),

    config,
    unlocks: [...meta.unlocks],
    tutorial: false,
    tutorialStep: 0,
    tutorialServed: 0,
    newUnlocks: [],

    cutscene: null,
    dayCard: null,
    stars: 0,

    guide: { x: 0, z: 0, label: "", icon: "", active: false },
    prompt: null,
    studioFocus: "chef",
    studioCat: "chef",

    muted: meta.muted,
    quality: meta.quality,
    rngSeed: seed,
  };
  recomputeDerived(s);
  return s;
}

/** Reset run-scoped fields for a fresh run (keeps the same object identity). */
export function resetRun(s: GameState, seed: number): void {
  const fresh = createState(seed);
  Object.assign(s, fresh);
}

export const stationById = (s: GameState, id: StationId): Station | undefined =>
  s.stations.find((st) => st.id === id);

/** Put out another dining table (the "New Table" upgrade). Returns false if the
 *  diner is already at the maximum the floor can hold. */
export function addTable(s: GameState): boolean {
  if (s.tables.length >= TABLE_SPOTS.length) return false;
  const [x, z] = TABLE_SPOTS[s.tables.length];
  s.tables.push({ x, z, seatX: x, seatZ: z - 0.55, occupied: 0 });
  s.config.tableCount = s.tables.length;
  return true;
}

/** Which floor spot (index into TABLE_SPOTS) a table currently sits on, or -1. */
export function tableSpotOf(s: GameState, spotIndex: number): number {
  const [x, z] = TABLE_SPOTS[spotIndex];
  return s.tables.findIndex((t) => Math.abs(t.x - x) < 0.6 && Math.abs(t.z - z) < 0.6);
}

/** Arrange screen: place/remove a table at a floor spot (keep at least one). */
export function toggleTableAt(s: GameState, spotIndex: number): void {
  const existing = tableSpotOf(s, spotIndex);
  if (existing >= 0) {
    if (s.tables.length <= 1) return; // always keep a table
    s.tables.splice(existing, 1);
  } else {
    if (s.tables.length >= TABLE_SPOTS.length) return;
    const [x, z] = TABLE_SPOTS[spotIndex];
    s.tables.push({ x, z, seatX: x, seatZ: z - 0.55, occupied: 0 });
  }
  s.config.tableCount = s.tables.length;
}

/** Remove the most-recently-added table (keep at least one). */
export function removeTable(s: GameState): boolean {
  if (s.tables.length <= 1) return false;
  s.tables.pop();
  s.config.tableCount = s.tables.length;
  return true;
}

/** Free-form drag: place a table at an exact floor position (seat trails it). */
export function moveTable(s: GameState, i: number, x: number, z: number): void {
  const t = s.tables[i];
  if (!t) return;
  t.x = x; t.z = z; t.seatX = x; t.seatZ = z - 0.55;
}

/** Free-form drag: place a station at an exact floor position. */
export function moveStation(s: GameState, id: StationId, x: number, z: number): void {
  const st = s.stations.find((v) => v.id === id);
  if (st) { st.x = x; st.z = z; }
}

/** Arrange screen: swap two stations' floor positions (move equipment around). */
export function swapStations(s: GameState, idA: StationId, idB: StationId): void {
  const a = s.stations.find((st) => st.id === idA);
  const b = s.stations.find((st) => st.id === idB);
  if (!a || !b) return;
  [a.x, b.x] = [b.x, a.x];
  [a.z, b.z] = [b.z, a.z];
  [a.ry, b.ry] = [b.ry, a.ry];
}

/** Apply an edited restaurant config to the live state: swap colours/looks and
 *  reconcile table count, pet kind and planter flowers so the diner matches. Used
 *  by the setup wizard and the between-day manage screen (live 3D preview). */
export function applyConfig(s: GameState, c: RestaurantConfig): void {
  s.config = c;
  const want = Math.max(1, Math.min(TABLE_SPOTS.length, c.tableCount));
  while (s.tables.length < want && addTable(s)) { /* grow to target */ }
  while (s.tables.length > want) s.tables.pop();
  c.tableCount = s.tables.length;
  s.pet.kind = c.pet.kind;
  s.plants.forEach((pl, i) => { if (c.plants[i]) pl.kind = c.plants[i].kind; });
  recomputeDerived(s);
}
