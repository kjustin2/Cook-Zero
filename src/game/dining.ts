// Dining room geometry for table service: the tables guests sit at, the counter
// (a wall with a central gap the chef walks through to reach the dining floor),
// the entrance/exit doors, and the static collision boxes the chef bumps into.

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

export interface Table {
  x: number;
  z: number;
}

/** Tables guests sit at (z is the seat the guest occupies; chef serves from the
 *  kitchen-facing side, ~1.2 away). */
export const TABLES: Table[] = [
  { x: -8.2, z: -4.4 },
  { x: -4.1, z: -4.4 },
  { x: 0, z: -4.4 },
  { x: 4.1, z: -4.4 },
  { x: 8.2, z: -4.4 },
];

export const ENTRANCE = { x: -HALF_W - 1.6, z: -6.6 };
export const EXIT = { x: HALF_W + 1.6, z: -6.6 };

/** How close the chef must be to a seated guest (or table) to serve. */
export const SERVE_REACH = 2.0;

const TABLE_HALF = 0.78;
const COUNTER_HALF_D = 0.55;

/** Static colliders: two counter segments (gap in the middle) + every table. */
export const BARRIERS: AABB[] = [
  { minX: -HALF_W, maxX: -GAP_HALF, minZ: COUNTER_Z - COUNTER_HALF_D, maxZ: COUNTER_Z + COUNTER_HALF_D },
  { minX: GAP_HALF, maxX: HALF_W, minZ: COUNTER_Z - COUNTER_HALF_D, maxZ: COUNTER_Z + COUNTER_HALF_D },
  ...TABLES.map((t) => ({ minX: t.x - TABLE_HALF, maxX: t.x + TABLE_HALF, minZ: t.z - TABLE_HALF, maxZ: t.z + TABLE_HALF })),
];

export const TABLE_COUNT = TABLES.length;
