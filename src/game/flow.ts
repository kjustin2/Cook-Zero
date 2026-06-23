// Day flow: starting a shift, tallying stars, and rolling the treat offer. The
// phase machine lives in main.ts; these are the transitions it calls. The run is
// always winnable — finishing a day never ends the game early, it just scores it.

import type { Ctx } from "./ctx";
import type { GameState } from "./types";
import { DAY_GOAL, DAY_GUESTS, MAX_DAY, SPAWN_GAP } from "./balance";
import { clearSlot } from "./stations";
import { recomputeDerived, countTreat } from "./state";
import { growGarden } from "./garden";
import { rollTreats } from "./upgrades";
import { DAY_THEMES } from "./story";
import { loadMeta, saveMeta, saveRun } from "../core/save";

/** Reset the chef + diner for a fresh shift (shared by tutorial + real days). */
function resetShift(s: GameState): void {
  s.servedToday = 0;
  s.happyToday = 0;
  s.combo = 0;
  s.comboT = 0;
  s.fire = 0;
  s.customers = [];
  for (const tb of s.tables) tb.occupied = 0;
  for (const st of s.stations) for (const sl of st.slots) clearSlot(sl);
  s.chef.carry = null;
  s.chef.x = 0;
  s.chef.z = -5.5;
  s.chef.vx = 0;
  s.chef.vz = 0;
  s.chef.dashT = 0;
  s.chef.dashCd = 0;
}

/** Begin the current day's shift (G.day already set). */
export function startDay(ctx: Ctx): void {
  const s = ctx.G;
  recomputeDerived(s);

  if (s.tutorial) {
    // The guided first shift: no clock, a tiny, calm queue of burger orders.
    s.tutorialStep = 0;
    s.tutorialServed = 0;
    s.dayLen = 999;
    s.dayTime = 999;
    s.goal = 3;
    s.spawnQueue = 3;
    s.spawnGap = 7;
    s.spawnTimer = 1.6;
    resetShift(s);
    s.dayCard = { title: "Let's Learn! 🎓", sub: "Follow the glowing arrow", t: 0 };
    ctx.music.cue("cooking");
    ctx.music.setIntensity(0);
    return;
  }

  growGarden(s); // the garden flourishes a little more each real day
  recomputeDerived(s); // fold the new bloom into patience
  const i = Math.max(0, Math.min(MAX_DAY - 1, s.day - 1));

  s.dayLen = s.derived.levelTime;
  s.dayTime = s.dayLen;
  s.goal = DAY_GOAL[i];
  s.spawnQueue = DAY_GUESTS[i] + 2 * countTreat(s.treats, "extracustomer");
  s.spawnGap = SPAWN_GAP[i];
  s.spawnTimer = 1.4;
  resetShift(s);

  s.dayCard = { title: `Day ${s.day}`, sub: DAY_THEMES[i] ?? "", t: 0 };
  ctx.music.cue("cooking");
  ctx.music.setIntensity(0);
  saveRun(s); // checkpoint: a quit now resumes at the start of this day
}

/** 1–3 star rating for the shift just finished (always at least 1 — kind). */
export function computeStars(s: GameState): number {
  if (s.servedToday >= s.goal) return 3;
  if (s.servedToday >= Math.ceil(s.goal * 0.6)) return 2;
  return 1;
}

export interface DayResult {
  stars: number;
  served: number;
  isFinal: boolean;
}

/** Tally the shift, save best stats. Does not change phase. */
export function finishDay(ctx: Ctx): DayResult {
  const s = ctx.G;
  s.stars = computeStars(s);
  const meta = loadMeta();
  meta.bestDay = Math.max(meta.bestDay, s.day);
  meta.bestStars = Math.max(meta.bestStars, s.stars);
  saveMeta(meta);
  return { stars: s.stars, served: s.servedToday, isFinal: s.day >= MAX_DAY };
}

/** Roll the three treats offered between days. */
export function prepareTreats(ctx: Ctx): void {
  ctx.G.treatChoices = rollTreats(ctx.rng, ctx.G);
}
