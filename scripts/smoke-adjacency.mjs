// Adjacency + decoration-effect smoke: proves placement changes gameplay —
// a fan speeds an adjacent grill, decor raises vibe/patience, pricing trades
// crowd size for patience.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR;
    const G = window.__G;

    // Fresh grill in an isolated corner → base cook speed.
    SR.place("grill", 0, 0);
    const g0 = SR.itemAt(0, 0).effCookSpeed;

    // A fan on the adjacent cell should boost it.
    SR.place("fan", 0, 1);
    const g1 = SR.itemAt(0, 0).effCookSpeed;

    const vibeBefore = G.derived.vibe;
    const patBefore = G.derived.patience;
    SR.place("aquarium", 4, 0); // big vibe + patience, front row
    const vibeAfter = G.derived.vibe;
    const patAfter = G.derived.patience;

    // Front-of-house weighting: same decor is worth more vibe up front.
    SR.place("neon", 3, 0);
    const vibeFront = G.derived.vibe;
    SR.remove(3, 0);
    SR.place("neon", 3, 5); // back row
    const vibeBack = G.derived.vibe;

    G.priceLevel = 4; SR.recompute();
    const patLux = G.derived.patience;
    const demandLux = G.derived.spawnMult;
    G.priceLevel = 0; SR.recompute();
    const demandBudget = G.derived.spawnMult;

    return { g0, g1, vibeBefore, vibeAfter, patBefore, patAfter, vibeFront, vibeBack, patLux, demandLux, demandBudget };
  });

  check("isolated grill cooks at base speed", Math.abs(r.g0 - 1) < 0.001, `${r.g0}`);
  check("adjacent fan speeds the grill", r.g1 > r.g0 + 0.15, `${r.g0.toFixed(2)}→${r.g1.toFixed(2)}`);
  check("decor raises ambience vibe", r.vibeAfter > r.vibeBefore, `${r.vibeBefore.toFixed(1)}→${r.vibeAfter.toFixed(1)}`);
  check("decor raises patience", r.patAfter > r.patBefore, `${r.patBefore.toFixed(2)}→${r.patAfter.toFixed(2)}`);
  check("front-of-house decor worth more vibe", r.vibeFront > r.vibeBack, `${r.vibeFront.toFixed(1)} vs ${r.vibeBack.toFixed(1)}`);
  check("luxury pricing lowers patience", r.patLux < r.patAfter, `${r.patLux.toFixed(2)}`);
  check("budget pricing draws a bigger crowd", r.demandBudget > r.demandLux, `${r.demandBudget.toFixed(2)} vs ${r.demandLux.toFixed(2)}`);
});

finish("ADJACENCY", fail);
