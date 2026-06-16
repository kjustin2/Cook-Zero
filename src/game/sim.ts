// The "playing" update: ticks every gameplay system in order each frame and
// drives music intensity. Phase transitions (shift over) are handled in main.

import type { Ctx } from "./ctx";
import { updateChef } from "./chef";
import { updateCombo, updateCustomers } from "./customers";
import { updateStations } from "./cooking";
import { updateHelper } from "./helper";
import { updateTutorial } from "./tutorial";
import { ON_FIRE_AT } from "./balance";
import { clamp } from "../core/math";

function updateFloats(ctx: Ctx, dt: number): void {
  const f = ctx.G.floats;
  for (const fl of f) fl.t += dt;
  ctx.G.floats = f.filter((fl) => fl.t < fl.life);
}

export function updatePlaying(ctx: Ctx, dt: number): void {
  const { G } = ctx;

  updateCustomers(ctx, dt);
  updateStations(ctx, dt);
  updateHelper(ctx, dt);
  updateChef(ctx, dt);
  updateCombo(G, dt);
  updateTutorial(G);
  updateFloats(ctx, dt);

  // Music intensity tracks the combo / on-fire state.
  const intensity = G.combo >= ON_FIRE_AT ? 1 : clamp(G.combo / ON_FIRE_AT, 0, 0.85);
  ctx.music.setIntensity(intensity);

  // Toast timer.
  if (G.toast) {
    G.toast.t += dt;
    if (G.toast.t > 2.6) G.toast = null;
  }

  // Shift clock. The first-run tutorial is a controlled setting — the night
  // does NOT tick down while it's running, so the player can learn unhurried.
  if (G.tutorial < 0) G.dayTime = Math.max(0, G.dayTime - dt);
}
