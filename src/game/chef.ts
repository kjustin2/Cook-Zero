// The chef (Pip): WASD/arrow movement, soft collision with stations + tables, a
// little "zoom!" dash (Shift), facing, and the single-button interact. Movement
// is generous and never sticky — a kid should glide around, not get wedged.

import type { Ctx } from "./ctx";
import { actionFor } from "./interact";
import { DASH_CD, DASH_MULT, DASH_TIME, FIRE_AT, FLOOR } from "./balance";
import { clamp, damp } from "../core/math";

const CHEF_R = 0.5;
const STATION_R = 1.05;
const TABLE_R = 0.95;
const COOK_PULSE = 0.42;

export function startDash(ctx: Ctx): boolean {
  const c = ctx.G.chef;
  if (c.dashCd > 0 || c.dashT > 0) return false;
  c.dashT = DASH_TIME;
  c.dashCd = DASH_CD;
  ctx.sfx.dash();
  ctx.fx.trail(c.x, c.z);
  return true;
}

export function updateChef(ctx: Ctx, dt: number): void {
  const { G, input } = ctx;
  const c = G.chef;

  if (c.dashCd > 0) c.dashCd = Math.max(0, c.dashCd - dt);
  if (c.dashT > 0) c.dashT = Math.max(0, c.dashT - dt);
  if (c.cookT > 0) c.cookT = Math.max(0, c.cookT - dt);
  if (c.cheer > 0) c.cheer = Math.max(0, c.cheer - dt);

  const mv = input.moveVector();
  let dx = mv.x;
  let dz = mv.z;
  const len = Math.hypot(dx, dz);
  let speed = G.derived.moveSpeed;
  if (c.dashT > 0) speed *= DASH_MULT;

  if (len > 0.01) {
    dx /= len;
    dz /= len;
    c.vx = damp(c.vx, dx * speed, 18, dt);
    c.vz = damp(c.vz, dz * speed, 18, dt);
    c.facing = Math.atan2(dx, dz);
    if (c.dashT > 0 && ctx.rng.chance(dt * 30)) ctx.fx.trail(c.x, c.z);
  } else {
    c.vx = damp(c.vx, 0, 18, dt);
    c.vz = damp(c.vz, 0, 18, dt);
  }

  c.x += c.vx * dt;
  c.z += c.vz * dt;

  // Soft circle push-out from solid stations + tables.
  for (const st of G.stations) pushOut(c, st.x, st.z, CHEF_R + STATION_R);
  for (const tb of G.tables) pushOut(c, tb.x, tb.z, CHEF_R + TABLE_R);

  c.x = clamp(c.x, FLOOR.minX, FLOOR.maxX);
  c.z = clamp(c.z, FLOOR.minZ, FLOOR.maxZ);

  // On-a-roll glow follows the combo.
  const fireTarget = G.combo >= FIRE_AT ? clamp((G.combo - FIRE_AT + 1) / 4, 0.3, 1) : 0;
  G.fire = damp(G.fire, fireTarget, 4, dt);

  // One-button interact: compute the best nearby action; press SPACE/ENTER to do
  // it. The label/icon feeds the big on-screen button.
  const action = actionFor(ctx);
  G.prompt = action ? { label: action.label, icon: action.icon } : null;
  if (action && (input.pressed("Space") || input.pressed("Enter"))) {
    action.run();
    if (action.cooks) c.cookT = COOK_PULSE;
  }
}

function pushOut(
  c: { x: number; z: number; vx: number; vz: number },
  ox: number,
  oz: number,
  minDist: number,
): void {
  const dx = c.x - ox;
  const dz = c.z - oz;
  const d = Math.hypot(dx, dz);
  if (d < minDist && d > 0.0001) {
    const push = (minDist - d) / d;
    c.x += dx * push;
    c.z += dz * push;
  }
}
