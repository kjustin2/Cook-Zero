// Balance smoke: the tuning should keep the game kid-kind but engaging — every
// day's goal is reachable (1..guests, never a fail), and guests overlap into a
// small queue to juggle instead of arriving one-at-a-time with idle waits.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  // Goal reachable & meaningful on every day.
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    const days = [{ day: G.day, goal: G.goal, guests: G.spawnQueue }];
    const seen = () => days.some((d) => d.day === G.day);
    let safety = 0;
    while (days.length < 5 && safety++ < 60) {
      if (G.phase === "playing") { G.servedToday = G.goal; SR.finishDay(); }
      else if (G.phase === "dayComplete") SR.nextDay();
      else if (G.phase === "manage") {
        const pick = G.treatChoices.find((t) => t !== "extracustomer") ?? G.treatChoices[0];
        if (pick) SR.chooseTreat(pick);
        SR.finishManage();
      } else if (G.phase === "cutscene") SR.skipStory();
      if (G.phase === "playing" && !seen()) days.push({ day: G.day, goal: G.goal, guests: G.spawnQueue });
    }
    return { days };
  });
  let reachable = r.days.length >= 5;
  for (const d of r.days) if (!(d.goal >= 1 && d.goal <= d.guests)) reachable = false;
  check("every day's goal is reachable (1..guests)", reachable, JSON.stringify(r.days));

  // Tight pacing creates an overlapping queue (the fun juggle).
  const o = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    let maxSeated = 0;
    for (let i = 0; i < 300; i++) {
      SR.tick(1 / 20);
      const s = G.customers.filter((c) => c.state === "seated" && !c.served).length;
      if (s > maxSeated) maxSeated = s;
    }
    return { maxSeated };
  });
  check("guests overlap into a small queue to juggle", o.maxSeated >= 2, `max seated=${o.maxSeated}`);
});

finish("BALANCE", fail);
