// Debug helper: reproduce the serve-perfect moment and save a CENTRE-CROPPED,
// native-resolution screenshot so the "PERFECT! ⭐" celebration is legible when
// reviewed (the normal full-frame shot downscales too far to read small text).
//   node scripts/loop/_peek.mjs [out.png]
import { ensureServer, killTree, launchBrowser, openGame } from "./_lib.mjs";

const PORT = 5194;
const URL = `http://localhost:${PORT}`;
const out = process.argv[2] || "loop/peek.png";

const { url, child } = await ensureServer(process.env.SR_URL || URL, PORT);
const browser = await launchBrowser();
try {
  const { page } = await openGame(browser, url);
  const ev = (fn) => page.evaluate(fn);
  await page.waitForTimeout(600);
  await ev(() => { const SR = window.__SR, G = window.__G; SR.ctrl.play(); let g = 0; while (G.phase === "cutscene" && g++ < 40) SR.skipStory(); });
  await page.waitForTimeout(400);
  await ev(() => {
    const SR = window.__SR, G = window.__G;
    G.dayCard = null;
    G.pet.x = 13; G.pet.z = 9; G.pet.tx = 13; G.pet.tz = 9;
    G.customers.length = 0; for (const t of G.tables) t.occupied = 0;
    for (const st of G.stations) for (const sl of st.slots) sl.food = null;
    const id = SR.spawnGuest("burger", 4);
    G.chef.carry = { kind: "ready", food: "burger", quality: "perfect" };
    SR.gotoCustomer(id); SR.interact(); // single, faithful real serve
    G.chef.x = -11; G.chef.z = 6; G.prompt = null; // step clear of the prompt pill
  });
  await page.waitForTimeout(140);
  // Centre crop (native res) so text is legible after downscale.
  await page.screenshot({ path: out, clip: { x: 360, y: 150, width: 560, height: 380 } });
  console.log("peek saved:", out);
} finally {
  await browser.close();
  killTree(child);
}
process.exit(0);
