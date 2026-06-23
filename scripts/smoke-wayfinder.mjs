// Wayfinder smoke: the guide always points at the right next step as the game
// state changes — grab → cook → take → serve. This is the core kid-onboarding.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    SR.spawnGuest("burger", 0);
    G.spawnQueue = 0;
    const guideAfter = (fn) => { fn(); SR.tick(0.001); return { ...G.guide }; };
    const log = {};

    let g = guideAfter(() => {});
    log.emptyActive = g.active;
    log.emptyIcon = g.icon;
    log.emptyLabel = g.label;

    g = guideAfter(() => { SR.gotoStation("meat"); SR.interact(); });
    log.rawLabel = g.label;

    g = guideAfter(() => { SR.gotoStation("grill"); SR.interact(); SR.tickN(1 / 30, 120); });
    log.readyLabel = g.label;

    g = guideAfter(() => { SR.gotoStation("grill"); SR.interact(); });
    log.serveLabel = g.label;
    log.serveIcon = g.icon;
    return log;
  });

  check("guide is active with a waiting guest", r.emptyActive);
  check("empty-handed → points at the ingredient", r.emptyLabel.includes("Grab") && r.emptyIcon === "🍔", `"${r.emptyLabel}" ${r.emptyIcon}`);
  check("holding raw → points at the cooker", r.rawLabel === "Cook it here!", `"${r.rawLabel}"`);
  check("food ready → says grab it", /ready/i.test(r.readyLabel), `"${r.readyLabel}"`);
  check("holding cooked → points at the guest", /bring it over/i.test(r.serveLabel) && r.serveIcon === "🍔", `"${r.serveLabel}"`);

  // Regression: holding finished food while the only matching guest is still
  // WALKING IN must never blank the guidance (the old blocker).
  const b = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    G.spawnQueue = 0;
    G.customers.length = 0;
    G.chef.carry = { kind: "ready", food: "burger", quality: "good" };
    const tb = G.tables[0];
    const uid = G.nextUid++;
    tb.occupied = uid;
    G.customers.push({ uid, order: "burger", table: 0, x: 0, z: 7, state: "entering", patience: 30, maxPatience: 30, served: false, servedT: 0, mood: 1, hop: 0, look: { body: 0, hair: 0, hat: false, hue: 0 } });
    SR.tick(0.001);
    return { active: G.guide.active, label: G.guide.label };
  });
  check("guidance never blanks while a matching guest walks in", b.active, `"${b.label}"`);

  // And an extra dish nobody is waiting for still gives a hint (no blackout).
  const c = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    G.spawnQueue = 0;
    G.customers.length = 0;
    G.chef.carry = { kind: "ready", food: "fries", quality: "good" };
    SR.tick(0.001);
    return { active: G.guide.active, label: G.guide.label };
  });
  check("an extra dish still shows a hint (no blackout)", c.active, `"${c.label}"`);
});

finish("WAYFINDER", fail);
