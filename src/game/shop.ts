// Between-day shop: spend banked coins on stations, decor and your helper.
// Purchases land in G.inventory and are placed in build mode.

import type { GameState } from "./types";
import type { RNG } from "../core/rng";
import { SHOP_ITEMS, def } from "./catalog";
import { HELPER_HIRE_COST, HELPER_UPGRADE_COST, HELPER_WAGES } from "./balance";

/** Roll a rotating shop stock (a spread of stations + decor scaled to the day). */
export function rollShop(s: GameState, rng: RNG): void {
  const pool = SHOP_ITEMS.map((d) => d.id);
  rng.shuffle(pool);
  // Guarantee at least a couple of functional stations and some decor.
  const stations = pool.filter((id) => def(id)?.category === "station");
  const decor = pool.filter((id) => def(id)?.category === "decor");
  const pick = [...stations.slice(0, 3), ...decor.slice(0, 5)];
  rng.shuffle(pick);
  s.shopOffer = pick.slice(0, 6);
}

export function canAfford(s: GameState, defId: string): boolean {
  const d = def(defId);
  return !!d && s.coins >= d.cost;
}

export function buyItem(s: GameState, defId: string): boolean {
  const d = def(defId);
  if (!d || s.coins < d.cost) return false;
  s.coins -= d.cost;
  s.inventory[defId] = (s.inventory[defId] ?? 0) + 1;
  return true;
}

export function hireHelper(s: GameState): boolean {
  if (s.helper.hired || s.coins < HELPER_HIRE_COST) return false;
  s.coins -= HELPER_HIRE_COST;
  s.helper.hired = true;
  s.helper.level = 1;
  s.helper.wage = HELPER_WAGES[1];
  s.helper.x = 0;
  s.helper.z = 6.5;
  return true;
}

export function upgradeHelper(s: GameState): boolean {
  const next = s.helper.level + 1;
  if (!s.helper.hired || next >= HELPER_WAGES.length) return false;
  const cost = HELPER_UPGRADE_COST[next] ?? 0;
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.helper.level = next;
  s.helper.wage = HELPER_WAGES[next];
  return true;
}
