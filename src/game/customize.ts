// Restaurant customization data: the default look (reproduces the original diner
// exactly), the swatch palettes the setup/manage screens offer, the choosable
// pets/foods, and the content-unlock table (new foods/pets/colours appear as the
// player reaches further days). Pure data + small helpers — no Three.js, no G.

import type {
  ChefLook, DinerPalette, FoodId, PetKind, PetLook, PlantStyle,
  RestaurantConfig, StationStyle, TableStyle,
} from "./types";

// ── Defaults (match the original hand-tuned colours one-for-one) ──────────────

export const DEFAULT_CHEF: ChefLook = { apron: 0xf6f3ec, accent: 0xff7a8a, skin: 0xffd9b3, hat: 0xfdfcf8, hair: 0x6b4423 };
export const DEFAULT_PET: PetLook = { kind: "corgi", body: 0xe09a4a, belly: 0xf7efdf, accent: 0xffb3c1 };
export const DEFAULT_PALETTE: DinerPalette = { wall: 0xa6d8c2, floorA: 0xf0d0a0, floorB: 0xe0b87e, stripe: 0xff9ec7, window: 0xa9d8f0 };
export const DEFAULT_TABLE: TableStyle = { top: 0xfff0e0, rim: 0xff9ec7, leg: 0xd98f5a, chair: 0x7ec4ff };
export const DEFAULT_STATION: StationStyle = { body: 0x6f7480, trim: 0xffd27a };

/** The four front planters, each a different candy flower. */
export const DEFAULT_PLANTS: PlantStyle[] = [
  { kind: 0, bloom: 0xff6f9c },
  { kind: 1, bloom: 0xffd23a },
  { kind: 2, bloom: 0x7aa8ff },
  { kind: 3, bloom: 0xff5d5d },
];

export const FOOD_BLOOMS = [0xff6f9c, 0xffd23a, 0x7aa8ff, 0xff5d5d, 0xb98cff, 0x7be0a8];

export const MIN_TABLES = 3;
export const MAX_TABLES = 6;
export const START_TABLES = 4;

/** A brand-new diner config — choosable foods kept to the starter set. */
export function defaultConfig(): RestaurantConfig {
  return {
    name: "Grandma's Diner",
    menu: ["burger", "fries", "drink"],
    tableCount: START_TABLES,
    decorLevel: 0,
    chef: { ...DEFAULT_CHEF },
    pet: { ...DEFAULT_PET },
    palette: { ...DEFAULT_PALETTE },
    table: { ...DEFAULT_TABLE },
    station: { ...DEFAULT_STATION },
    plants: DEFAULT_PLANTS.map((p) => ({ ...p })),
  };
}

/** Deep-ish clone (used when loading a saved config so we never alias defaults). */
export function cloneConfig(c: RestaurantConfig): RestaurantConfig {
  return {
    ...c,
    menu: [...c.menu],
    chef: { ...c.chef },
    pet: { ...c.pet },
    palette: { ...c.palette },
    table: { ...c.table },
    station: { ...c.station },
    plants: c.plants.map((p) => ({ ...p })),
  };
}

// ── Swatch palettes the wizard offers (named, kid-friendly colours) ───────────

export interface Swatch { hex: number; name: string; }
const sw = (hex: number, name: string): Swatch => ({ hex, name });

/** A warm, candy spread that works for almost any "pick a colour" question. */
export const SWATCHES: Swatch[] = [
  sw(0xffffff, "White"), sw(0xff5d6c, "Strawberry"), sw(0xffa14a, "Tangerine"), sw(0xffd23a, "Lemon"),
  sw(0x7be0a8, "Mint"), sw(0x5fbf6a, "Leaf"), sw(0x5fc4ff, "Sky"), sw(0x7aa8ff, "Blue"),
  sw(0xb98cff, "Grape"), sw(0xff9ec7, "Bubblegum"), sw(0xfdfcf8, "Cream"), sw(0x6f7480, "Steel"),
  sw(0x9a5a30, "Cocoa"), sw(0x2a2a2e, "Midnight"),
];

/** Skin/fur tones for the chef + pet bodies. */
export const TONE_SWATCHES: Swatch[] = [
  sw(0xffffff, "White"), sw(0xffe0bd, "Peach"), sw(0xf6c9a0, "Honey"), sw(0xe8b07e, "Caramel"),
  sw(0xc68642, "Cocoa"), sw(0x8d5524, "Mocha"), sw(0x2a2a2e, "Black"), sw(0xffd9b3, "Cream"),
  sw(0xe09a4a, "Ginger"), sw(0xf7efdf, "Vanilla"), sw(0x9fb0c4, "Grey"),
];

// ── Choosable content ─────────────────────────────────────────────────────────

export interface PetOption { kind: PetKind; name: string; icon: string; }
export const PET_OPTIONS: PetOption[] = [
  { kind: "corgi", name: "Corgi", icon: "🐶" },
  { kind: "cat", name: "Kitty", icon: "🐱" },
  { kind: "bunny", name: "Bunny", icon: "🐰" },
];

export interface FoodOption { id: FoodId; name: string; icon: string; }
export const FOOD_OPTIONS: FoodOption[] = [
  { id: "burger", name: "Burger", icon: "🍔" },
  { id: "fries", name: "Fries", icon: "🍟" },
  { id: "drink", name: "Fizzy Pop", icon: "🥤" },
  { id: "icecream", name: "Ice Cream", icon: "🍦" },
  { id: "hotdog", name: "Hot Dog", icon: "🌭" },
];

// ── Unlocks (persist in meta) — new content as the player reaches further ─────
// Key format: "food:<id>" | "pet:<kind>" | "decor:<n>". A key in meta.unlocks
// means it's available in setup/manage. Reaching day N grants its tier.

export const UNLOCK_AT: Record<string, number> = {
  "food:burger": 0, "food:fries": 0, "food:drink": 0,
  "pet:corgi": 0,
  "food:icecream": 2, // serve a couple of days, then ice cream appears
  "pet:cat": 2,
  "food:hotdog": 3,
  "decor:fancy": 3, // a fancier decoration tier (bigger score boost)
  "pet:bunny": 4,
};

/** All content keys unlocked by reaching `bestDay`. */
export function unlockedFor(bestDay: number): string[] {
  return Object.keys(UNLOCK_AT).filter((k) => bestDay >= UNLOCK_AT[k]);
}

/** Keys newly unlocked by going from `prevBest` to `newBest` (for a fanfare). */
export function newlyUnlocked(prevBest: number, newBest: number): string[] {
  return Object.keys(UNLOCK_AT).filter((k) => UNLOCK_AT[k] > prevBest && UNLOCK_AT[k] <= newBest);
}

export const isUnlocked = (unlocks: string[], key: string): boolean => unlocks.includes(key);
export const foodUnlocked = (unlocks: string[], id: FoodId): boolean => unlocks.includes(`food:${id}`);
export const petUnlocked = (unlocks: string[], kind: PetKind): boolean => unlocks.includes(`pet:${kind}`);

/** A friendly label for a freshly-unlocked key (used in the "New!" toast). */
export function unlockLabel(key: string): string {
  const food = FOOD_OPTIONS.find((f) => `food:${f.id}` === key);
  if (food) return `${food.icon} ${food.name}`;
  const pet = PET_OPTIONS.find((p) => `pet:${p.kind}` === key);
  if (pet) return `${pet.icon} ${pet.name}`;
  if (key === "decor:fancy") return "✨ Fancy Decor";
  return key;
}
