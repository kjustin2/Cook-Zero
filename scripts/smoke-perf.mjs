// Performance smoke: guards against regressions on a busy scene — scene draw-call
// budget, bounded geometry/texture counts, a cheap sim step, the High/Low quality
// toggle actually changing the pipeline, no geometry leak across heavy customer
// churn (validates mesh disposal), and a headless-fps sanity floor.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  // A busy scene: full counter, both stations cooking, helper hired.
  await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.ctrl.play();
    SR.skipStory();
    G.coins = 300;
    SR.hire();
    const go = (c, r) => { const w = SR.cellWorld(c, r); G.chef.x = w.x; G.chef.z = w.z; };
    const grill = SR.find("grill"), fryer = SR.find("fryer"), bp = SR.find("bin_patty"), bo = SR.find("bin_potato");
    go(bp.col, bp.row); SR.interact(); go(grill.col, grill.row); SR.interact();
    go(bo.col, bo.row); SR.interact(); go(fryer.col, fryer.row); SR.interact();
    SR.tickN(1 / 30, 20);
    const rc = (id) => G.recipes.find((q) => q.id === id) || G.recipes[1];
    G.customers = [0, 1, 2, 3, 4].map((s) => ({
      uid: 9000 + s, recipe: rc("cheeseburger"), kind: "normal", payMult: 1, repMult: 1, spot: s,
      x: (s - 2) * 2.7, z: -4.3, state: "waiting", patience: 25, maxPatience: 30, anger: 0, servedT: 0,
      happy: false, look: { skin: s % 6, shirt: s % 8, hair: s % 7, hat: s % 2 === 0 }, bob: s,
    }));
  });
  await page.waitForTimeout(600);

  const dc = await page.evaluate(() => window.__SR.drawCalls());
  check("scene draw calls within budget", dc > 0 && dc < 650, `${dc} calls`);

  const mem = await page.evaluate(() => window.__SR.info());
  check("geometry count is bounded", mem.geometries < 600, `${mem.geometries} geometries`);
  check("texture count is bounded", mem.textures < 80, `${mem.textures} textures`);

  const sim = await page.evaluate(() => { const t0 = performance.now(); window.__SR.tickN(1 / 60, 600); return (performance.now() - t0) / 600; });
  check("sim step under 0.5ms", sim < 0.5, `${sim.toFixed(3)} ms/tick`);

  const q = await page.evaluate(() => {
    window.__SR.setQuality("low"); const lo = window.__SR.info();
    window.__SR.setQuality("high"); const hi = window.__SR.info();
    return { lo, hi };
  });
  check("Low quality disables shadows", q.lo.castShadow === false && q.lo.quality === "low");
  check("High quality enables shadows", q.hi.castShadow === true && q.hi.quality === "high");

  // Heavy customer churn must not leak geometry (validates disposal).
  const leak = await page.evaluate(async () => {
    const G = window.__G, SR = window.__SR;
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const burger = G.recipes.find((r) => r.id === "burger");
    const mk = (uid) => ({ uid, recipe: burger, kind: "normal", payMult: 1, repMult: 1, spot: uid % 5, x: 0, z: -4.3, state: "waiting", patience: 30, maxPatience: 30, anger: 0, servedT: 0, happy: false, look: { skin: uid % 6, shirt: uid % 8, hair: uid % 7, hat: false }, bob: 0 });
    G.customers = []; await raf(); await raf();
    const base = SR.info().geometries;
    let uid = 50000;
    for (let i = 0; i < 30; i++) {
      G.customers = [mk(uid++), mk(uid++), mk(uid++), mk(uid++), mk(uid++)];
      await raf();
      G.customers = [];
      await raf();
    }
    await raf(); await raf();
    return { base, after: SR.info().geometries };
  });
  check("150 customers' worth of churn doesn't leak geometry", leak.after - leak.base < 60, `base=${leak.base} → after=${leak.after}`);

  const fps = await page.evaluate(() => new Promise((res) => {
    let f = 0; const s = performance.now();
    (function t() { f++; const e = performance.now() - s; if (e < 1200) requestAnimationFrame(t); else res(f / (e / 1000)); })();
  }));
  check("headless fps above 30", fps > 30, `${fps.toFixed(0)} fps`);
});

finish("PERF", fail);
