// Serving: a friendly score, a purely-celebratory combo, and all the juice that
// fires when a happy guest gets their food. No prices, no reputation, no math the
// kid has to do — just bigger, louder rewards when you're quick and perfect.

import type { Customer, FoodId, Quality } from "./types";
import type { Ctx } from "./ctx";
import { food } from "./catalog";
import { COIN_BASE, COIN_PERFECT, COMBO_WINDOW, FIRE_AT } from "./balance";

const YUMS = ["YUMMY!", "TASTY!", "WOW!", "SO GOOD!", "MMM!"];

export function serveCustomer(ctx: Ctx, cust: Customer, served: FoodId, quality: Quality): number {
  const { G } = ctx;
  const perfect = quality === "perfect";

  // Combo (just for sparkle): chain serves before the streak cools.
  G.combo += 1;
  G.comboT = COMBO_WINDOW;
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;

  const coins = Math.round((COIN_BASE + (perfect ? COIN_PERFECT : 0) + Math.min(8, G.combo)) * G.derived.coinMult);
  G.coins += coins;
  G.servedToday += 1;
  G.happyToday += 1;

  // Customer → over-the-moon, then strolls out.
  cust.served = true;
  cust.servedT = 0;
  cust.hop = 1;
  cust.mood = 1;

  // ── Reward burst ──
  ctx.sfx.serve(G.combo);
  ctx.sfx.coin();
  ctx.fx.coins(cust.x, cust.z, perfect ? 5 : 3);
  ctx.fx.hearts(cust.x, cust.z);
  ctx.fx.ring(cust.x, cust.z, perfect ? 0xffe066 : 0x7cff8a);
  ctx.fx.punch(0.5);
  ctx.fx.shake(0.14);
  ctx.fx.float(perfect ? "PERFECT! ⭐" : YUMS[G.combo % YUMS.length], cust.x, cust.z + 0.4, {
    color: perfect ? "#ffe066" : "#9dff7a",
    big: perfect,
  });
  ctx.fx.float(food(served).icon, cust.x, cust.z, { big: true });
  if (perfect) {
    // a perfect plate gets a proper star-burst so it clearly out-juices a normal serve
    ctx.fx.burst(cust.x, cust.z + 0.6, 0xffe066, 16);
    ctx.fx.sparkle(cust.x, cust.z + 0.4);
    ctx.fx.ring(cust.x, cust.z, 0xffd24a);
  }

  if (G.derived.sparkle) {
    ctx.fx.burst(cust.x, cust.z + 0.5, 0xff8fc4, 12);
    G.comboT = COMBO_WINDOW; // sparkle treat: the streak never cools mid-serve
  }
  if (G.combo === FIRE_AT) {
    ctx.sfx.yay();
    ctx.fx.float("ON A ROLL! 🔥", G.chef.x, G.chef.z + 0.5, { color: "#ff7a3d", big: true });
  }
  // Every few serves in a row is a little celebration the kid builds toward.
  if (G.combo >= 3 && G.combo % 3 === 0) {
    ctx.sfx.star();
    ctx.fx.coins(cust.x, cust.z, 6);
    ctx.fx.float(`⭐ x${G.combo}!`, cust.x, cust.z + 1.0, { color: "#ffd24a", big: true });
  }

  ctx.music.setIntensity(Math.min(1, G.combo / 8));
  return coins;
}
