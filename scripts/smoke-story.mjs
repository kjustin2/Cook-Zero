// Story/cutscene smoke: the intro cutscene opens on New Game, dialogue types out
// and advances with Space into night 1 (with a title card), night 3 has its own
// cutscene, and clearing the final night plays the ending before the win screen.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  await page.evaluate(() => localStorage.clear());
  await page.locator("button", { hasText: /New Game/ }).click();
  await page.waitForTimeout(300);

  const intro = await page.evaluate(() => ({
    phase: window.__G.phase,
    beats: window.__G.cutscene?.beats.length || 0,
    label: window.__G.cutscene?.label,
  }));
  check("New Game opens the intro cutscene", intro.phase === "cutscene" && intro.beats >= 3, `phase=${intro.phase} beats=${intro.beats}`);
  check("intro is labelled Night 1", intro.label === "Night 1", `label=${intro.label}`);

  await page.waitForTimeout(140);
  const typed = await page.evaluate(() => window.__G.cutscene?.typed || 0);
  check("dialogue types out over time", typed > 1, `typed=${typed.toFixed(0)}`);

  // Space advances through the beats into the setup hub.
  for (let i = 0; i < 16; i++) {
    if (await page.evaluate(() => window.__G.phase !== "cutscene")) break;
    await page.keyboard.press("Space");
    await page.waitForTimeout(90);
  }
  const after = await page.evaluate(() => ({ phase: window.__G.phase, day: window.__G.day }));
  check("intro leads to the setup hub", after.phase === "manage" && after.day === 1, `phase=${after.phase}`);

  // Open the night → play + a title card.
  await page.locator("button", { hasText: /Open Night/ }).click();
  await page.waitForTimeout(250);
  const open = await page.evaluate(() => ({ phase: window.__G.phase, card: window.__G.dayCard?.title }));
  check("opening the night starts play", open.phase === "playing", `phase=${open.phase}`);
  check("a Night title card appears", !!open.card, `card=${open.card}`);

  // Night 3 has its own cutscene.
  const d3 = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    G.day = 3;
    SR.ctrl.startNextShift(); // begin night 3 → its cutscene
    return { phase: G.phase, label: G.cutscene?.label, day: G.day };
  });
  check("night 3 plays a cutscene", d3.phase === "cutscene" && d3.day === 3 && d3.label === "Night 3", `phase=${d3.phase} day=${d3.day}`);
  await page.evaluate(() => window.__SR.skipStory());
  check("skipping the cutscene starts the shift", await page.evaluate(() => window.__G.phase === "playing"));

  // Clearing the final night plays the ending before the win screen.
  const ending = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    G.day = 6;
    G.dayCoins = G.quota + 10;
    G.dayTime = 0;
    SR.tick(0.1); // end-of-shift → ending cutscene
    return { phase: G.phase, label: G.cutscene?.label };
  });
  check("final night triggers the ending cutscene", ending.phase === "cutscene" && ending.label === "Finale", `phase=${ending.phase} label=${ending.label}`);
  await page.evaluate(() => window.__SR.skipStory());
  check("ending leads to the win screen", await page.evaluate(() => window.__G.phase === "win"));
});

finish("STORY", fail);
