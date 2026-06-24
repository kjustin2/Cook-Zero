// Shared helpers for the self-iterating improvement loop. Boots/owns the dev
// server, launches headless Chromium, resolves the loop's on-disk layout, and
// reads/writes the per-cycle JSON artifacts. Mirrors the conventions of
// scripts/run-smokes.mjs (server) and scripts/_harness.mjs (browser).
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { chromePath } from "../_chrome.mjs";

const isWin = platform() === "win32";
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LOOP_DIR = join(ROOT, "loop");
export const CYCLES_DIR = join(LOOP_DIR, "cycles");
export const STATE_FILE = join(LOOP_DIR, "state.json");
export const PROGRESS_FILE = join(LOOP_DIR, "PROGRESS.md");

export const cycleDir = (n) => join(CYCLES_DIR, String(n).padStart(3, "0"));

// ── JSON / fs helpers ────────────────────────────────────────────────────────
export function readJSON(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; }
}
export function writeJSON(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj, null, 2));
}
export function ensureDir(dir) { mkdirSync(dir, { recursive: true }); }

// ── Dev server (one per loop run; standalone scripts boot their own) ─────────
export function startServer(port) {
  const cmd = isWin ? "npx.cmd" : "npx";
  return spawn(cmd, ["vite", "--port", String(port), "--strictPort"], {
    // windowsHide: suppress the console-window flash that would steal foreground focus.
    cwd: ROOT, stdio: "ignore", shell: isWin, detached: !isWin, windowsHide: true,
  });
}
export function killTree(child) {
  if (!child || !child.pid) return;
  try {
    if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else process.kill(-child.pid, "SIGKILL");
  } catch { /* already gone */ }
}
export async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(url)).ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** Boot a server if `url` isn't already serving; returns { url, child|null }. */
export async function ensureServer(url, port) {
  if (await waitForServer(url, 1500)) return { url, child: null };
  const child = startServer(port);
  if (!(await waitForServer(url))) { killTree(child); throw new Error("dev server failed to start"); }
  return { url, child };
}

// ── Browser ──────────────────────────────────────────────────────────────────
export async function launchBrowser() {
  return chromium.launch({ executablePath: chromePath(), headless: true });
}

/** Open a fresh, isolated page (own context → own localStorage) at `url`, wait
 *  for the game's __SR test surface, and collect console/page errors. */
export async function openGame(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__SR && !!window.__G, null, { timeout: 20000 });
  const realErrors = () => errors.filter((e) => !/AudioContext|autoplay|was not allowed|glBlitFramebuffer/i.test(e));
  return { ctx, page, realErrors };
}

// ── Misc ───────────────────────────────────────────────────────────────────
export function latestCycleNumber() {
  if (!existsSync(CYCLES_DIR)) return 0;
  const ns = readdirSync(CYCLES_DIR).map((d) => Number(d)).filter((n) => Number.isFinite(n));
  return ns.length ? Math.max(...ns) : 0;
}
