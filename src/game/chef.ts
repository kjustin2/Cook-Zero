// Chef movement (continuous, collides with solid station cells) and the
// interact trigger. The chef roams the kitchen on the +Z side of the counter.

import type { Ctx } from "./ctx";
import { actionFor } from "./interact";
import { cellOfWorld, isSolidAt, worldOfCell, COUNTER_Z, TILE } from "./grid";
import { DASH_CD, DASH_MULT, DASH_TIME } from "./balance";
import { clamp, damp } from "../core/math";

const MOVE_SPEED = 6.6;
const CHEF_R = 0.42;
const CELL_HALF = TILE * 0.38; // solid footprint half-extent (gaps to walk)

function resolveAxis(ctx: Ctx, axis: "x" | "z"): void {
  const { G } = ctx;
  const chef = G.chef;
  const { col, row } = cellOfWorld(G.grid, chef.x, chef.z);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      const r = row + dr;
      if (!isSolidAt(G.grid, c, r)) continue;
      const { x: cx, z: cz } = worldOfCell(G.grid, c, r);
      const minX = cx - CELL_HALF - CHEF_R;
      const maxX = cx + CELL_HALF + CHEF_R;
      const minZ = cz - CELL_HALF - CHEF_R;
      const maxZ = cz + CELL_HALF + CHEF_R;
      if (chef.x <= minX || chef.x >= maxX || chef.z <= minZ || chef.z >= maxZ) continue;
      // Overlapping this cell's expanded box — push out along the active axis.
      if (axis === "x") {
        const pushL = chef.x - minX;
        const pushR = maxX - chef.x;
        if (pushL < pushR) chef.x = minX;
        else chef.x = maxX;
        chef.vx = 0;
      } else {
        const pushU = chef.z - minZ;
        const pushD = maxZ - chef.z;
        if (pushU < pushD) chef.z = minZ;
        else chef.z = maxZ;
        chef.vz = 0;
      }
    }
  }
}

/** Begin a dash in the current heading (or facing) if off cooldown. */
export function startDash(ctx: Ctx): boolean {
  const { G, input } = ctx;
  const chef = G.chef;
  if (chef.dashT > 0 || chef.dashCD > 0) return false;
  const mv = input.moveVector();
  const len = Math.hypot(mv.x, mv.z);
  if (len > 0) {
    chef.dashX = mv.x / len;
    chef.dashZ = mv.z / len;
  } else {
    chef.dashX = Math.sin(chef.face);
    chef.dashZ = -Math.cos(chef.face);
  }
  chef.dashT = DASH_TIME;
  chef.dashCD = DASH_CD;
  chef.face = Math.atan2(chef.dashX, -chef.dashZ);
  ctx.sfx.dash();
  ctx.fx.trail(chef.x, chef.z);
  return true;
}

export function updateChef(ctx: Ctx, dt: number): void {
  const { G, input } = ctx;
  const chef = G.chef;
  if (chef.dashCD > 0) chef.dashCD -= dt;

  const mv = input.moveVector();
  const len = Math.hypot(mv.x, mv.z);
  const nx = len > 0 ? mv.x / len : 0;
  const nz = len > 0 ? mv.z / len : 0;
  const speed = MOVE_SPEED * G.derived.moveSpeed;

  if (chef.dashT > 0) {
    chef.dashT -= dt;
    const ds = speed * DASH_MULT;
    chef.vx = chef.dashX * ds;
    chef.vz = chef.dashZ * ds;
    if (ctx.rng.chance(dt * 18)) ctx.fx.trail(chef.x, chef.z);
  } else {
    chef.vx = damp(chef.vx, nx * speed, 18, dt);
    chef.vz = damp(chef.vz, nz * speed, 18, dt);
  }

  chef.x += chef.vx * dt;
  resolveAxis(ctx, "x");
  chef.z += chef.vz * dt;
  resolveAxis(ctx, "z");

  // Play-area bounds.
  const halfW = (G.grid.cols / 2) * TILE + 0.6;
  const backZ = worldOfCell(G.grid, 0, G.grid.rows - 1).z + TILE * 0.7;
  chef.x = clamp(chef.x, -halfW, halfW);
  chef.z = clamp(chef.z, COUNTER_Z + 0.7, backZ);

  const moving = len > 0.01 || chef.dashT > 0;
  if (len > 0.01) chef.face = Math.atan2(nx, -nz); // face the heading
  if (moving) {
    chef.walk += dt * (6 + Math.hypot(chef.vx, chef.vz) * 0.7);
  } else {
    chef.walk = damp(chef.walk, 0, 6, dt);
  }

  // On-fire glow follows combo.
  const fireTarget = G.combo >= 5 ? clamp((G.combo - 4) / 4, 0.3, 1) : 0;
  chef.fire = damp(chef.fire, fireTarget, 4, dt);

  // Interact.
  if (chef.interactCD > 0) chef.interactCD -= dt;
  const action = actionFor(ctx);
  G.hint = action ? action.label : "";
  if (action && input.pressed("Space") && chef.interactCD <= 0) {
    action.run();
    chef.interactCD = 0.14;
  }
}
