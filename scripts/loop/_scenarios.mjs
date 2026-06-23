// Exercises the debug scenario system: for each scenario name, cut to it via
// window.__SR.scenario(name) and screenshot. Doubles as verification of both the
// scenario "cut" system and the menu/customization polish.
//   node scripts/loop/_scenarios.mjs [outDir]
import { join } from "node:path";
import { ensureServer, killTree, launchBrowser, openGame, ensureDir } from "./_lib.mjs";

const PORT = 5196;
const URL = `http://localhost:${PORT}`;
const outDir = process.argv[2] || "loop/scenarios";

const { url, child } = await ensureServer(process.env.SR_URL || URL, PORT);
ensureDir(outDir);
const browser = await launchBrowser();
const { page, realErrors } = await openGame(browser, url);
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
let n = 0;
const shot = async (name) => { await page.screenshot({ path: join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) }); };

try {
  const names = await ev(() => window.__SR.scenarios());
  console.log("scenarios:", names.join(", "));

  for (const name of names) {
    const label = await ev((nm) => window.__SR.scenario(nm), name);
    // Setup variants: open the matching customizer category so the panel + the
    // preview camera agree (Diner section + room view; Chef section + close-up).
    if (name === "setup-room") await page.click('[data-czcat="diner"]').catch(() => {});
    if (name === "setup-chef") await page.click('[data-czcat="chef"]').catch(() => {});
    await sleep(name.startsWith("setup") ? 900 : 500);
    await shot(name);
    console.log(`  ${name} → "${label}"`);
  }

  const errs = realErrors();
  if (errs.length) { console.log("CONSOLE ERRORS:", errs.slice(0, 8)); }
  console.log(`scenario capture done — ${n} shots in ${outDir}/`);
} finally {
  await browser.close();
  killTree(child);
}
process.exit(0);
