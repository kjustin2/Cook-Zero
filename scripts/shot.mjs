// Capture screenshots of the real game to eyeball visuals: title, the setup
// studio (with a colourful live preview), a cooking scene (confirms the glows are
// gone), and the between-day manage screen. Boots its own Vite server.
// Usage: node scripts/shot.mjs
import { spawn, spawnSync } from "node:child_process";
import { platform } from "node:os";
import { chromium } from "playwright-core";
import { chromePath } from "./_chrome.mjs";

const PORT = 5188;
const URL = `http://localhost:${PORT}`;
const isWin = platform() === "win32";

// windowsHide: no console-window flash, so the spawn never steals foreground focus.
const srv = spawn(isWin ? "npx.cmd" : "npx", ["vite", "--port", String(PORT), "--strictPort"], { stdio: "ignore", shell: isWin, windowsHide: true });
const kill = () => { if (isWin) spawnSync("taskkill", ["/pid", String(srv.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); else process.kill(-srv.pid, "SIGKILL"); };

async function up() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(URL)).ok) return true; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

if (!(await up())) { console.log("server failed"); kill(); process.exit(1); }

const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__SR);
await page.waitForTimeout(1200);
await page.screenshot({ path: "shots/01-title.png" });

// Setup studio + a bright custom config so the live preview is obvious.
await page.evaluate(() => {
  const SR = window.__SR, G = window.__G;
  SR.ctrl.play();
  let g = 0;
  while (G.phase === "cutscene" && g++ < 40) SR.skipStory();
  SR.finishDay(); // tutorial → "Tutorial Complete!" cutscene → setup
  let g2 = 0;
  while (G.phase === "cutscene" && g2++ < 40) SR.skipStory();
  const c = JSON.parse(JSON.stringify(SR.ctrl.config()));
  c.name = "Rainbow Cafe";
  c.menu = ["burger", "fries", "drink"];
  c.palette.wall = 0xb98cff; c.palette.floorA = 0x7be0a8; c.palette.floorB = 0x7aa8ff; c.palette.stripe = 0xffd23a;
  c.table.top = 0xffd23a; c.table.rim = 0xff7a8a; c.table.chair = 0xff7a8a; c.table.leg = 0xb98cff;
  c.chef.apron = 0x7aa8ff; c.chef.hat = 0xffd23a; c.chef.accent = 0xff7a8a;
  c.pet.kind = "cat"; c.pet.body = 0x6f7480; c.pet.belly = 0xfdfcf8;
  c.station.body = 0x7aa8ff; c.station.trim = 0xffd23a;
  c.plants.forEach((p, i) => { p.bloom = [0xff6f9c, 0xffd23a, 0x7be0a8, 0xb98cff][i]; });
  SR.ctrl.setConfig(c);
  G.chef.x = 3; G.chef.z = -2; G.pet.x = 5; G.pet.z = 0;
});
await page.waitForTimeout(1300);
await page.screenshot({ path: "shots/02-setup.png" });

// Open the diner → cook burger + fries; capture the cooking food (NO glows now).
await page.evaluate(() => {
  const SR = window.__SR, G = window.__G;
  SR.finishSetup();
  for (const p of G.plants) p.stage = 4;
  SR.spawnGuest("burger", 0); SR.spawnGuest("fries", 1); SR.spawnGuest("drink", 2);
  SR.gotoStation("meat"); SR.interact(); SR.gotoStation("grill"); SR.interact();
  SR.gotoStation("potato"); SR.interact(); SR.gotoStation("fryer"); SR.interact();
  SR.tickN(1 / 30, 78); // into the perfect window
  G.chef.x = -3.5; G.chef.z = -5;
});
await page.waitForTimeout(1300);
await page.screenshot({ path: "shots/03-cook.png" });

// Between-day manage screen (upgrade tab).
await page.evaluate(() => {
  const SR = window.__SR, G = window.__G;
  G.servedToday = G.goal;
  SR.finishDay();
  SR.nextDay();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: "shots/04-manage.png" });

await page.click('[data-tab="decorate"]');
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/05-decorate.png" });

await page.click('[data-tab="arrange"]');
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/06-arrange.png" });

console.log("saved shots/01-title.png, 02-setup.png, 03-cook.png, 04-manage.png, 05-decorate.png, 06-arrange.png");
await browser.close();
kill();
process.exit(0);
