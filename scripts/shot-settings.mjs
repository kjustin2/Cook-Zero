// One-off: screenshot the Settings overlay (title + pause contexts) for a visual
// check. Run against a live dev server: node scripts/shot-settings.mjs
import { chromium } from "playwright-core";
import { chromePath } from "./_chrome.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.SR_URL || "http://localhost:5179";
mkdirSync("shots/settings", { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__SR, null, { timeout: 20000 });

// Settings from the title.
await page.click("[data-opensettings]");
await page.waitForSelector(".settings-screen.on");
await page.waitForTimeout(500);
await page.screenshot({ path: "shots/settings/title-settings.png" });
console.log("saved shots/settings/title-settings.png");

await browser.close();
