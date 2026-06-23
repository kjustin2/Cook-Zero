// The garden — flower planters along the front of the diner that GROW over the
// run. They advance a stage at the start of every day (so the diner visibly
// flourishes as you progress), and the chef can optionally water one in-shift to
// push it along faster. Each bloomed flower makes the diner cosier — guests wait
// a little more patiently.

import type { GameState, Plant } from "./types";
import type { Ctx } from "./ctx";

export const MAX_STAGE = 4; // 0 seed · 1 sprout · 2 leaves · 3 bud · 4 bloom

/** Advance every plant one stage — called at the start of each day. */
export function growGarden(G: GameState): void {
  for (const p of G.plants) {
    if (p.stage < MAX_STAGE) {
      p.stage += 1;
      p.growth = 0;
    }
  }
}

/** Water a plant in-shift: a fun optional tend that nudges it toward blooming. */
export function waterPlant(ctx: Ctx, plant: Plant): void {
  plant.growth += 0.5;
  if (plant.growth >= 1 && plant.stage < MAX_STAGE) {
    plant.stage += 1;
    plant.growth = 0;
  } else if (plant.stage >= MAX_STAGE) {
    plant.growth = 1;
  }
  ctx.sfx.pour();
  ctx.fx.sparkle(plant.x, plant.z);
  ctx.fx.steam(plant.x, plant.z);
  ctx.fx.float("💧", plant.x, plant.z + 0.6, { color: "#9fe3ff" });
}

export const bloomCount = (G: GameState): number =>
  G.plants.reduce((n, p) => n + (p.stage >= MAX_STAGE ? 1 : 0), 0);
