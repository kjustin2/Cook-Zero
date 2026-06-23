// Soak smoke: let the REAL game run on its own rAF loop for ~8 seconds while
// random keys are mashed (kids mash buttons!), watching for any runtime error.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  await page.click("[data-play]");
  await page.waitForTimeout(600);
  await page.click(".cine-skip").catch(() => {});
  await page.waitForTimeout(300);

  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "KeyP"];
  for (let i = 0; i < 24; i++) {
    const k = keys[i % keys.length];
    await page.keyboard.down(k);
    await page.waitForTimeout(160);
    await page.keyboard.up(k);
    if (i % 3 === 0) await page.keyboard.press("Space");
  }

  const phase = await page.evaluate(() => window.__G.phase);
  check("survived an 8s soak with no errors", typeof phase === "string", `phase=${phase}`);
});

finish("SOAK", fail);
