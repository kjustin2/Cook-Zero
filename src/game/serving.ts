// Serving: scoring, combo multiplier, reputation, and all the juice that fires
// when a plate lands in front of a happy customer.

import type { Customer, GameState, PlatePart } from "./types";
import type { Ctx } from "./ctx";
import { PRICE_LEVELS, COMBO_CAP, ON_FIRE_AT, REP_GOOD, REP_PERFECT } from "./balance";
import { clamp } from "../core/math";

/** Combo coin multiplier — grows 0.2 per chained serve, capped. */
export const comboMult = (combo: number): number =>
  1 + 0.2 * (clamp(combo, 1, COMBO_CAP) - 1);

export function priceOf(s: GameState, basePrice: number): number {
  return basePrice * (PRICE_LEVELS[s.priceLevel] ?? PRICE_LEVELS[2]).price;
}

function perfectCount(parts: PlatePart[]): number {
  return parts.filter((p) => p.quality === "perfect").length;
}

/** Pay out a served customer. Assumes the carried plate already matched. */
export function serveCustomer(ctx: Ctx, cust: Customer, parts: PlatePart[]): number {
  const { G } = ctx;
  const recipe = cust.recipe;
  const price = priceOf(G, recipe.basePrice);
  const perfects = perfectCount(parts);

  G.combo += 1;
  const mult = comboMult(G.combo);
  const speedBonus = Math.round(6 * (cust.patience / Math.max(1, cust.maxPatience)));
  const perfectMult = G.modifier?.perfectMult ?? 1;
  const perfectBonus = perfects * 4 * perfectMult;
  const payMult = (cust.payMult ?? 1) * (G.modifier?.payMult ?? 1);
  const tip = Math.round(G.derived.tip);
  const coins = Math.round((price + perfectBonus + speedBonus) * mult * payMult) + tip;

  G.coins += coins;
  G.dayCoins += coins;
  G.comboTimer = G.derived.comboWindow;

  // Reputation (critics swing harder).
  const repGain = (perfects > 0 ? REP_PERFECT : REP_GOOD) * G.derived.repGainMult * (cust.repMult ?? 1);
  G.rep = clamp(G.rep + repGain, 0, 100);

  // Stats.
  G.stats.served++;
  G.dayStats.served++;
  if (perfects > 0) {
    G.stats.perfect++;
    G.dayStats.perfect++;
  }
  if (G.combo > G.stats.bestCombo) G.stats.bestCombo = G.combo;

  // Customer state → happy walk-off.
  cust.state = "served";
  cust.happy = true;
  cust.servedT = 0;

  // Juice.
  ctx.sfx.serve(G.combo);
  ctx.sfx.coin();
  ctx.fx.coins(cust.x, cust.z);
  ctx.fx.ring(cust.x, cust.z, 0x7CFF6b);
  ctx.fx.float(`+$${coins}`, cust.x, cust.z, { color: "#9dff7a", big: mult >= 1.6 || cust.kind === "vip" });
  ctx.fx.float("❤", cust.x - 0.6, cust.z + 0.5, { color: "#ff9ad1", big: true });
  if (perfects > 0) ctx.fx.float("PERFECT!", cust.x, cust.z + 0.4, { color: "#ffe066", big: true });
  if (cust.kind === "vip") ctx.fx.float("👑 VIP", cust.x, cust.z + 0.9, { color: "#ffd24a" });
  if (cust.kind === "critic") ctx.fx.float("📸 5★", cust.x, cust.z + 0.9, { color: "#9be7ff" });
  ctx.fx.shake(0.18 + Math.min(0.25, (mult - 1) * 0.15));

  if (G.combo === ON_FIRE_AT) {
    ctx.sfx.onFire();
    ctx.fx.float("ON FIRE!", G.chef.x, G.chef.z, { color: "#ff7a3d", big: true });
  }
  if (mult >= 1.4) {
    ctx.fx.float(`x${mult.toFixed(1)} COMBO`, cust.x, cust.z - 0.5, { color: "#ffd24a" });
  }
  return coins;
}
