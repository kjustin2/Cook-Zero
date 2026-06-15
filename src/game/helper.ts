// Hireable sous-chef ("Line Cook"). It watches the grills and tends the slots
// closest to burning so they never char — and at higher levels holds them right
// in the perfect-sear window. Capacity + skill scale with its level.

import type { Ctx } from "./ctx";
import type { CookSlot, PlacedItem } from "./types";
import { def } from "./catalog";
import { items, worldOfCell } from "./grid";
import { damp } from "../core/math";

const CAPACITY = [0, 1, 2, 4]; // by level

interface Tended {
  item: PlacedItem;
  slot: CookSlot;
}

export function updateHelper(ctx: Ctx, dt: number): void {
  const { G } = ctx;
  const h = G.helper;
  if (!h.hired) return;
  if (h.cooldown > 0) h.cooldown -= dt;

  // Find grill slots that are done and at risk of burning.
  const atRisk: Array<Tended & { x: number; z: number }> = [];
  for (const item of items(G.grid)) {
    const d = def(item.defId);
    if (!d || d.kind !== "grill" || !item.slots) continue;
    const { x, z } = worldOfCell(G.grid, item.col, item.row);
    for (const slot of item.slots) {
      if (slot.filling !== null && slot.done && slot.burnT !== Infinity) {
        atRisk.push({ item, slot, x, z });
      }
    }
  }
  // Most-cooked first (closest to burning).
  atRisk.sort((a, b) => b.slot.t - a.slot.t);

  const cap = CAPACITY[h.level] ?? 1;
  const holdPerfect = h.level >= 2;
  let target: { x: number; z: number } | null = null;
  for (let i = 0; i < Math.min(cap, atRisk.length); i++) {
    const { slot, x, z } = atRisk[i];
    if (holdPerfect) {
      // Pin just inside the perfect window.
      const hold = Math.max(slot.cookT, slot.perfT - 0.1);
      if (slot.t > hold) slot.t = hold;
    } else {
      // Just stop it from charring.
      const safe = slot.burnT - 0.35;
      if (slot.t > safe) slot.t = safe;
    }
    if (i === 0) target = { x, z };
    if (ctx.rng.chance(dt * 1.5)) ctx.fx.sizzle(x, z - 0.1);
  }

  // Move the helper toward whatever it's tending (or idle centre-back).
  const tx = target ? target.x : 0;
  const tz = target ? target.z + 1.0 : 6.5;
  h.x = damp(h.x, tx, 6, dt);
  h.z = damp(h.z, tz, 6, dt);
}
