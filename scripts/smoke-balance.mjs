// Balance + matching edge cases: roguelite upgrades (apply + max stacks + derived
// recompute), pricing payout end-to-end, recipe gating by day, plate matching
// (wrong / order-independent / duplicate parts), the 0–3 star tiers, the Lv.2
// line cook holding the perfect sear, and the cute heart emote on a serve.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR;
    const G = window.__G;
    SR.ctrl.play();
    SR.skipStory();
    const log = {};
    const cust = (recipe, extra = {}) => ({
      uid: 5000, recipe, kind: "normal", payMult: 1, repMult: 1, spot: 2, x: 0, z: -4.3,
      state: "waiting", patience: 30, maxPatience: 30, anger: 0, servedT: 0, happy: false,
      look: { skin: 0, shirt: 0, hair: 0, hat: false }, bob: 0, ...extra,
    });

    // ── Upgrades ──
    const grill = SR.find("grill");
    const base = SR.itemAt(grill.col, grill.row).effCookSpeed;
    const m0 = G.mods.cookSpeed;
    const ok1 = SR.upgrade("turbo");
    log.upgradeApplied = ok1 && Math.abs(G.mods.cookSpeed - m0 * 1.2) < 1e-6;
    log.derivedAfterUpgrade = SR.itemAt(grill.col, grill.row).effCookSpeed > base + 0.01;
    SR.upgrade("turbo"); SR.upgrade("turbo");
    log.maxStack = SR.upgrade("turbo") === false && G.upgrades.turbo === 3;

    // ── Pricing payout ──
    function serveAt(level) {
      G.priceLevel = level; SR.recompute();
      G.combo = 0; G.comboTimer = 0;
      G.customers = [cust(G.recipes.find((x) => x.id === "burger"))];
      G.carry = { kind: "plate", parts: [{ id: "bun", quality: "good" }, { id: "patty", quality: "good" }] };
      G.chef.x = 0; G.chef.z = -1;
      const c0 = G.coins; SR.interact(); return G.coins - c0;
    }
    const payBudget = serveAt(0);
    const payLux = serveAt(4);
    log.pricing = payLux > payBudget;
    log.heart = G.floats.some((f) => f.text === "❤");
    G.priceLevel = 2; SR.recompute();

    // ── Recipe gating ──
    G.day = 1; G.customers = [];
    const seen = new Set();
    for (let i = 0; i < 30; i++) { G.spawnTimer = 0; SR.tick(0.05); }
    for (const c of G.customers) seen.add(c.recipe.minDay);
    log.gatingDay1 = [...seen].every((d) => d <= 1);

    // ── Plate matching ──
    function label(recipeId, parts) {
      G.combo = 0;
      G.customers = [cust(G.recipes.find((x) => x.id === recipeId))];
      G.carry = { kind: "plate", parts: parts.map((id) => ({ id, quality: "good" })) };
      G.chef.x = 0; G.chef.z = -1;
      return SR.actionLabel() || "";
    }
    log.wrongRejected = label("burger", ["fries"]).includes("Wrong");
    log.rightServes = label("burger", ["bun", "patty"]).includes("Serve");
    log.orderIndep = label("burger", ["patty", "bun"]).includes("Serve");
    log.dupNeeded = label("double", ["bun", "patty", "cheese"]).includes("Wrong");
    log.dupOk = label("double", ["bun", "patty", "patty", "cheese"]).includes("Serve");

    // ── Star tiers ──
    G.quota = 100;
    const stars = (coins, served, perfect, expired, rep) => {
      G.dayCoins = coins; G.dayStats = { served, perfect, expired }; G.rep = rep;
      return SR.stars();
    };
    const s0 = stars(50, 1, 0, 9, 30);
    const s1 = stars(120, 10, 0, 9, 30);
    const s2 = stars(120, 10, 0, 0, 30);
    const s3 = stars(120, 10, 6, 0, 80);
    log.starTiers = s0 === 0 && s1 === 1 && s2 === 2 && s3 === 3;
    log.starVals = `${s0}${s1}${s2}${s3}`;

    // ── Helper Lv.2 holds the perfect sear ──
    G.coins = 300; SR.hire(); G.helper.level = 2;
    G.carry = null; // clear the plate left over from the matching checks
    const gi = G.grid.cells.map((c) => c.item).find((it) => it && it.defId === "grill");
    gi.slots.forEach((s) => { s.filling = null; s.t = 0; s.done = false; });
    const binP = SR.find("bin_patty");
    const go = (c, rr) => { const w = SR.cellWorld(c, rr); G.chef.x = w.x; G.chef.z = w.z; };
    go(binP.col, binP.row); SR.interact();
    go(grill.col, grill.row); SR.interact();
    SR.tickN(1 / 30, 400);
    const sl = gi.slots.find((s) => s.filling !== null);
    log.helperHoldsPerfect = !!sl && sl.t >= sl.cookT && sl.t < sl.perfT;
    log.helperSlot = sl ? `t=${sl.t.toFixed(2)} [${sl.cookT.toFixed(2)},${sl.perfT.toFixed(2)})` : "none";

    return log;
  });

  check("upgrade applies + recomputes derived", r.upgradeApplied && r.derivedAfterUpgrade);
  check("upgrade respects its max stacks", r.maxStack);
  check("luxury pricing pays more than budget", r.pricing);
  check("a serve emits a heart emote", r.heart);
  check("recipes gated by day (no future recipes on day 1)", r.gatingDay1);
  check("wrong plate is rejected", r.wrongRejected);
  check("correct plate serves", r.rightServes);
  check("plate matching is order-independent", r.orderIndep);
  check("duplicate parts required (double needs 2 patties)", r.dupNeeded && r.dupOk);
  check("star rating tiers 0/1/2/3", r.starTiers, r.starVals);
  check("line cook Lv.2 holds the perfect sear", r.helperHoldsPerfect, r.helperSlot);
});

finish("BALANCE", fail);
