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

  // ── Per-scenario full-frame cost + a leak guard across scene rebuilds ──
  // metrics.render.calls is the TRUE per-frame cost (shadow + scene + post),
  // higher than the scene-only drawCalls() above — so it gets a wider ceiling.
  const probe = await page.evaluate(() => {
    const SR = window.__SR;
    const out = {};
    // white-diner recolours → SceneView rebuilds the room/tables/stations. Probe
    // before, during, and after to catch a geometry/texture leak on rebuild.
    for (const name of ["cooking", "white-diner", "cooking", "win"]) {
      const m = SR.probe(name, 14).metrics;
      out[name + "@" + (out[name] ? "2" : "1")] = {
        calls: m.render.calls, tris: m.render.tris,
        geos: m.render.geometries, texs: m.render.textures,
        frameMs: m.frame.frameMs, renderMs: m.frame.renderMs, samples: m.frame.samples,
      };
      out[name] = true;
    }
    return out;
  });

  const cooking = probe["cooking@1"];
  const cooking2 = probe["cooking@2"];
  const white = probe["white-diner@1"];
  check("cooking frame draw-calls within budget", cooking.calls < 800, `calls=${cooking.calls}`);
  check("cooking frame geometry bounded", cooking.geos < 3000, `geos=${cooking.geos}`);
  check("no geometry leak across rebuild", cooking2.geos <= cooking.geos + 40, `before=${cooking.geos} after=${cooking2.geos}`);
  check("no texture leak across rebuild", cooking2.texs <= cooking.texs + 8, `before=${cooking.texs} after=${cooking2.texs}`);
  check("recolour rebuild stays bounded", white.geos < 3000 && white.texs < 400, `geos=${white.geos} texs=${white.texs}`);
  check("frame-timing instrumentation live", cooking.samples > 0 && cooking.frameMs > 0 && cooking.renderMs >= 0, `samples=${cooking.samples} frameMs=${cooking.frameMs.toFixed(1)} renderMs=${cooking.renderMs.toFixed(1)}`);
});

finish("PERF", fail);
