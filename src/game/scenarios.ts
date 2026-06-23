// Debug scenario system: deterministic "cuts" that drive the game straight into a
// named situation, so automated tests + screenshot captures can jump to any
// moment (a busy cooking shift, a perfect-serve celebration, the setup studio
// focused on the room, the manage screen, the win, …) without hand-staging it
// each time. Exposed in main.ts as `window.__SR.scenario(name)`.
//
// Pure game-layer: it only touches G + ctx and a small toolkit of control
// functions the host (main.ts) supplies — no render/ui imports.

import type { Ctx } from "./ctx";
import type { FoodId, RestaurantConfig, StationId } from "./types";
import { cloneConfig } from "./customize";

/** The control surface a scenario needs (supplied by main.ts). */
export interface ScenarioApi {
  ctx: Ctx;
  play(): void;
  quickStart(): void;            // drive all the way to a real cooking day
  toTitle(): void;
  finishDay(): void;
  nextDay(): void;
  finishManage(): void;
  finishSetup(): void;
  skipCutscenes(): void;
  setStudioFocus(f: "chef" | "room"): void;
  config(): RestaurantConfig;
  setConfig(c: RestaurantConfig): void;
  spawnGuest(food: FoodId, table?: number): number;
  gotoStation(id: StationId): void;
  gotoCustomer(uid: number): void;
  interact(): void;
  tickN(dt: number, n: number): void;
}

export const SCENARIOS = [
  "title", "play", "cooking", "carry", "burning", "wayfinder", "serve-perfect",
  "white-diner", "setup", "setup-chef", "setup-room", "manage", "day-complete", "win",
] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

/** Drive from anywhere to the setup studio (just before "Open My Diner!"). */
function toSetup(api: ScenarioApi): void {
  const G = api.ctx.G;
  api.play();
  for (let g = 0; g < 300; g++) {
    if (G.phase === "cutscene") { api.skipCutscenes(); continue; }
    if (G.phase === "playing" && G.tutorial) { api.finishDay(); continue; }
    if (G.phase === "setup") { api.ctx.fx.clear(); return; } // drop drive-through FX
    if (G.phase === "playing" || G.phase === "manage" || G.phase === "win") { api.ctx.fx.clear(); return; }
  }
}

/** A clean, near-white diner config (proves the chosen colours re-skin the room). */
function whiteConfig(api: ScenarioApi): RestaurantConfig {
  const c = cloneConfig(api.config());
  c.palette.wall = 0xffffff;
  c.palette.floorA = 0xffffff;
  c.palette.floorB = 0xf0f0f0;
  c.palette.stripe = 0xe0e0e0;
  c.palette.window = 0xcfe8ff;
  return c;
}

/** Cut to a named scenario. Returns a short human label, or "" for unknown. */
export function runScenario(name: string, api: ScenarioApi): string {
  const G = api.ctx.G;
  api.ctx.fx.clear(); // start every cut from clean FX (no stale particles/floaters)
  switch (name as ScenarioName) {
    case "title":
      api.toTitle();
      return "Title screen";

    case "play":
      api.quickStart();
      return "Day 1 — playing";

    case "cooking": {
      api.quickStart();
      api.spawnGuest("burger", 0); api.spawnGuest("fries", 1); api.spawnGuest("drink", 2);
      api.gotoStation("meat"); api.interact(); api.gotoStation("grill"); api.interact();
      api.gotoStation("potato"); api.interact(); api.gotoStation("fryer"); api.interact();
      api.tickN(1 / 30, 160); // cook until a grill slot is ready to grab
      api.ctx.fx.clear(); // drop the steam/smoke that piled up during the fast-forward
      G.dayCard = null;
      G.chef.x = -7.0; G.chef.z = -6.6; G.chef.facing = 0; G.prompt = null; // stand at the grill
      api.tickN(1 / 60, 3); // let updateChef populate the one-button prompt + beacon
      return "Busy shift, mid-cook";
    }

    case "carry": {
      // Chef holding a PERFECT cooked burger — verifies pickup has no glow halo.
      api.quickStart();
      G.dayCard = null;
      G.customers.length = 0; for (const t of G.tables) t.occupied = 0;
      for (const st of G.stations) for (const sl of st.slots) sl.food = null;
      G.pet.x = 30; G.pet.z = 30;
      G.chef.carry = { kind: "ready", food: "burger", quality: "perfect" };
      G.chef.x = -2; G.chef.z = -3; G.chef.facing = 0;
      return "Carrying a perfect burger";
    }

    case "burning": {
      // Food charred on the grill — verifies burning has NO big glow (just char + smoke).
      api.quickStart();
      G.dayCard = null;
      G.pet.x = 30; G.pet.z = 30;
      const grill = G.stations.find((s) => s.id === "grill");
      if (grill) {
        const slot = grill.slots[0];
        slot.food = "burger";
        slot.readyT = 1; slot.goldenT = 1.4; slot.crispT = 2.2; slot.burnT = 3.0;
        slot.t = 3.4; slot.pop = 1; // well past burnt
        api.ctx.fx.smoke(grill.x, grill.z - 0.1);
        api.ctx.fx.smoke(grill.x + 0.3, grill.z - 0.05);
      }
      G.chef.x = -4.5; G.chef.z = -6; G.chef.facing = 0; G.prompt = null;
      return "Food burning on the grill";
    }

    case "wayfinder": {
      // Beacon pointing at the grill — verifies the arrow/icon don't overlap the
      // station's floating sign.
      api.quickStart();
      G.dayCard = null;
      G.customers.length = 0; for (const t of G.tables) t.occupied = 0;
      for (const st of G.stations) for (const sl of st.slots) sl.food = null;
      G.pet.x = 30; G.pet.z = 30;
      G.chef.carry = { kind: "raw", food: "burger" }; // → guide "Cook it here!" at the grill
      G.chef.x = 6; G.chef.z = 2; G.chef.facing = 0; // far from the grill so the beacon shows
      api.tickN(1 / 60, 4); // compute the guide/beacon
      return "Wayfinder beacon over a station";
    }

    case "serve-perfect": {
      api.quickStart();
      G.dayCard = null;
      G.pet.x = 30; G.pet.z = 30; G.pet.tx = 30; G.pet.tz = 30; // park the pup off-stage
      G.customers.length = 0; for (const t of G.tables) t.occupied = 0;
      for (const st of G.stations) for (const sl of st.slots) sl.food = null;
      const id = api.spawnGuest("burger", 4); // front-centre table
      const cust = G.customers.find((c) => c.uid === id);
      if (cust) { cust.served = true; cust.servedT = 0.1; cust.mood = 1; cust.hop = 1; }
      G.chef.carry = null;
      G.chef.x = -11; G.chef.z = 6; G.prompt = null; // chef clear of the celebration
      if (cust) {
        api.ctx.fx.float("PERFECT! ⭐", cust.x, cust.z + 0.4, { big: true, color: "#ffe066" });
        api.ctx.fx.float("🍔", cust.x, cust.z, { big: true });
        api.ctx.fx.ring(cust.x, cust.z, 0xffe066);
        api.ctx.fx.hearts(cust.x, cust.z);
      }
      return "Perfect serve!";
    }

    case "white-diner":
      api.quickStart();
      api.setConfig(whiteConfig(api));
      G.dayCard = null;
      G.customers.length = 0; for (const t of G.tables) t.occupied = 0;
      G.chef.x = 0; G.chef.z = -1.5; G.chef.facing = 0; G.prompt = null;
      return "Recoloured (white) diner";

    case "setup":
    case "setup-chef":
      toSetup(api);
      G.studioCat = "chef";       // open the Chef section (the UI reads this)
      api.setStudioFocus("chef");
      return "Setup studio — chef preview";

    case "setup-room":
      toSetup(api);
      G.studioCat = "diner";      // open the Diner section → room-framed preview
      api.setStudioFocus("room");
      return "Setup studio — room preview";

    case "manage":
      api.quickStart();
      G.servedToday = G.goal;
      api.finishDay(); // → dayComplete
      api.nextDay();   // → manage
      return "Manage screen";

    case "day-complete":
      api.quickStart();
      G.servedToday = G.goal;
      api.finishDay(); // → dayComplete (3 stars)
      return "Day complete — stars";

    case "win":
      api.quickStart();
      for (let g = 0; g < 80 && G.phase !== "win"; g++) {
        if (G.phase === "playing") { G.servedToday = G.goal; api.finishDay(); }
        else if (G.phase === "dayComplete") api.nextDay();
        else if (G.phase === "manage") api.finishManage();
        else if (G.phase === "cutscene") api.skipCutscenes();
        else break;
      }
      return "Win screen";

    default:
      return "";
  }
}
