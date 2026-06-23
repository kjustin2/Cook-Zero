// REPORT — turns a cycle's raw signals (logic.json + observe.json + the captured
// screenshots) into a human-readable report.md and a machine-readable
// decision.json, and appends one line to loop/PROGRESS.md. A goal is MET only
// when every signal it defines passes (logical AND visual).
//
// Importable:  await report({ cycleNum, dir, timestamp, changesNote })
// Standalone:  node scripts/loop/report.mjs <cycleDir> [cycleNum]
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join, basename as pathBasename } from "node:path";
import { GOALS } from "../../loop/goals.mjs";
import { readJSON, writeJSON, PROGRESS_FILE } from "./_lib.mjs";

function classify(goal, logicRes, verdict) {
  const logicApplicable = !!goal.logic;
  const visualApplicable = !!goal.visual;
  const logicMet = logicApplicable ? !!(logicRes && logicRes.pass) : true;

  let visualState; // 'pass' | 'fail' | 'unverified' | 'n/a'
  if (!visualApplicable) visualState = "n/a";
  else if (!verdict) visualState = "unverified";
  else if (verdict.pass === true) visualState = "pass";
  else if (verdict.pass === false) visualState = "fail";
  else visualState = "unverified"; // skipped / error / no-screenshot

  // Strict: a visual goal needs a real PASS. (The orchestrator may relax this in
  // logic-only mode, where 'unverified' visuals don't block termination.)
  const met = logicMet && (visualState === "pass" || visualState === "n/a");
  return { logicApplicable, visualApplicable, logicMet, visualState, met };
}

export async function report({ cycleNum, dir, timestamp, changesNote }) {
  const logic = readJSON(join(dir, "logic.json"), []);
  const observeData = readJSON(join(dir, "observe.json"), { verdicts: [], credentialed: false });
  const manifest = readJSON(join(dir, "shots", "manifest.json"), { steps: {}, consoleErrors: [] });
  const logicById = Object.fromEntries(logic.map((r) => [r.id, r]));
  const verdictById = Object.fromEntries((observeData.verdicts || []).map((v) => [v.id, v]));
  const visionAvailable = !!observeData.credentialed;

  const goals = GOALS.map((g) => {
    const logicRes = logicById[g.id] || null;
    const verdict = verdictById[g.id] || null;
    const c = classify(g, logicRes, verdict);
    return {
      id: g.id,
      title: g.title,
      pillar: g.pillar,
      logicMet: c.logicMet,
      logicDetail: logicRes ? logicRes.detail : "(no logic check)",
      visualState: c.visualState,
      visualStep: g.visual ? g.visual.step : null,
      visualScreenshot: g.visual && manifest.steps[g.visual.step] ? "shots/" + pathBasename(manifest.steps[g.visual.step]) : null,
      visualReasoning: verdict ? verdict.reasoning || "" : "",
      visualObserved: verdict ? verdict.observed || "" : "",
      issues: verdict ? verdict.issues || [] : [],
      met: c.met,
    };
  });

  const summary = {
    cycle: cycleNum,
    total: goals.length,
    met: goals.filter((g) => g.met).length,
    logicPassed: goals.filter((g) => g.logicMet).length,
    visualPassed: goals.filter((g) => g.visualState === "pass").length,
    visualFailed: goals.filter((g) => g.visualState === "fail").length,
    visualUnverified: goals.filter((g) => g.visualState === "unverified").length,
    visionAvailable,
    consoleErrors: (manifest.consoleErrors || []).length,
  };

  // Remaining gaps: anything not fully met, with the actionable reasons.
  const gaps = [];
  for (const g of goals) {
    if (g.met) continue;
    const reasons = [];
    if (!g.logicMet) reasons.push(`logic FAIL — ${g.logicDetail}`);
    if (g.visualState === "fail") reasons.push(`visual FAIL — ${g.visualReasoning}`);
    if (g.visualState === "unverified" && g.visualStep) reasons.push("visual UNVERIFIED (vision unavailable/skipped)");
    if (g.issues.length) reasons.push("visual issues: " + g.issues.join("; "));
    gaps.push({ id: g.id, title: g.title, reasons });
  }

  const decision = { cycle: cycleNum, timestamp, summary, goals, gaps };
  writeJSON(join(dir, "decision.json"), decision);

  // ── report.md ────────────────────────────────────────────────────────────
  const mark = (b) => (b ? "✅" : "❌");
  const vmark = (s) => ({ pass: "✅", fail: "❌", unverified: "⚠️", "n/a": "—" })[s];
  const lines = [];
  lines.push(`# Improvement cycle ${String(cycleNum).padStart(3, "0")}`);
  lines.push("");
  lines.push(`*${timestamp}*`);
  lines.push("");
  lines.push(
    `**${summary.met}/${summary.total} goals fully met** · logic ${summary.logicPassed}/${summary.total} · ` +
    `visual ${summary.visualPassed} pass / ${summary.visualFailed} fail / ${summary.visualUnverified} unverified` +
    `${visionAvailable ? "" : " · _vision unavailable (logic-only)_"}` +
    `${summary.consoleErrors ? ` · ⚠️ ${summary.consoleErrors} console error(s)` : ""}`
  );
  lines.push("");
  if (changesNote) { lines.push("## Changes implemented this cycle"); lines.push(""); lines.push(changesNote); lines.push(""); }
  lines.push("## Goal scorecard");
  lines.push("");
  lines.push("| Goal | Logic | Visual | Met |");
  lines.push("|---|:---:|:---:|:---:|");
  for (const g of goals) {
    lines.push(`| ${g.title} | ${mark(g.logicMet)} | ${vmark(g.visualState)} | ${mark(g.met)} |`);
  }
  lines.push("");
  lines.push("## Detail");
  for (const g of goals) {
    lines.push("");
    lines.push(`### ${g.met ? "✅" : "❌"} ${g.id} — ${g.title}`);
    lines.push(`*pillar: ${g.pillar}*`);
    lines.push("");
    lines.push(`- **Logic** ${mark(g.logicMet)} — ${g.logicDetail}`);
    if (g.visualStep) {
      lines.push(`- **Visual** ${vmark(g.visualState)} (step \`${g.visualStep}\`)${g.visualReasoning ? " — " + g.visualReasoning : ""}`);
      if (g.visualObserved) lines.push(`  - observed: ${g.visualObserved}`);
      if (g.issues.length) lines.push("  - issues: " + g.issues.map((i) => `${i}`).join("; "));
      if (g.visualScreenshot) { lines.push(""); lines.push(`  ![${g.visualStep}](${g.visualScreenshot})`); }
    }
  }
  lines.push("");
  lines.push("## Remaining gaps");
  if (!gaps.length) {
    lines.push("");
    lines.push("None — all objective goals met. 🎉");
  } else {
    for (const gap of gaps) {
      lines.push("");
      lines.push(`- **${gap.id}** — ${gap.title}`);
      for (const r of gap.reasons) lines.push(`  - ${r}`);
    }
  }
  lines.push("");
  const reportPath = join(dir, "report.md");
  writeFileSync(reportPath, lines.join("\n"));

  // ── append PROGRESS.md ─────────────────────────────────────────────────────
  const progressLine = `- cycle ${String(cycleNum).padStart(3, "0")} (${timestamp}): ${summary.met}/${summary.total} met` +
    `${gaps.length ? " — gaps: " + gaps.map((g) => g.id).join(", ") : " — ALL MET 🎉"}\n`;
  if (!existsSync(PROGRESS_FILE)) appendFileSync(PROGRESS_FILE, "# Improvement loop — progress log\n\n");
  appendFileSync(PROGRESS_FILE, progressLine);

  return decision;
}

// Standalone entry.
if (process.argv[1]?.endsWith("report.mjs")) {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: node scripts/loop/report.mjs <cycleDir> [cycleNum]"); process.exit(2); }
  const cycleNum = Number(process.argv[3] || 0);
  const d = await report({ cycleNum, dir, timestamp: new Date().toISOString() });
  console.log(`report → ${join(dir, "report.md")}  (${d.summary.met}/${d.summary.total} met)`);
  process.exit(0);
}
