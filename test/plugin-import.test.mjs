import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPlan } from '../src/plan.mjs';
import { writePlan } from '../src/generate.mjs';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;

const SCHEMA = `
CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE, deleted_at TEXT);
CREATE TABLE tabs (id TEXT PRIMARY KEY, owner_id TEXT, slug TEXT, title TEXT, artist TEXT,
  subtitle TEXT, content TEXT, content_hash TEXT, revision INTEGER, content_mtime_ms INTEGER,
  created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE tab_tags (tab_id TEXT, tag TEXT, position INTEGER, PRIMARY KEY (tab_id, tag));
`;

async function makeDb(withUser = true) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ggt-db-'));
  const db = new DatabaseSync(path.join(dir, 'alphatex.db'));
  db.exec(SCHEMA);
  if (withUser) db.prepare('INSERT INTO users VALUES (?,?,NULL)').run('u1', 'tester');
  db.close();
  return dir;
}

test('imports every exercise once, then skips duplicates', async () => {
  const dir = await makeDb();
  const products = await mkdtemp(path.join(tmpdir(), 'ggt-prod-'));
  try {
    await writePlan(buildPlan().exercises, products);   // self-contained, survives the dist/ migration
    const args = [cli, 'import', '--db', path.join(dir, 'alphatex.db'), '--user', 'tester', '--root', products];
    const r1 = await run(process.execPath, args, { cwd: '/' });
    assert.match(r1.stdout, /imported=1253/);
    const r2 = await run(process.execPath, args, { cwd: '/' });
    assert.match(r2.stdout, /imported=0/);
    const db = new DatabaseSync(path.join(dir, 'alphatex.db'));
    assert.equal(db.prepare('SELECT COUNT(*) c FROM tabs').get().c, 1253);
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(products, { recursive: true, force: true });
  }
});

test('missing tabs table fails without creating anything', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ggt-empty-'));
  try {
    const dbPath = path.join(dir, 'alphatex.db');
    new DatabaseSync(dbPath).close();
    const r = await run(process.execPath, [cli, 'import', '--db', dbPath, '--user', 'tester'], { cwd: '/' })
      .catch((e) => e);
    assert.notEqual(r.code, 0);
    const db = new DatabaseSync(dbPath);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE name='tabs'").get().c, 0);
    db.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unknown user fails without creating the user', async () => {
  const dir = await makeDb(false);
  try {
    const r = await run(process.execPath, [cli, 'import', '--db', path.join(dir, 'alphatex.db'), '--user', 'ghost'], { cwd: '/' })
      .catch((e) => e);
    assert.notEqual(r.code, 0);
    const db = new DatabaseSync(path.join(dir, 'alphatex.db'));
    assert.equal(db.prepare('SELECT COUNT(*) c FROM users').get().c, 0);
    db.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('main flow works with plugins present', async () => {
  const r = await run(process.execPath, [cli, 'generate', '--dry-run'], { cwd: '/' });
  assert.match(r.stdout, /planned=1253/);
});
