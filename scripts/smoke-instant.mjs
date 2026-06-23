// Instant-food smoke: drink and ice cream are grabbed ready-to-serve (no cook
// step). Also checks the trash path and the "wrong order" non-serve.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    G.day = 3; // unlock drink + icecream
    const log = {};

    // Drink → instant ready
    SR.gotoStation("soda");
    log.drinkLabel = SR.interact();
    log.gotDrink = G.chef.carry && G.chef.carry.kind === "ready" && G.chef.carry.food === "drink";

    // Wrong order: a guest wants icecream, we hold a drink → no serve action.
    const wrongUid = SR.spawnGuest("icecream", 1);
    SR.gotoCustomer(wrongUid);
    log.wrongLabel = SR.actionLabel();

    // Trash the drink, then make the right thing.
    SR.gotoStation("trash");
    log.tossLabel = SR.interact();
    log.tossed = G.chef.carry === null;

    SR.gotoStation("icecream");
    SR.interact();
    log.gotIce = G.chef.carry && G.chef.carry.food === "icecream";
    G.spawnQueue = 0;
    SR.gotoCustomer(wrongUid);
    const before = G.servedToday;
    SR.interact();
    log.served = G.servedToday - before;
    return log;
  });

  check("drink is grabbed ready", r.gotDrink, `label="${r.drinkLabel}"`);
  check("wrong order offers no serve", r.wrongLabel !== "Serve!", `label="${r.wrongLabel}"`);
  check("tossed the wrong item", r.tossed, `label="${r.tossLabel}"`);
  check("scooped ice cream", r.gotIce);
  check("served the matching guest", r.served === 1);
});

finish("INSTANT", fail);
