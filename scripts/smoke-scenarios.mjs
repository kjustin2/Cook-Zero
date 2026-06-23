// Debug scenario system: every named scenario cuts the game to the right phase
// with no errors, so automated tests/screenshots can jump straight to it.
import { withGame, finish, BASE } from "./_harness.mjs";

const EXPECT = {
  title: "title", play: "playing", cooking: "playing", carry: "playing", burning: "playing",
  wayfinder: "playing", "serve-perfect": "playing", "white-diner": "playing",
  setup: "setup", "setup-chef": "setup", "setup-room": "setup",
  manage: "manage", "day-complete": "dayComplete", win: "win",
};

const fail = await withGame(async ({ page, check }) => {
  const names = await page.evaluate(() => window.__SR.scenarios());
  check("scenario registry is exposed", Array.isArray(names) && names.length >= 8, `n=${names?.length}`);

  for (const name of names) {
    // Cut to the scenario from a fresh reload so each is an independent jump.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.__SR && !!window.__G);
    const res = await page.evaluate((nm) => {
      const label = window.__SR.scenario(nm);
      return { label, phase: window.__G.phase };
    }, name);
    const want = EXPECT[name];
    check(`scenario "${name}" → ${want}`, !want || res.phase === want, `phase=${res.phase}, label="${res.label}"`);
    check(`scenario "${name}" returns a label`, typeof res.label === "string" && res.label.length > 0, res.label);
  }

  // Focus toggles drive the studio camera framing.
  await page.evaluate(() => window.__SR.scenario("setup-room"));
  const focusRoom = await page.evaluate(() => window.__G.studioFocus);
  check("setup-room sets studioFocus=room", focusRoom === "room", focusRoom);
  await page.evaluate(() => window.__SR.scenario("setup-chef"));
  const focusChef = await page.evaluate(() => window.__G.studioFocus);
  check("setup-chef sets studioFocus=chef", focusChef === "chef", focusChef);
}, BASE);

finish("SCENARIOS", fail);
