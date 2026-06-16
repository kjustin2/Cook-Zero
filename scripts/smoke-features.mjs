// New-features smoke: the first-run tutorial guides + completes, decor is now
// solid (chef can't walk through a fan), and Escape pauses/resumes.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  // ── First-run tutorial ──
  const tut = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    const log = { start: G.tutorial };
    const go = (c, r) => { const w = SR.cellWorld(c, r); G.chef.x = w.x; G.chef.z = w.z; };
    const binP = SR.find("bin_patty"), grill = SR.find("grill"), prep = SR.find("prep"), binB = SR.find("bin_bun");
    go(binP.col, binP.row); SR.interact(); SR.tick(0.05); log.afterGrab = G.tutorial;
    go(grill.col, grill.row); SR.interact(); SR.tick(0.05);
    SR.tickN(1 / 30, 220);
    go(grill.col, grill.row); SR.interact(); SR.tick(0.05);
    go(prep.col, prep.row); SR.interact(); SR.tick(0.05);
    go(binB.col, binB.row); SR.interact(); go(prep.col, prep.row); SR.interact(); SR.tick(0.05);
    go(prep.col, prep.row); SR.interact(); // pick up plate
    const burger = G.recipes.find((r) => r.id === "burger");
    G.customers = [{ uid: 1, recipe: burger, kind: "normal", payMult: 1, repMult: 1, spot: 2, x: 0, z: -4.3, state: "waiting", patience: 30, maxPatience: 30, anger: 0, servedT: 0, happy: false, look: { skin: 0, shirt: 0, hair: 0, hat: false }, bob: 0 }];
    G.chef.x = 0; G.chef.z = -3.0; SR.interact(); SR.tick(0.05);
    log.done = G.tutorial;
    log.served = G.stats.served;
    return log;
  });
  check("tutorial starts on a fresh run", tut.start === 0, `step=${tut.start}`);
  check("tutorial advances after grabbing a patty", tut.afterGrab === 1, `step=${tut.afterGrab}`);
  check("tutorial completes after the first serve", tut.done === -1 && tut.served >= 1, `done=${tut.done} served=${tut.served}`);

  // ── Decor collision ──
  const pushed = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.place("fan", 0, 0);
    const w = SR.cellWorld(0, 0);
    G.chef.x = w.x; G.chef.z = w.z; G.chef.vx = 0; G.chef.vz = 0;
    SR.tickN(1 / 60, 6);
    return Math.hypot(G.chef.x - w.x, G.chef.z - w.z);
  });
  check("chef is pushed out of a solid fan", pushed > 0.4, `pushed ${pushed.toFixed(2)}`);

  // ── Escape pause ──
  await page.keyboard.press("Escape");
  await page.waitForTimeout(140);
  const paused = await page.evaluate(() => window.__G.paused);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(140);
  const resumed = await page.evaluate(() => !window.__G.paused);
  check("Escape pauses and resumes", paused && resumed, `paused=${paused} resumed=${resumed}`);
});

finish("FEATURES", fail);
