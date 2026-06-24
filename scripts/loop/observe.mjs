// OBSERVE — the "visual" signal. Feeds each visual goal's screenshot to Claude
// (vision) as the source of truth, judging it against that goal's PASS/FAIL
// rubric and returning a structured verdict plus concrete improvement
// opportunities. Screenshots — not prose — are what's judged.
//
// Vision method (auto-detected, in order):
//   1. The Claude Code CLI (`claude -p`) — DEFAULT. Uses your existing Claude
//      Code login, so NO ANTHROPIC_API_KEY is required.
//   2. The Anthropic API (claude-opus-4-8) via @anthropic-ai/sdk or fetch — used
//      only if the CLI is absent but ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN is set.
//   3. none → verdicts marked skipped (the orchestrator then runs logic-only).
// Force a method with SR_LOOP_VISION=cli|api|off. Override the model with SR_LOOP_MODEL.
//
// Importable:  await observe({ shotsDir, outFile }) → { method, credentialed, verdicts }
// Standalone:  node scripts/loop/observe.mjs <shotsDir> [outFile]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";
import { GOALS } from "../../loop/goals.mjs";
import { readJSON, writeJSON } from "./_lib.mjs";

const isWin = platform() === "win32";
const MODEL = process.env.SR_LOOP_MODEL || ""; // "" → CLI/SDK default

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pass: { type: "boolean" },
    confidence: { type: "number" },
    observed: { type: "string" },
    reasoning: { type: "string" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["pass", "confidence", "observed", "reasoning", "issues"],
};

const SYSTEM =
  "You are a meticulous game-UX QA reviewer for 'Sizzle Rush', a bright, cute, kid-simple 3D cooking game. " +
  "You are given ONE screenshot and a strict PASS/FAIL rubric. Judge ONLY from what is visibly present in the " +
  "screenshot — do not assume anything off-screen. Set pass=true only if the screenshot clearly satisfies the " +
  "rubric. In `issues`, list concrete, actionable visual/UX problems or improvement opportunities you can see " +
  "(empty array if none). Be strict but fair; this drives an automated improvement loop.";

function userPrompt(goal) {
  return `GOAL: ${goal.title}\nRUBRIC (decides pass/fail):\n${goal.visual.rubric}\n\nReturn your structured verdict. confidence is 0..1.`;
}

// ── Method detection ─────────────────────────────────────────────────────────
let _cliChecked = false, _cliAvailable = false;
export function hasClaudeCli() {
  if (_cliChecked) return _cliAvailable;
  _cliChecked = true;
  if (process.env.SR_LOOP_VISION === "api" || process.env.SR_LOOP_VISION === "off") return (_cliAvailable = false);
  try {
    const r = spawnSync("claude", ["--version"], { encoding: "utf8", shell: isWin, timeout: 15000, windowsHide: true });
    _cliAvailable = r.status === 0 && /\d+\.\d+/.test(r.stdout || "");
  } catch { _cliAvailable = false; }
  return _cliAvailable;
}
function hasApiKey() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function chooseMethod() {
  if (process.env.SR_LOOP_VISION === "off") return "none";
  if (process.env.SR_LOOP_VISION === "api") return hasApiKey() ? "api" : "none";
  if (process.env.SR_LOOP_VISION === "cli") return hasClaudeCli() ? "cli" : "none";
  if (hasClaudeCli()) return "cli";
  if (hasApiKey()) return "api";
  return "none";
}

// ── Tolerant JSON parsing ────────────────────────────────────────────────────
function parseCliEnvelope(stdout) {
  const text = (stdout || "").trim();
  try { return JSON.parse(text); } catch { /* maybe preamble noise */ }
  // Find a line that is the result envelope.
  for (const ln of text.split(/\r?\n/).reverse()) {
    const t = ln.trim();
    if (t.startsWith("{") && t.includes('"type":"result"')) { try { return JSON.parse(t); } catch { /* keep looking */ } }
  }
  const idx = text.indexOf('{"type":"result"');
  if (idx >= 0) { try { return JSON.parse(text.slice(idx)); } catch { /* fall through */ } }
  throw new Error("could not parse `claude --output-format json` output");
}
function extractVerdict(resultText) {
  const t = (resultText || "").trim();
  try { return JSON.parse(t); } catch { /* maybe fenced or wrapped */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error("no JSON verdict found in model output");
}

// ── CLI path (default) ───────────────────────────────────────────────────────
function callClaudeCli({ imageAbsPath, goal }) {
  const prompt = [
    SYSTEM,
    `View the screenshot by reading this image file with your Read tool: ${imageAbsPath}`,
    userPrompt(goal),
    'Respond with ONLY one JSON object, no other text and no markdown fences: {"pass": boolean, "confidence": number, "observed": string, "reasoning": string, "issues": string[]}',
  ].join("\n\n");
  const args = ["-p", "--output-format", "json", "--allowedTools", "Read"];
  if (MODEL) args.push("--model", MODEL);
  const res = spawnSync("claude", args, {
    input: prompt, encoding: "utf8", shell: isWin, timeout: 180000, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
  });
  if (res.error) throw res.error;
  if (res.status !== 0 && !res.stdout) throw new Error(`claude exited ${res.status}: ${(res.stderr || "").slice(0, 200)}`);
  const env = parseCliEnvelope(res.stdout);
  if (env.is_error) throw new Error("claude CLI reported error: " + String(env.result || "").slice(0, 200));
  return extractVerdict(env.result);
}

// ── API path (fallback) — official SDK, then raw fetch ───────────────────────
async function callClaudeApi({ imageB64, goal }) {
  const body = {
    model: MODEL || "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: imageB64 } },
          { type: "text", text: userPrompt(goal) },
        ],
      },
    ],
  };
  const parse = (content) => {
    const tb = (content || []).find((b) => b.type === "text");
    if (!tb) throw new Error("no text block in response");
    return JSON.parse(tb.text);
  };
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const resp = await new Anthropic().messages.create(body);
    return parse(resp.content);
  } catch {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return parse((await res.json()).content);
  }
}

export async function observe({ shotsDir, outFile }) {
  const manifest = readJSON(join(shotsDir, "manifest.json"), { steps: {} });
  const steps = manifest.steps || {};
  const visualGoals = GOALS.filter((g) => g.visual);
  const method = chooseMethod();

  // CLI calls are blocking (spawnSync) → run sequentially; API calls can overlap.
  const verdicts = [];
  for (const goal of visualGoals) {
    const file = steps[goal.visual.step];
    if (!file) { verdicts.push({ id: goal.id, step: goal.visual.step, status: "no-screenshot", pass: false, issues: ["capture produced no screenshot for this step"] }); continue; }
    if (method === "none") { verdicts.push({ id: goal.id, step: goal.visual.step, status: "skipped", pass: null, issues: ["vision skipped — no Claude Code CLI and no ANTHROPIC_API_KEY"] }); continue; }
    try {
      const v = method === "cli"
        ? callClaudeCli({ imageAbsPath: file, goal })
        : await callClaudeApi({ imageB64: readFileSync(file).toString("base64"), goal });
      verdicts.push({ id: goal.id, step: goal.visual.step, status: "judged", pass: !!v.pass, ...v });
    } catch (e) {
      verdicts.push({ id: goal.id, step: goal.visual.step, status: "error", pass: null, issues: ["vision error: " + (e && e.message)] });
    }
  }

  const result = { method, model: MODEL || (method === "cli" ? "claude-code-cli-default" : "claude-opus-4-8"), credentialed: method !== "none", verdicts };
  if (outFile) writeJSON(outFile, result);
  return result;
}

// Standalone entry.
if (process.argv[1]?.endsWith("observe.mjs")) {
  const shotsDir = process.argv[2];
  if (!shotsDir) { console.error("usage: node scripts/loop/observe.mjs <shotsDir> [outFile]"); process.exit(2); }
  const out = await observe({ shotsDir, outFile: process.argv[3] || null });
  console.log(`vision method: ${out.method}`);
  for (const v of out.verdicts) {
    const mark = v.pass === true ? "PASS" : v.pass === false ? "FAIL" : "SKIP";
    console.log(`${mark} ${v.id} (${v.status}) — ${v.reasoning || (v.issues || []).join("; ")}`);
  }
  process.exit(0);
}
