// LOOP — the orchestrator that ties capture → observe → verify → report → decide
// into a repeating, self-iterating improvement loop. Runs every measurement step
// itself against one dev server; the only step it can't do alone is editing code,
// which it delegates to a pluggable implementer command (or stops and asks a
// human/agent to implement, then resumes — safe to stop & resume at any cycle).
//
//   node scripts/loop/loop.mjs [--max-cycles N] [--no-vision] [--fresh]
//                              [--port P] [--implementer "<shell cmd>"]
//
// Stop conditions: all goals met, max-cycles reached, or (no implementer) one
// measurement cycle done — re-run to continue after implementing the fixes.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT, CYCLES_DIR, STATE_FILE, cycleDir, ensureDir, readJSON, writeJSON,
  ensureServer, killTree, latestCycleNumber,
} from "./_lib.mjs";
import { capture } from "./capture.mjs";
import { verifyLogic } from "./verify-logic.mjs";
import { observe, hasClaudeCli } from "./observe.mjs";
import { report } from "./report.mjs";

const PORT = 5190;
const URL = `http://localhost:${PORT}`;

function parseArgs(argv) {
  const a = { maxCycles: 6, noVision: false, fresh: false, port: PORT, implementer: process.env.SR_LOOP_IMPLEMENTER || null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--max-cycles") a.maxCycles = Number(argv[++i]);
    else if (v === "--no-vision") a.noVision = true;
    else if (v === "--fresh") a.fresh = true;
    else if (v === "--port") a.port = Number(argv[++i]);
    else if (v === "--implementer") a.implementer = argv[++i];
  }
  return a;
}

function visionOn(args) {
  if (args.noVision) return false;
  // Prefer the Claude Code CLI (uses existing login, no API key); else an API key.
  return hasClaudeCli() || !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Strict success: every goal's logic passes AND every visual goal has a real
 *  screenshot PASS. Per the spec, a visual goal needs screenshot evidence — so in
 *  logic-only mode (no API key) visual goals stay UNVERIFIED and never count as met. */
function allGoalsMet(decision) {
  return decision.goals.every((g) => g.logicMet && (!g.visualStep || g.visualState === "pass"));
}

/** True when every signal that COULD be checked passed, but some visuals are
 *  unverified only because vision was unavailable (not because anything failed). */
function blockedOnlyOnVision(decision) {
  const noHardFail = decision.goals.every((g) => g.logicMet && g.visualState !== "fail");
  const someUnverified = decision.goals.some((g) => g.visualStep && g.visualState === "unverified");
  return noHardFail && someUnverified;
}

async function runCycle({ url, n, vision }) {
  const dir = cycleDir(n);
  const shotsDir = join(dir, "shots");
  ensureDir(shotsDir);
  const timestamp = new Date().toISOString();

  console.log(`\n──── cycle ${String(n).padStart(3, "0")} ────`);
  console.log("  capture…");
  await capture({ url, outDir: shotsDir });
  console.log("  verify-logic…");
  await verifyLogic({ url, outFile: join(dir, "logic.json") });
  console.log(vision ? "  observe (AI vision)…" : "  observe (skipped — logic-only)…");
  await observe({ shotsDir, outFile: join(dir, "observe.json") });

  // changes note: implementer (or agent) may drop a changes.md describing edits.
  const changesPath = join(dir, "changes.md");
  const changesNote = existsSync(changesPath) ? readFileSync(changesPath, "utf8") : null;
  const decision = await report({ cycleNum: n, dir, timestamp, changesNote });
  console.log(`  → ${decision.summary.met}/${decision.summary.total} goals met. report: ${join(dir, "report.md")}`);
  return decision;
}

function runImplementer(cmd, n, dir) {
  console.log(`  implementer: ${cmd}`);
  const env = {
    ...process.env,
    SR_LOOP_CYCLE: String(n),
    SR_LOOP_CYCLE_DIR: dir,
    SR_LOOP_REPORT: join(dir, "report.md"),
    SR_LOOP_DECISION: join(dir, "decision.json"),
  };
  const res = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: "inherit", env, windowsHide: true });
  return res.status === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const vision = visionOn(args);
  if (vision) {
    console.log(hasClaudeCli() ? "👁  Vision via Claude Code CLI (claude -p) — no API key needed." : "👁  Vision via Anthropic API key.");
  } else if (!args.noVision) {
    console.log("⚠ No Claude Code CLI and no ANTHROPIC_API_KEY found — running in logic-only mode.");
    console.log("  (Visual goals will be captured but marked UNVERIFIED.)");
  }

  ensureDir(CYCLES_DIR);
  let state = readJSON(STATE_FILE, null);
  if (args.fresh || !state) {
    state = { startedAt: new Date().toISOString(), lastCycle: 0, done: false, mode: vision ? "vision" : "logic-only", history: [] };
  }
  if (state.done && !args.fresh) {
    console.log("✅ Loop already complete (all goals met). Use --fresh to re-run from cycle 1.");
    return 0;
  }

  const { url, child } = await ensureServer(URL, args.port);
  let exit = 0;
  try {
    let n = Math.max(state.lastCycle, latestCycleNumber()) + 1;
    const lastAllowed = n + args.maxCycles - 1;
    while (n <= lastAllowed) {
      let decision;
      try {
        decision = await runCycle({ url, n, vision });
      } catch (e) {
        console.error(`  cycle ${n} errored: ${e && e.message}`);
        state.history.push({ cycle: n, error: String(e && e.message), timestamp: new Date().toISOString() });
        state.lastCycle = n; writeJSON(STATE_FILE, state);
        exit = 1;
        break;
      }

      state.lastCycle = n;
      state.history.push({
        cycle: n, met: decision.summary.met, total: decision.summary.total,
        gaps: decision.gaps.map((g) => g.id), timestamp: decision.timestamp,
      });

      if (allGoalsMet(decision)) {
        state.done = true;
        writeJSON(STATE_FILE, state);
        console.log(`\n🎉 ALL ${decision.summary.total} GOALS MET (logic + visual) — stopping (success). Report: ${join(cycleDir(n), "report.md")}`);
        break;
      }
      writeJSON(STATE_FILE, state);

      if (blockedOnlyOnVision(decision)) {
        console.log(`\n⏹ Logic verified for all ${decision.summary.total} goals; ${decision.summary.visualUnverified} visual goal(s) UNVERIFIED because vision is unavailable.`);
        console.log("  This is NOT full success — visual goals need screenshot evidence. Set ANTHROPIC_API_KEY (or review the");
        console.log(`  captured screenshots under ${join(cycleDir(n), "shots")} yourself) to confirm the visual goals.`);
        break;
      }

      if (n >= lastAllowed) {
        console.log(`\n⏹ Budget reached (${args.maxCycles} cycle(s) this run). ${decision.summary.met}/${decision.summary.total} met.`);
        console.log(`  Remaining gaps: ${decision.gaps.map((g) => g.id).join(", ") || "none"}.  Re-run to continue.`);
        break;
      }

      if (args.implementer) {
        const ok = runImplementer(args.implementer, n, cycleDir(n));
        if (!ok) { console.log("  implementer reported failure — stopping; fix and re-run."); break; }
        n += 1; // verify the change on the next cycle
        continue;
      }

      // No implementer: nothing will change on its own — stop and ask for an
      // implementation pass, then resume with a re-run.
      console.log(`\n⏸ Measurement cycle ${String(n).padStart(3, "0")} complete — ${decision.summary.met}/${decision.summary.total} met.`);
      console.log(`  Implement the gaps in: ${join(cycleDir(n), "report.md")}`);
      console.log("  Then re-run `npm run loop` (resumes at the next cycle), or pass --implementer \"<cmd>\" to automate.");
      break;
    }
  } finally {
    killTree(child);
  }
  return exit;
}

process.exit(await main());
