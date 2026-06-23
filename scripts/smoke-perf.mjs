// Perf smoke: a bounded scene draw-call count, bounded geometry/texture counts,
// a fast deterministic sim step, and a working quality toggle (low drops shadows).
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    // Populate the diner with guests + cooking food, then measure.
    G.spawnGap = 0.4;
    G.spawnTimer = 0.1;
    SR.tickN(1 / 30, 30 * 3);
    SR.gotoStation("meat"); SR.interact();
    SR.gotoStation("grill"); SR.interact();
    SR.tickN(1 / 30, 30);

    const calls = SR.drawCalls();
    const info = SR.info();

    const t0 = performance.now();
    SR.tickN(1 / 60, 240);
    const stepMs = (performance.now() - t0) / 240;

    SR.setQuality("low");
    const low = SR.info();
    SR.setQuality("high");
    const high = SR.info();

    return { calls, geometries: info.geometries, textures: info.textures, stepMs, lowShadow: low.castShadow, highShadow: high.castShadow };
  });

  check("draw calls within budget", r.calls < 700, `calls=${r.calls}`);
  check("geometry count bounded", r.geometries < 3000, `geos=${r.geometries}`);
  check("texture count bounded", r.textures < 400, `texs=${r.textures}`);
  check("sim step is fast", r.stepMs < 1.0, `${r.stepMs.toFixed(3)}ms`);
  check("low quality drops shadows", r.lowShadow === false);
  check("high quality keeps shadows", r.highShadow === true);
});

finish("PERF", fail);
