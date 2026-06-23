// "Treats" — between-day upgrades, chosen one-of-three by picture. No economy, no
// reading required: a kid taps the shiny one. Most are repeatable stat boosts;
// "sparkle"/"helper" are one-time powers; "table"/"decor" change the restaurant
// itself (more seats / more score per guest).

import type { GameState, TreatDef, TreatId } from "./types";
import type { RNG } from "../core/rng";
import { addTable, recomputeDerived } from "./state";
import { MAX_TABLES } from "./customize";

export const TREATS: TreatDef[] = [
  { id: "fast", name: "Speedy Shoes", icon: "👟", blurb: "Run faster!" },
  { id: "reach", name: "Stretchy Arms", icon: "🤲", blurb: "Grab from farther away!" },
  { id: "time", name: "Extra Time", icon: "⏰", blurb: "More time each day!" },
  { id: "quickcook", name: "Super Stove", icon: "🔥", blurb: "Food cooks faster!" },
  { id: "patient", name: "Comfy Chairs", icon: "🛋️", blurb: "Guests wait happily longer!" },
  { id: "extracustomer", name: "Big Crowd", icon: "🎈", blurb: "More happy guests to feed!" },
  { id: "table", name: "New Table", icon: "🪑", blurb: "Another table — more guests at once!" },
  { id: "decor", name: "Decorations", icon: "🖼️", blurb: "Cosier diner — more points per guest!" },
  { id: "sparkle", name: "Sparkle Power", icon: "✨", blurb: "Every dish bursts confetti!" },
  { id: "helper", name: "Helper Pal", icon: "🧑‍🍳", blurb: "Food never burns — stays perfect!" },
];

const BY_ID = new Map(TREATS.map((t) => [t.id, t]));
const ONE_TIME: TreatId[] = ["sparkle", "helper"];

export const treatDef = (id: TreatId): TreatDef | undefined => BY_ID.get(id);

/** Is this treat still offerable given what's owned / the diner's state? */
function offerable(id: TreatId, s: GameState): boolean {
  if (ONE_TIME.includes(id) && s.treats.includes(id)) return false;
  if (id === "table" && s.config.tableCount >= MAX_TABLES) return false;
  return true;
}

/** Three treats to offer between days (filtered + shuffled). */
export function rollTreats(rng: RNG, s: GameState): TreatId[] {
  const pool = TREATS.map((t) => t.id).filter((id) => offerable(id, s));
  rng.shuffle(pool);
  return pool.slice(0, 3);
}

export function chooseTreat(s: GameState, id: TreatId): boolean {
  if (!BY_ID.has(id)) return false;
  s.treats.push(id);
  // Some treats reshape the restaurant itself.
  if (id === "table") addTable(s);
  if (id === "decor") s.config.decorLevel += 1;
  recomputeDerived(s);
  return true;
}
