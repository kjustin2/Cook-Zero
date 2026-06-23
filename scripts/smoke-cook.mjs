// Cook smoke: drive the whole one-button loop for a burger — grab the patty,
// cook it on the grill, take it at the perfect window, carry it to a guest, serve.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    // Clean stage: our own guest, no auto-arrivals interfering.
    const uid = SR.spawnGuest("burger", 0);
    G.spawnQueue = 0;
    const log = {};

    SR.gotoStation("meat");
    log.grabLabel = SR.interact();
    log.grabbed = G.chef.carry && G.chef.carry.kind === "raw" && G.chef.carry.food === "burger";

    SR.gotoStation("grill");
    log.cookLabel = SR.interact();
    log.placed = G.chef.carry === null;
    const grill = G.stations.find((s) => s.id === "grill");
    log.cooking = grill.slots.some((sl) => sl.food === "burger");

    SR.tickN(1 / 30, 120); // ~4s → inside the perfect window

    SR.gotoStation("grill");
    log.takeLabel = SR.interact();
    log.took = G.chef.carry && G.chef.carry.kind === "ready" && G.chef.carry.food === "burger";
    log.quality = G.chef.carry && G.chef.carry.quality;

    SR.gotoCustomer(uid);
    const before = G.coins;
    log.serveLabel = SR.interact();
    log.served = G.servedToday;
    log.coins = G.coins - before;
    log.combo = G.combo;
    return log;
  });

  check("grabbed a raw patty", r.grabbed, `label="${r.grabLabel}"`);
  check("placed it on the grill", r.placed && r.cooking, `label="${r.cookLabel}"`);
  check("took a cooked burger", r.took, `quality=${r.quality}, label="${r.takeLabel}"`);
  check("cooked to perfect", r.quality === "perfect");
  check("served the guest", r.served === 1, `label="${r.serveLabel}"`);
  check("earned score on serve", r.coins > 0, `+${r.coins}`);
  check("combo went up", r.combo === 1);
});

finish("COOK", fail);
