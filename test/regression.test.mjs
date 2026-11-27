import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPlan } from '../src/plan.mjs';
import { writePlan } from '../src/generate.mjs';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;

test('regenerates byte-identical output for the default plan', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'ggt-'));
  try {
    const { exercises } = buildPlan();
    await writePlan(exercises, out);
    for (const dir of new Set(exercises.map((e) => e.dir))) {
      const files = (await readdir(path.join(out, dir))).sort();
      assert.ok(files.length > 0, dir);
      for (const f of files) {
        const a = await readFile(new URL(`../dist/${dir}/${f}`, import.meta.url), 'utf8');
        const b = await readFile(path.join(out, dir, f), 'utf8');
        assert.equal(b, a, `${dir}/${f}`);
      }
    }
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('generating twice produces identical bytes (no timestamp in .atex)', async () => {
  const a = await mkdtemp(path.join(tmpdir(), 'ggt-a-'));
  const b = await mkdtemp(path.join(tmpdir(), 'ggt-b-'));
  try {
    const { exercises } = buildPlan();
    await writePlan(exercises, a); await writePlan(exercises, b);
    const one = path.join(a, 'C-Ionian', 'C-Ionian-i3-P1-T1.atex');
    const two = path.join(b, 'C-Ionian', 'C-Ionian-i3-P1-T1.atex');
    assert.equal(await readFile(two, 'utf8'), await readFile(one, 'utf8'));
  } finally { await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('manifest counts match the plan', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'ggt-m-'));
  try {
    await run(process.execPath, [cli, 'generate', '--out', out], { cwd: '/' });
    const m = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
    assert.equal(m.schemaVersion, 1);
    assert.equal(m.totals.exercises, 1253);
    assert.equal(m.exercises.length, 1253);
    assert.match(m.exercises[0].sha256, /^[0-9a-f]{64}$/);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('validate reports zero errors on a fresh generation', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'ggt-v-'));
  try {
    await run(process.execPath, [cli, 'generate', '--out', out], { cwd: '/' });
    const r = await run(process.execPath, [cli, 'validate', '--root', out], { cwd: '/' });
    assert.match(r.stdout, /errors=0/);
  } finally { await rm(out, { recursive: true, force: true }); }
});
