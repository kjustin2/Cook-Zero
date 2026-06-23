// Central tunables for Sizzle Rush (kid edition). All the magic numbers live in
// one file so the feel is easy to dial. The whole game is tuned to be GENEROUS:
// generous patience, a wide perfect window, and burning so slow it almost never
// happens — a young kid should win and have fun, not fail.

export const MAX_DAY = 5; // a short, always-winnable run

/** Shift length in seconds, per day (1-indexed). Day 5 builds via density, not length. */
export const DAY_LEN = [70, 78, 85, 92, 100];

/** Happy guests that earn 3 stars, per day — close to the guest count so the
 *  goal feels earned (still 1-star minimum, never a fail). */
export const DAY_GOAL = [4, 6, 8, 10, 12];

/** How many guests show up across the whole shift, per day. */
export const DAY_GUESTS = [6, 8, 10, 12, 14];

/** Seconds between guest arrivals — tighter so 2-3 guests overlap and the kid
 *  juggles a small queue (capped by 6 tables) instead of waiting around. */
export const SPAWN_GAP = [4.5, 4.0, 3.6, 3.2, 2.9];

// ── Cooking timing (seconds), as durations of each stage. Kid-forgiving. ─────
// raw [0, ready)  → good [ready, +golden) → PERFECT [+perfect) → crispy [+crisp)
// → burnt (only after the whole, very long chain — grills only; fryer never).
export const COOK = {
  ready: 2.0, // until it's edible (good) — less dead grill-waiting
  golden: 0.8, // a short beat, then...
  perfect: 2.6, // ...a generous-but-deliberate perfect window (a small skill win)
  crisp: 6.0, // a long grace as "crispy" before it could ever burn
};

// Chef movement.
export const CHEF_SPEED = 8.4; // units/sec — glides, so travel feels zippy
export const CHEF_REACH = 2.6; // how close to a station/guest to interact
export const DASH_TIME = 0.18;
export const DASH_CD = 0.9;
export const DASH_MULT = 2.6;

// Customer patience (seconds) — still generous, but trimmed enough that a busy
// overlap brings mild urgency (never anger a guest you serve promptly).
export const PATIENCE = [22, 21, 19, 18, 16];

// Combo (purely celebratory — more sparkle/cheer, never a number to do math on).
export const COMBO_WINDOW = 9; // seconds between serves before the streak cools
export const FIRE_AT = 4; // serves in a row before "on a roll!"

// Score (a friendly coin counter; bigger when faster/perfect).
export const COIN_BASE = 5;
export const COIN_PERFECT = 4; // bonus for a perfect cook

// World bounds (the diner floor the chef roams).
export const FLOOR = { minX: -12, maxX: 12, minZ: -9.5, maxZ: 7.5 };
