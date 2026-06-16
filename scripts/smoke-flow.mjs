// Phase-machine smoke: title → playing → dayEnd → manage → build (place an
// item) → manage → next shift, plus the gameOver (quota miss) and win
// (final day cleared) branches.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR;
    const G = window.__G;
    const log = {};

    SR.quickStart();
    log.playing = G.phase === "playing" && G.day === 1;

    // Clear the shift by meeting quota, then run the clock out.
    G.dayCoins = G.quota;
    G.dayTime = 0;
    SR.tick(0.1);
    log.dayEnd = G.phase === "dayEnd";

    SR.ctrl.toManage();
    log.manage = G.phase === "manage" && G.shopOffer.length > 0 && G.upgradeOffer.length > 0;

    SR.ctrl.enterBuild();
    log.build = G.phase === "build" && G.build.active === true;

    // Place a starting decor item from inventory onto an empty cell.
    const brushId = Object.keys(G.inventory).find((k) => G.inventory[k] > 0);
    G.build.brush = brushId;
    G.build.cursorCol = 8;
    G.build.cursorRow = 3;
    const invBefore = G.inventory[brushId] || 0;
    SR.buildClick();
    log.placed = !!SR.itemAt(8, 3) && (G.inventory[brushId] || 0) === invBefore - 1;

    SR.ctrl.exitBuild();
    log.backToManage = G.phase === "manage";

    SR.ctrl.startNextShift();
    log.nextDay = G.phase === "playing" && G.day === 2;

    // Quota miss → "closed" cutscene → game over.
    G.dayCoins = 0;
    G.dayTime = 0;
    SR.tick(0.1);
    SR.skipStory();
    log.gameOver = G.phase === "gameOver";

    // Win branch: clear the final day → ending cutscene → win.
    SR.quickStart();
    G.day = 6;
    G.dayCoins = 99999;
    G.dayTime = 0;
    SR.tick(0.1);
    SR.skipStory();
    log.win = G.phase === "win";

    return log;
  });

  check("starts on day 1 playing", r.playing);
  check("meeting quota ends the day", r.dayEnd);
  check("manager rolls shop + upgrades", r.manage);
  check("can enter build mode", r.build);
  check("placing consumes inventory + fills the cell", r.placed);
  check("leaving build returns to manager", r.backToManage);
  check("starting next shift advances the day", r.nextDay);
  check("missing quota triggers game over", r.gameOver);
  check("clearing the final day wins", r.win);
});

finish("FLOW", fail);
