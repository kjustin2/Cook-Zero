// Menu/customization capture: drives the game to every menu + customization
// screen and screenshots them (full-frame) so the menus + setup studio can be
// reviewed and polished. Boots its own server.  node scripts/loop/_menus.mjs [outDir]
import { join } from "node:path";
import { ensureServer, killTree, launchBrowser, openGame, ensureDir, writeJSON } from "./_lib.mjs";

const PORT = 5195;
const URL = `http://localhost:${PORT}`;
const outDir = process.argv[2] || "loop/menus";

const { url, child } = await ensureServer(process.env.SR_URL || URL, PORT);
ensureDir(outDir);
const browser = await launchBrowser();
const { page } = await openGame(browser, url);
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const manifest = {};
let n = 0;
const shot = async (name) => {
  const file = join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  manifest[name] = file;
};
const scrollPanel = (top) => ev((t) => { const p = document.querySelector(".overlay.wide"); if (p) p.scrollTop = t; }, top);

try {
  await sleep(700);
  await shot("title");

  // Into setup (tutorial → setup).
  await ev(() => { const SR = window.__SR, G = window.__G; SR.ctrl.play(); let g = 0; while (G.phase === "cutscene" && g++ < 40) SR.skipStory(); while (G.phase === "playing") SR.finishDay(); g = 0; while (G.phase === "cutscene" && g++ < 40) SR.skipStory(); });
  await sleep(800);
  await shot("setup-top");
  await scrollPanel(380); await sleep(250); await shot("setup-mid");
  await scrollPanel(760); await sleep(250); await shot("setup-diner");
  await scrollPanel(1200); await sleep(250); await shot("setup-tables");
  await scrollPanel(3000); await sleep(250); await shot("setup-bottom");
  await scrollPanel(0); await sleep(150);

  // Pause menu (during a real day).
  await ev(() => { window.__SR.finishSetup(); });
  await sleep(500);
  await ev(() => { window.__G.paused = true; });
  await sleep(300);
  await shot("pause");
  await ev(() => { window.__G.paused = false; });

  // Day complete.
  await ev(() => { const SR = window.__SR, G = window.__G; G.servedToday = G.goal; SR.finishDay(); });
  await sleep(700);
  await shot("day-complete");

  // Manage tabs.
  await ev(() => window.__SR.nextDay());
  await sleep(600);
  await shot("manage-upgrade");
  await page.click('[data-tab="decorate"]').catch(() => {});
  await sleep(400);
  await shot("manage-decorate");
  await page.click('[data-tab="arrange"]').catch(() => {});
  await sleep(400);
  await shot("manage-arrange");

  // Win.
  await ev(() => { const SR = window.__SR, G = window.__G; let g = 0; while (G.phase !== "win" && g++ < 80) { if (G.phase === "playing") { G.servedToday = G.goal; SR.finishDay(); } else if (G.phase === "dayComplete") SR.nextDay(); else if (G.phase === "manage") SR.finishManage(); else if (G.phase === "cutscene") SR.skipStory(); else break; } });
  await sleep(1200);
  await shot("win");

  writeJSON(join(outDir, "manifest.json"), { steps: manifest });
  console.log(`menus captured: ${Object.keys(manifest).length} → ${outDir}`);
} finally {
  await browser.close();
  killTree(child);
}
process.exit(0);
