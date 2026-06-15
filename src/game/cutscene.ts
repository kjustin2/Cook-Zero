// Cutscene controller. A cutscene is a list of dialogue beats shown over the
// live kitchen; text types out, click/Space advances (and first completes the
// typewriter), Esc/Skip bails. When the last beat is dismissed, onDone() fires.

import type { Beat, Cutscene, GameState } from "./types";

const TYPE_SPEED = 42; // characters per second

export function startCutscene(s: GameState, beats: Beat[], onDone: () => void, label = ""): void {
  s.cutscene = { beats, index: 0, typed: 0, onDone, label };
  s.phase = "cutscene";
}

/** Advance the typewriter each frame. */
export function tickCutscene(s: GameState, dt: number): void {
  const cs = s.cutscene;
  if (!cs) return;
  const cur = cs.beats[cs.index];
  if (cur && cs.typed < cur.text.length) {
    cs.typed = Math.min(cur.text.length, cs.typed + dt * TYPE_SPEED);
  }
}

/** Click / Space: finish the current line, or move to the next (or end). */
export function advanceCutscene(s: GameState): void {
  const cs = s.cutscene;
  if (!cs) return;
  const cur = cs.beats[cs.index];
  if (cur && cs.typed < cur.text.length) {
    cs.typed = cur.text.length;
    return;
  }
  cs.index++;
  if (cs.index >= cs.beats.length) finishCutscene(s);
  else cs.typed = 0;
}

export function skipCutscene(s: GameState): void {
  finishCutscene(s);
}

function finishCutscene(s: GameState): void {
  const cb = s.cutscene?.onDone;
  s.cutscene = null;
  if (cb) cb();
}

/** The visible (typed-so-far) portion of the current line. */
export function cutsceneText(cs: Cutscene): string {
  return cs.beats[cs.index]?.text.slice(0, Math.floor(cs.typed)) ?? "";
}

export function currentBeat(cs: Cutscene): Beat | undefined {
  return cs.beats[cs.index];
}

export function lineComplete(cs: Cutscene): boolean {
  const cur = cs.beats[cs.index];
  return !!cur && cs.typed >= cur.text.length;
}
