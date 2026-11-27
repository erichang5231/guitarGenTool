import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;

test('validate reports stray .atex files that the plan does not know', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'ggt-extra-'));
  try {
    await run(process.execPath, [cli, 'generate', '--keys', 'C', '--modes', 'Ionian', '--out', out], { cwd: '/' });
    await writeFile(path.join(out, 'C-Ionian', 'C-Ionian-i9-P1-T1.atex'), 'x', 'utf8');
    const r = await run(process.execPath, [cli, 'validate', '--root', out, '--keys', 'C', '--modes', 'Ionian'], { cwd: '/' })
      .catch((e) => e);
    assert.match(String(r.stdout), /UNKNOWN|未知/);
    assert.notEqual(r.code, 0);
  } finally { await rm(out, { recursive: true, force: true }); }
});
