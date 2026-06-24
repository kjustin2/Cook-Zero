// Settings smoke: the "real game" options menu. Opens from the title + the pause
// menu, and proves each control actually drives the engine + persists:
//  • Resolution scale changes the renderer's pixel ratio (and saves renderScale).
//  • Graphics (Fancy/Smooth) toggles real shadows.
//  • Music/Effects sliders persist their levels.
//  • Sound on/off persists mute and disables the sliders.
//  • Esc closes the panel without leaking through to the game (pause stays paused).
import { withGame, finish } from "./_harness.mjs";

const META = "sizzle_rush_kid_save";

const fail = await withGame(async ({ page, check }) => {
  // ── Open Settings from the title screen ──
  await page.click("[data-opensettings]");
  await page.waitForSelector(".settings-screen.on", { timeout: 5000 });
  check("settings opens from the title", true);

  // ── Resolution scale drives the renderer pixel ratio + persists ──
  await page.click('[data-set-res] [data-seg="2"]'); // Ultra (2×)
  const ultra = await page.evaluate(() => ({
    pr: window.__SR.info().pixelRatio,
    saved: JSON.parse(localStorage.getItem("sizzle_rush_kid_save")).renderScale,
  }));
  check("Ultra resolution raises pixel ratio", Math.abs(ultra.pr - 2) < 0.05, `pr=${ultra.pr}`);
  check("resolution choice persists", Math.abs(ultra.saved - 2) < 0.05, `saved=${ultra.saved}`);

  await page.click('[data-set-res] [data-seg="0.67"]'); // Smooth
  const smooth = await page.evaluate(() => window.__SR.info().pixelRatio);
  check("Smooth resolution lowers pixel ratio", Math.abs(smooth - 0.67) < 0.05, `pr=${smooth}`);

  // ── Graphics quality toggles shadows ──
  await page.click('[data-set-qual] [data-seg="low"]');
  const low = await page.evaluate(() => window.__SR.info().castShadow);
  await page.click('[data-set-qual] [data-seg="high"]');
  const high = await page.evaluate(() => window.__SR.info().castShadow);
  check("Smooth graphics drops shadows", low === false);
  check("Fancy graphics keeps shadows", high === true);

  // ── Volume sliders persist their levels ──
  const vols = await page.evaluate(() => {
    const set = (key, pct) => {
      const el = document.querySelector(`[data-set-slider="${key}"]`);
      el.value = String(pct);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("music", 25);
    set("sfx", 60);
    const m = JSON.parse(localStorage.getItem("sizzle_rush_kid_save"));
    return { music: m.musicVol, sfx: m.sfxVol };
  });
  check("music volume persists", Math.abs(vols.music - 0.25) < 0.02, `music=${vols.music}`);
  check("effects volume persists", Math.abs(vols.sfx - 0.6) < 0.02, `sfx=${vols.sfx}`);

  // ── Sound on/off persists + disables the sliders ──
  await page.click("[data-set-mute]");
  const muted = await page.evaluate(() => ({
    saved: JSON.parse(localStorage.getItem("sizzle_rush_kid_save")).muted,
    disabled: document.querySelector('[data-set-slider="music"]').disabled,
  }));
  check("muting persists", muted.saved === true);
  check("muting dims the volume sliders", muted.disabled === true);
  await page.click("[data-set-mute]"); // restore sound

  // ── Fullscreen toggle exists + doesn't throw (state is environment-dependent) ──
  const fsType = await page.evaluate(() => typeof window.__SR.ctrl.isFullscreen());
  check("fullscreen control is wired", fsType === "boolean");

  // ── Done closes the panel ──
  await page.click("[data-set-close]");
  const closed = await page.evaluate(() => !document.querySelector(".settings-screen.on"));
  check("Done closes settings", closed);

  // ── Open from the pause menu, then Esc closes it WITHOUT unpausing ──
  const paused = await page.evaluate(async () => {
    const SR = window.__SR, G = window.__G;
    const frames = (n) => new Promise((res) => {
      let i = 0; const step = () => (++i >= n ? res() : requestAnimationFrame(step));
      requestAnimationFrame(step);
    });
    SR.quickStart();
    await frames(3); // let the loop settle the "playing" phase render first
    SR.ctrl.togglePause();
    await frames(3); // now showPause renders the pause overlay (no phase-change wipe)
    return G.paused;
  });
  check("game pauses for the menu", paused === true);
  await page.waitForSelector("[data-opensettings]", { timeout: 5000 });
  await page.click("[data-opensettings]");
  await page.waitForSelector(".settings-screen.on", { timeout: 5000 });
  await page.keyboard.press("Escape");
  const afterEsc = await page.evaluate(() => ({
    open: !!document.querySelector(".settings-screen.on"),
    paused: window.__G.paused,
  }));
  check("Esc closes settings", afterEsc.open === false);
  check("Esc doesn't leak through to unpause the game", afterEsc.paused === true);
});

finish("SETTINGS", fail);
