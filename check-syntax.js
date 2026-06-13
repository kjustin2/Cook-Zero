// Syntax-checks every src/*.js module with `node --check`.
// package.json has "type": "module", so node parses them as ESM.

import { readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const dir = join(import.meta.dirname, 'src');
let errors = 0;

for (const f of readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
  const p = join(dir, f);
  try {
    execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' });
    console.log(`OK    src/${f}`);
  } catch (e) {
    errors++;
    console.error(`FAIL  src/${f}`);
    console.error(String(e.stderr || e.message));
  }
}

console.log(errors === 0 ? '\nAll files passed.' : `\n${errors} file(s) failed.`);
process.exit(errors === 0 ? 0 : 1);
