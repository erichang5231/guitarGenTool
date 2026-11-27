#!/usr/bin/env node
/**
 * Import generated .atex files into a guitarTexTool SQLite database,
 * attributed to an existing App user.
 *
 *   node import-atex.mjs --dry-run
 *   node import-atex.mjs --username zzx605
 *
 * Options:
 *   --data-dir <dir>   guitarTexTool data dir holding alphatex.db
 *                      (default ../guitarTexTool/guitarTexTool/data-local)
 *   --username <name>  App user that owns the imported tabs (default zzx605)
 *   --dirs a,b         source dirs relative to this repo (default: all C-* dirs)
 *   --tag <name>       extra tag (default: guitarTexTool tag is always added)
 *   --dry-run          report only, never touch the database
 *   --json <path>      write a machine-readable report
 *
 * Idempotency: a tab is skipped when (owner_id, content_hash) already exists.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SHARED = '/home/zzx604/work/guitarTexTool/guitarTexTool/shared/dist/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const pick = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (flag) => argv.includes(flag);

const DATA_DIR = path.resolve(ROOT, pick('--data-dir', '../guitarTexTool/guitarTexTool/data-local'));
const DB_PATH = path.join(DATA_DIR, 'alphatex.db');
const USERNAME = pick('--username', 'zzx605');
const DRY_RUN = has('--dry-run');
const EXTRA_TAG = pick('--tag', null);
const JSON_OUT = pick('--json', null);
const SOURCE_TAG = 'guitarGenTool';

const { extractScoreMeta, slugify } = await import(SHARED);

function sha256(content) {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex');
}

async function sourceDirs() {
  const explicit = pick('--dirs', null);
  if (explicit) return explicit.split(',').map((s) => s.trim()).filter(Boolean);
  const entries = await readdir(ROOT, { withFileTypes: true });
  // This rollout imports the C-tonic set only (Ionian + the six modes).
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith('C-') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

async function collect(dirs) {
  const items = [];
  for (const dir of dirs) {
    const abs = path.join(ROOT, dir);
    let files;
    try {
      files = (await readdir(abs)).filter((f) => f.endsWith('.atex')).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      items.push({ dir, file: f, abs: path.join(abs, f) });
    }
  }
  return items;
}

const dirs = await sourceDirs();
const items = await collect(dirs);
console.log('source dirs: ' + dirs.join(', '));
console.log('candidate files: ' + items.length);

if (DRY_RUN) {
  const byDir = {};
  for (const it of items) byDir[it.dir] = (byDir[it.dir] ?? 0) + 1;
  for (const [d, n] of Object.entries(byDir)) console.log('  ' + d + ': ' + n);
  console.log('DRY RUN: database untouched');
  process.exit(0);
}

// --- database ---
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = FULL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

const hasTabs = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tabs'")
  .get();
if (!hasTabs) {
  console.error('ERROR: ' + DB_PATH + ' has no tabs table; wrong --data-dir?');
  process.exit(2);
}

const user = db
  .prepare('SELECT id, username FROM users WHERE username = ? AND deleted_at IS NULL')
  .get(USERNAME);
if (!user) {
  console.error('ERROR: user not found (will not create): ' + USERNAME);
  process.exit(3);
}
console.log('owner: ' + user.username + ' (' + user.id + ')');
console.log('database: ' + DB_PATH);

const existsStmt = db.prepare(
  'SELECT id FROM tabs WHERE owner_id = ? AND content_hash = ? AND deleted_at IS NULL',
);
const insertTab = db.prepare(
  `INSERT INTO tabs
     (id, owner_id, slug, title, artist, subtitle, content, content_hash,
      revision, content_mtime_ms, created_at, updated_at, deleted_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NULL)`,
);
const insertTag = db.prepare(
  'INSERT OR IGNORE INTO tab_tags (tab_id, tag, position) VALUES (?, ?, ?)',
);

let imported = 0;
let skipped = 0;
const failed = [];
const report = [];

for (const it of items) {
  const rel = it.dir + '/' + it.file;
  try {
    const content = await readFile(it.abs, 'utf8');
    const hash = sha256(content);
    const existing = existsStmt.get(user.id, hash);
    if (existing) {
      skipped++;
      report.push({ file: rel, result: 'skipped', tabId: existing.id, contentHash: hash });
      continue;
    }
    const meta = extractScoreMeta(content);
    const id = randomUUID();
    const now = new Date().toISOString();
    const tags = [SOURCE_TAG, it.dir];
    if (EXTRA_TAG) tags.push(EXTRA_TAG);

    db.exec('BEGIN IMMEDIATE');
    try {
      insertTab.run(
        id, user.id, slugify(meta.title || 'tab'), meta.title, meta.artist, meta.subtitle,
        content, hash, Date.now(), now, now,
      );
      [...new Set(tags)].forEach((tag, position) => insertTag.run(id, tag, position));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    imported++;
    report.push({ file: rel, result: 'imported', tabId: id, contentHash: hash, title: meta.title });
  } catch (err) {
    failed.push({ file: rel, error: String(err.message || err).slice(0, 200) });
    report.push({ file: rel, result: 'failed', error: String(err.message || err).slice(0, 200) });
  }
}

db.close();

console.log('');
console.log('imported=' + imported + ' skipped=' + skipped + ' failed=' + failed.length);
for (const f of failed.slice(0, 10)) console.log('  FAIL ' + f.file + ': ' + f.error);
if (JSON_OUT) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.resolve(ROOT, JSON_OUT), JSON.stringify({ imported, skipped, failed, report }, null, 2), 'utf8');
  console.log('report: ' + JSON_OUT);
}
if (failed.length) process.exit(1);
