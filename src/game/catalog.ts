// All game data: recipes, placeable stations/decor, and the rules that map raw
// ingredients to cooked/prepped parts. Pure data + lookups, no state.

import type { CatalogDef, IngredientId, PartId, Recipe, StationKind } from "./types";
import { GRILL_COOK, GRILL_PERFECT, FRY_COOK, FRY_GOLDEN, DRINK_POUR } from "./balance";

// ─── Recipes ─────────────────────────────────────────────────────────────────

export const RECIPES: Recipe[] = [
  { id: "fries", name: "Fries Basket", parts: ["fries"], basePrice: 9, minDay: 1, weight: 3, icon: "🍟" },
  { id: "burger", name: "Classic Burger", parts: ["bun", "patty"], basePrice: 15, minDay: 1, weight: 4, icon: "🍔" },
  { id: "cheeseburger", name: "Cheeseburger", parts: ["bun", "patty", "cheese"], basePrice: 21, minDay: 1, weight: 3, icon: "🧀" },
  { id: "salad", name: "Garden Salad", parts: ["lettuce", "tomato"], basePrice: 14, minDay: 2, weight: 2, icon: "🥗" },
  { id: "combo", name: "Combo Meal", parts: ["bun", "patty", "fries"], basePrice: 26, minDay: 2, weight: 3, icon: "🍱" },
  { id: "soda_combo", name: "Soda Combo", parts: ["bun", "patty", "soda"], basePrice: 24, minDay: 3, weight: 2, icon: "🥤" },
  { id: "deluxe", name: "Deluxe Burger", parts: ["bun", "patty", "cheese", "lettuce", "tomato"], basePrice: 34, minDay: 3, weight: 2, icon: "🍔" },
  { id: "double", name: "Double Trouble", parts: ["bun", "patty", "patty", "cheese"], basePrice: 40, minDay: 4, weight: 2, icon: "😤" },
  { id: "veggie", name: "Veggie Deluxe", parts: ["bun", "lettuce", "tomato", "cheese"], basePrice: 28, minDay: 4, weight: 1, icon: "🥬" },
  { id: "mega", name: "Mega Stack", parts: ["bun", "patty", "patty", "cheese", "fries", "soda"], basePrice: 56, minDay: 5, weight: 1, icon: "🍔" },
];

/** Normalized key for multiset comparison of parts. */
export const partsKey = (parts: PartId[]): string => [...parts].sort().join("+");

// ─── Cooking rules ───────────────────────────────────────────────────────────

export interface CookSpec {
  accepts: IngredientId; // raw input
  start: IngredientId; // what sits in the slot while cooking
  part: PartId; // produced part
  cook: number;
  perfect: number;
  canBurn: boolean;
}

export const COOK_SPECS: Partial<Record<StationKind, CookSpec>> = {
  grill: { accepts: "patty_raw", start: "patty_raw", part: "patty", cook: GRILL_COOK, perfect: GRILL_PERFECT, canBurn: true },
  fryer: { accepts: "potato", start: "potato", part: "fries", cook: FRY_COOK, perfect: FRY_GOLDEN, canBurn: false },
  // Drink station pours with empty hands; "cup" represents the filling glass.
  drink: { accepts: "cup", start: "cup", part: "soda", cook: DRINK_POUR, perfect: 99, canBurn: false },
};

/** Ingredients that drop straight onto a plate at a prep counter (no cooking). */
export const PREP_DIRECT: Partial<Record<IngredientId, PartId>> = {
  bun: "bun",
  cheese: "cheese",
  lettuce: "lettuce",
  tomato: "tomato",
};

// ─── Placeable catalog ───────────────────────────────────────────────────────

export const CATALOG: CatalogDef[] = [
  // Functional stations
  { id: "grill", name: "Grill", category: "station", kind: "grill", slots: 2, cost: 55, solid: true, color: 0x4a4f59, icon: "🔥", desc: "Cooks patties. Pull at the golden window for a Perfect sear." },
  { id: "fryer", name: "Fryer", category: "station", kind: "fryer", slots: 2, cost: 50, solid: true, color: 0x53504a, icon: "🍟", desc: "Fries potatoes. Never burns, but golden fries score more." },
  { id: "prep", name: "Prep Counter", category: "station", kind: "prep", slots: 1, cost: 40, solid: true, color: 0x8a8f98, icon: "🔪", desc: "Assemble plates here. Stack parts, then pick up the plate." },
  { id: "drink", name: "Soda Fountain", category: "station", kind: "drink", slots: 2, cost: 45, solid: true, color: 0x3a6ea5, icon: "🥤", desc: "Pour sodas with empty hands." },
  { id: "trash", name: "Trash Bin", category: "station", kind: "trash", slots: 0, cost: 12, solid: true, color: 0x33373d, icon: "🗑️", desc: "Dump a burnt patty or a wrong item." },
  { id: "bin_bun", name: "Bun Bin", category: "station", kind: "bin", ingredient: "bun", cost: 28, solid: true, color: 0xd9a866, icon: "🥯", desc: "Dispenses buns." },
  { id: "bin_patty", name: "Patty Fridge", category: "station", kind: "bin", ingredient: "patty_raw", cost: 30, solid: true, color: 0xb35b5b, icon: "🥩", desc: "Dispenses raw patties." },
  { id: "bin_potato", name: "Potato Crate", category: "station", kind: "bin", ingredient: "potato", cost: 26, solid: true, color: 0xc8a063, icon: "🥔", desc: "Dispenses potatoes for the fryer." },
  { id: "bin_cheese", name: "Cheese Bin", category: "station", kind: "bin", ingredient: "cheese", cost: 24, solid: true, color: 0xe9c14a, icon: "🧀", desc: "Dispenses cheese slices." },
  { id: "bin_lettuce", name: "Lettuce Bin", category: "station", kind: "bin", ingredient: "lettuce", cost: 22, solid: true, color: 0x6fbf5a, icon: "🥬", desc: "Dispenses lettuce." },
  { id: "bin_tomato", name: "Tomato Bin", category: "station", kind: "bin", ingredient: "tomato", cost: 22, solid: true, color: 0xe05a44, icon: "🍅", desc: "Dispenses tomato." },

  // Decor — adjacency (boost neighbouring stations)
  { id: "fan", name: "Cooling Fan", category: "decor", cost: 35, solid: true, color: 0x9fb6c4, icon: "🌀", desc: "Adjacent grills & fryers cook 20% faster.", adj: { to: ["grill", "fryer"], cookSpeedMult: 1.2 } },
  { id: "hood", name: "Exhaust Hood", category: "decor", cost: 62, solid: true, color: 0x7d8590, icon: "💨", desc: "Adjacent grills cook 30% faster.", adj: { to: ["grill"], cookSpeedMult: 1.3 } },
  { id: "spice", name: "Spice Rack", category: "decor", cost: 40, solid: true, color: 0xc06a3a, icon: "🧂", desc: "+0.6s perfect windows, +1 tip per serve.", global: { perfectWindow: 0.6, tipFlat: 1 } },

  // Decor — global vibe / front-of-house
  { id: "plant", name: "Potted Plant", category: "decor", cost: 26, solid: true, color: 0x4f9d52, icon: "🪴", desc: "Cozy vibe. Calms waiting customers (best up front).", global: { vibe: 10, patienceMult: 1.04 } },
  { id: "flowers", name: "Flower Vase", category: "decor", cost: 24, solid: true, color: 0xd56b9c, icon: "💐", desc: "Pretty vibe; a little extra patience.", global: { vibe: 8, patienceMult: 1.05 } },
  { id: "lamp", name: "Warm Lamp", category: "decor", cost: 30, solid: true, color: 0xf2c879, icon: "💡", desc: "Warm glow. +1 tip per serve.", global: { vibe: 9, tipFlat: 1 } },
  { id: "painting", name: "Wall Art", category: "decor", cost: 45, solid: true, color: 0x8a6bbf, icon: "🖼️", desc: "Classy. Reputation grows 20% faster.", global: { vibe: 12, repGainMult: 1.2 } },
  { id: "speaker", name: "Speaker", category: "decor", cost: 50, solid: true, color: 0x33373d, icon: "🔊", desc: "Good tunes keep the combo alive +2s.", global: { vibe: 6, comboWindow: 2 } },
  { id: "rug", name: "Floor Rug", category: "decor", cost: 26, solid: false, color: 0xb5573f, icon: "🧶", desc: "Walkable! Chef moves 5% faster on it.", global: { vibe: 4, moveSpeedMult: 1.05 } },
  { id: "neon", name: "Neon Sign", category: "decor", cost: 70, solid: true, color: 0xff4fd8, icon: "🪧", desc: "Big vibe. Draws a bigger crowd.", global: { vibe: 16 } },
  { id: "menuboard", name: "Menu Board", category: "decor", cost: 40, solid: true, color: 0x2f3640, icon: "📋", desc: "Reputation grows 20% faster.", global: { vibe: 5, repGainMult: 1.2 } },
  { id: "aquarium", name: "Aquarium", category: "decor", cost: 110, solid: true, color: 0x2aa9b8, icon: "🐠", desc: "Mesmerizing. Big vibe, calmer guests.", global: { vibe: 22, patienceMult: 1.08 } },
  { id: "tv", name: "Wall TV", category: "decor", cost: 90, solid: true, color: 0x1c2026, icon: "📺", desc: "Keeps guests entertained: vibe + combo +1s.", global: { vibe: 14, comboWindow: 1 } },

  // More decor — heavy customization
  { id: "lights", name: "Fairy Lights", category: "decor", cost: 30, solid: false, color: 0xffe6a0, icon: "✨", desc: "Twinkly warm vibe. +1 tip per serve.", global: { vibe: 9, tipFlat: 1 } },
  { id: "clock", name: "Wall Clock", category: "decor", cost: 24, solid: true, color: 0xe8e2d0, icon: "🕐", desc: "Keeps guests patient (+5%).", global: { vibe: 5, patienceMult: 1.05 } },
  { id: "cat", name: "Café Cat", category: "decor", cost: 95, solid: true, color: 0x9a7b5a, icon: "🐱", desc: "Adorable! Big vibe + calmer guests.", global: { vibe: 16, patienceMult: 1.06 } },
  { id: "balloons", name: "Balloons", category: "decor", cost: 28, solid: false, color: 0xff7aa8, icon: "🎈", desc: "Party vibe — draws a crowd.", global: { vibe: 11 } },
  { id: "jukebox", name: "Jukebox", category: "decor", cost: 80, solid: true, color: 0xc23a3a, icon: "🎵", desc: "Tunes! Combo lasts +2s, good vibe.", global: { vibe: 10, comboWindow: 2 } },
  { id: "poster", name: "Band Poster", category: "decor", cost: 22, solid: false, color: 0x6a8cff, icon: "🎤", desc: "Cool. Reputation grows 15% faster.", global: { vibe: 7, repGainMult: 1.15 } },
  { id: "bookshelf", name: "Bookshelf", category: "decor", cost: 55, solid: true, color: 0x7a5230, icon: "📚", desc: "Cozy nook: +vibe, +6% patience.", global: { vibe: 10, patienceMult: 1.06 } },
  { id: "candle", name: "Candle", category: "decor", cost: 18, solid: false, color: 0xffb060, icon: "🕯️", desc: "Romantic glow. +1 tip per serve.", global: { vibe: 6, tipFlat: 1 } },
];

const BY_ID = new Map(CATALOG.map((d) => [d.id, d]));

export const def = (id: string): CatalogDef | undefined => BY_ID.get(id);

/** Defs purchasable in the shop (everything with a cost > 0). */
export const SHOP_ITEMS = CATALOG.filter((d) => d.cost > 0);
