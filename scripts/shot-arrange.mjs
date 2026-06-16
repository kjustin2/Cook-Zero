// Visual check: in build mode, hovering the dining floor shows a table cursor +
// ghost so the player can add/move/remove tables, and tables render dynamically
// from G.tables.
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
  SR.setQuality("low");
  G.chef.x = 0; G.chef.z = 7.5;
  SR.ctrl.enterBuild(); // phase → build
  // Lift the centre table so the move ghost follows the cursor.
  G.build.inDining = true; G.build.diningCol = 4;
  SR.buildClick();
});
await page.waitForTimeout(3300); // let the "Night 1" card fade

// Hover out over the dining floor so the dining cursor + table ghost appear.
await page.mouse.move(720, 235);
await page.waitForTimeout(400);
const state = await page.evaluate(() => ({ inDining: window.__G.build.inDining, col: window.__G.build.diningCol, tables: window.__G.tables.length }));
console.log("build state:", JSON.stringify(state));

await page.screenshot({ path: "shots/arrange-wide.png" });
await page.screenshot({ path: "shots/arrange-dining.png", clip: { x: 300, y: 120, width: 700, height: 320 } });

await browser.close();
console.log("saved shots/arrange-wide.png + shots/arrange-dining.png");
