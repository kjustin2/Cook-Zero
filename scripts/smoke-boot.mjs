// Boot smoke: the game loads, reaches the title, starts a shift, renders, and
// customers arrive — with no unexpected console errors. Saves screenshots.
import { mkdirSync } from "node:fs";
import { withGame, finish } from "./_harness.mjs";

mkdirSync("shots", { recursive: true });

const fail = await withGame(async ({ page, check }) => {
  check("boots to title", await page.evaluate(() => window.__G.phase === "title"));
  await page.screenshot({ path: "shots/1-title.png" });

  await page.evaluate(() => { window.__SR.ctrl.play(); window.__SR.skipStory(); });
  await page.waitForTimeout(300);
  check("starts a shift", await page.evaluate(() => window.__G.phase === "playing"));

  // Let the real-time rAF loop run so customers spawn + the scene renders.
  await page.waitForTimeout(2600);
  const r = await page.evaluate(() => ({
    custs: window.__G.customers.length,
    vibe: window.__G.derived.vibe,
    day: window.__G.day,
  }));
  check("customers arrive", r.custs > 0, `${r.custs} present`);
  check("decor vibe computed", r.vibe > 0, `vibe ${r.vibe.toFixed(1)}`);
  check("on day 1", r.day === 1);
  await page.screenshot({ path: "shots/2-playing.png" });
});

finish("BOOT", fail);
