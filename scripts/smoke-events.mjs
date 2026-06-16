// Improvements smoke: special customers (VIP pay, critic reputation swing), the
// chef dash, daily modifiers feeding the derived stats, and the per-day star
// rating. All driven through window.__SR.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR;
    const G = window.__G;
    SR.quickStart();

    const KIND = {
      normal: { pay: 1, rep: 1 },
      vip: { pay: 1.9, rep: 1.1 },
      critic: { pay: 1, rep: 2.6 },
    };
    function serveOne(kind) {
      G.combo = 0;
      G.comboTimer = 0;
      const burger = G.recipes.find((x) => x.id === "burger");
      const kd = KIND[kind];
      G.customers.length = 0;
      G.customers.push({
        uid: 7000, recipe: burger, kind, payMult: kd.pay, repMult: kd.rep, spot: 2,
        x: 0, z: -4.3, state: "waiting", patience: 30, maxPatience: 30, anger: 0,
        servedT: 0, happy: false, look: { skin: 0, shirt: 0, hair: 0, hat: false }, bob: 0,
      });
      G.carry = { kind: "plate", parts: [{ id: "bun", quality: "good" }, { id: "patty", quality: "good" }] };
      G.chef.x = 0; G.chef.z = -3.0;
      const coins0 = G.coins;
      const rep0 = G.rep;
      SR.interact();
      return { coins: G.coins - coins0, rep: G.rep - rep0 };
    }

    // VIP pays more than a normal guest for the same dish.
    const payNormal = serveOne("normal").coins;
    const payVip = serveOne("vip").coins;

    // Critic swings reputation harder than a normal guest.
    G.rep = 50; const repNormal = serveOne("normal").rep;
    G.rep = 50; const repCritic = serveOne("critic").rep;

    // Daily modifier reshapes derived stats.
    G.modifier = null; SR.recompute();
    const pat0 = G.derived.patience;
    const spawn0 = G.derived.spawnMult;
    G.modifier = { id: "happy", name: "Happy Hour", desc: "", icon: "🍹", patienceMult: 1.25 };
    SR.recompute();
    const patHappy = G.derived.patience;
    G.modifier = { id: "rush", name: "Dinner Rush", desc: "", icon: "👥", spawnMult: 1.35 };
    SR.recompute();
    const spawnRush = G.derived.spawnMult;
    G.modifier = null; SR.recompute();

    // Dash: triggers, sets a cooldown, and visibly moves the chef.
    G.chef.x = -3; G.chef.z = 0.5; G.chef.face = -Math.PI / 2;
    G.chef.dashT = 0; G.chef.dashCD = 0; G.chef.vx = 0; G.chef.vz = 0;
    const dashOk = SR.dash();
    const dashState = G.chef.dashT > 0 && G.chef.dashCD > 0;
    const dx0 = G.chef.x, dz0 = G.chef.z;
    SR.tickN(1 / 60, 7);
    const dashMoved = Math.hypot(G.chef.x - dx0, G.chef.z - dz0);

    // Star rating: clean quota-clearing day → 3 stars.
    G.customers.length = 0;
    G.spawnTimer = 999;
    G.dayCoins = G.quota;
    G.dayStats = { served: 10, perfect: 6, expired: 0 };
    G.rep = 80;
    G.dayTime = 0;
    SR.tick(0.1); // triggers end-of-shift tally
    const stars = G.dayStars;

    return { payNormal, payVip, repNormal, repCritic, pat0, patHappy, spawn0, spawnRush, dashOk, dashState, dashMoved, stars };
  });

  check("VIP pays more than a normal guest", r.payVip > r.payNormal * 1.4, `$${r.payNormal} vs $${r.payVip}`);
  check("critic swings reputation harder", r.repCritic > r.repNormal * 1.5, `${r.repNormal.toFixed(2)} vs ${r.repCritic.toFixed(2)}`);
  check("Happy Hour modifier raises patience", r.patHappy > r.pat0, `${r.pat0.toFixed(2)}→${r.patHappy.toFixed(2)}`);
  check("Dinner Rush modifier grows the crowd", r.spawnRush > r.spawn0, `${r.spawn0.toFixed(2)}→${r.spawnRush.toFixed(2)}`);
  check("dash triggers + sets cooldown", r.dashOk && r.dashState);
  check("dash moves the chef", r.dashMoved > 0.4, `${r.dashMoved.toFixed(2)} units`);
  check("clean shift earns 3 stars", r.stars === 3, `got ${r.stars}`);
});

finish("EVENTS", fail);
