// Shared smoke-test harness: launches headless Chromium, opens the game page,
// captures console/page errors, and provides a tiny check() assertion helper.
import { chromium } from "playwright-core";
import { chromePath } from "./_chrome.mjs";

export const BASE = process.env.SR_URL || "http://localhost:5179";

export async function withGame(run) {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

  let fail = 0;
  const check = (name, ok, extra = "") => {
    console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? "  — " + extra : ""}`);
    if (!ok) fail++;
  };

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    // Wait for the game + test surface to come up.
    await page.waitForFunction(() => !!window.__SR && !!window.__G, null, { timeout: 20000 });
    await run({ page, check });
  } finally {
    // Surface unexpected console errors (ignore benign AudioContext warnings).
    const real = errors.filter((e) => !/AudioContext|autoplay|was not allowed/i.test(e));
    if (real.length) {
      console.log(`CONSOLE ERRORS (${real.length}):`);
      for (const e of real.slice(0, 12)) console.log("  " + e);
      fail += real.length;
    }
    await browser.close();
  }
  return fail;
}

export function finish(name, fail) {
  console.log(fail === 0 ? `${name}: ALL PASS` : `${name}: ${fail} FAILURE(S)`);
  process.exit(fail === 0 ? 0 : 1);
}
