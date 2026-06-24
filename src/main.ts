// Boot + phase machine + main loop. Wires every system through the Ctx hub:
//   title → cutscene(intro) → playing → dayComplete → treat → … → cutscene(win) → win
// The run is always winnable. Exposes window.__G / window.__SR for headless tests.

import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./style.css";
import { Input } from "./core/input";
import { RNG } from "./core/rng";
import { loadMeta, saveMeta, loadRun, saveRun, clearRun, hasRun } from "./core/save";
import { createState, resetRun, recomputeDerived, stationById, applyConfig, toggleTableAt, swapStations, addTable, removeTable, moveTable, moveStation } from "./game/state";
import type { Ctx } from "./game/ctx";
import type { FoodId, RestaurantConfig, StationId } from "./game/types";
import { newlyUnlocked, unlockedFor } from "./game/customize";
import { CHEF_REACH } from "./game/balance";
import { updatePlaying, shiftOver } from "./game/sim";
import { actionFor } from "./game/interact";
import { runScenario, SCENARIOS, type ScenarioApi } from "./game/scenarios";
import { startDash } from "./game/chef";
import { startDay, finishDay, computeStars, prepareTreats } from "./game/flow";
import { startCutscene, tickCutscene, skipCutscene } from "./game/cutscene";
import { introScene, storyForDay, winScene, tutorialDoneScene } from "./game/story";
import { chooseTreat } from "./game/upgrades";
import { Stage } from "./render/stage";
import { SceneView } from "./render/sceneView";
import { FxSystem } from "./render/fx";
import { WebSfx } from "./audio/sfx";
import { WebMusic } from "./audio/music";
import { UI, type GameController } from "./ui/ui";
import { Inspector } from "./debug/inspect";
import { DebugHud } from "./debug/hud";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui") as HTMLElement;

let seed = Math.floor(Math.random() * 1e9);
const G = createState(seed);
const input = new Input();
const rng = new RNG(seed);
const stage = new Stage(canvas);
const view = new SceneView(stage, G);
const fx = new FxSystem(stage.scene, stage);
const sfx = new WebSfx();
const music = new WebMusic();

const ctx: Ctx = { G, input, rng, fx, sfx, music };

// Debug/QA harness instrumentation: live frame-perf + scene metrics, a visual
// fingerprint for regression diffing, a game-state invariant net, and a
// toggleable on-screen HUD (backtick / ?debug). Inert unless read or shown.
const inspect = new Inspector(stage, fx, G);
// Mount on <body>, not the UI root (the UI clears its root's innerHTML on build).
const hud = new DebugHud(document.body);

if (G.muted) {
  sfx.setMuted(true);
  music.setMuted(true);
}
stage.applyQuality(G.quality);

// ── Phase transitions ────────────────────────────────────────────────────────

function beginDay(): void {
  startDay(ctx);
  G.phase = "playing";
}

/** The setup studio: name + menu + looks + layout, with a live 3D preview. */
function enterSetup(): void {
  G.phase = "setup";
  music.cue("menu");
}

/** Leave setup → remember the chosen restaurant → open for the real first day. */
function finishSetup(): void {
  const meta = loadMeta();
  meta.config = G.config;
  saveMeta(meta);
  saveRun(G);
  sfx.star();
  beginDay();
}

function startTutorial(): void {
  G.tutorial = true;
  G.day = 1;
  music.cue("story");
  startCutscene(G, introScene(), beginDay, "Intro");
}

/** Tutorial over → mark it done → a clear "Tutorial Complete!" beat → setup. */
function finishTutorial(): void {
  G.tutorial = false;
  const meta = loadMeta();
  meta.tutorialDone = true;
  saveMeta(meta);
  music.stop();
  fx.confetti();
  startCutscene(G, tutorialDoneScene(), enterSetup, "TutorialDone");
}

function newRun(): void {
  seed = Math.floor(Math.random() * 1e9);
  resetRun(G, seed);
  const meta = loadMeta();
  meta.runs += 1;
  saveMeta(meta);
  clearRun();
  G.day = 1;
  if (!meta.tutorialDone) startTutorial();
  else enterSetup();
}

function continueRun(): void {
  const snap = loadRun();
  if (!snap) { newRun(); return; }
  Object.assign(G, snap);
  G.cutscene = null;
  G.paused = false;
  G.tutorial = false;
  if (G.phase === "cutscene" || G.phase === "title") G.phase = "playing";
  recomputeDerived(G);
  if (G.phase === "playing") { music.cue("cooking"); music.setIntensity(0); }
  else music.cue("menu");
}

function endShift(): void {
  if (G.tutorial) { finishTutorial(); return; }
  const meta = loadMeta();
  const prevBest = meta.bestDay;
  const res = finishDay(ctx); // saves bestDay/bestStars
  // Reaching a new day can unlock new content (foods/pets/decor).
  const fresh = newlyUnlocked(prevBest, Math.max(prevBest, G.day));
  if (fresh.length) {
    const m2 = loadMeta();
    m2.unlocks = [...new Set([...m2.unlocks, ...unlockedFor(m2.bestDay)])];
    saveMeta(m2);
    G.unlocks = [...m2.unlocks];
    G.newUnlocks = fresh;
  }
  G.paused = false;
  music.stop();
  fx.confetti();
  sfx.fanfare();
  if (res.isFinal) {
    clearRun();
    startCutscene(G, winScene(), () => { G.phase = "win"; }, "Win");
  } else {
    G.phase = "dayComplete";
  }
}

const controller: GameController = {
  play: () => newRun(),
  continueRun: () => continueRun(),
  hasSave: () => hasRun(),
  togglePause: () => {
    if (G.phase === "playing") G.paused = !G.paused;
  },
  resume: () => { G.paused = false; },
  restart: () => newRun(),
  quitToTitle: () => {
    G.paused = false;
    // Snapshot a real in-progress run so "Continue" can resume it.
    if (!G.tutorial && (G.phase === "playing" || G.phase === "dayComplete" || G.phase === "manage")) {
      saveRun(G);
    } else if (G.tutorial || G.phase === "setup") {
      clearRun();
    }
    G.phase = "title";
    music.cue("menu");
  },
  config: () => G.config,
  setConfig: (c: RestaurantConfig) => { applyConfig(G, c); },
  setStudioFocus: (focus: "chef" | "room", cat?: string) => { G.studioFocus = focus; if (cat) G.studioCat = cat; },
  finishSetup: () => finishSetup(),
  nextFromDayComplete: () => {
    prepareTreats(ctx);
    G.phase = "manage";
    sfx.ui();
  },
  chooseTreat: (id) => {
    chooseTreat(G, id);
    sfx.star();
    G.treatChoices = []; // one upgrade per day — picker collapses to "chosen ✓"
  },
  finishManage: () => {
    G.newUnlocks = [];
    G.day += 1;
    saveRun(G);
    const story = storyForDay(G.day);
    if (story) startCutscene(G, story, beginDay, `Day ${G.day}`);
    else beginDay();
  },
  toggleTable: (i: number) => { toggleTableAt(G, i); },
  swapStations: (a: StationId, b: StationId) => { swapStations(G, a, b); },
  moveTable: (i: number, x: number, z: number) => { moveTable(G, i, x, z); },
  moveStation: (id: StationId, x: number, z: number) => { moveStation(G, id, x, z); },
  addTable: () => { addTable(G); },
  removeTable: () => { removeTable(G); },
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

const ui = new UI(uiRoot, controller);
music.cue("menu");

// Unlock audio on first user gesture.
let unlocked = false;
function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  sfx.unlock();
  music.unlock();
}
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

// ── Deterministic logic step (shared by rAF + tests) ─────────────────────────
function stepSim(dt: number): void {
  if (G.phase === "playing" && !G.paused) {
    updatePlaying(ctx, dt);
    if (shiftOver(G)) endShift();
  }
}

function handleKeys(): void {
  if (G.phase === "cutscene") {
    const cs = G.cutscene;
    const wantSkip = input.pressed("Space") || input.pressed("Enter") || input.pressed("Escape") || input.clickedOn("game");
    if (cs && cs.guard <= 0 && wantSkip) skipCutscene(G);
    return;
  }
  if (G.phase === "playing") {
    if (input.pressed("KeyP") || input.pressed("Escape")) controller.togglePause();
    if (!G.paused && (input.pressed("ShiftLeft") || input.pressed("ShiftRight"))) startDash(ctx);
  }
}

// ── Main loop ────────────────────────────────────────────────────────────────
let last = performance.now();
let lastTODday = -1;
let inCinePrev = false;
let lastPaused = false;

function frame(now: number): void {
  const rawMs = now - last; // real wall-clock frame interval (uncapped) for perf
  const dt = Math.min(0.05, rawMs / 1000);
  last = now;
  input.beginFrame();
  G.t += dt;

  handleKeys();
  stepSim(dt);
  if (G.cutscene) tickCutscene(ctx, dt);

  if (G.dayCard) {
    G.dayCard.t += dt;
    if (G.dayCard.t > 3) G.dayCard = null;
  }

  // Time-of-day mellows from morning → golden evening across the run. The
  // cutscene layer sets its own warm tint, so refresh when we leave a cutscene.
  const inCine = G.phase === "cutscene";
  if (!inCine && (G.day !== lastTODday || inCinePrev)) {
    lastTODday = G.day;
    stage.setTimeOfDay(G.maxDay > 1 ? (G.day - 1) / (G.maxDay - 1) : 0);
  }
  inCinePrev = inCine;

  fx.update(dt);
  view.update(G, dt);
  stage.update(dt);
  const r0 = performance.now();
  stage.render(dt);
  inspect.sample(rawMs, performance.now() - r0);

  if (G.paused !== lastPaused) {
    lastPaused = G.paused;
    ui.showPause(G.paused);
  }
  ui.frame(G);
  // Lazy: metrics() (which runs the invariant sweep) is only built when shown.
  hud.update(rawMs, () => inspect.metrics(), inspect.lastScenario);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── Headless test surface ────────────────────────────────────────────────────
function gotoStation(id: StationId): void {
  const st = stationById(G, id);
  if (!st) return;
  G.chef.x = st.x;
  G.chef.z = st.z + CHEF_REACH * 0.6;
}

function spawnGuest(order: FoodId, table = 0): number {
  const tb = G.tables[table];
  const uid = G.nextUid++;
  if (tb) tb.occupied = uid;
  G.customers.push({
    uid, order, table,
    x: tb?.seatX ?? 0, z: tb?.seatZ ?? 0, state: "seated",
    patience: 30, maxPatience: 30, served: false, servedT: 0, mood: 1, hop: 0,
    look: { body: 0, hair: 0, hat: false, hue: 0 },
  });
  return uid;
}

// Shared helpers used by both the test API and the debug scenario system.
function doInteract(): string | null {
  const a = actionFor(ctx);
  if (a) { a.run(); G.prompt = { label: a.label, icon: a.icon }; }
  return a ? a.label : null;
}
function doSkipStory(): void {
  let guard = 0;
  while (G.phase === "cutscene" && guard++ < 50) skipCutscene(G);
}
function doQuickStart(): void {
  controller.play();
  let g = 0;
  while (g++ < 300) {
    if (G.phase === "cutscene") { skipCutscene(G); continue; }
    if (G.phase === "setup") { controller.finishSetup(); continue; }
    if (G.phase === "playing" && G.tutorial) { endShift(); continue; }
    if (G.phase === "playing") break;
    if (G.phase === "dayComplete") { controller.nextFromDayComplete(); continue; }
    if (G.phase === "manage") { controller.finishManage(); continue; }
    break;
  }
  // The drive-through fires celebration FX (e.g. the tutorial-complete confetti)
  // synchronously, which can't fade without render frames — drop them so a
  // scenario "cut" starts from a clean slate.
  ctx.fx.clear();
}

// Drive the FULL per-frame pipeline (sim + cutscene + fx + camera + render) N
// times WITHOUT input/rAF — lets headless QA probes settle the camera, age FX,
// and accumulate real frame-timing samples deterministically before a metric or
// signature read. Mirrors frame() minus input/UI/time-of-day.
function stepRender(dt: number): void {
  const t0 = performance.now();
  stepSim(dt);
  if (G.cutscene) tickCutscene(ctx, dt);
  fx.update(dt);
  view.update(G, dt);
  stage.update(dt);
  const r0 = performance.now();
  stage.render(dt);
  const now = performance.now();
  inspect.sample(now - t0, now - r0);
}
function renderFrames(n: number, dt = 1 / 60): void {
  for (let i = 0; i < Math.max(1, n | 0); i++) stepRender(dt);
}

/** Cut to a scenario, settle it over `frames` real frames, then return the full
 *  QA snapshot (visual fingerprint + perf metrics + invariant report) in one go. */
function probeScenario(name: string, frames = 12): {
  label: string;
  metrics: ReturnType<Inspector["metrics"]>;
  signature: ReturnType<Inspector["signature"]>;
  invariants: ReturnType<Inspector["invariants"]>;
} {
  inspect.reset();
  const label = runScenario(name, scenarioApi);
  inspect.lastScenario = name;
  renderFrames(frames);
  return {
    label,
    metrics: inspect.metrics(),
    signature: inspect.signature(),
    invariants: inspect.invariants(),
  };
}

// The toolkit the debug scenarios drive the game through (see game/scenarios.ts).
const scenarioApi: ScenarioApi = {
  ctx,
  play: () => controller.play(),
  quickStart: doQuickStart,
  toTitle: () => controller.quitToTitle(),
  finishDay: () => endShift(),
  nextDay: () => controller.nextFromDayComplete(),
  finishManage: () => controller.finishManage(),
  finishSetup: () => controller.finishSetup(),
  skipCutscenes: doSkipStory,
  setStudioFocus: (f) => controller.setStudioFocus(f),
  config: () => G.config,
  setConfig: (c) => controller.setConfig(c),
  spawnGuest,
  gotoStation,
  gotoCustomer: (uid) => { const c = G.customers.find((x) => x.uid === uid); if (c) { G.chef.x = c.x; G.chef.z = c.z + 1.0; } },
  interact: () => { doInteract(); },
  tickN: (dt, n) => { for (let i = 0; i < n; i++) stepSim(dt); },
};

interface TestApi {
  G: typeof G;
  ctx: Ctx;
  ctrl: GameController;
  tick: (dt?: number) => void;
  tickN: (dt: number, n: number) => void;
  scenario: (name: string) => string;
  scenarios: () => readonly string[];
  interact: () => string | null;
  actionLabel: () => string | null;
  guide: () => typeof G.guide;
  dash: () => boolean;
  gotoStation: (id: StationId) => void;
  gotoCustomer: (uid: number) => void;
  spawnGuest: (order: FoodId, table?: number) => number;
  recompute: () => void;
  stars: () => number;
  finishDay: () => void;
  nextDay: () => void;
  chooseTreat: (id: string) => void;
  finishManage: () => void;
  finishSetup: () => void;
  continueRun: () => void;
  skipStory: () => void;
  quickStart: () => void;
  info: () => { calls: number; tris: number; geometries: number; textures: number; castShadow: boolean; pixelRatio: number; quality: string };
  drawCalls: () => number;
  setQuality: (q: "high" | "low") => void;
  // ── Debug/QA harness surface ──
  metrics: () => ReturnType<Inspector["metrics"]>;
  signature: (w?: number, h?: number) => ReturnType<Inspector["signature"]>;
  invariants: () => ReturnType<Inspector["invariants"]>;
  probe: (name: string, frames?: number) => ReturnType<typeof probeScenario>;
  renderFrames: (n: number, dt?: number) => void;
  resetPerf: () => void;
  hud: (on?: boolean) => boolean;
}

const api: TestApi = {
  G,
  ctx,
  ctrl: controller,
  tick: (dt = 1 / 60) => stepSim(dt),
  tickN: (dt, n) => { for (let i = 0; i < n; i++) stepSim(dt); },
  scenario: (name) => { const label = runScenario(name, scenarioApi); inspect.lastScenario = name; return label; },
  scenarios: () => SCENARIOS,
  interact: doInteract,
  actionLabel: () => actionFor(ctx)?.label ?? null,
  guide: () => G.guide,
  dash: () => startDash(ctx),
  gotoStation,
  gotoCustomer: (uid) => {
    const c = G.customers.find((x) => x.uid === uid);
    if (c) { G.chef.x = c.x; G.chef.z = c.z + 1.0; }
  },
  spawnGuest,
  recompute: () => recomputeDerived(G),
  stars: () => computeStars(G),
  finishDay: () => endShift(),
  nextDay: () => controller.nextFromDayComplete(),
  chooseTreat: (id) => controller.chooseTreat(id as Parameters<GameController["chooseTreat"]>[0]),
  finishManage: () => controller.finishManage(),
  finishSetup: () => controller.finishSetup(),
  continueRun: () => controller.continueRun(),
  skipStory: doSkipStory,
  quickStart: doQuickStart,
  info: () => ({
    calls: stage.renderer.info.render.calls,
    tris: stage.renderer.info.render.triangles,
    geometries: stage.renderer.info.memory.geometries,
    textures: stage.renderer.info.memory.textures,
    castShadow: stage.keyLight.castShadow,
    pixelRatio: stage.renderer.getPixelRatio(),
    quality: stage.quality,
  }),
  drawCalls: () => {
    stage.renderer.info.reset(); // autoReset is off (see Stage); reset before a one-off count
    stage.renderer.render(stage.scene, stage.camera);
    return stage.renderer.info.render.calls;
  },
  setQuality: (q) => {
    G.quality = q;
    stage.applyQuality(q);
  },
  metrics: () => inspect.metrics(),
  signature: (w, h) => inspect.signature(w, h),
  invariants: () => inspect.invariants(),
  probe: (name, frames) => probeScenario(name, frames),
  renderFrames: (n, dt) => renderFrames(n, dt),
  resetPerf: () => inspect.reset(),
  hud: (on) => { if (typeof on === "boolean") hud.setVisible(on); else hud.toggle(); return hud.visible; },
};
(window as unknown as { __G: typeof G; __SR: TestApi }).__G = G;
(window as unknown as { __G: typeof G; __SR: TestApi }).__SR = api;
// Render-side handles for the vision/debug tooling (scene-graph introspection).
(window as unknown as { __stage: Stage; __view: SceneView }).__stage = stage;
(window as unknown as { __stage: Stage; __view: SceneView }).__view = view;
