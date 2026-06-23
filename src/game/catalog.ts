// All game data: the foods on the menu and the stations that make them. Pure
// data + lookups, no state. Each food is one simple path:
//   grab at `source`  →  (maybe) cook at `cook`  →  carry to the guest.
// Instant foods (drink, ice cream) have cook = null: you grab them ready-to-go.

import type { FoodDef, FoodId, GameState, StationDef, StationId } from "./types";

export const FOODS: FoodDef[] = [
  {
    id: "burger", name: "Burger", icon: "🍔", source: "meat", cook: "grill",
    minDay: 1, rawName: "a patty", color: 0x8a4f2a, rawColor: 0xd98f8f,
  },
  {
    id: "fries", name: "Fries", icon: "🍟", source: "potato", cook: "fryer",
    minDay: 1, rawName: "a potato", color: 0xe7b94e, rawColor: 0xf0e2b6,
  },
  {
    id: "drink", name: "Fizzy Pop", icon: "🥤", source: "soda", cook: null,
    minDay: 2, rawName: "a pop", color: 0xff5d6c, rawColor: 0xff5d6c,
  },
  {
    id: "icecream", name: "Ice Cream", icon: "🍦", source: "icecream", cook: null,
    minDay: 3, rawName: "a scoop", color: 0xfff0f5, rawColor: 0xfff0f5,
  },
  {
    id: "hotdog", name: "Hot Dog", icon: "🌭", source: "sausage", cook: "hotgrill",
    minDay: 4, rawName: "a sausage", color: 0xb5642f, rawColor: 0xe09a8a,
  },
];

export const STATIONS: StationDef[] = [
  { id: "meat", name: "Patty Box", kind: "source", icon: "🥩", color: 0xc4685f, gives: "burger", slots: 0 },
  { id: "grill", name: "Grill", kind: "cook", icon: "🔥", color: 0x4a4f59, cooks: ["burger"], slots: 2 },
  { id: "potato", name: "Potato Bin", kind: "source", icon: "🥔", color: 0xc8a063, gives: "fries", slots: 0 },
  { id: "fryer", name: "Fryer", kind: "cook", icon: "🍟", color: 0x53504a, cooks: ["fries"], slots: 2 },
  { id: "soda", name: "Pop Fountain", kind: "instant", icon: "🥤", color: 0x3a6ea5, gives: "drink", slots: 0 },
  { id: "icecream", name: "Ice Cream Swirl", kind: "instant", icon: "🍦", color: 0xffd1e8, gives: "icecream", slots: 0 },
  { id: "sausage", name: "Sausage Box", kind: "source", icon: "🥩", color: 0xcf7a6a, gives: "hotdog", slots: 0 },
  { id: "hotgrill", name: "Dog Grill", kind: "cook", icon: "🔥", color: 0x55504a, cooks: ["hotdog"], slots: 2 },
  { id: "trash", name: "Bin", kind: "trash", icon: "🗑️", color: 0x39414a, slots: 0 },
];

const FOOD_BY_ID = new Map(FOODS.map((f) => [f.id, f]));
const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]));

export const food = (id: FoodId): FoodDef => {
  const f = FOOD_BY_ID.get(id);
  if (!f) throw new Error(`unknown food ${id}`);
  return f;
};

export const stationDef = (id: StationId): StationDef => {
  const s = STATION_BY_ID.get(id);
  if (!s) throw new Error(`unknown station ${id}`);
  return s;
};

/** Foods on the menu for a given day (everything unlocked so far). */
export const menuForDay = (day: number): FoodDef[] => FOODS.filter((f) => f.minDay <= day);

/** The foods actually served right now: the player's chosen menu (or, during the
 *  guided tutorial, just the burger so the first lesson is one clear path). */
export function activeMenu(G: GameState): FoodDef[] {
  if (G.tutorial) return [food("burger")];
  const chosen = G.config.menu.map((id) => FOOD_BY_ID.get(id)).filter((f): f is FoodDef => !!f);
  return chosen.length ? chosen : menuForDay(G.day);
}

/** Which station ids are actually needed for the current menu (others are idle). */
export function activeStationIds(G: GameState): Set<StationId> {
  const ids = new Set<StationId>(["trash"]);
  for (const f of activeMenu(G)) {
    ids.add(f.source);
    if (f.cook) ids.add(f.cook);
  }
  return ids;
}
