// QA SWEEP — the one-command harness centrepiece. Cuts the real game to EVERY
// debug scenario and, for each, collects:
//   • a screenshot (full frame, + a tight detail crop where it reads small),
//   • a visual fingerprint  (window.__SR.signature — downsampled RGB + stats),
//   • perf metrics          (window.__SR.metrics — fps/draw-calls/tris/pools),
//   • a game-state invariant report (window.__SR.invariants),
//   • any console / page errors.
// Then it diffs each fingerprint against a stored baseline and writes three
// artifacts a human, CI, and Claude's vision pass can all use:
//   shots/qa/index.html   — a contact sheet: every shot + perf/invariant/diff badges
//   shots/qa/SUMMARY.md    — a concise, AI-readable verdict per scenario
//   shots/qa/report.json   — the full machine-readable record
//
// Hard failures (exit 1): a degenerate frame (black/flat), any invariant
// violation, any console error, or a perf-budget breach. A visual DIFF vs
// baseline is a warning (review it) unless --strict.
//
//   node scripts/loop/qa.mjs [--update-baseline] [--strict] [--hud]
//                            [--out shots/qa] [--frames 12] [--port 5197]
import { join, basename } from "node:path";
import { existsSync } from "node:fs";
import { ensureServer, killTree, launchBrowser, openGame, ensureDir, readJSON, writeJSON } from "./_lib.mjs";
import { writeFileSync } from "node:fs";

const PORT = 5197;
const URL = `http://localhost:${PORT}`;

// ── Budgets (mirror smoke-perf; a breach is a hard failure) ──────────────────
const BUDGET = { calls: 800, geometries: 3000, textures: 400 };
// Scenarios whose framing reads small benefit from an extra detail crop.
const CROPS = {
  "serve-perfect": { x: 360, y: 150, width: 560, height: 380 },
  "day-complete": { x: 360, y: 120, width: 560, height: 420 },
};
// Camera transitions (preview glide, cutscene settle) need more settle frames.
const SLOW = new Set(["title", "setup", "setup-chef", "setup-room", "manage", "day-complete", "win"]);
// Per-scenario "this delta is a real change" threshold. Animated FX scenes get a
// bit of slack; the confetti/random-upgrade screens (day-complete/win/manage) get
// a lot — their pixels are non-deterministic, so they're guarded by degeneracy +
// invariants + perf instead of a pixel diff. Deterministic 3D frames stay tight.
const DIFF_WARN = 0.05;
const DIFF_LOUD = {
  "serve-perfect": 0.13, cooking: 0.1, burning: 0.1, wayfinder: 0.09,
  "day-complete": 0.24, win: 0.24, manage: 0.22,
};

function diffSignatures(a, b) {
  if (!a || !b || a.w !== b.w || a.h !== b.h || !a.cells || !b.cells) return null;
  let sum = 0;
  const n = Math.min(a.cells.length, b.cells.length);
  for (let i = 0; i < n; i++) sum += Math.abs(a.cells[i] - b.cells[i]);
  return sum / (n * 255); // 0..1 mean absolute per-channel delta
}

/** Intrinsic frame health (no baseline needed) — catches the catastrophic class. */
function degeneracy(sig) {
  const flags = [];
  if (sig.luma < 0.04 || sig.black > 0.85) flags.push({ kind: "BLACK", hard: true, note: `luma ${sig.luma.toFixed(3)}, black ${(sig.black * 100) | 0}%` });
  if (sig.variance < 0.00025 && sig.colorful < 0.015) flags.push({ kind: "FLAT", hard: true, note: `variance ${sig.variance.toFixed(5)} (single-colour frame?)` });
  if (sig.white > 0.92) flags.push({ kind: "WASHED", hard: false, note: `${(sig.white * 100) | 0}% near-white` });
  return flags;
}

export async function qa({ url, outDir, frames, updateBaseline, strict, hud, baselinePath }) {
  ensureDir(outDir);
  const browser = await launchBrowser();
  const { page, realErrors } = await openGame(browser, url);
  const sleep = (ms) => page.waitForTimeout(ms);
  const ev = (fn, a) => page.evaluate(fn, a);

  // The baseline is a durable, committed reference (screenshots under outDir are
  // ephemeral + gitignored), so it lives in the tracked loop/ folder by default.
  baselinePath = baselinePath || join("loop", "qa-baseline.json");
  const baseline = readJSON(baselinePath, { signatures: {} });
  const results = [];
  const fullSignatures = {}; // name → full signature (with cells) for baseline writing

  try {
    if (hud) await ev(() => window.__SR.hud(true));
    const names = await ev(() => [...window.__SR.scenarios()]);
    console.log(`QA sweep: ${names.length} scenarios → ${outDir}`);

    let n = 0;
    for (const name of names) {
      const probe = await ev(({ name, frames }) => window.__SR.probe(name, frames), { name, frames: SLOW.has(name) ? 50 : frames });
      // Setup variants: open the matching customizer category so panel + camera agree.
      if (name === "setup-room") await page.click('[data-czcat="diner"]').catch(() => {});
      if (name === "setup-chef") await page.click('[data-czcat="chef"]').catch(() => {});
      await sleep(SLOW.has(name) ? 900 : 320);

      // Fresh signature + metrics that match exactly the frame we're about to shoot.
      const signature = await ev(() => window.__SR.signature());
      const metrics = await ev(() => window.__SR.metrics());
      fullSignatures[name] = signature;

      const file = join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`);
      await page.screenshot({ path: file });
      let cropFile = null;
      if (CROPS[name]) {
        cropFile = join(outDir, `${String(n).padStart(2, "0")}-${name}-detail.png`);
        await page.screenshot({ path: cropFile, clip: CROPS[name] });
      }

      // ── Verdicts ──
      const flags = degeneracy(signature);
      const inv = probe.invariants;
      const r = metrics.render;
      const budgetBreaches = [];
      if (r.calls >= BUDGET.calls) budgetBreaches.push(`draw calls ${r.calls} ≥ ${BUDGET.calls}`);
      if (r.geometries >= BUDGET.geometries) budgetBreaches.push(`geometries ${r.geometries} ≥ ${BUDGET.geometries}`);
      if (r.textures >= BUDGET.textures) budgetBreaches.push(`textures ${r.textures} ≥ ${BUDGET.textures}`);

      const base = baseline.signatures[name];
      const delta = diffSignatures(base, signature);
      const loud = DIFF_LOUD[name] ?? DIFF_WARN;
      let diffStatus = "new";
      if (delta != null) diffStatus = delta >= loud ? "changed" : "ok";

      const hardFlags = flags.filter((f) => f.hard);
      const hardFail =
        hardFlags.length > 0 || !inv.ok || budgetBreaches.length > 0 || (strict && diffStatus === "changed");

      results.push({
        n, name, label: probe.label, file: basename(file), cropFile: cropFile ? basename(cropFile) : null,
        metrics, signature: { luma: signature.luma, black: signature.black, white: signature.white, colorful: signature.colorful, variance: signature.variance },
        invariants: inv, flags, budgetBreaches, diff: { status: diffStatus, delta }, hardFail,
      });

      const tag = hardFail ? "FAIL" : flags.length || diffStatus === "changed" ? "warn" : "ok  ";
      console.log(`  [${tag}] ${name.padEnd(13)} calls ${String(r.calls).padStart(3)}  ${(r.tris / 1000).toFixed(0).padStart(3)}k  inv ${inv.ok ? "✓" : "✗" + inv.violations.length}  ${diffStatus}${delta != null ? " " + (delta * 100).toFixed(1) + "%" : ""}${flags.length ? "  " + flags.map((f) => f.kind).join(",") : ""}`);
    }

    const consoleErrors = realErrors();

    // ── Update baseline (only from a clean run, so we never bless a broken frame) ──
    if (updateBaseline) {
      const anyDegenerate = results.some((r) => r.flags.some((f) => f.hard));
      if (anyDegenerate) {
        console.log("⚠ refusing to update baseline — some frames are degenerate. Fix them first.");
      } else {
        writeJSON(baselinePath, { updatedAt: new Date().toISOString(), signatures: fullSignatures });
        console.log(`✓ baseline updated → ${baselinePath} (${Object.keys(fullSignatures).length} scenarios)`);
      }
    }

    const summary = writeArtifacts({ outDir, results, consoleErrors, hadBaseline: Object.keys(baseline.signatures).length > 0 });
    return { results, consoleErrors, summary };
  } finally {
    await browser.close();
  }
}

// ── Artifact writers ─────────────────────────────────────────────────────────
function writeArtifacts({ outDir, results, consoleErrors, hadBaseline }) {
  const fails = results.filter((r) => r.hardFail);
  const warns = results.filter((r) => !r.hardFail && (r.flags.length || r.diff.status === "changed"));
  const summary = {
    total: results.length,
    clean: results.filter((r) => !r.hardFail && !r.flags.length && r.diff.status !== "changed").length,
    fails: fails.length,
    warns: warns.length,
    consoleErrors: consoleErrors.length,
  };

  // report.json
  writeJSON(join(outDir, "report.json"), { generatedAt: new Date().toISOString(), summary, consoleErrors, results });

  // SUMMARY.md (what Claude reads)
  const md = [];
  md.push("# Sizzle Rush — QA sweep");
  md.push("");
  md.push(`**${summary.clean}/${summary.total} clean** · ${summary.fails} fail · ${summary.warns} warn · ${summary.consoleErrors} console error(s)${hadBaseline ? "" : " · _no baseline yet (run with --update-baseline)_"}`);
  md.push("");
  md.push("Open `index.html` in this folder for the visual contact sheet.");
  md.push("");
  if (consoleErrors.length) {
    md.push("## ⚠️ Console errors");
    for (const e of consoleErrors.slice(0, 12)) md.push(`- \`${e}\``);
    md.push("");
  }
  md.push("## Per-scenario");
  md.push("");
  md.push("| Scenario | Status | draws | tris | fps | invariants | visual | notes |");
  md.push("|---|---|--:|--:|--:|---|---|---|");
  for (const r of results) {
    const status = r.hardFail ? "❌ FAIL" : r.flags.length || r.diff.status === "changed" ? "⚠️ warn" : "✅ ok";
    const inv = r.invariants.ok ? "✓" : `✗ ${r.invariants.violations.join(", ")}`;
    const vis = r.diff.delta != null ? `${r.diff.status} ${(r.diff.delta * 100).toFixed(1)}%` : "new";
    const notes = [...r.flags.map((f) => `${f.kind} (${f.note})`), ...r.budgetBreaches].join("; ");
    md.push(`| \`${r.name}\` | ${status} | ${r.metrics.render.calls} | ${(r.metrics.render.tris / 1000).toFixed(0)}k | ${r.metrics.frame.fps.toFixed(0)} | ${inv} | ${vis} | ${notes} |`);
  }
  md.push("");
  if (fails.length) {
    md.push("## ❌ Hard failures to fix");
    for (const r of fails) {
      const why = [
        ...r.flags.filter((f) => f.hard).map((f) => `${f.kind} — ${f.note}`),
        ...(r.invariants.ok ? [] : [`invariant violations: ${r.invariants.violations.join(", ")}`]),
        ...r.budgetBreaches,
      ];
      md.push(`- **${r.name}**: ${why.join("; ")}`);
    }
    md.push("");
  }
  writeFileSync(join(outDir, "SUMMARY.md"), md.join("\n"));

  // index.html contact sheet
  writeFileSync(join(outDir, "index.html"), contactSheet({ results, consoleErrors, summary }));

  return summary;
}

function contactSheet({ results, consoleErrors, summary }) {
  const badge = (txt, col) => `<span class="b" style="background:${col}">${txt}</span>`;
  const cards = results.map((r) => {
    const m = r.metrics;
    const statusCol = r.hardFail ? "#d33" : r.flags.length || r.diff.status === "changed" ? "#c80" : "#2a8";
    const statusTxt = r.hardFail ? "FAIL" : r.flags.length || r.diff.status === "changed" ? "WARN" : "OK";
    const fpsCol = m.frame.fps >= 55 ? "#2a8" : m.frame.fps >= 30 ? "#c80" : "#d33";
    const callsCol = m.render.calls < 700 ? "#456" : "#c80";
    const inv = r.invariants.ok
      ? badge("inv ✓", "#2a8")
      : badge(`inv ✗${r.invariants.violations.length}`, "#d33");
    const diff = r.diff.delta == null
      ? badge("new", "#789")
      : badge(`Δ ${(r.diff.delta * 100).toFixed(1)}%`, r.diff.status === "changed" ? "#c80" : "#456");
    const flags = r.flags.map((f) => badge(f.kind, f.hard ? "#d33" : "#c80")).join("");
    const viol = r.invariants.ok ? "" : `<div class="viol">${r.invariants.violations.join("<br>")}</div>`;
    const breaches = r.budgetBreaches.length ? `<div class="viol">${r.budgetBreaches.join("<br>")}</div>` : "";
    return `<div class="card" style="border-color:${statusCol}">
      <a href="${r.file}" target="_blank"><img src="${r.file}" loading="lazy"></a>
      <div class="head"><span class="name">${r.n}. ${r.name}</span>${badge(statusTxt, statusCol)}</div>
      <div class="lbl">${r.label || ""}</div>
      <div class="badges">${badge(`${m.render.calls} draws`, callsCol)}${badge(`${(m.render.tris / 1000).toFixed(0)}k tris`, "#456")}${badge(`${m.frame.fps.toFixed(0)} fps`, fpsCol)}${inv}${diff}${flags}</div>
      <div class="badges">${badge(`luma ${m && r.signature.luma.toFixed(2)}`, "#456")}${badge(`fx ${m.fx.particles}p`, "#456")}${badge(m.state.phase, "#456")}</div>
      ${viol}${breaches}
    </div>`;
  }).join("\n");

  const errBlock = consoleErrors.length
    ? `<div class="errors"><b>⚠️ ${consoleErrors.length} console error(s):</b><br>${consoleErrors.slice(0, 12).map((e) => e.replace(/</g, "&lt;")).join("<br>")}</div>`
    : "";

  return `<!doctype html><meta charset="utf-8"><title>Sizzle Rush — QA contact sheet</title>
<style>
  body{margin:0;background:#11161c;color:#dfe7ee;font:14px/1.5 system-ui,sans-serif}
  header{padding:16px 20px;background:#0c1015;position:sticky;top:0;border-bottom:1px solid #233;z-index:1}
  header h1{margin:0 0 4px;font-size:18px}
  .sum{font-size:13px;color:#9fb4c4}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px;padding:16px}
  .card{background:#1a212a;border:2px solid #2a8;border-radius:10px;overflow:hidden}
  .card img{width:100%;display:block;background:#000;aspect-ratio:16/10;object-fit:cover}
  .head{display:flex;justify-content:space-between;align-items:center;padding:7px 10px 2px}
  .name{font-weight:700}
  .lbl{padding:0 10px;color:#8aa;font-size:12px;min-height:16px}
  .badges{display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px}
  .b{font:600 11px/1.6 ui-monospace,monospace;color:#fff;padding:1px 6px;border-radius:5px}
  .viol{margin:2px 10px 8px;color:#ff9c8f;font:600 11px/1.4 ui-monospace,monospace;background:#2a1418;padding:5px 7px;border-radius:5px}
  .errors{margin:12px 20px;color:#ff9c8f;font:13px/1.5 ui-monospace,monospace;background:#2a1418;padding:10px 14px;border-radius:8px}
</style>
<header>
  <h1>🍔 Sizzle Rush — QA contact sheet</h1>
  <div class="sum">${summary.clean}/${summary.total} clean · ${summary.fails} fail · ${summary.warns} warn · ${summary.consoleErrors} console error(s) · generated ${new Date().toISOString()}</div>
</header>
${errBlock}
<div class="grid">${cards}</div>`;
}

// ── Standalone entry ─────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith("qa.mjs")) {
  const argv = process.argv.slice(2);
  const opt = {
    outDir: "shots/qa",
    frames: 12,
    baselinePath: join("loop", "qa-baseline.json"),
    updateBaseline: argv.includes("--update-baseline"),
    strict: argv.includes("--strict"),
    hud: argv.includes("--hud"),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") opt.outDir = argv[++i];
    else if (argv[i] === "--frames") opt.frames = Number(argv[++i]);
    else if (argv[i] === "--baseline") opt.baselinePath = argv[++i];
    else if (argv[i] === "--port") process.env.SR_QA_PORT = argv[++i];
  }
  const port = Number(process.env.SR_QA_PORT || PORT);
  const { url, child } = await ensureServer(process.env.SR_URL || `http://localhost:${port}`, port);
  let code = 0;
  try {
    const { summary } = await qa({ url, ...opt });
    const hardFail = summary.fails > 0 || summary.consoleErrors > 0;
    console.log("");
    console.log(`QA: ${summary.clean}/${summary.total} clean, ${summary.fails} fail, ${summary.warns} warn, ${summary.consoleErrors} console error(s).`);
    console.log(`→ open ${join(opt.outDir, "index.html")}  ·  read ${join(opt.outDir, "SUMMARY.md")}`);
    if (!existsSync(opt.baselinePath) && !opt.updateBaseline) {
      console.log("  (no visual baseline yet — run `npm run qa:baseline` once the look is good.)");
    }
    code = hardFail ? 1 : 0;
  } catch (e) {
    console.error("QA sweep errored:", e && e.message);
    code = 1;
  } finally {
    killTree(child);
  }
  process.exit(code);
}
