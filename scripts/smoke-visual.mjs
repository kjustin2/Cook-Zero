// Visual smoke: drives EVERY debug scenario and asserts the rendered frame is
// not degenerate — i.e. it actually drew something. This is the regression net
// for the catastrophic visual class the project has shipped before (a full black
// screen, a single flat colour, a frame washed entirely white) that logic-only
// and mock-canvas tests can't see. It reads window.__SR.probe(), which renders a
// real frame, fingerprints it (downsampled RGB + luma/variance stats), and runs
// the game-state invariant battery — so this one suite guards visuals AND state
// for all 14 cuts, plus fails on any console error (via the shared harness).
import { withGame, finish } from "./_harness.mjs";

// A per-scenario draw-call ceiling (real per-frame cost incl. shadow + post).
const CALL_BUDGET = 800;

const fail = await withGame(async ({ page, check }) => {
  const names = await page.evaluate(() => [...window.__SR.scenarios()]);
  check("scenario list non-empty", names.length >= 10, `${names.length} scenarios`);

  for (const name of names) {
    const d = await page.evaluate((nm) => {
      // Slow camera transitions (preview glide / cutscene settle) need more frames.
      const slow = /^(title|setup|manage|day-complete|win)/.test(nm);
      const p = window.__SR.probe(nm, slow ? 40 : 14);
      const s = p.signature;
      return {
        luma: s.luma, black: s.black, white: s.white, variance: s.variance, colorful: s.colorful,
        inv: p.invariants, calls: p.metrics.render.calls, tris: p.metrics.render.tris,
      };
    }, name);

    const blackish = d.luma < 0.04 || d.black > 0.85;
    const flat = d.variance < 0.00025 && d.colorful < 0.015;
    const washed = d.white > 0.96;

    check(`${name}: frame not black`, !blackish, `luma=${d.luma.toFixed(3)} black=${(d.black * 100) | 0}%`);
    check(`${name}: frame has structure (not flat)`, !flat, `var=${d.variance.toFixed(5)} chroma=${d.colorful.toFixed(3)}`);
    check(`${name}: frame not blown-out white`, !washed, `white=${(d.white * 100) | 0}%`);
    check(`${name}: drew real geometry`, d.tris > 1000, `tris=${d.tris}`);
    check(`${name}: invariants hold`, d.inv.ok, d.inv.violations.join(", "));
    check(`${name}: draw calls within budget`, d.calls < CALL_BUDGET, `calls=${d.calls}`);
  }
});

finish("VISUAL", fail);
