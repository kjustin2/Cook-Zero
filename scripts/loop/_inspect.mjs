import { ensureServer, killTree, launchBrowser, openGame } from "./_lib.mjs";
const PORT = 5194, URL = `http://localhost:${PORT}`;
const scenario = process.argv[2] || "white-diner";
const { url, child } = await ensureServer(process.env.SR_URL || URL, PORT);
const browser = await launchBrowser();
const { page } = await openGame(browser, url);
await page.evaluate((s) => window.__SR.scenario(s), scenario);
await page.waitForTimeout(400);
const objs = await page.evaluate(() => {
  const out = [];
  const scene = window.__stage.scene;
  const trulyVisible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  scene.traverse((o) => {
    if (!o.geometry) return;            // only real meshes
    if (!trulyVisible(o)) return;       // honour ancestor visibility
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const wp = { x: e[12], y: e[13], z: e[14] };
    if (wp.y > 0.45) return;
    let colHex = null;
    const m = o.material;
    if (m && m.color) colHex = "#" + m.color.getHexString();
    out.push({ geo: o.geometry.type, col: colHex, x: +wp.x.toFixed(2), y: +wp.y.toFixed(2), z: +wp.z.toFixed(2) });
  });
  return out;
});
console.log(`near-floor visible objects (y<=0.45) for "${scenario}":`);
for (const o of objs) console.log(JSON.stringify(o));
await browser.close();
killTree(child);
process.exit(0);
