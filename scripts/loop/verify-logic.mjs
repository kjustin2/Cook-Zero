// VERIFY-LOGIC — the "logical" signal. For every goal that defines a `logic`
// check, open a fresh isolated browser context, drive window.__SR into the right
// state, run the check, and record { id, pass, detail }. Each goal runs in its
// own context so localStorage / run state never bleeds between checks.
//
// Importable:  await verifyLogic({ url, outFile }) → results array
// Standalone:  node scripts/loop/verify-logic.mjs   (boots its own server)
import { GOALS } from "../../loop/goals.mjs";
import { ensureServer, killTree, launchBrowser, openGame, writeJSON } from "./_lib.mjs";

const PORT = 5192;
const URL = `http://localhost:${PORT}`;

export async function verifyLogic({ url, outFile }) {
  const browser = await launchBrowser();
  const results = [];
  try {
    for (const goal of GOALS) {
      if (!goal.logic) continue;
      const { ctx, page, realErrors } = await openGame(browser, url);
      let res;
      try {
        res = await page.evaluate(goal.logic);
      } catch (e) {
        res = { pass: false, detail: "evaluate threw: " + (e && e.message) };
      }
      const errs = realErrors();
      results.push({
        id: goal.id,
        title: goal.title,
        pass: !!res.pass && errs.length === 0,
        detail: res.detail + (errs.length ? ` | console-errors: ${errs.slice(0, 3).join("; ")}` : ""),
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  if (outFile) writeJSON(outFile, results);
  return results;
}

// Standalone entry.
if (process.argv[1]?.endsWith("verify-logic.mjs")) {
  const { url, child } = await ensureServer(process.env.SR_URL || URL, PORT);
  try {
    const results = await verifyLogic({ url, outFile: process.argv[2] || null });
    let fail = 0;
    for (const r of results) {
      console.log(`${r.pass ? "OK  " : "FAIL"} ${r.id} — ${r.detail}`);
      if (!r.pass) fail++;
    }
    console.log(fail === 0 ? "logic: ALL PASS" : `logic: ${fail} FAILURE(S)`);
    killTree(child);
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    killTree(child);
    console.error(e);
    process.exit(1);
  }
}
