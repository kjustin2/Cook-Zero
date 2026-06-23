// Context-sensitive interaction — the single most kid-friendly mechanic. One
// button (SPACE/ENTER) does everything: actionFor() looks at where the chef is
// standing and what's in their hands, then returns ONE {label, icon, run} for
// the best thing to do. The label + icon drive the big on-screen button.

import type { FoodId, Quality, Station } from "./types";
import type { Ctx } from "./ctx";
import { food, stationDef } from "./catalog";
import { clearSlot, freeSlot, slotQuality, startCooking } from "./stations";
import { serveCustomer } from "./serving";
import { petPet, feedPet } from "./pet";
import { waterPlant, MAX_STAGE } from "./garden";
import { CHEF_REACH } from "./balance";
import { dist } from "../core/math";

export interface Action {
  label: string;
  icon: string;
  run(): void;
  cooks?: boolean; // triggers the chef's cook arm-pump
}

const QPRIO: Record<Quality | "raw", number> = { perfect: 4, good: 3, crispy: 2, burnt: 1, raw: 0 };

/** Best slot to take from a cook station: prefer perfect, then good, etc. */
function bestSlot(st: Station): { idx: number; q: Quality } | null {
  let best = -1;
  let bestQ: Quality | "raw" = "raw";
  for (let i = 0; i < st.slots.length; i++) {
    const q = slotQuality(st.slots[i]);
    if (q === "raw") continue;
    if (QPRIO[q] > QPRIO[bestQ]) {
      bestQ = q;
      best = i;
    }
  }
  return best >= 0 && bestQ !== "raw" ? { idx: best, q: bestQ } : null;
}

/** The best action for the chef's current position + carry, or null. */
export function actionFor(ctx: Ctx): Action | null {
  const { G } = ctx;
  const chef = G.chef;
  const reach = CHEF_REACH * G.derived.reachMult;

  let best: Action | null = null;
  let bestDist = Infinity;
  const consider = (d: number, make: () => Action | null) => {
    if (d >= bestDist || d > reach) return;
    const a = make();
    if (a) {
      best = a;
      bestDist = d;
    }
  };

  const carry = chef.carry;

  // ── Serve a seated guest you're standing next to (matching order) ──
  if (carry && carry.kind === "ready") {
    const heldFood = carry.food;
    const quality = carry.quality;
    for (const cust of G.customers) {
      if (cust.state !== "seated" || cust.served || cust.order !== heldFood) continue;
      const d = dist(chef.x, chef.z, cust.x, cust.z);
      consider(d, () => ({
        label: "Serve!",
        icon: food(heldFood).icon,
        run: () => {
          serveCustomer(ctx, cust, heldFood, quality);
          chef.carry = null;
        },
      }));
    }
  }

  // ── Stations ──
  for (const st of G.stations) {
    const d = dist(chef.x, chef.z, st.x, st.z);
    if (d > reach) continue;
    const def = stationDef(st.id);

    if (st.kind === "source" && def.gives && carry === null) {
      const give = def.gives;
      consider(d, () => ({
        label: `Grab ${food(give).rawName}`,
        icon: food(give).icon,
        run: () => {
          chef.carry = { kind: "raw", food: give };
          ctx.sfx.grab();
        },
      }));
    } else if (st.kind === "instant" && def.gives && carry === null) {
      const give = def.gives;
      consider(d, () => ({
        label: `Grab ${food(give).name}`,
        icon: food(give).icon,
        cooks: true,
        run: () => {
          chef.carry = { kind: "ready", food: give, quality: "good" };
          if (give === "drink") ctx.sfx.pour();
          else ctx.sfx.scoop();
        },
      }));
    } else if (st.kind === "cook") {
      // Place a raw item this grill accepts.
      if (carry && carry.kind === "raw" && def.cooks?.includes(carry.food) && freeSlot(st) >= 0) {
        const f = carry.food;
        consider(d, () => ({
          label: "Cook it!",
          icon: "🔥",
          cooks: true,
          run: () => {
            const idx = freeSlot(st);
            if (idx >= 0 && startCooking(st, idx, f, G.derived.cookSpeedMult)) {
              chef.carry = null;
              ctx.sfx.place();
            }
          },
        }));
      }
      // Take a ready item.
      if (carry === null) {
        const pick = bestSlot(st);
        if (pick) {
          const slot = st.slots[pick.idx];
          const f = slot.food as FoodId;
          const q = pick.q;
          consider(d, () => ({
            // Burnt: picking it UP off the grill (then the wayfinder routes to the
            // bin) — so it must NOT show the trash-can icon, which means "dispose".
            label: q === "burnt" ? "Pick it up" : q === "perfect" ? "Take it! ✨" : "Take it!",
            icon: q === "burnt" ? "💨" : food(f).icon,
            run: () => {
              if (q === "burnt") {
                chef.carry = { kind: "burnt" };
                ctx.fx.smoke(st.x, st.z);
              } else {
                chef.carry = { kind: "ready", food: f, quality: q };
                ctx.sfx.pull(q === "perfect");
              }
              clearSlot(slot);
            },
          }));
        }
      }
    } else if (st.kind === "trash" && carry !== null) {
      consider(d, () => ({
        label: "Toss it",
        icon: "🗑️",
        run: () => {
          chef.carry = null;
          ctx.sfx.toss();
          ctx.fx.smoke(st.x, st.z);
        },
      }));
    }
  }

  // ── Pet the corgi (optional fun — pet with empty hands, or feed it a dish) ──
  {
    const p = G.pet;
    const d = dist(chef.x, chef.z, p.x, p.z);
    if (d <= reach) {
      if (carry === null) {
        consider(d, () => ({ label: "Pet the pup", icon: "🐾", run: () => petPet(ctx) }));
      } else if (carry.kind === "ready") {
        consider(d, () => ({ label: "Feed the pup", icon: "🦴", run: () => feedPet(ctx) }));
      }
    }
  }

  // ── Water a flower (optional tend — helps it bloom) ──
  if (carry === null) {
    for (const pl of G.plants) {
      if (pl.stage >= MAX_STAGE) continue;
      const d = dist(chef.x, chef.z, pl.x, pl.z);
      consider(d, () => ({ label: "Water it", icon: "💧", run: () => waterPlant(ctx, pl) }));
    }
  }

  return best;
}
