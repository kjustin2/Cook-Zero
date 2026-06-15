// Test runner: boots a Vite dev server, runs every smoke script against it in
// sequence (sharing the one server), then tears the server down. Exit code is
// non-zero if any smoke fails. Usage: npm test
import { spawn, spawnSync } from "node:child_process";
import { platform } from "node:os";

const PORT = 5179;
const URL = `http://localhost:${PORT}`;
const SMOKES = [
  "smoke-boot.mjs",
  "smoke-story.mjs",
  "smoke-adjacency.mjs",
  "smoke-economy.mjs",
  "smoke-cook.mjs",
  "smoke-events.mjs",
  "smoke-systems.mjs",
  "smoke-balance.mjs",
  "smoke-perf.mjs",
  "smoke-flow.mjs",
  "smoke-input.mjs",
  "smoke-playthrough.mjs",
  "smoke-soak.mjs",
];

const isWin = platform() === "win32";

function startServer() {
  const cmd = isWin ? "npx.cmd" : "npx";
  const srv = spawn(cmd, ["vite", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
    shell: isWin,
  });
  return srv;
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
  if (isWin) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try { process.kill(pid, "SIGKILL"); } catch { /* gone */ }
    }
  }
}

function runSmoke(file) {
  const res = spawnSync(process.execPath, ["scripts/" + file], {
    stdio: "inherit",
    env: { ...process.env, SR_URL: URL },
  });
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
  const ok = runSmoke(file);
  if (!ok) failed++;
  console.log("");
}

killTree(server.pid);

console.log("════════════════════════════");
console.log(failed === 0 ? "✅ ALL SMOKE TESTS PASSED" : `❌ ${failed} SMOKE SUITE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
