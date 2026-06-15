// Customer lifecycle: arrival pacing (scaled by reputation, vibe and pricing),
// queueing at counter spots, patience, and the served/stormed-off walk-offs.
// A customer IS the order — there is no separate ticket list.

import type { Customer, CustomerKind, GameState, Recipe } from "./types";
import type { Ctx } from "./ctx";
import { RECIPES } from "./catalog";
import { CUSTOMER_Z, TILE } from "./grid";
import { SHIFT_LEN, SPAWN_BASE, REP_EXPIRE, CUSTOMER_KINDS } from "./balance";
import { nextUid } from "./state";
import { clamp, lerp } from "../core/math";

const SPOTS = 5;
const SPOT_GAP = 2.7;
const WALK_SPEED = 3.4;
const LEAVE_SPEED = 3.6;
const STORM_SPEED = 5.4;

const spotX = (i: number): number => (i - (SPOTS - 1) / 2) * SPOT_GAP;
const enterX = (g: GameState): number => -((g.grid.cols / 2) * TILE + 4);
const exitX = (g: GameState): number => (g.grid.cols / 2) * TILE + 5;

export function basePatience(s: GameState): number {
  return clamp(52 - s.day * 3, 24, 52) * s.derived.patience;
}

export function spawnInterval(s: GameState): number {
  const dayScale = 1 - (s.day - 1) * 0.06; // busier later in the run
  const progress = 1 - s.dayTime / SHIFT_LEN;
  const ramp = lerp(1.15, 0.78, progress); // crowd builds through the shift
  const base = (SPAWN_BASE * dayScale * ramp) / Math.max(0.4, s.derived.spawnMult);
  return Math.max(1.4, base);
}

function availableRecipes(s: GameState): Recipe[] {
  return RECIPES.filter((r) => r.minDay <= s.day);
}

function freeSpot(s: GameState): number {
  const used = new Set(s.customers.filter((c) => c.state !== "leaving").map((c) => c.spot));
  for (let i = 0; i < SPOTS; i++) if (!used.has(i)) return i;
  return -1;
}

function rollKind(ctx: Ctx): CustomerKind {
  const { G, rng } = ctx;
  const repNorm = clamp(G.rep / 100, 0, 1);
  const vipBoost = G.modifier?.vipBoost ?? 0;
  const vipChance = clamp(0.05 + repNorm * 0.08 + (G.day - 1) * 0.01 + vipBoost, 0, 0.4);
  const criticChance = G.day >= 2 ? 0.08 : 0;
  if (rng.chance(vipChance)) return "vip";
  if (rng.chance(criticChance)) return "critic";
  return "normal";
}

function spawnCustomer(ctx: Ctx): void {
  const { G, rng } = ctx;
  const spot = freeSpot(G);
  if (spot < 0) return;
  const pool = availableRecipes(G);
  const recipe = rng.weighted(pool.map((r) => ({ item: r, weight: r.weight })));
  const kind = rollKind(ctx);
  const kd = CUSTOMER_KINDS[kind];
  const maxP = basePatience(G) * kd.patience;
  G.customers.push({
    uid: nextUid(),
    recipe,
    kind,
    payMult: kd.pay,
    repMult: kd.rep,
    spot,
    x: enterX(G),
    z: CUSTOMER_Z,
    state: "walkin",
    patience: maxP,
    maxPatience: maxP,
    anger: 0,
    servedT: 0,
    happy: false,
    look: {
      skin: rng.int(0, 5),
      shirt: rng.int(0, 7),
      hair: rng.int(0, 6),
      hat: rng.chance(0.25),
    },
    bob: rng.range(0, Math.PI * 2),
  });
}

function expire(ctx: Ctx, c: Customer): void {
  const { G } = ctx;
  c.state = "leaving";
  c.happy = false;
  c.anger = 1;
  G.stats.expired++;
  G.dayStats.expired++;
  G.combo = 0;
  G.comboTimer = 0;
  G.rep = clamp(G.rep + REP_EXPIRE * (c.repMult ?? 1), 0, 100);
  ctx.sfx.error();
  ctx.fx.float(c.kind === "critic" ? "✗ 1★" : "✗", c.x, c.z, { color: "#ff5a5a", big: true });
  ctx.fx.shake(c.kind === "critic" ? 0.2 : 0.12);
}

export function updateCustomers(ctx: Ctx, dt: number): void {
  const { G } = ctx;

  // Spawn pacing.
  G.spawnTimer -= dt;
  if (G.spawnTimer <= 0) {
    spawnCustomer(ctx);
    G.spawnTimer = spawnInterval(G);
  }

  for (const c of G.customers) {
    c.bob += dt;
    const tx = spotX(c.spot);
    switch (c.state) {
      case "walkin": {
        c.x += Math.sign(tx - c.x) * WALK_SPEED * dt;
        if (Math.abs(tx - c.x) < 0.1) {
          c.x = tx;
          c.state = "waiting";
          c.patience = c.maxPatience;
        }
        break;
      }
      case "waiting": {
        c.patience -= dt;
        c.anger = clamp(1 - c.patience / (c.maxPatience * 0.45), 0, 1);
        // Cute impatience puff (rare, so it doesn't spam).
        if (c.anger > 0.55 && ctx.rng.chance(dt * 0.5)) {
          ctx.fx.float("💢", c.x + 0.5, c.z + 1.0, { color: "#ff7a7a" });
        }
        if (c.patience <= 0) expire(ctx, c);
        break;
      }
      case "served": {
        c.servedT += dt;
        if (c.servedT > 0.7) c.state = "leaving";
        break;
      }
      case "leaving": {
        const sp = c.happy ? LEAVE_SPEED : STORM_SPEED;
        c.x += sp * dt;
        break;
      }
    }
  }

  // Reap customers that left the scene.
  const ex = exitX(G);
  G.customers = G.customers.filter((c) => !(c.state === "leaving" && c.x > ex));
}

/** Combo decay between serves (called from the sim each frame). */
export function updateCombo(s: GameState, dt: number): void {
  if (s.combo > 0) {
    s.comboTimer -= dt;
    if (s.comboTimer <= 0) {
      s.combo = 0;
      s.comboTimer = 0;
    }
  }
}

export { SPOTS, spotX };
