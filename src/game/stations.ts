// Cooking runtime: filling a cook station's slots, advancing their timers, and
// reading the quality you'd get by pulling right now. Timing windows are baked
// when the food is placed, scaled by the run's cook-speed treats. Burning is so
// slow it almost never happens — and the "helper" treat auto-holds at perfect.

import type { CookSlot, FoodId, Quality, Station } from "./types";
import type { Ctx } from "./ctx";
import { COOK } from "./balance";

/** Grills char eventually; the fryer (fries) and dog grill stay forgiving. */
const canBurn = (id: Station["id"]): boolean => id === "grill" || id === "hotgrill";

export function freeSlot(st: Station): number {
  return st.slots.findIndex((s) => s.food === null);
}

/** First slot that's at least "good" (servable), or -1. */
export function readySlot(st: Station): number {
  return st.slots.findIndex((s) => s.food !== null && s.t >= s.readyT);
}

/** Put a raw food into slot `idx`, baking its timing windows. */
export function startCooking(st: Station, idx: number, food: FoodId, cookSpeedMult: number): boolean {
  const slot = st.slots[idx];
  if (!slot || slot.food !== null) return false;
  const k = Math.max(0.3, cookSpeedMult);
  slot.food = food;
  slot.t = 0;
  slot.readyT = COOK.ready / k;
  slot.goldenT = slot.readyT + COOK.golden / k;
  slot.crispT = slot.goldenT + COOK.perfect / k;
  slot.burnT = canBurn(st.id) ? slot.crispT + COOK.crisp / k : Infinity;
  slot.pop = 0;
  return true;
}

/** Quality you'd get pulling this slot right now. */
export function slotQuality(slot: CookSlot): Quality | "raw" {
  if (slot.food === null || slot.t < slot.readyT) return "raw";
  if (slot.t < slot.goldenT) return "good";
  if (slot.t < slot.crispT) return "perfect";
  if (slot.t < slot.burnT) return "crispy";
  return "burnt";
}

export function clearSlot(slot: CookSlot): void {
  slot.food = null;
  slot.t = 0;
  slot.readyT = 0;
  slot.goldenT = 0;
  slot.crispT = 0;
  slot.burnT = 0;
  slot.pop = 0;
}

/** Advance every cook slot, hold-at-perfect with a helper, spray feedback. */
export function updateStations(ctx: Ctx, dt: number): void {
  const { G } = ctx;
  const helper = G.derived.helper;
  for (const st of G.stations) {
    if (st.kind !== "cook") continue;
    for (const slot of st.slots) {
      if (slot.food === null) continue;
      if (slot.pop < 1) slot.pop = Math.min(1, slot.pop + dt * 3.4);
      // With the helper treat, freeze the food at the perfect window so it never
      // overcooks — a kid can take their time.
      if (helper && slot.t >= slot.goldenT) {
        slot.t = Math.min(slot.t + dt, slot.crispT - 0.05);
      } else {
        slot.t += dt;
      }
      const q = slotQuality(slot);
      // Cooking shows purely as the food browning + a little steam/smoke — NO glow
      // sparkles or ready-rings (they read as a glowing halo over the food).
      if (q === "raw" && ctx.rng.chance(dt * 1.6)) ctx.fx.sizzle(st.x, st.z - 0.1);
      if ((q === "good" || q === "perfect") && ctx.rng.chance(dt * 0.8)) ctx.fx.steam(st.x, st.z - 0.1);
      if ((q === "crispy" || q === "burnt") && ctx.rng.chance(dt * 1.6)) ctx.fx.smoke(st.x, st.z - 0.1);
    }
  }
}
