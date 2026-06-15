// Real-input smoke: exercises the actual keyboard/mouse → input → game pipeline
// (not the __SR logic shortcuts). Moves the chef with WASD, dashes with Shift,
// grabs from a bin with a real Space press, toggles pause with P, and places a
// decoration in build mode with a real mouse click on the canvas.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const get = (fn) => page.evaluate(fn);
  await get(() => localStorage.clear());
  await page.locator("button", { hasText: /New Game/ }).click();
  await page.waitForTimeout(300);
  await get(() => window.__SR.skipStory());
  await page.waitForTimeout(150);

  // 1) WASD movement (real keys, real rAF).
  await get(() => { const c = window.__G.chef; c.x = -2; c.z = 6; c.vx = 0; c.vz = 0; });
  const x0 = await get(() => window.__G.chef.x);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(550);
  await page.keyboard.up("KeyD");
  const x1 = await get(() => window.__G.chef.x);
  check("chef moves right with D held", x1 - x0 > 0.8, `Δx=${(x1 - x0).toFixed(2)}`);

  // 2) Dash (real Shift) sets a cooldown.
  await get(() => { const c = window.__G.chef; c.dashCD = 0; c.dashT = 0; });
  await page.keyboard.press("ShiftLeft");
  await page.waitForTimeout(120);
  const dashed = await get(() => window.__G.chef.dashCD > 0 || window.__G.chef.dashT > 0);
  check("Shift triggers a dash", dashed);

  // 3) Real Space press grabs from the bin nearest the chef.
  await get(() => {
    const SR = window.__SR, G = window.__G;
    const bin = SR.find("bin_patty");
    const w = SR.cellWorld(bin.col, bin.row);
    G.chef.x = w.x;
    G.chef.z = w.z;
    G.carry = null;
  });
  await page.waitForTimeout(120);
  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  const grabbed = await get(() => !!window.__G.carry && window.__G.carry.kind === "ing");
  check("Space grabs an ingredient from a bin", grabbed);

  // 4) Pause toggles with P.
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(120);
  const paused = await get(() => window.__G.paused);
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(120);
  const resumed = await get(() => !window.__G.paused);
  check("P pauses and resumes", paused && resumed);

  // 5) Build placement via a real mouse click on the canvas.
  await get(() => {
    const G = window.__G;
    G.coins = 500;
    G.inventory.plant = (G.inventory.plant || 0) + 2;
    window.__SR.ctrl.toManage();
    window.__SR.ctrl.enterBuild();
  });
  await page.waitForTimeout(200);
  await page.locator(".swatch").first().click();
  await page.waitForTimeout(150);
  const beforeCount = await get(() => window.__G.grid.cells.filter((c) => c.item).length);
  await page.mouse.move(620, 300);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterCount = await get(() => window.__G.grid.cells.filter((c) => c.item).length);
  check("mouse click in build places an item", afterCount === beforeCount + 1, `${beforeCount}→${afterCount}`);
});

finish("INPUT", fail);
