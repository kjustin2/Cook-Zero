// The "playing" update: ticks every gameplay system in order each frame, runs
// the wayfinder, and drives music intensity. Phase transitions (shift over) are
// handled in main.ts.

import type { Ctx } from "./ctx";
import { updateChef } from "./chef";
import { updateCombo, updateCustomers } from "./customers";
import { updateStations } from "./stations";
import { updatePet } from "./pet";
import { computeGuide } from "./wayfinder";
import { FIRE_AT } from "./balance";
import { clamp } from "../core/math";

export function updatePlaying(ctx: Ctx, dt: number): void {
  const { G } = ctx;

  updateCustomers(ctx, dt);
  updateStations(ctx, dt);
  updatePet(ctx, dt);
  // Cool the combo BEFORE the chef may serve this frame, so a fresh serve's full
  // streak window isn't shaved by a same-frame decrement.
  updateCombo(G, dt);
  updateChef(ctx, dt);
  computeGuide(G);

  // Music gets bouncier the longer your streak runs.
  ctx.music.setIntensity(G.combo >= FIRE_AT ? 1 : clamp(G.combo / FIRE_AT, 0, 0.8));

  G.dayTime = Math.max(0, G.dayTime - dt);
}

/** The shift is over when the clock runs out, or every guest has come and gone. */
export function shiftOver(G: Ctx["G"]): boolean {
  return G.dayTime <= 0 || (G.spawnQueue <= 0 && G.customers.length === 0);
}
