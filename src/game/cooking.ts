// Station runtime: advancing cook/fry/pour slots, computing pull quality, and
// emitting sizzle/smoke feedback. Timing windows are baked at placement time
// using the station's adjacency-boosted speed and the run's perfect-window mod.

import type { CookSlot, Derived, PlacedItem, Quality } from "./types";
import type { Ctx } from "./ctx";
import { COOK_SPECS, def } from "./catalog";
import { GRILL_BURN } from "./balance";
import { items, worldOfCell } from "./grid";

export type Pull = Quality | "raw" | "burnt";

/** Fill slot `idx` of a cook station, baking its timing windows. */
export function startSlot(item: PlacedItem, idx: number, derived: Derived): boolean {
  const d = def(item.defId);
  const spec = d?.kind ? COOK_SPECS[d.kind] : undefined;
  if (!spec || !item.slots || !item.slots[idx] || item.slots[idx].filling !== null) return false;
  const slot = item.slots[idx];
  const speed = Math.max(0.2, item.effCookSpeed);
  slot.filling = spec.start;
  slot.t = 0;
  slot.cookT = spec.cook / speed;
  slot.perfT = slot.cookT + (spec.perfect + derived.perfectWindow);
  slot.burnT = spec.canBurn ? slot.perfT + GRILL_BURN : Infinity;
  slot.done = false;
  return true;
}

/** First empty slot index, or -1. */
export function freeSlot(item: PlacedItem): number {
  if (!item.slots) return -1;
  return item.slots.findIndex((s) => s.filling === null);
}

/** Quality you'd get pulling this slot right now. */
export function pullQuality(slot: CookSlot): Pull {
  if (slot.filling === null) return "raw";
  if (slot.t < slot.cookT) return "raw";
  if (slot.t >= slot.burnT) return "burnt";
  if (slot.t < slot.perfT) return "perfect";
  return "good";
}

export function clearSlot(slot: CookSlot): void {
  slot.filling = null;
  slot.t = 0;
  slot.cookT = 0;
  slot.perfT = 0;
  slot.burnT = 0;
  slot.done = false;
}

/** Advance every cook slot and spray feedback particles. */
export function updateStations(ctx: Ctx, dt: number): void {
  const { G } = ctx;
  for (const item of items(G.grid)) {
    const d = def(item.defId);
    if (!d || !d.kind || !COOK_SPECS[d.kind] || !item.slots) continue;
    const { x, z } = worldOfCell(G.grid, item.col, item.row);
    for (const slot of item.slots) {
      if (slot.filling === null) continue;
      const wasReady = slot.done;
      slot.t += dt;
      if (!slot.done && slot.t >= slot.cookT) {
        slot.done = true;
        ctx.fx.ring(x, z - 0.2, 0xffd66b);
      }
      // While actively cooking, occasional sizzle.
      if (slot.t < slot.perfT && ctx.rng.chance(dt * 2)) ctx.fx.sizzle(x, z - 0.1);
      // Hot & ready in the perfect window → a little sparkle + wisp of steam.
      if (slot.done && slot.t < slot.perfT) {
        if (ctx.rng.chance(dt * 1.8)) ctx.fx.sparkle(x, z - 0.1);
        if (ctx.rng.chance(dt * 1.0)) ctx.fx.steam(x, z - 0.1);
      }
      // Overdone / burning → smoke.
      if (slot.burnT !== Infinity && slot.t >= slot.perfT && ctx.rng.chance(dt * 2.2)) {
        ctx.fx.smoke(x, z - 0.1);
      }
      if (slot.burnT !== Infinity && slot.t >= slot.burnT && wasReady && ctx.rng.chance(dt * 4)) {
        ctx.fx.smoke(x, z);
      }
    }
  }
}
