// Dining room geometry for table service: the dining row the player arranges
// tables along, the counter (a wall with a central gap the chef walks through to
// reach the dining floor), the entrance/exit doors, and the colliders the chef
// bumps into (counter segments + each placed table).

import type { TableInst } from "./types";
import { GRID_COLS } from "./balance";
import { TILE, COUNTER_Z } from "./grid";

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const HALF_W = (GRID_COLS / 2) * TILE + 0.5; // ~10.85 — room half-width
export const GAP_HALF = 2.3; // half-width of the counter opening (centered)
export const DINING_MIN_Z = -5.2; // how far into the dining floor the chef may go
export { COUNTER_Z };

// ── Dining row: a single row of evenly-spaced table slots the player arranges
//    tables across. One row keeps every table clear of the counter so the chef
//    can always serve it from the kitchen-facing side. ──
export const DINING_COLS = 9; // number of slots across the dining floor
export const DINING_DX = 2.0; // horizontal spacing between slots
export const DINING_ROW_Z = -4.4; // depth of the dining row
export const SEAT_DZ = -0.98; // guest sits on the back stool (behind the table)
export const DEFAULT_TABLE_COLS = [0, 2, 4, 6, 8]; // starting spread (5 tables)

const colX = (col: number): number => (col - (DINING_COLS - 1) / 2) * DINING_DX;

export interface Table {
  x: number;
  z: number;
}

/** World centre of a dining column's table. */
export const tableWorld = (col: number): Table => ({ x: colX(col), z: DINING_ROW_Z });
/** Centre of a placed table instance. */
export const tableCenter = (t: TableInst): Table => tableWorld(t.col);
/** Nearest dining column to a world x (may fall outside [0, DINING_COLS) — the
 *  caller clamps / range-checks). */
export const diningColOf = (x: number): number => Math.round(x / DINING_DX + (DINING_COLS - 1) / 2);
/** Is this world z out on the dining floor (in front of the counter)? */
export const inDiningZone = (z: number): boolean => z < COUNTER_Z - 0.4;

/** Where the guest sits for a table — the back stool, facing the kitchen. */
export const seatOf = (t: TableInst): { x: number; z: number } => {
  const c = tableWorld(t.col);
  return { x: c.x, z: c.z + SEAT_DZ };
};

export const ENTRANCE = { x: -HALF_W - 1.6, z: -6.6 };
export const EXIT = { x: HALF_W + 1.6, z: -6.6 };

/** How close the chef must be to a seated guest to serve (reaches across the
 *  table from the kitchen side). */
export const SERVE_REACH = 2.4;

const TABLE_HALF = 0.78;
const COUNTER_HALF_D = 0.55;

/** Collision box for a placed table. */
export const tableAABB = (t: TableInst): AABB => {
  const c = tableWorld(t.col);
  return { minX: c.x - TABLE_HALF, maxX: c.x + TABLE_HALF, minZ: c.z - TABLE_HALF, maxZ: c.z + TABLE_HALF };
};

/** Static counter colliders: two segments with a gap in the middle. */
export const COUNTER_BARRIERS: AABB[] = [
  { minX: -HALF_W, maxX: -GAP_HALF, minZ: COUNTER_Z - COUNTER_HALF_D, maxZ: COUNTER_Z + COUNTER_HALF_D },
  { minX: GAP_HALF, maxX: HALF_W, minZ: COUNTER_Z - COUNTER_HALF_D, maxZ: COUNTER_Z + COUNTER_HALF_D },
];

/** Everything solid the chef bumps into: the counter plus every placed table. */
export const barriersFor = (tables: TableInst[]): AABB[] => [
  ...COUNTER_BARRIERS,
  ...tables.map(tableAABB),
];
