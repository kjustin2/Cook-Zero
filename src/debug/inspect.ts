// DEBUG INSPECTOR — the measurement core of the testing/debug harness. One
// render-adjacent module (it may touch the renderer + Three numbers, like fx.ts
// and stage.ts do) that turns the live game into something a human, a smoke
// test, and Claude's vision loop can all *measure*:
//
//   • sample(frameMs, renderMs)  — feed it the real frame timing every frame.
//   • metrics()    — rolling fps + frame-time stats, a renderer.info snapshot
//                    (draw calls / triangles / geometries / textures / programs),
//                    FX-pool occupancy, and a compact game-state summary.
//   • signature()  — a dependency-free visual fingerprint of the CURRENT frame
//                    (a downsampled RGB grid + luma/black/white/colourfulness
//                    stats). Catches the catastrophic visual-regression class the
//                    global guide calls out (a full black screen, missing
//                    geometry, a washed-out/over-bright frame, a palette shift)
//                    with numbers — no PNG decode, no extra deps.
//   • invariants() — a battery of game-state sanity checks (chef in bounds, no
//                    NaN positions, patience/timers in range, pools not
//                    overrun, …). The bug net: assertable headless, shown live.
//
// All of it is surfaced on window.__SR in main.ts and drawn by the debug HUD.

import type { Stage } from "../render/stage";
import type { FxSystem } from "../render/fx";
import type { GameState, FoodId } from "../game/types";
import { FLOOR } from "../game/balance";

export interface FrameStats {
  fps: number; // mean fps over the window
  frameMs: number; // mean frame time (ms)
  minMs: number;
  maxMs: number;
  p99Ms: number; // worst 1% frame time
  low1Fps: number; // fps implied by p99 ("1% low")
  renderMs: number; // mean of the measured render() cost
  samples: number;
}

export interface RenderInfo {
  calls: number;
  tris: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  quality: string;
  castShadow: boolean;
}

export interface Signature {
  w: number;
  h: number;
  cells: number[]; // flattened RGB per cell, 0..255 (w*h*3 ints)
  luma: number; // mean luminance 0..1
  black: number; // fraction of near-black cells 0..1
  white: number; // fraction of near-white cells 0..1
  colorful: number; // mean per-cell chroma 0..1 (max-min channel)
  variance: number; // luma variance across cells 0..1 (flatness detector)
}

export interface InvariantReport {
  ok: boolean;
  checked: number;
  violations: string[];
}

export interface Metrics {
  frame: FrameStats;
  render: RenderInfo;
  fx: ReturnType<FxSystem["debugStats"]>;
  state: {
    phase: string;
    day: number;
    paused: boolean;
    customers: number;
    served: number;
    goal: number;
    combo: number;
    coins: number;
    carry: string;
  };
  invariants: InvariantReport;
}

const FOODS: FoodId[] = ["burger", "fries", "drink", "icecream", "hotdog"];
const WINDOW = 180; // ~3s of samples at 60fps

export class Inspector {
  private frameMs: number[] = [];
  private renderMs: number[] = [];
  private head = 0;
  private renderHead = 0;
  // Reused offscreen 2D canvas for the frame signature (no per-call allocation).
  private sigCanvas: HTMLCanvasElement | null = null;
  private sigCtx: CanvasRenderingContext2D | null = null;
  /** Last scenario label set via __SR.scenario / probe — handy on the HUD. */
  lastScenario = "";

  constructor(
    private stage: Stage,
    private fx: FxSystem,
    private G: GameState,
  ) {}

  /** Drop the accumulated frame-time window (per-scenario perf isolation). */
  reset(): void {
    this.frameMs = [];
    this.renderMs = [];
    this.head = 0;
    this.renderHead = 0;
  }

  /** Feed real per-frame timings (call once per rAF frame). */
  sample(frameMs: number, renderMs: number): void {
    if (Number.isFinite(frameMs) && frameMs > 0) {
      this.frameMs[this.head] = frameMs;
      this.head = (this.head + 1) % WINDOW;
    }
    if (Number.isFinite(renderMs) && renderMs >= 0) {
      this.renderMs[this.renderHead] = renderMs;
      this.renderHead = (this.renderHead + 1) % WINDOW;
    }
  }

  private frameStats(): FrameStats {
    const a = this.frameMs.filter((x) => Number.isFinite(x) && x > 0);
    if (!a.length) {
      return { fps: 0, frameMs: 0, minMs: 0, maxMs: 0, p99Ms: 0, low1Fps: 0, renderMs: 0, samples: 0 };
    }
    const sorted = [...a].sort((x, y) => x - y);
    const sum = a.reduce((s, x) => s + x, 0);
    const mean = sum / a.length;
    const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    const r = this.renderMs.filter((x) => Number.isFinite(x) && x >= 0);
    const renderMean = r.length ? r.reduce((s, x) => s + x, 0) / r.length : 0;
    return {
      fps: mean > 0 ? 1000 / mean : 0,
      frameMs: mean,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      p99Ms: p99,
      low1Fps: p99 > 0 ? 1000 / p99 : 0,
      renderMs: renderMean,
      samples: a.length,
    };
  }

  renderInfo(): RenderInfo {
    const info = this.stage.renderer.info;
    return {
      calls: info.render.calls,
      tris: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs ? info.programs.length : 0,
      pixelRatio: this.stage.renderer.getPixelRatio(),
      quality: this.stage.quality,
      castShadow: this.stage.keyLight.castShadow,
    };
  }

  /** A compact numeric fingerprint of whatever is on the canvas RIGHT NOW. It
   *  forces one synchronous render so the WebGL backbuffer is valid, then
   *  downsamples it into a 2D canvas (averaging) and reads the pixels back. */
  signature(gw = 24, gh = 16): Signature {
    // Render once so the current frame is on the canvas (preserveDrawingBuffer is
    // off, so the read must happen in this same synchronous task).
    this.stage.render(0);
    if (!this.sigCanvas) {
      this.sigCanvas = document.createElement("canvas");
      this.sigCtx = this.sigCanvas.getContext("2d", { willReadFrequently: true });
    }
    const canvas = this.sigCanvas!;
    const g2 = this.sigCtx!;
    canvas.width = gw;
    canvas.height = gh;
    g2.imageSmoothingEnabled = true;
    g2.clearRect(0, 0, gw, gh);
    g2.drawImage(this.stage.renderer.domElement, 0, 0, gw, gh);
    const data = g2.getImageData(0, 0, gw, gh).data;

    const cells: number[] = [];
    let lumaSum = 0;
    let luma2Sum = 0;
    let black = 0;
    let white = 0;
    let chroma = 0;
    const n = gw * gh;
    for (let i = 0; i < n; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      cells.push(r, g, b);
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      lumaSum += l;
      luma2Sum += l * l;
      if (l < 0.06) black++;
      if (l > 0.94) white++;
      chroma += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    }
    const luma = lumaSum / n;
    return {
      w: gw,
      h: gh,
      cells,
      luma,
      black: black / n,
      white: white / n,
      colorful: chroma / n,
      variance: Math.max(0, luma2Sum / n - luma * luma),
    };
  }

  /** Game-state sanity battery. Returns every violated invariant by name. */
  invariants(): InvariantReport {
    const G = this.G;
    const v: string[] = [];
    let checked = 0;
    const ok = (name: string, cond: boolean) => {
      checked++;
      if (!cond) v.push(name);
    };
    const fin = (x: number) => Number.isFinite(x);

    try {
      // Chef: finite position/velocity, on the floor (generous 1.5u margin for
      // dash overshoot / collision settle).
      const ch = G.chef;
      ok("chef.pos-finite", fin(ch.x) && fin(ch.z) && fin(ch.facing));
      ok("chef.vel-finite", fin(ch.vx) && fin(ch.vz));
      ok(
        "chef.in-bounds",
        ch.x >= FLOOR.minX - 1.5 && ch.x <= FLOOR.maxX + 1.5 && ch.z >= FLOOR.minZ - 1.5 && ch.z <= FLOOR.maxZ + 1.5,
      );
      if (ch.carry) {
        if (ch.carry.kind === "raw" || ch.carry.kind === "ready") {
          ok("chef.carry-food", FOODS.includes(ch.carry.food));
        } else {
          ok("chef.carry-kind", ch.carry.kind === "burnt");
        }
      }

      // Customers: bounded count, finite positions, sane patience, valid order +
      // table reference.
      ok("customers.count", G.customers.length <= G.tables.length + 2);
      for (const c of G.customers) {
        if (!fin(c.x) || !fin(c.z)) { v.push(`customer#${c.uid}.pos-finite`); }
        if (!(c.maxPatience > 0)) { v.push(`customer#${c.uid}.maxPatience>0`); }
        if (!(c.patience >= -0.5 && c.patience <= c.maxPatience + 0.5)) { v.push(`customer#${c.uid}.patience-range`); }
        if (!FOODS.includes(c.order)) { v.push(`customer#${c.uid}.order-valid`); }
        if (!(c.table >= 0 && c.table < G.tables.length)) { v.push(`customer#${c.uid}.table-ref`); }
        checked += 5;
      }

      // Tables: an occupied table must point at a live customer.
      for (let i = 0; i < G.tables.length; i++) {
        const occ = G.tables[i].occupied;
        if (occ !== 0 && !G.customers.some((c) => c.uid === occ)) { v.push(`table#${i}.occupied-orphan`); }
        checked++;
      }

      // Cook slots: non-negative timer, valid food, monotonic cook windows.
      for (const st of G.stations) {
        for (let s = 0; s < st.slots.length; s++) {
          const sl = st.slots[s];
          if (sl.food === null) continue;
          if (!FOODS.includes(sl.food)) { v.push(`${st.id}.slot${s}.food-valid`); }
          if (!(sl.t >= 0 && fin(sl.t))) { v.push(`${st.id}.slot${s}.t>=0`); }
          if (!(sl.readyT <= sl.goldenT && sl.goldenT <= sl.crispT && sl.crispT <= sl.burnT)) {
            v.push(`${st.id}.slot${s}.window-order`);
          }
          checked += 3;
        }
      }

      // Scores / counters never go negative or NaN.
      ok("score.finite", fin(G.coins) && fin(G.combo) && fin(G.servedToday));
      ok("score.nonneg", G.coins >= 0 && G.combo >= 0 && G.servedToday >= 0);
      // A day's goal only exists once a shift is running (0 at title/setup/win).
      if (G.phase === "playing" || G.phase === "dayComplete") ok("goal.positive", G.goal > 0);
      ok("stars.range", G.stars >= 0 && G.stars <= 3);

      // Pet / particles finite + pools within cap (a leak pins particles at max).
      ok("pet.pos-finite", fin(G.pet.x) && fin(G.pet.z));
      const fx = this.fx.debugStats();
      ok("fx.particles-capped", fx.particles <= fx.maxParticles);
    } catch (e) {
      v.push("invariants-threw:" + (e && (e as Error).message));
    }

    return { ok: v.length === 0, checked, violations: v };
  }

  metrics(): Metrics {
    const G = this.G;
    const carry = G.chef.carry ? (G.chef.carry.kind === "burnt" ? "burnt" : `${G.chef.carry.kind}:${G.chef.carry.food}`) : "empty";
    return {
      frame: this.frameStats(),
      render: this.renderInfo(),
      fx: this.fx.debugStats(),
      state: {
        phase: G.phase,
        day: G.day,
        paused: G.paused,
        customers: G.customers.length,
        served: G.servedToday,
        goal: G.goal,
        combo: G.combo,
        coins: G.coins,
        carry,
      },
      invariants: this.invariants(),
    };
  }
}
