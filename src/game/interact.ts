// Context-sensitive interaction. actionFor() returns the single best {label,run}
// for whatever the chef is standing next to — the label doubles as the on-screen
// SPACE hint. run() performs the action (mutating G, emitting fx/sfx).

import type { Carry, Customer, PlatePart } from "./types";
import type { Ctx } from "./ctx";
import { COOK_SPECS, PREP_DIRECT, def, partsKey } from "./catalog";
import { worldOfCell, items } from "./grid";
import { clearSlot, freeSlot, pullQuality, startSlot } from "./cooking";
import { serveCustomer } from "./serving";
import { dist } from "../core/math";
import { SERVE_REACH } from "./dining";

export interface Action {
  label: string;
  run(): void;
}

const REACH = 2.55;
const COOK_PULSE = 0.42; // how long the chef plays a cook/chop arm-pump

const PART_LABEL: Record<string, string> = {
  patty: "patty",
  fries: "fries",
  soda: "soda",
  bun: "bun",
  cheese: "cheese",
  lettuce: "lettuce",
  tomato: "tomato",
};

const carryPlate = (c: Carry): PlatePart[] | null => (c && c.kind === "plate" ? c.parts : null);

function plateMatches(parts: PlatePart[], wantedKey: string): boolean {
  return partsKey(parts.map((p) => p.id)) === wantedKey;
}

/** The best action for the chef's current position + carry, or null. */
export function actionFor(ctx: Ctx): Action | null {
  const { G } = ctx;
  const chef = G.chef;

  let best: Action | null = null;
  let bestDist = Infinity;
  const consider = (d: number, make: () => Action | null) => {
    if (d >= bestDist || d > REACH) return;
    const a = make();
    if (a) {
      best = a;
      bestDist = d;
    }
  };

  // ── Table service: serve a seated guest you're standing next to ──
  const plate = carryPlate(G.carry);
  if (plate) {
    let cust: Customer | null = null;
    let cd = SERVE_REACH;
    for (const c of G.customers) {
      if (c.state !== "waiting") continue;
      const d = dist(chef.x, chef.z, c.x, c.z);
      if (d < cd) {
        cd = d;
        cust = c;
      }
    }
    if (cust) {
      const target = cust;
      const matches = plateMatches(plate, partsKey(target.recipe.parts));
      consider(0.5, () =>
        matches
          ? {
              label: `Serve ${target.recipe.name}`,
              run: () => {
                serveCustomer(ctx, target, plate);
                G.carry = null;
              },
            }
          : {
              label: "✗ Wrong order",
              run: () => ctx.sfx.error(),
            },
      );
    }
  }

  // ── Grid stations ──
  for (const item of items(G.grid)) {
    const d = def(item.defId);
    if (!d || d.category !== "station") continue;
    const { x, z } = worldOfCell(G.grid, item.col, item.row);
    const dd = dist(chef.x, chef.z, x, z);
    if (dd > REACH) continue;

    if (d.kind === "bin" && d.ingredient) {
      if (G.carry === null) {
        const ing = d.ingredient;
        consider(dd, () => ({
          label: `Grab ${d.name.replace(/ (Bin|Fridge|Crate)$/, "")}`,
          run: () => {
            G.carry = { kind: "ing", id: ing };
            ctx.sfx.grab();
            ctx.fx.burst(x, z, d.color, 3);
          },
        }));
      }
    } else if (d.kind === "trash") {
      if (G.carry !== null) {
        consider(dd, () => ({
          label: "Trash item",
          run: () => {
            if (G.carry && G.carry.kind === "burnt") G.stats.trashed++;
            G.carry = null;
            ctx.sfx.error();
            ctx.fx.smoke(x, z);
          },
        }));
      }
    } else if (d.kind === "grill" || d.kind === "fryer") {
      const spec = COOK_SPECS[d.kind]!;
      // Place a raw input.
      if (G.carry && G.carry.kind === "ing" && G.carry.id === spec.accepts && freeSlot(item) >= 0) {
        consider(dd, () => ({
          label: `Cook ${PART_LABEL[spec.part]}`,
          run: () => {
            const idx = freeSlot(item);
            if (idx >= 0 && startSlot(item, idx, G.derived)) {
              G.carry = null;
              chef.cookT = COOK_PULSE;
              ctx.sfx.place();
            }
          },
        }));
      }
      // Take a ready item.
      if (G.carry === null && item.slots) {
        let bi = -1;
        for (let i = 0; i < item.slots.length; i++) {
          const q = pullQuality(item.slots[i]);
          if (q !== "raw") {
            bi = i;
            if (q === "perfect" || q === "burnt") break;
          }
        }
        if (bi >= 0) {
          const slot = item.slots[bi];
          const q = pullQuality(slot);
          const label =
            q === "burnt" ? "Scrape burnt" : q === "perfect" ? `Take ${PART_LABEL[spec.part]} ✨` : `Take ${PART_LABEL[spec.part]}`;
          consider(dd, () => ({
            label,
            run: () => {
              if (q === "burnt") {
                G.carry = { kind: "burnt" };
                ctx.fx.smoke(x, z);
              } else {
                const quality = q === "perfect" ? "perfect" : "good";
                G.carry = { kind: "part", id: spec.part, quality };
                ctx.sfx.pull(q === "perfect");
                ctx.fx.burst(x, z, q === "perfect" ? 0xffe066 : 0xffaa55, q === "perfect" ? 10 : 5);
              }
              clearSlot(slot);
            },
          }));
        }
      }
    } else if (d.kind === "drink") {
      // Empty-handed: take a ready soda, else start a pour.
      if (G.carry === null && item.slots) {
        const readyIdx = item.slots.findIndex((s) => s.filling !== null && pullQuality(s) !== "raw");
        if (readyIdx >= 0) {
          const slot = item.slots[readyIdx];
          consider(dd, () => ({
            label: "Take soda",
            run: () => {
              G.carry = { kind: "part", id: "soda", quality: "good" };
              clearSlot(slot);
              ctx.sfx.pull(false);
            },
          }));
        } else if (freeSlot(item) >= 0) {
          consider(dd, () => ({
            label: "Pour soda",
            run: () => {
              const idx = freeSlot(item);
              if (idx >= 0 && startSlot(item, idx, G.derived)) {
                chef.cookT = COOK_PULSE;
                ctx.sfx.place();
              }
            },
          }));
        }
      }
    } else if (d.kind === "prep") {
      if (!item.plate) item.plate = [];
      const pl = item.plate;
      // Add a prepped/cooked part to the plate on this counter.
      let addable: PlatePart | null = null;
      if (G.carry) {
        if (G.carry.kind === "part") addable = { id: G.carry.id, quality: G.carry.quality };
        else if (G.carry.kind === "ing" && PREP_DIRECT[G.carry.id]) {
          addable = { id: PREP_DIRECT[G.carry.id]!, quality: "good" };
        }
      }
      if (addable && pl.length < 6) {
        const part = addable;
        consider(dd, () => ({
          label: pl.length === 0 ? "Start plate" : "Add to plate",
          run: () => {
            pl.push(part);
            G.carry = null;
            chef.cookT = COOK_PULSE;
            ctx.sfx.chop();
            ctx.fx.burst(x, z + 0.2, 0xffffff, 4);
          },
        }));
      }
      // Pick up the finished plate.
      if (G.carry === null && pl.length > 0) {
        consider(dd, () => ({
          label: `Pick up plate (${pl.length})`,
          run: () => {
            G.carry = { kind: "plate", parts: pl.slice() };
            item.plate = [];
            ctx.sfx.grab();
          },
        }));
      }
    }
  }

  return best;
}
