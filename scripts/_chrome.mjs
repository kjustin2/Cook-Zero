// Locate a cached Playwright Chromium executable (auto-detects the newest
// chromium-<rev> build under the Playwright browsers cache).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function chromePath() {
  const base = join(process.env.LOCALAPPDATA || process.env.HOME || "", "ms-playwright");
  if (!existsSync(base)) throw new Error("No Playwright browser cache at " + base);
  const dirs = readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const d of dirs) {
    const exe = join(base, d, "chrome-win64", "chrome.exe");
    if (existsSync(exe)) return exe;
    const lin = join(base, d, "chrome-linux", "chrome");
    if (existsSync(lin)) return lin;
  }
  throw new Error("No chromium-* build found under " + base);
}
