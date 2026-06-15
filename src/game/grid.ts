// Floor-plan grid: the tile model plus conversions between grid cells and 3D
// world coordinates. Row 0 sits just behind the service counter (front of
// house); rows increase toward the camera (back of kitchen).

import type { Cell, Grid, PlacedItem } from "./types";
import { def } from "./catalog";
import { clamp } from "../core/math";

export const TILE = 2.3;
export const COUNTER_Z = -2.0; // z of the service counter line
const FRONT_GAP = 1.9; // gap from counter to first kitchen row
export const CUSTOMER_Z = COUNTER_Z - 2.3; // where guests stand (far side)

export function createGrid(cols: number, rows: number): Grid {
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ col, row, item: null });
    }
  }
  return { cols, rows, cells };
}

export const inBounds = (g: Grid, col: number, row: number): boolean =>
  col >= 0 && col < g.cols && row >= 0 && row < g.rows;

export const cellAt = (g: Grid, col: number, row: number): Cell | null =>
  inBounds(g, col, row) ? g.cells[row * g.cols + col] : null;

export const itemAt = (g: Grid, col: number, row: number): PlacedItem | null =>
  cellAt(g, col, row)?.item ?? null;

/** World x/z of a cell centre. */
export function worldOfCell(g: Grid, col: number, row: number): { x: number; z: number } {
  return {
    x: (col - (g.cols - 1) / 2) * TILE,
    z: COUNTER_Z + FRONT_GAP + row * TILE,
  };
}

/** Nearest cell to a world position (clamped into bounds). */
export function cellOfWorld(g: Grid, x: number, z: number): { col: number; row: number } {
  const col = Math.round(x / TILE + (g.cols - 1) / 2);
  const row = Math.round((z - COUNTER_Z - FRONT_GAP) / TILE);
  return { col: clamp(col, 0, g.cols - 1), row: clamp(row, 0, g.rows - 1) };
}

/** Front-of-house weight: row 0 (by the counter) matters most for vibe. */
export const frontFactor = (g: Grid, row: number): number =>
  1.1 - 0.6 * (row / Math.max(1, g.rows - 1));

export const isSolidAt = (g: Grid, col: number, row: number): boolean => {
  const it = itemAt(g, col, row);
  return it != null && (def(it.defId)?.solid ?? false);
};

export function place(g: Grid, item: PlacedItem): void {
  const c = cellAt(g, item.col, item.row);
  if (c) c.item = item;
}

export function removeAt(g: Grid, col: number, row: number): PlacedItem | null {
  const c = cellAt(g, col, row);
  if (!c || !c.item) return null;
  const it = c.item;
  c.item = null;
  return it;
}

/** All placed items, row-major order. */
export function items(g: Grid): PlacedItem[] {
  const out: PlacedItem[] = [];
  for (const c of g.cells) if (c.item) out.push(c.item);
  return out;
}

/** 4-neighbour cells of (col,row). */
export function neighbors(g: Grid, col: number, row: number): Cell[] {
  const out: Cell[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dc, dr] of dirs) {
    const c = cellAt(g, col + dc, row + dr);
    if (c) out.push(c);
  }
  return out;
}
