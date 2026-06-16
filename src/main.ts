// Boot + state machine + main loop. Wires every system through the Ctx hub and
// drives the phase machine:
//   title → playing → dayEnd → manage ⇄ build → playing … → win | gameOver
// Exposes window.__G / window.__SR for headless smoke tests.

import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./style.css";
import { Input } from "./core/input";
import { RNG } from "./core/rng";
import { loadMeta, saveMeta } from "./core/save";
import { createState, resetRun } from "./game/state";
import { recomputeDerived } from "./game/adjacency";
import { makeItem } from "./game/state";
import { place, removeAt, itemAt, items, worldOfCell } from "./game/grid";
import type { Ctx } from "./game/ctx";
import { updatePlaying } from "./game/sim";
import { actionFor } from "./game/interact";
import { startDash } from "./game/chef";
import { startDay, finishDay, prepareManage, computeStars } from "./game/flow";
import { startCutscene, advanceCutscene, skipCutscene, tickCutscene } from "./game/cutscene";
import { INTRO, WIN_STORY, LOSE_STORY, storyForDay } from "./game/story";
import { applyUpgrade } from "./game/upgrades";
import { TOTAL_DAYS } from "./game/balance";
import { buildClick, enterBuild, exitBuild, rotateCursor, sellHovered } from "./game/placement";
import { buyItem, hireHelper } from "./game/shop";
import { Stage } from "./render/stage";
import { SceneView } from "./render/sceneView";
import { FxSystem } from "./render/fx";
import { WebSfx } from "./audio/sfx";
import { WebMusic } from "./audio/music";
import { UI, type GameController } from "./ui/ui";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui") as HTMLElement;

let seed = Math.floor(Math.random() * 1e9);
const G = createState(seed);
const input = new Input();
const rng = new RNG(seed);
const stage = new Stage(canvas);
const view = new SceneView(stage, G);
const fx = new FxSystem(stage.scene, stage, G);
const sfx = new WebSfx();
const music = new WebMusic();

const ctx: Ctx = { G, input, rng, fx, sfx, music };

// Apply persisted settings.
if (G.muted) {
  sfx.setMuted(true);
  music.setMuted(true);
}
stage.applyQuality(G.quality);

/** Setup hub before a night: shop + rearrange + decorate. */
function toSetup(): void {
  prepareManage(ctx);
  G.phase = "manage";
}

/** Begin the current night (G.day), playing its cutscene first if any. */
function beginNight(): void {
  const beats = G.day > 1 ? storyForDay(G.day) : null; // intro is shown before day 1's setup
  if (beats) startCutscene(G, beats, () => { startDay(ctx); G.phase = "playing"; }, `Night ${G.day}`);
  else {
    startDay(ctx);
    G.phase = "playing";
  }
}

function newRun(): void {
  seed = Math.floor(Math.random() * 1e9);
  resetRun(G, seed);
  const meta = loadMeta();
  meta.runs += 1;
  saveMeta(meta);
  G.day = 1;
  G.tutorial = meta.tutorialDone ? -1 : 0;
  // Intro story → then the setup hub so you can decorate before opening night 1.
  startCutscene(G, INTRO, toSetup, "Night 1");
}

const controller: GameController = {
  play: () => newRun(),
  toManage: () => {
    G.day += 1; // advance to the upcoming night's setup
    toSetup();
  },
  startNextShift: () => beginNight(),
  enterBuild: () => {
    enterBuild(G);
    G.phase = "build";
    sfx.ui();
  },
  exitBuild: () => {
    exitBuild(G);
    G.phase = "manage";
    sfx.ui();
  },
  togglePause: () => {
    if (G.phase === "playing") G.paused = !G.paused;
  },
  quitToTitle: () => {
    G.paused = false;
    G.phase = "title";
    music.stop();
  },
  advanceCutscene: () => advanceCutscene(G),
  skipCutscene: () => skipCutscene(G),
  toggleMute: () => {
    G.muted = !G.muted;
    sfx.setMuted(G.muted);
    music.setMuted(G.muted);
    const m = loadMeta();
    m.muted = G.muted;
    saveMeta(m);
  },
  toggleQuality: () => {
    G.quality = G.quality === "high" ? "low" : "high";
    stage.applyQuality(G.quality);
    const m = loadMeta();
    m.quality = G.quality;
    saveMeta(m);
  },
};

const ui = new UI(uiRoot, controller, ctx);

// Unlock audio on first user gesture.
let unlocked = false;
function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  sfx.unlock();
  music.unlock();
}
window.addEventListener("pointerdown", unlockAudio, { once: false });
window.addEventListener("keydown", unlockAudio, { once: false });

function endShift(): void {
  const res = finishDay(ctx);
  G.paused = false;
  if (!res.passed) startCutscene(G, LOSE_STORY, () => { G.phase = "gameOver"; }, "Closed");
  else if (res.isFinal) startCutscene(G, WIN_STORY, () => { G.phase = "win"; }, "Finale");
  else G.phase = "dayEnd";
}

/** The deterministic logic step (shared by the rAF loop and tests). */
function stepSim(dt: number): void {
  if (G.phase === "playing" && !G.paused) {
    updatePlaying(ctx, dt);
    if (G.dayTime <= 0) endShift();
  }
}

function handleKeys(): void {
  if (G.phase === "cutscene") {
    if (input.pressed("Space") || input.pressed("Enter") || input.clickedOn("game")) advanceCutscene(G);
    if (input.pressed("Escape")) skipCutscene(G);
    return;
  }
  if (input.pressed("KeyP") || (G.phase === "playing" && input.pressed("Escape"))) controller.togglePause();
  if (G.phase === "playing" && !G.paused && (input.pressed("ShiftLeft") || input.pressed("ShiftRight"))) {
    startDash(ctx);
  }
  if (G.phase === "build") {
    if (input.pressed("KeyR")) rotateCursor(G);
    if (input.pressed("KeyX")) sellHovered(ctx);
    if (input.pressed("Escape")) controller.exitBuild();
    if (input.clickedOn("game")) buildClick(ctx);
  }
}

let last = performance.now();
let lastDay = 0;
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.beginFrame();
  G.t += dt;

  handleKeys();
  stepSim(dt);
  if (G.phase === "cutscene") tickCutscene(G, dt);
  if (G.dayCard) {
    G.dayCard.t += dt;
    if (G.dayCard.t > 3.0) G.dayCard = null;
  }

  // Time-of-day follows the run's day (afternoon → night).
  if (G.day !== lastDay) {
    lastDay = G.day;
    stage.setTimeOfDay(TOTAL_DAYS > 1 ? (G.day - 1) / (TOTAL_DAYS - 1) : 0);
  }

  fx.update(dt);
  view.update(G, dt, input);
  stage.update(dt);
  stage.render(dt);

  ui.frame(G);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── Headless test surface ────────────────────────────────────────────────
interface TestApi {
  G: typeof G;
  ctx: Ctx;
  ctrl: GameController;
  tick: (dt?: number) => void;
  tickN: (dt: number, n: number) => void;
  interact: () => string | null;
  actionLabel: () => string | null;
  buildClick: () => void;
  place: (defId: string, col: number, row: number) => number;
  remove: (col: number, row: number) => void;
  itemAt: (col: number, row: number) => unknown;
  recompute: () => void;
  cellWorld: (col: number, row: number) => { x: number; z: number };
  find: (defId: string) => { uid: number; col: number; row: number } | null;
  buy: (defId: string) => boolean;
  hire: () => boolean;
  dash: () => boolean;
  sell: () => void;
  rotate: () => void;
  upgrade: (id: string) => boolean;
  stars: () => number;
  skipStory: () => void;
  quickStart: () => void;
  advanceCutscene: () => void;
  info: () => { calls: number; tris: number; geometries: number; textures: number; castShadow: boolean; pixelRatio: number; quality: string };
  drawCalls: () => number;
  setQuality: (q: "high" | "low") => void;
}
const api: TestApi = {
  G,
  ctx,
  ctrl: controller,
  tick: (dt = 1 / 60) => stepSim(dt),
  tickN: (dt, n) => {
    for (let i = 0; i < n; i++) stepSim(dt);
  },
  interact: () => {
    const a = actionFor(ctx);
    if (a) a.run();
    return a ? a.label : null;
  },
  actionLabel: () => actionFor(ctx)?.label ?? null,
  buildClick: () => buildClick(ctx),
  place: (defId, col, row) => {
    const it = makeItem(defId, col, row);
    place(G.grid, it);
    recomputeDerived(G);
    return it.uid;
  },
  remove: (col, row) => {
    removeAt(G.grid, col, row);
    recomputeDerived(G);
  },
  itemAt: (col, row) => itemAt(G.grid, col, row),
  recompute: () => recomputeDerived(G),
  cellWorld: (col, row) => worldOfCell(G.grid, col, row),
  find: (defId) => {
    const it = items(G.grid).find((i) => i.defId === defId);
    return it ? { uid: it.uid, col: it.col, row: it.row } : null;
  },
  buy: (defId) => buyItem(G, defId),
  hire: () => hireHelper(G),
  dash: () => startDash(ctx),
  sell: () => sellHovered(ctx),
  rotate: () => rotateCursor(G),
  upgrade: (id) => applyUpgrade(G, id),
  stars: () => computeStars(G),
  skipStory: () => {
    let guard = 0;
    while (G.phase === "cutscene" && guard++ < 50) skipCutscene(G);
  },
  // Start a fresh run and fast-forward through intro + setup into actual play.
  quickStart: () => {
    controller.play();
    let g = 0;
    while (G.phase !== "playing" && g++ < 30) {
      if (G.phase === "cutscene") skipCutscene(G);
      else if (G.phase === "manage") controller.startNextShift();
      else break;
    }
  },
  advanceCutscene: () => advanceCutscene(G),
  info: () => ({
    calls: stage.renderer.info.render.calls,
    tris: stage.renderer.info.render.triangles,
    geometries: stage.renderer.info.memory.geometries,
    textures: stage.renderer.info.memory.textures,
    castShadow: stage.keyLight.castShadow,
    pixelRatio: stage.renderer.getPixelRatio(),
    quality: stage.quality,
  }),
  // True scene draw-call count via a direct (non-composer) render.
  drawCalls: () => {
    stage.renderer.render(stage.scene, stage.camera);
    return stage.renderer.info.render.calls;
  },
  setQuality: (q) => {
    G.quality = q;
    stage.applyQuality(q);
  },
};
(window as unknown as { __G: typeof G; __SR: TestApi }).__G = G;
(window as unknown as { __G: typeof G; __SR: TestApi }).__SR = api;
