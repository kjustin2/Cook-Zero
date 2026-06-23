// Cutscene director (logic core). A scene is a list of timed camera Shots that
// dolly through the real diner, each carrying optional dialogue + a title card.
// This file owns only the TIMING + sound: it advances shots, types out the
// current line, fires per-shot sfx/shake/music, and calls onDone when the scene
// ends. The camera move + figure cast are interpreted by the render layer
// (render/cineView), and the letterbox/dialogue/fade are drawn by the UI — all
// from G.cutscene, so the same state drives every surface. Skippable (with a
// short guard so the launching click can't instantly skip).

import type { CineScene, CutsceneState, GameState, Shot } from "./types";
import type { Ctx } from "./ctx";

const TYPE_SPEED = 38; // characters per second

/** Map a shot's sfx name to a sound. Keeps scene data declarative. */
const SFX_MAP: Record<string, (s: Ctx["sfx"]) => void> = {
  ding: (s) => s.star(),
  yay: (s) => s.yay(),
  fanfare: (s) => s.fanfare(),
  pop: (s) => s.ui(),
  serve: (s) => s.serve(3),
  sad: (s) => s.sad(),
};

export function startCutscene(s: GameState, scene: CineScene, onDone: () => void, label = ""): void {
  s.cutscene = {
    scene,
    shotIndex: 0,
    elapsed: 0,
    typed: 0,
    started: false,
    guard: 0.4,
    label,
    onDone,
  };
  s.phase = "cutscene";
}

export const currentShot = (cs: CutsceneState): Shot | undefined => cs.scene.shots[cs.shotIndex];

/** 0..1 progress through the current shot (for the camera dolly). */
export const shotProgress = (cs: CutsceneState): number => {
  const shot = currentShot(cs);
  return shot ? Math.min(1, cs.elapsed / shot.dur) : 0;
};

/** Visible (typed-so-far) portion of the current line. */
export const cutsceneText = (cs: CutsceneState): string => {
  const line = currentShot(cs)?.line;
  return line ? line.text.slice(0, Math.floor(cs.typed)) : "";
};

function enterShot(ctx: Ctx, cs: CutsceneState, shot: Shot): void {
  if (cs.shotIndex === 0 && cs.scene.music) ctx.music.cue(cs.scene.music);
  if (shot.sfx && SFX_MAP[shot.sfx]) SFX_MAP[shot.sfx](ctx.sfx);
  if (shot.shake) ctx.fx.shake(shot.shake);
}

export function tickCutscene(ctx: Ctx, dt: number): void {
  const cs = ctx.G.cutscene;
  if (!cs) return;
  if (cs.guard > 0) cs.guard -= dt;

  const shot = currentShot(cs);
  if (!shot) {
    finishCutscene(ctx.G);
    return;
  }
  if (!cs.started) {
    enterShot(ctx, cs, shot);
    cs.started = true;
  }

  cs.elapsed += dt;
  if (shot.line) cs.typed = Math.min(shot.line.text.length, cs.typed + dt * TYPE_SPEED);

  if (cs.elapsed >= shot.dur) {
    cs.shotIndex += 1;
    cs.elapsed = 0;
    cs.typed = 0;
    cs.started = false;
    if (cs.shotIndex >= cs.scene.shots.length) finishCutscene(ctx.G);
  }
}

export function skipCutscene(s: GameState): void {
  finishCutscene(s);
}

export function finishCutscene(s: GameState): void {
  const cb = s.cutscene?.onDone;
  s.cutscene = null;
  cb?.();
}
