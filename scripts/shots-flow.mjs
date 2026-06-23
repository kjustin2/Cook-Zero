// Flow capture: boots the real game and walks the WHOLE player journey, saving a
// numbered series of screenshots to shots/flow/ so the look + flow can be reviewed
// as a storyboard (title → intro → tutorial → setup → cook → serve → day-complete →
// manage tabs → win). Re-runnable: `node scripts/shots-flow.mjs`. Used as the eyes
// of an improve-look-improve loop.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { platform } from "node:os";
import { chromium } from "playwright-core";
import { chromePath } from "./_chrome.mjs";

const PORT = 5193;
const URL = `http://localhost:${PORT}`;
const isWin = platform() === "win32";
const DIR = "shots/flow";
rmSync(DIR, { recursive: true, force: true }); // fresh storyboard every run
mkdirSync(DIR, { recursive: true });

const srv = spawn(isWin ? "npx.cmd" : "npx", ["vite", "--port", String(PORT), "--strictPort"], { stdio: "ignore", shell: isWin });
const kill = () => { try { if (isWin) spawnSync("taskkill", ["/pid", String(srv.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(-srv.pid, "SIGKILL"); } catch { /* gone */ } };
process.on("exit", kill);

async function up() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(URL)).ok) return true; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}
if (!(await up())) { console.log("server failed"); kill(); process.exit(1); }

const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__SR);
const sleep = (ms) => page.waitForTimeout(ms);
let n = 0;
const shot = async (name) => {
  const file = `${DIR}/${String(++n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file });
  console.log("  " + file);
};
const ev = (fn, arg) => page.evaluate(fn, arg);

await sleep(900);
await shot("title");

// Intro cutscene (don't skip — capture it mid-play).
await ev(() => window.__SR.ctrl.play());
await sleep(1600);
await shot("intro-cutscene");

// Tutorial: skip into the guided shift, cook a burger, add a waiting guest.
const uid = await ev(() => {
  const SR = window.__SR, G = window.__G;
  let g = 0; while (G.phase === "cutscene" && g++ < 40) SR.skipStory();
  SR.gotoStation("meat"); SR.interact(); SR.gotoStation("grill"); SR.interact();
  const id = SR.spawnGuest("burger", 0);
  SR.tickN(1 / 30, 100); // cook toward the perfect window
  G.chef.x = -5.5; G.chef.z = -5.2; G.chef.facing = 0;
  return id;
});
await sleep(700);
await shot("tutorial-cooking");

// Serve a centre guest a PERFECT plate → the celebration floater (check the
// "PERFECT! ⭐" text isn't clipped and there's NO glow bulb on the serve).
await ev(() => {
  const SR = window.__SR, G = window.__G;
  G.customers.length = 0; for (const t of G.tables) t.occupied = 0;
  const id = SR.spawnGuest("burger", 2); // right-side table → float clears centre banners
  G.chef.carry = { kind: "ready", food: "burger", quality: "perfect" };
  SR.gotoCustomer(id); SR.interact(); // serve → PERFECT! floater
}, uid);
await sleep(150);
await shot("serving-perfect");

// Finish the tutorial → the "Tutorial Complete!" cutscene.
await ev(() => { const SR = window.__SR, G = window.__G; while (window.__G.phase === "playing") SR.finishDay(); void G; });
await sleep(1400);
await shot("tutorial-done");

// Setup studio — the zoomed character/pet preview at default colours.
await ev(() => { const SR = window.__SR, G = window.__G; let g = 0; while (G.phase === "cutscene" && g++ < 40) SR.skipStory(); });
await sleep(2400); // let the camera settle on the character preview
await shot("setup-preview-default");

// Recolour everything WHITE to confirm picked colours actually appear.
await ev(() => {
  const SR = window.__SR;
  const c = JSON.parse(JSON.stringify(SR.ctrl.config()));
  for (const k of ["apron", "accent", "skin", "hat", "hair"]) c.chef[k] = 0xffffff;
  for (const k of ["body", "belly", "accent"]) c.pet[k] = 0xffffff;
  SR.ctrl.setConfig(c);
});
await sleep(1400);
await shot("setup-preview-white");

// A bright, varied custom diner + the drag arrange map.
await ev(() => {
  const SR = window.__SR;
  const c = JSON.parse(JSON.stringify(SR.ctrl.config()));
  c.name = "Rainbow Cafe"; c.pet.kind = "cat";
  c.chef.apron = 0x7aa8ff; c.chef.hat = 0xff5d6c; c.chef.hair = 0x2a2a2e; c.chef.skin = 0xffd9b3; c.chef.accent = 0xffd23a;
  c.pet.body = 0xffa14a; c.pet.belly = 0xffffff; c.pet.accent = 0xff9ec7;
  c.palette.wall = 0xb98cff; c.palette.floorA = 0xffffff; c.palette.floorB = 0x7be0a8; c.palette.stripe = 0xffd23a; c.palette.window = 0x5fc4ff;
  c.table.top = 0xffd23a; c.table.rim = 0xff5d6c; c.table.chair = 0xff5d6c; c.table.leg = 0xb98cff;
  c.station.body = 0x5fc4ff; c.station.trim = 0xffd23a;
  SR.ctrl.setConfig(c);
});
await sleep(1300);
await shot("setup-custom");

// Verify the "PERFECT! ⭐" celebration text renders fully (not clipped) — fire it
// over the clean preview (no HUD banners in the way).
await ev(() => window.__SR.ctx.fx.float("PERFECT! ⭐", 4.7, 2.2, { big: true, color: "#ffe066" }));
await sleep(140);
await shot("perfect-text-check");

// Open the diner → real day 1 start (day card).
await ev(() => { const SR = window.__SR, G = window.__G; SR.finishSetup(); void G; });
await sleep(700);
await shot("day1-start");

// Cooking in the real diner (no glow check) + a couple of guests.
await ev(() => {
  const SR = window.__SR, G = window.__G;
  SR.spawnGuest("burger", 0); SR.spawnGuest("fries", 1);
  SR.gotoStation("meat"); SR.interact(); SR.gotoStation("grill"); SR.interact();
  SR.gotoStation("potato"); SR.interact(); SR.gotoStation("fryer"); SR.interact();
  SR.tickN(1 / 30, 90);
  G.chef.x = -3; G.chef.z = -5;
});
await sleep(900);
await shot("day1-cooking");

// Day complete (stars).
await ev(() => { const SR = window.__SR, G = window.__G; G.servedToday = G.goal; SR.finishDay(); });
await sleep(900);
await shot("day-complete");

// Manage — Upgrade / Decorate / Arrange tabs.
await ev(() => window.__SR.nextDay());
await sleep(700);
await shot("manage-upgrade");
await page.click('[data-tab="decorate"]').catch(() => {});
await sleep(500);
await shot("manage-decorate");
await page.click('[data-tab="arrange"]').catch(() => {});
await sleep(500);
await shot("manage-arrange");

// Win screen.
await ev(() => {
  const SR = window.__SR, G = window.__G;
  let g = 0;
  while (G.phase !== "win" && g++ < 80) {
    if (G.phase === "playing") { G.servedToday = G.goal; SR.finishDay(); }
    else if (G.phase === "dayComplete") SR.nextDay();
    else if (G.phase === "manage") SR.finishManage();
    else if (G.phase === "cutscene") SR.skipStory();
    else break;
  }
});
await sleep(1400);
await shot("win");

console.log(`\nflow capture done — ${n} shots in ${DIR}/`);
if (errors.filter((e) => !/AudioContext|autoplay|was not allowed/i.test(e)).length) {
  console.log("CONSOLE ERRORS:");
  for (const e of errors.slice(0, 10)) console.log("  " + e);
}
await browser.close();
kill();
process.exit(0);
