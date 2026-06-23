// Boot smoke: the page comes up, the test surface exists, quickStart reaches the
// playing phase with a populated diner, and nothing logs a console error.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    const out = { phase0: G.phase };
    SR.quickStart();
    out.playing = G.phase === "playing";
    out.stations = G.stations.length;
    out.tables = G.tables.length;
    out.day = G.day;
    out.hasGrill = !!G.stations.find((s) => s.id === "grill");
    return out;
  });
  check("starts on the title screen", r.phase0 === "title", `phase=${r.phase0}`);
  check("quickStart reaches playing", r.playing);
  check("diner has stations", r.stations >= 8, `n=${r.stations}`);
  check("diner has tables", r.tables >= 4, `n=${r.tables}`);
  check("a grill exists", r.hasGrill);
  check("starts on day 1", r.day === 1);
});

finish("BOOT", fail);
