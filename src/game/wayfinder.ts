// The Wayfinder — the kid never gets lost. One function reads the real game
// state (what's in your hands, who's waiting, what's cooking) and points a
// glowing beacon + on-screen arrow at the single most helpful next thing to do,
// with a matching label/icon. Because the goal and the arrow come from the same
// place, they can never disagree. (Lesson borrowed from Wall-of-Dead-2.)

import type { GameState, Station } from "./types";
import { food } from "./catalog";
import { readySlot } from "./stations";
import { dist } from "../core/math";

function station(G: GameState, id: Station["id"]): Station | undefined {
  return G.stations.find((s) => s.id === id);
}

function nearestReadyCook(G: GameState): Station | null {
  let best: Station | null = null;
  let bestD = Infinity;
  for (const st of G.stations) {
    if (st.kind !== "cook" || readySlot(st) < 0) continue;
    const d = dist(G.chef.x, G.chef.z, st.x, st.z);
    if (d < bestD) {
      bestD = d;
      best = st;
    }
  }
  return best;
}

export function computeGuide(G: GameState): void {
  const g = G.guide;
  const set = (x: number, z: number, label: string, icon: string) => {
    g.x = x;
    g.z = z;
    g.label = label;
    g.icon = icon;
    g.active = true;
  };
  g.active = false;

  const carry = G.chef.carry;

  if (carry && carry.kind === "burnt") {
    const t = station(G, "trash");
    if (t) set(t.x, t.z, "Toss it in the bin", "🗑️");
    return;
  }

  if (carry && carry.kind === "raw") {
    const def = food(carry.food);
    if (def.cook) {
      const st = station(G, def.cook);
      if (st) set(st.x, st.z, "Cook it here!", "🔥");
    }
    return;
  }

  if (carry && carry.kind === "ready") {
    // Point at the nearest matching guest — INCLUDING one still walking to their
    // seat — so the guidance never goes blank while holding finished food.
    const icon = food(carry.food).icon;
    let bestC: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (const c of G.customers) {
      if (c.served || c.state === "leaving" || c.order !== carry.food) continue;
      const d = dist(G.chef.x, G.chef.z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        bestC = c;
      }
    }
    if (bestC) set(bestC.x, bestC.z, "Bring it over!", icon);
    else set(0, 1.5, "Carry it to a hungry friend!", icon); // extra dish — never blank
    return;
  }

  // Empty hands: if something's ready to pull, go get it...
  const ready = nearestReadyCook(G);
  if (ready) {
    const idx = readySlot(ready);
    const f = ready.slots[idx].food;
    set(ready.x, ready.z, "It's ready — grab it!", f ? food(f).icon : "✨");
    return;
  }

  // ...otherwise head to the ingredient the most-impatient SEATED guest wants
  // (a guest still walking in has full patience and shouldn't win the pick).
  let urgent: { order: GameState["customers"][number]["order"] } | null = null;
  let least = Infinity;
  for (const c of G.customers) {
    if (c.state !== "seated" || c.served) continue;
    if (c.patience < least) {
      least = c.patience;
      urgent = c;
    }
  }
  // Fall back to a guest still walking in, so guidance never blanks at shift start.
  if (!urgent) {
    for (const c of G.customers) {
      if (c.state === "entering" && !c.served) {
        urgent = c;
        break;
      }
    }
  }
  if (urgent) {
    const def = food(urgent.order);
    const src = station(G, def.source);
    if (src) set(src.x, src.z, `Grab ${def.rawName}`, def.icon);
  }
}
