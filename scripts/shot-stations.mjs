// Visual check for the station/bin graphics upgrade: bins brim with the actual
// food they hold, and the grill/fryer/soda/prep carry utensils + details.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { chromePath } from "./_chrome.mjs";

mkdirSync("shots", { recursive: true });
const URL = process.env.SR_URL || "http://localhost:5179";

const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__SR && !!window.__G, null, { timeout: 20000 });

await page.evaluate(() => {
  const SR = window.__SR, G = window.__G;
  SR.quickStart();
  // Line a row of every bin + each machine across the front kitchen rows so they
  // are all on camera, then look from closer in.
  for (const c of G.grid.cells) c.item = null;
  const put = (id, col, row) => SR.place(id, col, row);
  put("bin_bun", 1, 1); put("bin_patty", 2, 1); put("bin_potato", 3, 1);
  put("bin_cheese", 4, 1); put("bin_lettuce", 5, 1); put("bin_tomato", 6, 1);
  put("grill", 2, 3); put("fryer", 3, 3); put("prep", 4, 3); put("drink", 5, 3);
  G.chef.x = 0; G.chef.z = 7.5; // out of the way
});

await page.waitForTimeout(3300); // let the day card fade
await page.screenshot({ path: "shots/stations-wide.png" });
await page.screenshot({ path: "shots/stations-bins.png", clip: { x: 250, y: 250, width: 780, height: 300 } });

await browser.close();
console.log("saved shots/stations-wide.png + shots/stations-bins.png");
