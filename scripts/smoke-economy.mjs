// Business-layer smoke: shop purchases, hiring the helper, and reputation
// dropping (with combo reset) when a customer walks out.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR;
    const G = window.__G;
    SR.quickStart();
    G.coins = 600;
    SR.ctrl.toManage();

    const offerLen = G.shopOffer.length;
    const firstId = G.shopOffer[0];
    const coinsBefore = G.coins;
    const invBefore = G.inventory[firstId] || 0;
    const bought = SR.buy(firstId);
    const coinsAfter = G.coins;
    const invAfter = G.inventory[firstId] || 0;

    G.coins = 600;
    const hired = SR.hire();

    // Walkout: a waiting customer at 0 patience should expire on the next tick.
    const burger = G.recipes.find((x) => x.id === "burger");
    G.customers.length = 0;
    G.combo = 4;
    G.customers.push({
      uid: 42, recipe: burger, spot: 2, x: 0, z: -4.3, state: "waiting",
      patience: 0.03, maxPatience: 30, anger: 1, servedT: 0, happy: false,
      look: { skin: 1, shirt: 1, hair: 1, hat: false }, bob: 0,
    });
    const repBefore = G.rep;
    G.phase = "playing";
    SR.tick(0.1);
    const repAfter = G.rep;
    const comboAfter = G.combo;

    return { offerLen, bought, coinsBefore, coinsAfter, invBefore, invAfter, hired, helperHired: G.helper.hired, repBefore, repAfter, comboAfter };
  });

  check("shop offers items", r.offerLen >= 4, `${r.offerLen}`);
  check("buying succeeds", r.bought === true);
  check("buying spends coins", r.coinsAfter < r.coinsBefore, `$${r.coinsBefore}→$${r.coinsAfter}`);
  check("buying adds to inventory", r.invAfter === r.invBefore + 1);
  check("helper can be hired", r.hired && r.helperHired);
  check("walkout drops reputation", r.repAfter < r.repBefore, `${r.repBefore.toFixed(1)}→${r.repAfter.toFixed(1)}`);
  check("walkout resets combo", r.comboAfter === 0);
});

finish("ECONOMY", fail);
