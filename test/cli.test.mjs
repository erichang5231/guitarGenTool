import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
const call = async (...args) => {
  try { const r = await run(process.execPath, [cli, ...args], { cwd: '/' }); return { code: 0, ...r }; }
  catch (e) { return { code: e.code, stdout: e.stdout, stderr: e.stderr }; }
};

test('help exits 0 and lists commands', async () => {
  const r = await call('--help');
  assert.equal(r.code, 0);
  for (const c of ['generate', 'validate', 'manifest', 'import']) assert.match(r.stdout, new RegExp(c));
});

test('unknown command exits 2', async () => {
  assert.equal((await call('frobnicate')).code, 2);
});

test('unknown type exits 2 and lists T1/T2', async () => {
  const r = await call('generate', '--types', 'T9', '--dry-run');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /T9/);
  assert.match(r.stderr, /T1/);
});

test('invalid key exits 2 and lists legal tonics', async () => {
  const r = await call('generate', '--keys', 'H', '--dry-run');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /C#|Db/);
});

test('dry-run default plan reports 1253 and works from any cwd', async () => {
  const r = await call('generate', '--dry-run');
  assert.equal(r.code, 0);
  assert.match(r.stdout, /1253/);
});

test('all targets rejected exits 1', async () => {
  const r = await call('generate', '--keys', 'G#', '--modes', 'Ionian', '--dry-run');
  assert.equal(r.code, 1);
  assert.match(r.stdout + r.stderr, /等音主音/);
});

test('plugins command lists installed plugins, not types', async () => {
  const r = await call('plugins');
  assert.equal(r.code, 0);
  assert.match(r.stdout, /import-textool/);
  assert.doesNotMatch(r.stdout, /^type T1$/m);
});
