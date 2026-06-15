// Boot + state machine + main loop. Wires every system through the Ctx hub and
// drives the phase machine:
//   title → playing → dayEnd → manage ⇄ build → playing … → win | gameOver
// Exposes window.__G / window.__SR for headless smoke tests.

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
import { beginDay, finishDay, prepareManage, computeStars } from "./game/flow";
import { startCutscene, advanceCutscene, skipCutscene, tickCutscene } from "./game/cutscene";
import { WIN_STORY, LOSE_STORY } from "./game/story";
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

// Apply the persisted mute setting.
if (G.muted) {
  sfx.setMuted(true);
  music.setMuted(true);
}

// Pause overlay (toggled outside the menu system).
const pauseEl = document.createElement("div");
pauseEl.className = "overlay";
pauseEl.style.display = "none";
pauseEl.innerHTML = `<div class="panel center"><h2>Paused</h2><div class="small-muted">Press P to resume</div></div>`;
uiRoot.append(pauseEl);

function newRun(): void {
  seed = Math.floor(Math.random() * 1e9);
  resetRun(G, seed);
  const meta = loadMeta();
  meta.runs += 1;
  saveMeta(meta);
  G.day = 1;
  beginDay(ctx); // plays the intro cutscene, then opens night 1
}

const controller: GameController = {
  play: () => newRun(),
  toManage: () => {
    prepareManage(ctx);
    G.phase = "manage";
  },
  startNextShift: () => {
    G.day += 1;
    beginDay(ctx);
  },
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
  if (input.pressed("KeyP")) controller.togglePause();
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

  pauseEl.style.display = G.paused && G.phase === "playing" ? "flex" : "none";
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
  advanceCutscene: () => void;
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
  advanceCutscene: () => advanceCutscene(G),
};
(window as unknown as { __G: typeof G; __SR: TestApi }).__G = G;
(window as unknown as { __G: typeof G; __SR: TestApi }).__SR = api;
