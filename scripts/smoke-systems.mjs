// Systems edge-case smoke: burning + scrape + trash, the hired line cook actually
// preventing burns, and build-mode place / occupied-block / sell-refund. These
// probe paths the happy-path tests don't.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR;
    const G = window.__G;
    SR.ctrl.play();
    SR.skipStory();
    const log = {};
    const go = (c, rr) => { const w = SR.cellWorld(c, rr); G.chef.x = w.x; G.chef.z = w.z; };
    const grillItem = () => G.grid.cells.map((c) => c.item).find((it) => it && it.defId === "grill");
    const slot0 = () => grillItem().slots[0];
    const count = () => G.grid.cells.filter((c) => c.item).length;

    // Burn a patty (no helper yet).
    const binP = SR.find("bin_patty");
    const grill = SR.find("grill");
    go(binP.col, binP.row); SR.interact();
    go(grill.col, grill.row); SR.interact();
    SR.tickN(1 / 30, 450); // ~15s — well past the burn threshold
    const s1 = slot0();
    log.burns = s1.filling !== null && s1.t >= s1.burnT;

    go(grill.col, grill.row); SR.interact(); // scrape burnt
    log.scraped = !!(G.carry && G.carry.kind === "burnt");

    const trash = SR.find("trash");
    go(trash.col, trash.row);
    const trashedBefore = G.stats.trashed;
    SR.interact();
    log.trashed = G.carry === null && G.stats.trashed === trashedBefore + 1;

    // Hire the line cook → it should keep the next patty from charring.
    G.coins = 200;
    log.hired = SR.hire();
    go(binP.col, binP.row); SR.interact();
    go(grill.col, grill.row); SR.interact();
    SR.tickN(1 / 30, 450);
    const s2 = slot0();
    log.helperSaved = s2.filling !== null && s2.t < s2.burnT;

    // Build mode: place / occupied-block / sell.
    G.coins = 300;
    G.inventory.plant = (G.inventory.plant || 0) + 2;
    SR.ctrl.enterBuild();
    const c0 = count();
    G.build.brush = "plant"; G.build.cursorCol = 8; G.build.cursorRow = 0;
    SR.buildClick();
    log.placed = count() === c0 + 1 && !!SR.itemAt(8, 0);

    G.build.brush = "plant"; G.build.cursorCol = 8; G.build.cursorRow = 0; // now occupied
    SR.buildClick();
    log.occupiedBlocked = count() === c0 + 1;

    G.build.brush = null; G.build.movingItem = null; G.build.movingUid = null;
    G.build.cursorCol = 8; G.build.cursorRow = 0;
    const coinsBefore = G.coins;
    SR.sell();
    log.sold = G.coins > coinsBefore && !SR.itemAt(8, 0);

    return log;
  });

  check("a neglected patty burns", r.burns);
  check("burnt patty can be scraped off", r.scraped);
  check("trash clears hands + counts it", r.trashed);
  check("hired line cook prevents the burn", r.hired && r.helperSaved);
  check("build places on an empty cell", r.placed);
  check("build blocks an occupied cell", r.occupiedBlocked);
  check("selling refunds coins + frees the cell", r.sold);
});

finish("SYSTEMS", fail);
