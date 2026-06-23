// Customers smoke: guests arrive and seat themselves; a guest whose patience
// runs out just leaves (no score penalty — the kindest "failure"); and the
// combo cools off after a while with no serves.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  // Arrival pacing.
  const a = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    G.spawnGap = 0.5;
    G.spawnTimer = 0.1;
    SR.tickN(1 / 30, 30 * 4);
    return { seated: G.customers.filter((c) => c.state === "seated").length, total: G.customers.length };
  });
  check("guests arrive and sit down", a.seated >= 1 && a.total >= 2, `seated=${a.seated} total=${a.total}`);

  // Patience runout = gentle leave, no penalty.
  const b = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    const uid = SR.spawnGuest("burger", 0);
    G.spawnQueue = 0;
    G.combo = 2;
    const cust = G.customers.find((c) => c.uid === uid);
    cust.patience = 0.05;
    cust.maxPatience = 20;
    SR.tickN(1 / 30, 10);
    const after = G.customers.find((c) => c.uid === uid);
    return { state: after ? after.state : "gone", served: G.servedToday, combo: G.combo };
  });
  check("an impatient guest just leaves", b.state === "leaving" || b.state === "gone", `state=${b.state}`);
  check("leaving never penalises the score", b.served === 0);
  check("the streak resets when a guest leaves", b.combo === 0);

  // Combo cools down after a while.
  const c = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    const uid = SR.spawnGuest("burger", 0);
    G.spawnQueue = 0;
    const cust = G.customers.find((x) => x.uid === uid);
    cust.patience = 999;
    cust.maxPatience = 999;
    G.combo = 3;
    G.comboT = 9;
    SR.tickN(1 / 30, 30 * 10);
    return { combo: G.combo };
  });
  check("combo cools off with no serves", c.combo === 0);
});

finish("CUSTOMERS", fail);
