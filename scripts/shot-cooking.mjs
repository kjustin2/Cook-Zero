// Visual check: the patty sears continuously on the grill (raw pink → browned →
// perfect glow → overdone), and the upgraded grill model. Reads the slot's real
// cook timing so it captures each stage precisely.
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

const timing = await page.evaluate(() => {
  const SR = window.__SR, G = window.__G;
  SR.quickStart();
  SR.setQuality("high");
  const grill = SR.find("grill"), binP = SR.find("bin_patty");
  const go = (c, r) => { const w = SR.cellWorld(c, r); G.chef.x = w.x; G.chef.z = w.z; };
  go(binP.col, binP.row); SR.interact();
  go(grill.col, grill.row); SR.interact(); // place patty
  G.chef.z += 1.7; // step back a little so the chef doesn't cover the grill
  const it = G.grid.cells.map((c) => c.item).find((i) => i && i.uid === grill.uid);
  const s = it.slots.find((sl) => sl.filling);
  return { cookT: s.cookT, perfT: s.perfT, burnT: s.burnT };
});
console.log("timing:", JSON.stringify(timing));

await page.waitForTimeout(3300); // let the "Night 1" card fade

const grillClip = { x: 360, y: 320, width: 440, height: 320 };
// Target cook times for each stage (clamped before burnt).
const targets = [
  { name: "1-raw", t: timing.cookT * 0.35 },
  { name: "2-searing", t: timing.cookT * 0.85 },
  { name: "3-perfect", t: (timing.cookT + timing.perfT) / 2 },
  { name: "4-overdone", t: (timing.perfT + timing.burnT) / 2 },
];
for (const s of targets) {
  const info = await page.evaluate((targetT) => {
    const G = window.__G, SR = window.__SR;
    const it = G.grid.cells.map((c) => c.item).find((i) => i && i.slots && i.slots.some((sl) => sl.filling));
    const slot = it.slots.find((sl) => sl.filling);
    let guard = 0;
    while (slot.t < targetT && guard++ < 2000) SR.tick(1 / 60);
    return { t: +slot.t.toFixed(2) };
  }, s.t);
  await page.waitForTimeout(1300); // let FX particles age out (they only age in rAF)
  await page.screenshot({ path: `shots/cooking-${s.name}.png`, clip: grillClip });
  console.log(`  ${s.name}: t=${info.t}`);
}
await page.screenshot({ path: "shots/cooking-wide.png" });

await browser.close();
console.log("saved shots/cooking-*.png");
