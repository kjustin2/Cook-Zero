// DEBUG HUD — a toggleable on-screen overlay that makes the harness's numbers
// visible to a human AND to a screenshot (so Claude's vision pass can read perf
// + state straight off the frame). Hidden by default; it never touches gameplay
// and is pointer-events:none so it can't interfere with the clean kid UI.
//
//   • Toggle live with the  `  (backtick / Backquote) key.
//   • Auto-shown when the URL has ?debug or ?hud (handy for captures).
//   • The harness can force it on/off via window.__SR.hud(on).
//
// It reads a Metrics object (see inspect.ts) once per frame and also keeps its
// own short frame-time ring so it can draw a hitch sparkline.

import type { Metrics } from "./inspect";

const SPARK_N = 90;

export class DebugHud {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private spark: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;
  private series: number[] = [];
  private _visible = false;

  constructor(mount: HTMLElement = document.body) {
    this.root = document.createElement("div");
    this.root.id = "debug-hud";
    this.root.style.cssText = [
      "position:fixed", "top:8px", "left:8px", "z-index:99999",
      "font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
      "color:#dfe7ee", "background:rgba(10,14,20,0.82)", "padding:8px 10px",
      "border-radius:8px", "border:1px solid rgba(120,160,200,0.28)",
      "pointer-events:none", "white-space:pre", "letter-spacing:0.2px",
      "box-shadow:0 4px 18px rgba(0,0,0,0.4)", "display:none",
      "max-width:340px", "backdrop-filter:blur(2px)",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "🔧 SIZZLE RUSH · DEBUG";
    title.style.cssText = "font-weight:700;color:#ffd56b;margin-bottom:4px;letter-spacing:0.4px";
    this.root.appendChild(title);

    this.spark = document.createElement("canvas");
    this.spark.width = SPARK_N * 2;
    this.spark.height = 30;
    this.spark.style.cssText = "width:" + SPARK_N * 2 + "px;height:30px;display:block;margin:2px 0 5px;border-radius:3px;background:rgba(255,255,255,0.05)";
    this.root.appendChild(this.spark);
    this.sctx = this.spark.getContext("2d")!;

    this.body = document.createElement("div");
    this.root.appendChild(this.body);
    mount.appendChild(this.root);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") { this.toggle(); }
    });
    const q = location.search;
    if (/[?&](debug|hud)\b/.test(q) || /[?&](debug|hud)=1/.test(q)) this.setVisible(true);
  }

  get visible(): boolean { return this._visible; }
  toggle(): void { this.setVisible(!this._visible); }
  setVisible(on: boolean): void {
    this._visible = on;
    this.root.style.display = on ? "block" : "none";
  }

  /** Call every frame. Cheap when hidden: it only feeds the sparkline series and
   *  pulls the (invariant-computing) Metrics lazily — so normal play pays nothing. */
  update(frameMs: number, getMetrics: () => Metrics, scenario = ""): void {
    // Keep the sparkline series warm even while hidden so it's ready on toggle.
    this.series.push(frameMs);
    if (this.series.length > SPARK_N) this.series.shift();
    if (!this._visible) return;

    const m = getMetrics();
    const f = m.frame;
    const r = m.render;
    const s = m.state;
    const inv = m.invariants;
    const fpsCol = f.fps >= 55 ? "#7fe08a" : f.fps >= 30 ? "#ffd56b" : "#ff7a6b";
    const callsCol = r.calls < 700 ? "#9fb4c4" : "#ffb14a";
    const invCol = inv.ok ? "#7fe08a" : "#ff7a6b";
    const c = (col: string, t: string) => `<span style="color:${col}">${t}</span>`;
    const row = (k: string, val: string) => `<span style="color:#7d93a6">${k.padEnd(7)}</span>${val}`;

    const invLine = inv.ok
      ? c(invCol, `✓ ${inv.checked} invariants ok`)
      : c(invCol, `✗ ${inv.violations.length} VIOLATION(S)`) + "\n" +
        c("#ff9c8f", "  " + inv.violations.slice(0, 6).join("\n  ") + (inv.violations.length > 6 ? `\n  …+${inv.violations.length - 6}` : ""));

    this.body.innerHTML = [
      scenario || s.phase ? row("scene", `${scenario || "—"}  ${c("#cdd8e2", "[" + s.phase + (s.paused ? " ⏸" : "") + "  day " + s.day + "]")}`) : "",
      row("fps", `${c(fpsCol, f.fps.toFixed(0))}  ${c("#9fb4c4", f.frameMs.toFixed(1) + "ms")}  1%low ${c(fpsCol, f.low1Fps.toFixed(0))}  rnd ${f.renderMs.toFixed(1)}ms`),
      row("draw", `${c(callsCol, r.calls + " calls")}  ${(r.tris / 1000).toFixed(1)}k tris  ${r.programs} prog`),
      row("mem", `${r.geometries} geo  ${r.textures} tex  dpr${r.pixelRatio}  ${r.quality}${r.castShadow ? "·shadow" : ""}`),
      row("fx", `${m.fx.particles}/${m.fx.maxParticles} p  ${m.fx.coins}c ${m.fx.hearts}h ${m.fx.floaters}f ${m.fx.rings}r`),
      row("play", `${s.customers} guests  served ${s.served}/${s.goal}  combo ${s.combo}  ${c("#ffd56b", "🪙" + s.coins)}`),
      row("hands", s.carry),
      invLine,
    ].filter(Boolean).join("\n");

    void f;
    this.drawSpark();
  }

  private drawSpark(): void {
    const ctx = this.sctx;
    const W = this.spark.width;
    const H = this.spark.height;
    ctx.clearRect(0, 0, W, H);
    // 16.7ms (60fps) and 33ms (30fps) reference lines.
    const msToY = (ms: number) => H - Math.min(H, (ms / 50) * H);
    for (const [ms, col] of [[16.7, "rgba(127,224,138,0.35)"], [33.3, "rgba(255,122,107,0.35)"]] as const) {
      const y = msToY(ms);
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    const bw = W / SPARK_N;
    for (let i = 0; i < this.series.length; i++) {
      const ms = this.series[i];
      const y = msToY(ms);
      ctx.fillStyle = ms <= 18 ? "#7fe08a" : ms <= 34 ? "#ffd56b" : "#ff7a6b";
      ctx.fillRect(i * bw, y, Math.max(1, bw - 0.5), H - y);
    }
  }
}
