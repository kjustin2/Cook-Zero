// Full-run playthrough (RH3 style): drive the REAL game through every screen via
// real DOM clicks, resolving whatever phase is up each step, all the way to the
// win screen — then a death path. Reads window.__G only to decide the next move
// and to fast-forward each shift (like RH3 force-kills enemies). Asserts the run
// reaches the end screens with zero console errors.
import { mkdirSync } from "node:fs";
import { withGame, finish } from "./_harness.mjs";

mkdirSync("shots", { recursive: true });

const fail = await withGame(async ({ page, check }) => {
  const phase = () => page.evaluate(() => window.__G.phase);
  const day = () => page.evaluate(() => window.__G.day);
  const clickText = async (re) => {
    const b = page.locator("button", { hasText: re });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(220);
      return true;
    }
    return false;
  };
  const forceEndShift = async (pass) => {
    await page.evaluate((p) => {
      const G = window.__G;
      G.dayCoins = p ? G.quota + 5 : 0;
      G.dayTime = 0.05;
    }, pass);
    await page.waitForTimeout(240); // let the rAF loop run the clock out
  };
  const exerciseBuild = async () => {
    await clickText(/Floor Plan/);
    await page.waitForTimeout(250);
    const sw = page.locator(".swatch");
    if (await sw.count()) {
      await sw.first().click();
      await page.waitForTimeout(120);
      await page.mouse.move(640, 440);
      await page.waitForTimeout(120);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
    await clickText(/Done/);
    await page.waitForTimeout(150);
  };

  // Boot → start the run.
  await page.evaluate(() => localStorage.clear());
  check("starts at title", (await phase()) === "title");
  await clickText(/New Game/);
  check("New Game opens the intro cutscene", (await phase()) === "cutscene", `phase=${await phase()}`);

  // Navigate the whole run to victory.
  let won = false;
  let builtOnce = false;
  let lastSig = "";
  let stuck = 0;
  for (let step = 0; step < 120; step++) {
    const p = await phase();
    if (p === "win") {
      won = true;
      break;
    }
    if (p === "gameOver") break;
    const sig = `${p}:${await day()}`;
    if (sig === lastSig) stuck++;
    else {
      stuck = 0;
      lastSig = sig;
    }
    if (stuck > 8) break;

    if (p === "cutscene") {
      await clickText(/Skip/);
    } else if (p === "playing") {
      await forceEndShift(true);
    } else if (p === "dayEnd") {
      await clickText(/Manage Restaurant/);
    } else if (p === "manage") {
      if ((await day()) === 2 && !builtOnce) {
        builtOnce = true;
        await exerciseBuild();
      }
      await clickText(/Open Night/);
    } else if (p === "build") {
      await clickText(/Done/);
    }
  }

  check("exercised build mode mid-run", builtOnce);
  check("reached victory", won, `final phase=${await phase()}`);
  const winText = await page.evaluate(() => document.body.innerText.includes("KITCHEN LEGEND"));
  check("win screen shows KITCHEN LEGEND", winText);
  await page.screenshot({ path: "shots/8-win.png" });

  // Death path: play again (intro → setup → open), then fail night 1's quota.
  await clickText(/Play Again/);
  await page.evaluate(() => window.__SR.skipStory());
  await clickText(/Open Night/);
  check("Play Again restarts the run", (await phase()) === "playing", `phase=${await phase()}`);
  await forceEndShift(false);
  await page.evaluate(() => window.__SR.skipStory());
  await page.waitForTimeout(250); // let the game-over screen render
  check("missing quota → game over", (await phase()) === "gameOver", `phase=${await phase()}`);
  const firedText = await page.evaluate(() => document.body.innerText.includes("FIRED"));
  check("game-over screen shows YOU'RE FIRED", firedText);
});

finish("PLAYTHROUGH", fail);
