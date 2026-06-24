// AUDIT CAPTURE — a thorough look-and-feel pass. Drives the real game to each
// customizer category (to verify the studio zooms to what you're editing, shows
// lots of options, and nothing is cut off) plus the gameplay clarity scenarios
// (cooking readability, no glow halos, clean serve). Writes full frames + tight
// detail crops so a reviewer can actually see what's happening.
//
//   node scripts/loop/audit.mjs [outDir]
import { join } from "node:path";
import { ensureServer, killTree, launchBrowser, openGame, ensureDir } from "./_lib.mjs";

const PORT = 5193;
const URL = `http://localhost:${PORT}`;

const CATS = ["menu", "chef", "pet", "diner", "tables", "gear", "flowers"];

export async function audit({ url, outDir }) {
  ensureDir(outDir);
  const browser = await launchBrowser();
  const { page, realErrors } = await openGame(browser, url);
  const sleep = (ms) => page.waitForTimeout(ms);
  let n = 0;
  const shot = async (name, clip) => {
    const file = join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`);
    await page.screenshot(clip ? { path: file, clip } : { path: file });
  };

  try {
    // ── Customizer: visit every category in the setup studio ──
    await page.evaluate(() => window.__SR.scenario("setup-room"));
    await sleep(900);
    for (const cat of CATS) {
      await page.click(`[data-czcat="${cat}"]`).catch(() => {});
      await sleep(900); // let the camera glide to the focus + section swap
      await shot(`cz-${cat}`);
      // crop the left editor panel to check options + cutoff at full detail
      await shot(`cz-${cat}-panel`, { x: 0, y: 0, width: 540, height: 800 });
    }

    // ── Gameplay clarity scenarios ──
    await page.evaluate(() => window.__SR.scenario("cooking"));
    await sleep(500);
    await shot("cooking-full");
    await shot("cooking-floor", { x: 200, y: 380, width: 880, height: 420 }); // the floor items
    await shot("cooking-stations", { x: 0, y: 40, width: 900, height: 300 }); // the cook line

    await page.evaluate(() => window.__SR.scenario("carry"));
    await sleep(400);
    await shot("carry");

    await page.evaluate(() => window.__SR.scenario("burning"));
    await sleep(400);
    await shot("burning", { x: 200, y: 60, width: 700, height: 480 });

    await page.evaluate(() => window.__SR.scenario("wayfinder"));
    await sleep(400);
    await shot("wayfinder");

    await page.evaluate(() => window.__SR.scenario("serve-perfect"));
    await sleep(450);
    await shot("serve-perfect-full");

    await page.evaluate(() => window.__SR.scenario("white-diner"));
    await sleep(450);
    await shot("white-diner-full");
    await shot("white-floor", { x: 200, y: 380, width: 880, height: 420 });

    // ── Day-complete, settled (stars animate in over ~0.7s) ──
    await page.evaluate(() => window.__SR.scenario("day-complete"));
    await sleep(1400);
    await shot("day-complete-settled");

    const errs = realErrors();
    return { errs, n };
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.endsWith("audit.mjs")) {
  const outDir = process.argv[2] || join(process.cwd(), "shots", "audit2");
  const { url, child } = await ensureServer(process.env.SR_URL || URL, PORT);
  try {
    const { errs, n } = await audit({ url, outDir });
    console.log(`captured ${n} shots → ${outDir}`);
    if (errs.length) console.log("CONSOLE ERRORS:", errs.slice(0, 8));
    else console.log("no console errors");
  } finally { killTree(child); }
  process.exit(0);
}
