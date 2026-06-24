// Test runner: boots one Vite dev server, runs every smoke against it, tears the
// server down. Non-zero exit if any smoke fails. Usage: npm test
import { spawn, spawnSync } from "node:child_process";
import { platform } from "node:os";

const PORT = 5179;
const URL = `http://localhost:${PORT}`;
const SMOKES = [
  "smoke-boot.mjs",
  "smoke-cook.mjs",
  "smoke-instant.mjs",
  "smoke-wayfinder.mjs",
  "smoke-customers.mjs",
  "smoke-balance.mjs",
  "smoke-pet-garden.mjs",
  "smoke-setup.mjs",
  "smoke-scenarios.mjs",
  "smoke-visual.mjs",
  "smoke-save.mjs",
  "smoke-flow.mjs",
  "smoke-story.mjs",
  "smoke-perf.mjs",
  "smoke-playthrough.mjs",
  "smoke-soak.mjs",
];

const isWin = platform() === "win32";

function startServer() {
  const cmd = isWin ? "npx.cmd" : "npx";
  // windowsHide: never let the spawned console window flash to the foreground and
  // steal the user's focus (it would yank the active window back to the terminal).
  return spawn(cmd, ["vite", "--port", String(PORT), "--strictPort"], { stdio: "ignore", shell: isWin, windowsHide: true });
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function killTree(pid) {
  if (!pid) return;
  if (isWin) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else {
    try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
  }
}

function runSmoke(file) {
  const res = spawnSync(process.execPath, ["scripts/" + file], { stdio: "inherit", windowsHide: true, env: { ...process.env, SR_URL: URL } });
  return res.status === 0;
}

console.log("→ starting dev server…");
const server = startServer();
const up = await waitForServer();
if (!up) {
  console.log("FAIL: dev server did not come up");
  killTree(server.pid);
  process.exit(1);
}
console.log(`→ server up at ${URL}\n`);

let failed = 0;
for (const file of SMOKES) {
  console.log(`──── ${file} ────`);
  if (!runSmoke(file)) failed++;
  console.log("");
}

killTree(server.pid);
console.log("════════════════════════════");
console.log(failed === 0 ? "✅ ALL SMOKE TESTS PASSED" : `❌ ${failed} SMOKE SUITE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
