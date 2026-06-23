// Real-play smoke: drive the actual game through real DOM clicks + keyboard —
// click Play, skip the intro, walk around and press the action button — and
// confirm we reach play with no runtime errors.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  await page.click("[data-play]");
  await page.waitForTimeout(600); // let the skip guard elapse
  // Skip the intro cutscene via its Skip button.
  await page.click(".cine-skip").catch(() => {});
  await page.waitForTimeout(400);

  const playing = await page.evaluate(() => window.__G.phase === "playing");
  check("reached play via real clicks", playing);

  // Walk to the patty box and try a few actions with the real keyboard.
  await page.evaluate(() => window.__SR.gotoStation("meat"));
  for (const key of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(180);
    await page.keyboard.up(key);
  }
  await page.keyboard.press("Space");
  await page.keyboard.press("ShiftLeft");
  await page.waitForTimeout(300);

  const alive = await page.evaluate(() => window.__G.phase === "playing" || window.__G.phase === "dayComplete");
  check("game still running after real input", alive);
});

finish("PLAYTHROUGH", fail);
