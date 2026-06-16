// Visual check for table service: boot, start a shift, let several customers walk
// in and seat themselves at tables, move the chef out into the dining floor, and
// capture a beauty shot. Saves to shots/tables-*.png.
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

// Jump into a live shift with a full dining room.
await page.evaluate(() => {
  const SR = window.__SR, G = window.__G;
  SR.quickStart();
  G.spawnTimer = 0;
});
// Let customers walk in + seat (a few seconds of real frames).
await page.waitForTimeout(200);
await page.evaluate(() => {
  const G = window.__G;
  // Force a handful of guests to spawn quickly.
  for (let i = 0; i < 6; i++) { G.spawnTimer = 0; window.__SR.tick(0.4); }
});
// Run real rAF frames so they path to their seats and idle.
await page.waitForTimeout(2600);

// Park the chef out in the dining area near a table for the serve pose.
await page.evaluate(() => {
  const G = window.__G;
  G.chef.x = 0; G.chef.z = -3.0;
});
await page.waitForTimeout(400);

const seated = await page.evaluate(() =>
  window.__G.customers.map((c) => ({ state: c.state, spot: c.spot, x: +c.x.toFixed(1), z: +c.z.toFixed(1) })),
);
console.log("customers:", JSON.stringify(seated, null, 0));

await page.screenshot({ path: "shots/tables-wide.png" });
// Close-up of the dining strip (top of frame) to inspect table/stool meshes.
await page.screenshot({ path: "shots/tables-dining.png", clip: { x: 140, y: 70, width: 1000, height: 220 } });

await browser.close();
console.log("saved shots/tables-wide.png + shots/tables-kitchen.png");
