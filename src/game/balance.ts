// Central tunables. Keep all the magic numbers here so balance is one file.

export const TOTAL_DAYS = 6;
export const SHIFT_LEN = 120; // seconds per shift

/** Cash you must bank during a shift to keep the job, per day (1-indexed). */
export const QUOTAS = [60, 110, 180, 270, 380, 520];

// Cooking timing (seconds, before per-station speed multipliers).
export const GRILL_COOK = 5.5;
export const GRILL_PERFECT = 2.4; // perfect-sear window after cook
export const GRILL_BURN = 3.0; // overdone→burnt window after perfect
export const FRY_COOK = 4.5;
export const FRY_GOLDEN = 3.0; // golden window; fryer never burns to trash
export const DRINK_POUR = 1.3;

// Combo.
export const COMBO_BASE_WINDOW = 11; // seconds of no-serve before combo decays
export const COMBO_CAP = 12; // combo count cap for multiplier
export const ON_FIRE_AT = 5;

// Reputation.
export const REP_START = 50;
export const REP_PERFECT = 1.6;
export const REP_GOOD = 0.7;
export const REP_EXPIRE = -3.2;
export const REP_WRONG = -1.4;

// Customer spawn pacing (seconds between arrivals, before multipliers).
export const SPAWN_BASE = 4.6;

// Chef dash (Shift): a short burst with a cooldown.
export const DASH_TIME = 0.17;
export const DASH_CD = 1.0;
export const DASH_MULT = 2.7; // speed multiplier while dashing

// Special customers. Effects baked onto the customer at spawn.
export interface CustomerKindDef {
  pay: number; // payout multiplier
  patience: number; // patience multiplier
  rep: number; // reputation-swing multiplier
}
export const CUSTOMER_KINDS = {
  normal: { pay: 1, patience: 1, rep: 1 },
  vip: { pay: 1.9, patience: 0.68, rep: 1.1 },
  critic: { pay: 1.0, patience: 0.85, rep: 2.6 },
} as const satisfies Record<string, CustomerKindDef>;

// Pricing levels: label, price multiplier, patience multiplier, demand mult.
export interface PriceLevel {
  label: string;
  price: number;
  patience: number;
  demand: number;
}
export const PRICE_LEVELS: PriceLevel[] = [
  { label: "Budget", price: 0.7, patience: 1.28, demand: 1.35 },
  { label: "Friendly", price: 0.88, patience: 1.12, demand: 1.15 },
  { label: "Standard", price: 1.0, patience: 1.0, demand: 1.0 },
  { label: "Premium", price: 1.22, patience: 0.86, demand: 0.82 },
  { label: "Luxury", price: 1.5, patience: 0.72, demand: 0.62 },
];

// Helper wages by level (deducted at day end if hired).
export const HELPER_WAGES = [0, 22, 36, 54];
export const HELPER_HIRE_COST = 70;
export const HELPER_UPGRADE_COST = [0, 0, 90, 140];

// Grid dimensions.
export const GRID_COLS = 9;
export const GRID_ROWS = 6;
