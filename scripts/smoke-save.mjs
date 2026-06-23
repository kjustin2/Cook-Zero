// Save/resume smoke: quitting an in-progress run to the title leaves a save, and
// "Continue" restores the run (phase, score, day and the customized restaurant)
// from localStorage — proven by clobbering the in-memory state before continuing.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart(); // reach a real cooking day
    G.config.name = "Saved Diner";
    G.config.chef.apron = 0xabcdef;
    G.coins = 123;
    const savedDay = G.day;

    SR.ctrl.quitToTitle(); // snapshots the run to storage
    const hasSave = SR.ctrl.hasSave();
    const titlePhase = G.phase;

    // Clobber the live state to prove Continue reads from storage, not memory.
    G.coins = 0;
    G.config.name = "WIPED";
    G.config.chef.apron = 0;
    G.day = 99;

    SR.continueRun();
    return {
      hasSave, titlePhase, phase: G.phase, coins: G.coins,
      name: G.config.name, apron: G.config.chef.apron, day: G.day, savedDay,
    };
  });

  check("quitting an in-progress run leaves a save", r.hasSave);
  check("quit returns to the title", r.titlePhase === "title");
  check("continue resumes a playing shift", r.phase === "playing", `phase=${r.phase}`);
  check("continue restores the score", r.coins === 123, `coins=${r.coins}`);
  check("continue restores the restaurant name", r.name === "Saved Diner", `name=${r.name}`);
  check("continue restores customized colours", r.apron === 0xabcdef);
  check("continue restores the day", r.day === r.savedDay, `day=${r.day}`);
});

finish("SAVE", fail);
