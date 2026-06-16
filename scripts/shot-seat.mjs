// Visual check: customers walk in and SIT at the tables (perched on the back
// stool, facing the kitchen) rather than standing inside the table, and the chef
// can walk out to serve across the table.
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
  // Fill several tables, then let everyone path in and sit.
  G.customers.length = 0;
  for (let i = 0; i < 5; i++) { G.spawnTimer = 0; SR.tickN(1 / 30, 60); }
  SR.tickN(1 / 30, 240); // settle everyone into their seats
  // Park the chef out at the centre table, mid-stride, to show table service.
  G.chef.x = 0; G.chef.z = -3.1;
});

await page.waitForTimeout(3300); // let the "Night 1" card fade
await page.screenshot({ path: "shots/seat-wide.png" });
// A tighter crop on the centre table to judge the seated pose.
await page.screenshot({ path: "shots/seat-close.png", clip: { x: 430, y: 150, width: 520, height: 420 } });

await browser.close();
console.log("saved shots/seat-wide.png + shots/seat-close.png");
