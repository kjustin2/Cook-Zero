// Build-mode controller: place owned inventory onto the grid, pick up & move
// placed items, rotate, and sell for a partial refund. The render layer writes
// the hovered cell into G.build.cursorCol/Row (via mouse picking) each frame;
// this module turns clicks/keys into grid edits and re-derives bonuses.

import type { GameState, PlacedItem } from "./types";
import type { Ctx } from "./ctx";
import { def } from "./catalog";
import { cellAt, itemAt, place, removeAt } from "./grid";
import { recomputeDerived } from "./adjacency";
import { makeItem } from "./state";

export const REFUND_RATE = 0.6;

export function enterBuild(s: GameState): void {
  s.build.active = true;
  s.build.brush = null;
  s.build.movingUid = null;
}

export function exitBuild(s: GameState): void {
  // Drop any item being moved back to inventory so nothing is lost.
  if (s.build.movingUid !== null) {
    // The moving item is not on the grid; stash it back as inventory.
    const moving = s.build.movingItem;
    if (moving) {
      s.inventory[moving.defId] = (s.inventory[moving.defId] ?? 0) + 1;
      s.build.movingItem = null;
    }
    s.build.movingUid = null;
  }
  s.build.active = false;
  s.build.brush = null;
  recomputeDerived(s);
}

export function setBrush(s: GameState, defId: string | null): void {
  // Selecting a palette item cancels any in-progress move.
  returnMoving(s);
  s.build.brush = defId && (s.inventory[defId] ?? 0) > 0 ? defId : null;
}

export function rotateCursor(s: GameState): void {
  s.build.rot = (s.build.rot + 1) % 4;
  if (s.build.movingItem) s.build.movingItem.rot = s.build.rot;
}

function returnMoving(s: GameState): void {
  if (s.build.movingItem) {
    s.inventory[s.build.movingItem.defId] = (s.inventory[s.build.movingItem.defId] ?? 0) + 1;
    s.build.movingItem = null;
  }
  s.build.movingUid = null;
}

/** Primary build click at the hovered cell. */
export function buildClick(ctx: Ctx): void {
  const s = ctx.G;
  const col = s.build.cursorCol;
  const row = s.build.cursorRow;
  const cell = cellAt(s.grid, col, row);
  if (!cell) return;

  // Dropping a moved item.
  if (s.build.movingItem) {
    if (cell.item) {
      ctx.sfx.error();
      return;
    }
    const it = s.build.movingItem;
    it.col = col;
    it.row = row;
    it.rot = s.build.rot;
    place(s.grid, it);
    s.build.movingItem = null;
    s.build.movingUid = null;
    ctx.sfx.build();
    recomputeDerived(s);
    return;
  }

  // Placing from the palette brush.
  if (s.build.brush) {
    if (cell.item) {
      ctx.sfx.error();
      return;
    }
    const id = s.build.brush;
    if ((s.inventory[id] ?? 0) <= 0) return;
    s.inventory[id] -= 1;
    if (s.inventory[id] <= 0) {
      delete s.inventory[id];
      s.build.brush = null;
    }
    place(s.grid, makeItem(id, col, row, s.build.rot));
    ctx.sfx.build();
    recomputeDerived(s);
    return;
  }

  // Empty hands on an item → pick it up to move.
  if (cell.item) {
    const it = removeAt(s.grid, col, row) as PlacedItem;
    s.build.movingItem = it;
    s.build.movingUid = it.uid;
    s.build.rot = it.rot;
    ctx.sfx.grab();
    recomputeDerived(s);
  }
}

/** Sell the item under the cursor (or the one being moved) for a refund. */
export function sellHovered(ctx: Ctx): void {
  const s = ctx.G;
  let target: PlacedItem | null = s.build.movingItem ?? itemAt(s.grid, s.build.cursorCol, s.build.cursorRow);
  if (!target) return;
  const d = def(target.defId);
  if (!d) return;
  const refund = Math.floor(d.cost * REFUND_RATE);
  if (s.build.movingItem && s.build.movingItem.uid === target.uid) {
    s.build.movingItem = null;
    s.build.movingUid = null;
  } else {
    removeAt(s.grid, target.col, target.row);
  }
  s.coins += refund;
  ctx.sfx.build();
  ctx.fx.coins(0, 0);
  s.toast = { text: `Sold ${d.name} for $${refund}`, t: 0 };
  recomputeDerived(s);
}
