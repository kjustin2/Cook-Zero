// First-run tutorial: a short guided sequence that walks the player through
// cooking and serving their first burger. Each step advances automatically once
// its goal state is reached. Runs only on the very first run (meta.tutorialDone).

import type { GameState } from "./types";
import { items } from "./grid";
import { def } from "./catalog";
import { loadMeta, saveMeta } from "../core/save";

interface TutStep {
  text: string;
  done: (s: GameState) => boolean;
}

const grillCooking = (s: GameState): boolean =>
  items(s.grid).some((it) => def(it.defId)?.kind === "grill" && (it.slots?.some((sl) => sl.filling !== null) ?? false));

const prepHas = (s: GameState, id: string): boolean =>
  items(s.grid).some((it) => def(it.defId)?.kind === "prep" && (it.plate?.some((p) => p.id === id) ?? false));

const carriedBurger = (s: GameState): boolean =>
  s.carry?.kind === "plate" && s.carry.parts.some((p) => p.id === "bun") && s.carry.parts.some((p) => p.id === "patty");

export const TUTORIAL: TutStep[] = [
  { text: "Grab a raw patty 🥩 — walk to the Patty Fridge and press SPACE.", done: (s) => s.carry?.kind === "ing" && s.carry.id === "patty_raw" },
  { text: "Cook it! 🔥 Carry it to the Grill and press SPACE to drop it on.", done: grillCooking },
  { text: "Let it sizzle… when it turns golden ✨, press SPACE to grab it back.", done: (s) => s.carry?.kind === "part" && s.carry.id === "patty" },
  { text: "Build the burger! 🔪 At the Prep Counter press SPACE to add the patty.", done: (s) => prepHas(s, "patty") || carriedBurger(s) },
  { text: "Grab a bun 🥯, bring it to the Prep Counter, and add it too.", done: (s) => (prepHas(s, "bun") && prepHas(s, "patty")) || carriedBurger(s) },
  { text: "Pick up the plate 🍔, then serve a customer at the counter with SPACE!", done: (s) => s.stats.served >= 1 },
];

/** Advance the tutorial when the current step's goal is met. */
export function updateTutorial(s: GameState): void {
  if (s.tutorial < 0 || s.tutorial >= TUTORIAL.length) return;
  if (TUTORIAL[s.tutorial].done(s)) {
    s.tutorial++;
    if (s.tutorial >= TUTORIAL.length) {
      s.tutorial = -1;
      const m = loadMeta();
      m.tutorialDone = true;
      saveMeta(m);
    }
  }
}

export function tutorialText(s: GameState): string | null {
  if (s.tutorial < 0 || s.tutorial >= TUTORIAL.length) return null;
  return `${TUTORIAL[s.tutorial].text}`;
}

export const tutorialStep = (s: GameState): string =>
  s.tutorial >= 0 ? `Tutorial · ${s.tutorial + 1}/${TUTORIAL.length}` : "";
