// Visual check for the richer cooking animation: a patty cooking on the grill
// (which periodically somersault-flips) with the chef stood at the grill playing
// the chop/cook arm-pump. Captures a short burst of frames to catch a flip arc.
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

// Start a shift, drop a patty on the grill, cook it into the searing window, and
// park the chef at the grill so its cook pulse keeps firing.
await page.evaluate(() => {
  const SR = window.__SR, G = window.__G;
  SR.quickStart();
  SR.setQuality("low"); // tighter bloom so the patty flip reads in a tight crop
  const grill = SR.find("grill");
  const binP = SR.find("bin_patty");
  const go = (c, r) => { const w = SR.cellWorld(c, r); G.chef.x = w.x; G.chef.z = w.z; };
  go(binP.col, binP.row); SR.interact();
  go(grill.col, grill.row); SR.interact(); // place patty
  SR.tickN(1 / 30, 120); // cook a few seconds
  go(grill.col, grill.row);
  G.chef.cookT = 0.42; // show the chop arm-pump
});

// Let the "Night 1" card fade out first.
await page.waitForTimeout(3300);

// Capture a burst so at least one frame lands mid-flip.
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => { window.__G.chef.cookT = 0.42; }); // keep the pump alive
  await page.waitForTimeout(170);
  await page.screenshot({
    path: `shots/cook-${i}.png`,
    clip: { x: 360, y: 210, width: 560, height: 380 },
  });
}

await browser.close();
console.log("saved shots/cook-0..5.png");
