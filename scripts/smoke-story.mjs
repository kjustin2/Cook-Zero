// Story smoke: starting a run plays the intro cinematic (camera shots + emoji
// dialogue + a title card), and it is skippable to reach play.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    const log = {};
    SR.ctrl.play();
    log.phase = G.phase;
    const scene = G.cutscene && G.cutscene.scene;
    log.shots = scene ? scene.shots.length : 0;
    log.hasTitle = !!(scene && scene.shots.some((s) => s.title));
    log.hasDialogue = !!(scene && scene.shots.some((s) => s.line));
    log.hasCast = !!(scene && scene.cast && scene.cast.length);
    SR.skipStory();
    log.afterSkip = G.phase;
    return log;
  });

  check("Play opens a cutscene", r.phase === "cutscene");
  check("the intro has several shots", r.shots >= 3, `n=${r.shots}`);
  check("it has a title card", r.hasTitle);
  check("it has emoji dialogue", r.hasDialogue);
  check("it places a cast in the diner", r.hasCast);
  check("it is skippable to play", r.afterSkip === "playing");
});

finish("STORY", fail);
