// Roguelite upgrades — flat run-wide buffs that mutate G.mods (distinct from the
// placement/adjacency layer). Offered 3-at-a-time in the between-day manager.

import type { GameState, Mods } from "./types";
import type { RNG } from "../core/rng";
import { recomputeDerived } from "./adjacency";

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  max: number;
  apply: (m: Mods) => void;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "turbo", name: "Turbo Burners", desc: "All stations cook 20% faster", icon: "🔥", max: 3, apply: (m) => (m.cookSpeed *= 1.2) },
  { id: "shoes", name: "Rocket Shoes", desc: "Move 15% faster", icon: "👟", max: 3, apply: (m) => (m.moveSpeed *= 1.15) },
  { id: "zen", name: "Charming Host", desc: "Customers wait 18% longer", icon: "🧘", max: 2, apply: (m) => (m.patience *= 1.18) },
  { id: "sear", name: "Golden Sear", desc: "Perfect windows last +1.2s", icon: "✨", max: 2, apply: (m) => (m.perfectWindow += 1.2) },
  { id: "tips", name: "Tip Jar", desc: "+3 coins on every serve", icon: "💰", max: 3, apply: (m) => (m.tip += 3) },
  { id: "keeper", name: "Combo Keeper", desc: "Combo lasts +4s longer", icon: "🧲", max: 2, apply: (m) => (m.comboWindow += 4) },
  { id: "charm", name: "Five Stars", desc: "Reputation grows 30% faster", icon: "⭐", max: 2, apply: (m) => (m.repGain *= 1.3) },
  { id: "prep", name: "Mise en Place", desc: "Move 8% faster & cook 8% faster", icon: "🧑‍🍳", max: 2, apply: (m) => { m.moveSpeed *= 1.08; m.cookSpeed *= 1.08; } },
];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

/** Three offerable upgrades (respecting per-upgrade max stacks). */
export function rollUpgrades(rng: RNG, owned: Record<string, number>): string[] {
  const pool = UPGRADES.filter((u) => (owned[u.id] ?? 0) < u.max).map((u) => u.id);
  rng.shuffle(pool);
  return pool.slice(0, 3);
}

export function applyUpgrade(s: GameState, id: string): boolean {
  const u = BY_ID.get(id);
  if (!u) return false;
  if ((s.upgrades[id] ?? 0) >= u.max) return false;
  u.apply(s.mods);
  s.upgrades[id] = (s.upgrades[id] ?? 0) + 1;
  recomputeDerived(s);
  return true;
}

export const upgradeDef = (id: string): UpgradeDef | undefined => BY_ID.get(id);
