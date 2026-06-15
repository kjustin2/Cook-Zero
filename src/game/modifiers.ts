// Daily modifiers — a single random "twist" applied to each shift from day 2 on,
// announced with a banner at the start of the shift. Mostly upside boons that
// reshape strategy. Effects are read by adjacency.ts (derived knobs),
// serving.ts (perfect/pay), and customers.ts (VIP rate).

import type { DayModifier } from "./types";
import type { RNG } from "../core/rng";

export const MODIFIERS: DayModifier[] = [
  { id: "happy", name: "Happy Hour", desc: "Relaxed guests — patience +25%", icon: "🍹", patienceMult: 1.25 },
  { id: "rush", name: "Dinner Rush", desc: "A big crowd pours in (+35%)", icon: "👥", spawnMult: 1.35 },
  { id: "foodie", name: "Foodie Night", desc: "Perfect dishes pay double", icon: "✨", perfectMult: 2 },
  { id: "tippers", name: "Big Tippers", desc: "Generous guests — tips +$2 and +30%", icon: "💸", tipAdd: 2, tipMult: 1.3 },
  { id: "vip", name: "VIP Night", desc: "The town's regulars are out — more VIPs", icon: "👑", vipBoost: 0.3 },
  { id: "gourmet", name: "Gourmet Crowd", desc: "Everyone pays +15%, but they are picky (patience -10%)", icon: "🍽️", payMult: 1.15, patienceMult: 0.9 },
];

const BY_ID = new Map(MODIFIERS.map((m) => [m.id, m]));

export const modifierById = (id: string): DayModifier | undefined => BY_ID.get(id);

/** One random modifier per day (none on day 1). */
export function rollModifier(rng: RNG, day: number): DayModifier | null {
  if (day <= 1) return null;
  return rng.pick(MODIFIERS);
}
