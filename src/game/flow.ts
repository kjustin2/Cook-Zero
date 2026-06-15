// Day/shift flow: starting a shift, tallying results, paying the helper wage,
// and rolling the between-day shop + upgrade offers. The phase machine lives in
// main.ts; these are the transitions it calls.

import type { Ctx } from "./ctx";
import type { GameState } from "./types";
import { QUOTAS, SHIFT_LEN, TOTAL_DAYS } from "./balance";
import { items } from "./grid";
import { clearSlot } from "./cooking";
import { recomputeDerived } from "./adjacency";
import { rollModifier } from "./modifiers";
import { rollShop } from "./shop";
import { rollUpgrades } from "./upgrades";
import { startCutscene } from "./cutscene";
import { DAY_THEMES, storyForDay } from "./story";
import { loadMeta, saveMeta } from "../core/save";

/** Begin (or restart) the current day's shift. */
export function startDay(ctx: Ctx): void {
  const s = ctx.G;
  s.dayTime = SHIFT_LEN;
  s.dayCoins = 0;
  s.quota = QUOTAS[Math.min(s.day - 1, QUOTAS.length - 1)];
  s.dayCard = { title: `Night ${s.day}`, sub: DAY_THEMES[s.day - 1] ?? "", t: 0 };
  s.customers = [];
  s.spawnTimer = 1.6;
  s.combo = 0;
  s.comboTimer = 0;
  s.carry = null;
  s.chef.x = 0;
  s.chef.z = 5;
  s.chef.dashT = 0;
  s.chef.dashCD = 0;
  s.dayStats = { served: 0, perfect: 0, expired: 0 };
  s.modifier = rollModifier(ctx.rng, s.day);
  // Fresh stations: clear leftover cooking + plates.
  for (const it of items(s.grid)) {
    if (it.slots) for (const sl of it.slots) clearSlot(sl);
    if (it.plate) it.plate = [];
  }
  recomputeDerived(s);
  ctx.music.start();
  ctx.music.setIntensity(0);
  if (s.modifier) {
    s.toast = { text: `${s.modifier.icon} ${s.modifier.name} — ${s.modifier.desc}`, t: 0 };
  }
}

/** 0–3 star rating for the shift just finished. */
export function computeStars(s: GameState): number {
  let stars = 0;
  if (s.dayCoins >= s.quota) stars++;
  if (s.dayStats.expired <= 2) stars++;
  const served = Math.max(1, s.dayStats.served);
  if (s.dayStats.perfect / served >= 0.4 || s.rep >= 72) stars++;
  return stars;
}

export interface DayResult {
  passed: boolean;
  dayCoins: number;
  quota: number;
  wage: number;
  isFinal: boolean;
}

/** Tally the shift just finished and pay wages. Does not change phase. */
export function finishDay(ctx: Ctx): DayResult {
  const s = ctx.G;
  const passed = s.dayCoins >= s.quota;
  const wage = s.helper.hired ? s.helper.wage : 0;
  s.coins = Math.max(0, s.coins - wage);
  s.lastDayPassed = passed;
  s.dayStars = computeStars(s);
  recordMeta(s);
  ctx.music.stop();
  return { passed, dayCoins: s.dayCoins, quota: s.quota, wage, isFinal: s.day >= TOTAL_DAYS };
}

/** Roll the manager's shop + upgrade offers for this visit. */
export function prepareManage(ctx: Ctx): void {
  const s = ctx.G;
  rollShop(s, ctx.rng);
  s.upgradeOffer = rollUpgrades(ctx.rng, s.upgrades);
  s.manageTab = "shop";
}

/** Start a day, playing its opening cutscene first if it has one. */
export function beginDay(ctx: Ctx): void {
  const beats = storyForDay(ctx.G.day);
  const go = () => {
    startDay(ctx);
    ctx.G.phase = "playing";
  };
  if (beats) startCutscene(ctx.G, beats, go, `Night ${ctx.G.day}`);
  else go();
}

export function recordMeta(s: GameState): void {
  const meta = loadMeta();
  meta.bestDay = Math.max(meta.bestDay, s.lastDayPassed ? s.day : s.day - 1);
  meta.bestCoins = Math.max(meta.bestCoins, s.coins);
  meta.bestCombo = Math.max(meta.bestCombo, s.stats.bestCombo);
  meta.bestRep = Math.max(meta.bestRep, Math.round(s.rep));
  meta.bestStars = Math.max(meta.bestStars, s.dayStars);
  saveMeta(meta);
}

export const isFinalDay = (s: GameState): boolean => s.day >= TOTAL_DAYS;
