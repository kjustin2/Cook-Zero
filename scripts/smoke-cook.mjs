// Cook pipeline smoke: drive the full grab → grill → pull → plate → serve loop
// through the test API and assert a paying customer was served.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR;
    const G = window.__G;
    SR.quickStart();
    const log = {};
    const itemByUid = (uid) => G.grid.cells.map((c) => c.item).find((it) => it && it.uid === uid);
    const goTo = (col, row) => {
      const w = SR.cellWorld(col, row);
      G.chef.x = w.x;
      G.chef.z = w.z;
    };

    const binP = SR.find("bin_patty");
    goTo(binP.col, binP.row);
    SR.interact();
    log.grabbed = !!(G.carry && G.carry.kind === "ing" && G.carry.id === "patty_raw");

    const grill = SR.find("grill");
    goTo(grill.col, grill.row);
    SR.interact();
    log.placed = G.carry === null;
    log.cookPulse = G.chef.cookT > 0; // placing on the grill kicks the chop/cook arm-pump

    SR.tickN(1 / 30, 270); // ~9s — past cook, before burn (fan-boosted grill)

    goTo(grill.col, grill.row);
    SR.interact();
    log.took = !!(G.carry && G.carry.kind === "part" && G.carry.id === "patty");
    log.quality = G.carry && G.carry.quality;

    const prep = SR.find("prep");
    goTo(prep.col, prep.row);
    SR.interact();
    log.platedPatty = !!(itemByUid(prep.uid)?.plate?.length);

    const binB = SR.find("bin_bun");
    goTo(binB.col, binB.row);
    SR.interact();
    goTo(prep.col, prep.row);
    SR.interact(); // add bun

    goTo(prep.col, prep.row);
    SR.interact(); // pick up plate
    log.hasPlate = !!(G.carry && G.carry.kind === "plate" && G.carry.parts.length === 2);

    // A burger customer to serve.
    const burger = G.recipes.find((x) => x.id === "burger");
    G.customers.length = 0;
    G.customers.push({
      uid: 99001, recipe: burger, spot: 2, x: 0, z: -4.3, state: "waiting",
      patience: 30, maxPatience: 30, anger: 0, servedT: 0, happy: false,
      look: { skin: 0, shirt: 0, hair: 0, hat: false }, bob: 0,
    });
    G.chef.x = 0;
    G.chef.z = -3.0;
    const before = G.coins;
    log.serveLabel = SR.interact();
    log.coins = G.coins - before;
    log.served = G.stats.served;
    return log;
  });

  check("grabbed a raw patty", r.grabbed);
  check("placed it on the grill", r.placed);
  check("cooking triggers the chef's cook/chop animation", r.cookPulse);
  check("pulled a cooked patty", r.took, `quality=${r.quality}`);
  check("started a plate with the patty", r.platedPatty);
  check("assembled bun+patty plate", r.hasPlate);
  check("served the burger", r.served === 1, `label="${r.serveLabel}"`);
  check("earned coins on serve", r.coins > 0, `+$${r.coins}`);

  // ── Plate hold: set a carried plate down on a counter, leave, come back, add
  //    another part, then pick it back up. ──
  const hold = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    const log = {};
    const goTo = (col, row) => { const w = SR.cellWorld(col, row); G.chef.x = w.x; G.chef.z = w.z; };
    const prep = SR.find("prep");
    // The counter is empty after the main flow picked its plate up; carry a
    // one-patty plate over to it.
    G.carry = { kind: "plate", parts: [{ id: "patty", quality: "good" }] };
    goTo(prep.col, prep.row);
    log.setLabel = SR.interact(); // "Set down plate"
    const held = SR.itemAt(prep.col, prep.row);
    log.setDown = G.carry === null && !!held?.plate && held.plate.length === 1;

    // Walk off, grab a bun, return, and add it to the held plate.
    const binB = SR.find("bin_bun");
    goTo(binB.col, binB.row); SR.interact();
    goTo(prep.col, prep.row);
    log.addLabel = SR.interact(); // "Add to plate"
    const held2 = SR.itemAt(prep.col, prep.row);
    log.added = !!held2?.plate && held2.plate.length === 2;

    // Pick the finished plate back up.
    log.pickLabel = SR.interact(); // "Pick up plate (2)"
    log.pickedUp = !!(G.carry && G.carry.kind === "plate" && G.carry.parts.length === 2);
    return log;
  });
  check("set a carried plate down on a counter", hold.setDown, `label="${hold.setLabel}"`);
  check("added a part to the held plate", hold.added, `label="${hold.addLabel}"`);
  check("picked the held plate back up", hold.pickedUp, `label="${hold.pickLabel}"`);
});

finish("COOK", fail);
