// CAPTURE — step 1 of the loop. Cuts the real game to each goal-relevant
// scenario via the debug scenario system (window.__SR.scenario) and screenshots
// it, writing a manifest mapping step → file. Using deterministic "cuts" (instead
// of walking the whole journey and racing the live loop) makes every shot stable.
//
// Importable:  await capture({ url, outDir })  → manifest object
// Standalone:  node scripts/loop/capture.mjs [outDir]   (boots its own server)
import { join } from "node:path";
import { ensureServer, killTree, launchBrowser, openGame, ensureDir, writeJSON } from "./_lib.mjs";

const PORT = 5191;
const URL = `http://localhost:${PORT}`;

// Each goal-relevant step maps to a debug scenario. `cat` opens a customizer
// category; `clip` frames the shot on a small region (the serve celebration reads
// small in the full room view).
const STEPS = [
  { step: "title", scenario: "title" },
  { step: "day-cooking", scenario: "cooking" },
  { step: "serve-perfect", scenario: "serve-perfect", clip: { x: 360, y: 150, width: 560, height: 380 } },
  { step: "setup", scenario: "setup-chef" },
  { step: "setup-room", scenario: "setup-room", cat: "diner" },
  { step: "white-diner", scenario: "white-diner" },
  { step: "day-complete", scenario: "day-complete" },
  { step: "manage", scenario: "manage" },
  { step: "win", scenario: "win" },
];

export async function capture({ url, outDir }) {
  ensureDir(outDir);
  const browser = await launchBrowser();
  const { page, realErrors } = await openGame(browser, url);
  const sleep = (ms) => page.waitForTimeout(ms);
  const manifest = {};
  let n = 0;

  try {
    for (const s of STEPS) {
      await page.evaluate((name) => window.__SR.scenario(name), s.scenario);
      if (s.cat) await page.click(`[data-czcat="${s.cat}"]`).catch(() => {});
      await sleep(s.scenario.startsWith("setup") ? 850 : 350);
      const file = join(outDir, `${String(++n).padStart(2, "0")}-${s.step}.png`);
      await page.screenshot(s.clip ? { path: file, clip: s.clip } : { path: file });
      manifest[s.step] = file;
    }
    const errs = realErrors();
    writeJSON(join(outDir, "manifest.json"), { steps: manifest, consoleErrors: errs });
    return { steps: manifest, consoleErrors: errs };
  } finally {
    await browser.close();
  }
}

// Standalone entry.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("capture.mjs")) {
  const outDir = process.argv[2] || join(process.cwd(), "loop", "cycles", "manual", "shots");
  const { url, child } = await ensureServer(process.env.SR_URL || URL, PORT);
  try {
    const m = await capture({ url, outDir });
    console.log(`captured ${Object.keys(m.steps).length} steps → ${outDir}`);
    if (m.consoleErrors.length) console.log("CONSOLE ERRORS:", m.consoleErrors.slice(0, 8));
  } finally { killTree(child); }
  process.exit(0);
}
