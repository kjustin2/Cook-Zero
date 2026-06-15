// Adjacency + vibe engine. Recomputes, from the current floor plan:
//   • each cook station's effective speed/slot count (from neighbouring decor)
//   • the global "derived" knobs (patience, tip, combo window, move speed,
//     perfect window, reputation gain, ambience vibe, customer spawn rate)
// Call recomputeDerived() whenever layout, pricing, or reputation changes.

import type { CookSlot, GameState, PlacedItem } from "./types";
import { def } from "./catalog";
import { frontFactor, items, neighbors } from "./grid";
import { PRICE_LEVELS } from "./balance";
import { clamp01 } from "../core/math";

export function emptySlot(): CookSlot {
  return { filling: null, t: 0, cookT: 0, perfT: 0, burnT: 0, done: false };
}

/** Resize a cook station's slot array to `n`, preserving in-progress slots and
 *  only dropping trailing empty ones when shrinking. */
function resizeSlots(item: PlacedItem, n: number): void {
  if (!item.slots) item.slots = [];
  while (item.slots.length < n) item.slots.push(emptySlot());
  while (item.slots.length > n) {
    // Remove a trailing empty slot if possible; otherwise keep (don't destroy food).
    const idx = item.slots.map((s) => s.filling === null).lastIndexOf(true);
    if (idx === -1) break;
    item.slots.splice(idx, 1);
  }
}

export function recomputeDerived(s: GameState): void {
  const m = s.mods;
  const all = items(s.grid);

  // ── Per-station adjacency (cook speed + slots from neighbouring decor) ──
  for (const it of all) {
    const d = def(it.defId);
    if (!d || d.category !== "station") continue;
    let speedMult = 1;
    let slotBonus = 0;
    if (d.kind === "grill" || d.kind === "fryer" || d.kind === "drink") {
      for (const nb of neighbors(s.grid, it.col, it.row)) {
        const nd = nb.item ? def(nb.item.defId) : undefined;
        const adj = nd?.adj;
        if (adj && d.kind && adj.to.includes(d.kind)) {
          if (adj.cookSpeedMult) speedMult *= adj.cookSpeedMult;
          if (adj.slots) slotBonus += adj.slots;
        }
      }
      it.effCookSpeed = m.cookSpeed * speedMult;
      it.effSlots = (d.slots ?? 0) + slotBonus;
      resizeSlots(it, it.effSlots);
    } else {
      it.effCookSpeed = m.cookSpeed;
      it.effSlots = d.slots ?? 0;
    }
  }

  // ── Global vibe + pooled decor bonuses ──
  let vibe = 0;
  let patienceMult = 1;
  let tip = 0;
  let comboAdd = 0;
  let moveMult = 1;
  let perfAdd = 0;
  let repMult = 1;
  for (const it of all) {
    const d = def(it.defId);
    const g = d?.global;
    if (!g) continue;
    if (g.vibe) vibe += g.vibe * frontFactor(s.grid, it.row);
    if (g.patienceMult) patienceMult *= g.patienceMult;
    if (g.tipFlat) tip += g.tipFlat;
    if (g.comboWindow) comboAdd += g.comboWindow;
    if (g.moveSpeedMult) moveMult *= g.moveSpeedMult;
    if (g.perfectWindow) perfAdd += g.perfectWindow;
    if (g.repGainMult) repMult *= g.repGainMult;
  }

  const price = PRICE_LEVELS[s.priceLevel] ?? PRICE_LEVELS[2];
  const vibeNorm = clamp01(vibe / 120);
  const repNorm = clamp01(s.rep / 100);

  s.derived.vibe = vibe;
  s.derived.moveSpeed = m.moveSpeed * moveMult;
  s.derived.patience = m.patience * price.patience * patienceMult * (1 + 0.22 * vibeNorm);
  s.derived.perfectWindow = m.perfectWindow + perfAdd;
  s.derived.tip = m.tip + tip;
  s.derived.comboWindow = m.comboWindow + comboAdd;
  s.derived.repGainMult = m.repGain * repMult;
  // Crowd size: pricing demand × reputation × ambience.
  s.derived.spawnMult = price.demand * (0.55 + 0.9 * repNorm) * (1 + 0.25 * vibeNorm);

  // Today's modifier reshapes a few derived knobs (perfect/pay handled at serve).
  const mod = s.modifier;
  if (mod) {
    if (mod.patienceMult) s.derived.patience *= mod.patienceMult;
    if (mod.spawnMult) s.derived.spawnMult *= mod.spawnMult;
    if (mod.tipAdd) s.derived.tip += mod.tipAdd;
    if (mod.tipMult) s.derived.tip *= mod.tipMult;
  }
}
