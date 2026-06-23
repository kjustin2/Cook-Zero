// Flow smoke: stars are scored from happy guests, finishing a day shows the
// celebration → pick-a-treat → next day, treats stack, and the run is always
// winnable (we can reach the win screen).
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    const log = {};

    G.servedToday = G.goal;
    log.stars3 = SR.stars();
    G.servedToday = 0;
    log.stars1 = SR.stars();

    G.servedToday = G.goal;
    SR.finishDay();
    log.afterFinish = G.phase;
    log.starsSet = G.stars;

    SR.nextDay();
    log.afterNext = G.phase;
    log.choices = G.treatChoices.length;

    const before = G.day;
    SR.chooseTreat(G.treatChoices[0]);
    log.treats1 = G.treats.length;
    SR.finishManage();
    if (G.phase === "cutscene") SR.skipStory();
    log.dayAdvanced = G.day === before + 1 && G.phase === "playing";

    let safety = 0;
    while (G.phase !== "win" && safety++ < 60) {
      if (G.phase === "playing") { G.servedToday = G.goal; SR.finishDay(); }
      else if (G.phase === "dayComplete") SR.nextDay();
      else if (G.phase === "manage") { if (G.treatChoices.length) SR.chooseTreat(G.treatChoices[0]); SR.finishManage(); }
      else if (G.phase === "cutscene") SR.skipStory();
      else break;
    }
    log.reachedWin = G.phase === "win";
    log.finalDay = G.day;
    return log;
  });

  check("3 stars for hitting the goal", r.stars3 === 3);
  check("at least 1 star always (never 0)", r.stars1 === 1);
  check("finishing a day shows the celebration", r.afterFinish === "dayComplete", `phase=${r.afterFinish}`);
  check("stars are recorded", r.starsSet === 3);
  check("Next opens the Manage screen with 3 upgrades", r.afterNext === "manage" && r.choices === 3);
  check("choosing an upgrade + starting advances the day", r.dayAdvanced);
  check("the upgrade is kept", r.treats1 === 1);
  check("the run is winnable", r.reachedWin, `finalDay=${r.finalDay}`);
});

finish("FLOW", fail);
