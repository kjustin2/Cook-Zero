// Soak smoke: let the real game run for ~12s of wall-clock time (real rAF loop)
// while poking input, so customers spawn → queue → expire and the render/sim
// loop churns. Catches runtime errors that only surface over time. Fails on any
// console error or if the sim never produced customers.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  await page.evaluate(() => localStorage.clear());
  await page.locator("button", { hasText: /Start Shift/ }).click();
  await page.waitForTimeout(300);

  const keys = ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "Space"];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(keys[i % keys.length]);
    await page.waitForTimeout(1000);
  }

  const s = await page.evaluate(() => ({
    phase: window.__G.phase,
    seen: window.__G.customers.length + window.__G.stats.served + window.__G.stats.expired,
    rep: window.__G.rep,
    floats: window.__G.floats.length,
  }));

  check("still playing after 12s soak", s.phase === "playing", `phase=${s.phase}`);
  check("customers cycled through the scene", s.seen > 0, `${s.seen} seen`);
  check("float text pool is bounded", s.floats <= 40, `${s.floats} floats`);
});

finish("SOAK", fail);
