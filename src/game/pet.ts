// The diner's pet — a corgi! It happily wanders the dining area. The chef can
// PET it (joy + everyone cheers up a little) or FEED it a finished dish (a fun,
// optional "cool decision": spend a dish to delight the pup and keep your
// streak). Petting/feeding are never required, so they stay pure fun.

import type { Ctx } from "./ctx";
import { COMBO_WINDOW } from "./balance";
import { clamp, damp } from "../core/math";

const ZONE = { minX: -9, maxX: 9, minZ: -4.5, maxZ: 6 };

export function updatePet(ctx: Ctx, dt: number): void {
  const { G, rng } = ctx;
  const p = G.pet;
  p.wag += dt * (4 + p.happy * 8);
  if (p.hop > 0) p.hop = Math.max(0, p.hop - dt * 2);
  if (p.barkT > 0) p.barkT -= dt;
  p.happy = damp(p.happy, 0.4, 0.3, dt); // settles to a content baseline

  let tx = p.tx;
  let tz = p.tz;
  if (p.followT > 0) {
    p.followT -= dt;
    tx = G.chef.x;
    tz = G.chef.z + 1.3; // trot a step behind the chef
  } else {
    p.retargetT -= dt;
    if (p.retargetT <= 0 || Math.hypot(p.x - p.tx, p.z - p.tz) < 0.4) {
      p.tx = rng.range(ZONE.minX, ZONE.maxX);
      p.tz = rng.range(ZONE.minZ, ZONE.maxZ);
      p.retargetT = rng.range(2.5, 5);
    }
    tx = p.tx;
    tz = p.tz;
  }

  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  const speed = p.followT > 0 ? 4.6 : 2.4;
  if (d > 0.3) {
    p.vx = damp(p.vx, (dx / d) * speed, 8, dt);
    p.vz = damp(p.vz, (dz / d) * speed, 8, dt);
  } else {
    p.vx = damp(p.vx, 0, 8, dt);
    p.vz = damp(p.vz, 0, 8, dt);
  }
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.x = clamp(p.x, ZONE.minX, ZONE.maxX);
  p.z = clamp(p.z, ZONE.minZ, ZONE.maxZ);
  for (const tb of G.tables) {
    const ddx = p.x - tb.x;
    const ddz = p.z - tb.z;
    const dd = Math.hypot(ddx, ddz);
    if (dd < 1.25 && dd > 0.001) {
      const k = (1.25 - dd) / dd;
      p.x += ddx * k;
      p.z += ddz * k;
    }
  }

  if (p.barkT <= 0 && p.happy > 0.55 && rng.chance(dt * 0.5)) {
    ctx.sfx.bark();
    ctx.fx.float("🐾", p.x, p.z + 0.8, { color: "#ffd27a" });
    p.barkT = rng.range(4, 8);
  }
}

export function petPet(ctx: Ctx): void {
  const { G } = ctx;
  const p = G.pet;
  p.happy = 1;
  p.followT = 4;
  p.hop = 1;
  G.chef.cheer = 1;
  ctx.sfx.bark();
  ctx.sfx.yay();
  ctx.fx.hearts(p.x, p.z);
  ctx.fx.float("So happy! 🐾", p.x, p.z + 0.9, { color: "#ff9ec7", big: true });
  // The cute dog cheers everyone up — a little patience back for waiting guests.
  for (const c of G.customers) {
    if (c.state === "seated" && !c.served) {
      c.patience = Math.min(c.maxPatience, c.patience + 3);
      ctx.fx.float("😊", c.x, c.z + 0.9, { color: "#7cff8a" });
    }
  }
}

export function feedPet(ctx: Ctx): void {
  const { G } = ctx;
  const p = G.pet;
  p.happy = 1;
  p.followT = 6;
  p.hop = 1;
  G.chef.carry = null;
  ctx.sfx.bark();
  ctx.sfx.yay();
  ctx.fx.hearts(p.x, p.z);
  ctx.fx.burst(p.x, p.z + 0.5, 0xff8fc4, 12);
  ctx.fx.float("YUM! 🦴", p.x, p.z + 0.9, { color: "#ffd24a", big: true });
  G.coins += 3;
  G.comboT = Math.max(G.comboT, COMBO_WINDOW); // keep your streak going
}
