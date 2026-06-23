// Customer lifecycle: a gentle trickle of guests who walk in, sit at a free
// table with a big picture order, wait (patiently!), and stroll out happy when
// served. A guest IS the order — no ticket list. Nobody is ever punished hard:
// if a guest gives up they just leave a little sad, with no score penalty.

import type { Customer, GameState } from "./types";
import type { Ctx } from "./ctx";
import { activeMenu } from "./catalog";
import { FLOOR, PATIENCE } from "./balance";
import { clamp, damp } from "../core/math";

const ENTRANCE = { x: 0, z: FLOOR.maxZ - 0.3 };
const EXIT = { x: 0, z: FLOOR.maxZ + 2.0 };
const WALK = 3.4;
const LEAVE = 3.6;
const SIT_CELEBRATE = 1.8; // seconds beaming in the seat after being served

function freeTable(G: GameState): number {
  for (let i = 0; i < G.tables.length; i++) if (G.tables[i].occupied === 0) return i;
  return -1;
}

function makeLook(rng: Ctx["rng"]): Customer["look"] {
  return { body: rng.int(0, 7), hair: rng.int(0, 6), hat: rng.chance(0.3), hue: rng.next() };
}

function spawnCustomer(ctx: Ctx): void {
  const { G, rng } = ctx;
  const ti = freeTable(G);
  if (ti < 0) return; // diner full — they'll arrive once a table frees up
  const menu = activeMenu(G);
  const order = rng.pick(menu).id;
  const dayIdx = Math.max(0, Math.min(PATIENCE.length - 1, G.day - 1));
  // The tutorial is utterly relaxed; real guests use the tuned patience curve.
  const maxP = G.tutorial ? 90 : PATIENCE[dayIdx] * G.derived.patienceMult;
  const uid = G.nextUid++;
  G.tables[ti].occupied = uid;
  G.customers.push({
    uid, order, table: ti,
    x: ENTRANCE.x, z: ENTRANCE.z, state: "entering",
    patience: maxP, maxPatience: maxP,
    served: false, servedT: 0, mood: 1, hop: 0,
    look: makeLook(rng),
  });
}

function freeUp(G: GameState, c: Customer): void {
  const tb = G.tables[c.table];
  if (tb && tb.occupied === c.uid) tb.occupied = 0;
}

function moveTo(c: Customer, tx: number, tz: number, speed: number, dt: number): boolean {
  const dx = tx - c.x;
  const dz = tz - c.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.12) {
    c.x = tx;
    c.z = tz;
    return true;
  }
  c.x += (dx / d) * speed * dt;
  c.z += (dz / d) * speed * dt;
  return false;
}

export function updateCustomers(ctx: Ctx, dt: number): void {
  const { G } = ctx;

  // Spawn pacing: a calm trickle, only while guests remain to arrive.
  if (G.spawnQueue > 0) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0 && freeTable(G) >= 0) {
      spawnCustomer(ctx);
      G.spawnQueue -= 1;
      G.spawnTimer = G.spawnGap;
    }
  }

  for (const c of G.customers) {
    if (c.hop > 0) c.hop = Math.max(0, c.hop - dt * 2);
    const tb = G.tables[c.table];
    switch (c.state) {
      case "entering": {
        if (tb && moveTo(c, tb.seatX, tb.seatZ, WALK, dt)) {
          c.state = "seated";
          c.patience = c.maxPatience;
        }
        break;
      }
      case "seated": {
        if (c.served) {
          c.servedT += dt;
          c.mood = 1;
          if (c.servedT > SIT_CELEBRATE) {
            c.state = "leaving";
            freeUp(G, c);
          }
        } else {
          c.patience -= dt;
          const ratio = c.patience / c.maxPatience;
          c.mood = damp(c.mood, clamp(ratio, 0, 1), 3, dt);
          // Gentle "please hurry!" nudge before a guest gives up — so it's never
          // a silent surprise for the kid.
          if (ratio < 0.3 && ctx.rng.chance(dt * 0.7)) {
            ctx.fx.float("🙏", c.x + 0.5, c.z + 1.0, { color: "#ffb84a" });
          }
          if (c.patience <= 0) {
            // Gives up — leaves a touch sad. No score penalty; just resets the
            // streak. Kindest possible "failure".
            c.state = "leaving";
            c.mood = 0;
            freeUp(G, c);
            G.combo = 0;
            G.comboT = 0;
            ctx.sfx.sad();
            ctx.fx.float("😞", c.x, c.z + 0.9, { color: "#9bb0c4" });
          }
        }
        break;
      }
      case "leaving": {
        moveTo(c, EXIT.x, EXIT.z, LEAVE, dt);
        break;
      }
    }
  }

  G.customers = G.customers.filter(
    (c) => !(c.state === "leaving" && Math.hypot(c.x - EXIT.x, c.z - EXIT.z) < 1.0),
  );
}

/** Combo cools off if you take too long between serves (purely cosmetic). */
export function updateCombo(G: GameState, dt: number): void {
  if (G.combo > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) {
      G.combo = 0;
      G.comboT = 0;
    }
  }
}
