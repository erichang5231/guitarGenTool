#!/usr/bin/env node
/**
 * Update the already-imported guitarGenTool tabs in guitarTexTool's SQLite DB
 * in place (no duplicates), replacing the old `instrument acousticguitar`
 * with `instrument acousticguitarsteel`.
 *
 *   node update-db-instrument.mjs            # dry run: report only
 *   node update-db-instrument.mjs --apply    # backup, then write
 *
 * Matching: tag = source dir (e.g. C-Ionian) + parsed `\title`.
 * Safety: every candidate line must match the on-disk file except the
 * instrument token; otherwise the run aborts without touching any row.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup, DatabaseSync } from 'node:sqlite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHARED = '/home/zzx604/work/guitarTexTool/guitarTexTool/shared/dist/index.js';
const DB_PATH = '/home/zzx604/work/guitarTexTool/guitarTexTool/data-local/alphatex.db';
const USERNAME = 'zzx605';
const OLD = '\\track "Guitar" { instrument acousticguitar }';
const NEW = '\\track "Guitar" { instrument acousticguitarsteel }';

const APPLY = process.argv.includes('--apply');
const { extractScoreMeta } = await import(SHARED);

function sha256(content) {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex');
}

async function sourceFiles() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('C-') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  const files = [];
  for (const dir of dirs) {
    const names = (await readdir(path.join(ROOT, dir))).filter((f) => f.endsWith('.atex')).sort();
    for (const file of names) {
      const abs = path.join(ROOT, dir, file);
      const content = await readFile(abs, 'utf8');
      const meta = extractScoreMeta(content);
      files.push({ dir, file, abs, content, title: meta.title, key: dir + '\u0000' + meta.title });
    }
  }
  return { dirs, files };
}

const { dirs, files } = await sourceFiles();
console.log('source dirs: ' + dirs.join(', '));
console.log('source files: ' + files.length);

const byKey = new Map();
for (const f of files) {
  if (byKey.has(f.key)) throw new Error('duplicate source title: ' + f.dir + ' / ' + f.title);
  byKey.set(f.key, f);
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA busy_timeout = 5000');

const user = db.prepare('SELECT id FROM users WHERE username = ? AND deleted_at IS NULL').get(USERNAME);
if (!user) throw new Error('user not found: ' + USERNAME);

const rows = db.prepare(`
  SELECT t.id, t.title, t.subtitle, t.content, t.content_hash, t.revision,
         (SELECT tt.tag FROM tab_tags tt
           WHERE tt.tab_id = t.id AND tt.tag LIKE 'C-%'
           ORDER BY tt.position LIMIT 1) AS dir_tag
    FROM tabs t
    JOIN tab_tags g ON g.tab_id = t.id AND g.tag = 'guitarGenTool'
   WHERE t.owner_id = ? AND t.deleted_at IS NULL
   ORDER BY t.title
`).all(user.id);

console.log('db tabs (guitarGenTool owner ' + USERNAME + '): ' + rows.length);

const plan = [];
const problems = [];
const seen = new Set();
for (const row of rows) {
  if (!row.dir_tag) {
    problems.push({ id: row.id, title: row.title, reason: 'missing source dir tag' });
    continue;
  }
  const key = row.dir_tag + '\u0000' + row.title;
  const src = byKey.get(key);
  if (!src) {
    problems.push({ id: row.id, title: row.title, reason: 'no matching file for ' + row.dir_tag + ' / ' + row.title });
    continue;
  }
  seen.add(key);
  const oldLines = row.content.split('\n');
  const newLines = src.content.split('\n');
  const expected = oldLines.map((l) => (l === OLD ? NEW : l));
  if (expected.length !== newLines.length || expected.some((l, i) => l !== newLines[i])) {
    const diff = [];
    for (let i = 0; i < Math.max(expected.length, newLines.length); i++) {
      if (expected[i] !== newLines[i]) diff.push(i + 1);
    }
    problems.push({
      id: row.id, title: row.title,
      reason: 'on-disk content differs by more than the instrument line (lines ' + diff.slice(0, 8).join(',') + ')',
    });
    continue;
  }
  const hash = sha256(src.content);
  plan.push({
    ...src, id: row.id, oldHash: row.content_hash, newHash: hash,
    revision: row.revision, changed: hash !== row.content_hash,
  });
}

const unmatchedFiles = files.filter((f) => !seen.has(f.key));
const changed = plan.filter((p) => p.changed);
console.log('matched: ' + plan.length + ', need update: ' + changed.length +
  ', unchanged: ' + (plan.length - changed.length) + ', unmatched files: ' + unmatchedFiles.length);
if (unmatchedFiles.length) {
  console.log('unmatched files: ' + unmatchedFiles.slice(0, 5).map((f) => f.dir + '/' + f.file).join(', '));
}
if (problems.length) {
  for (const p of problems.slice(0, 20)) console.log('PROBLEM ' + p.id + ' ' + p.title + ': ' + p.reason);
  console.log('aborting: ' + problems.length + ' problem(s); database untouched');
  process.exit(2);
}

if (!APPLY) {
  console.log('DRY RUN: no rows written. Re-run with --apply.');
  process.exit(0);
}

const backupDir = path.join(ROOT, '.backup');
await mkdir(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, 'alphatex-before-instrument-fix-' + stamp + '.db');
await backup(db, backupPath);
console.log('backup: ' + backupPath);

const update = db.prepare(`
  UPDATE tabs
     SET content = ?, content_hash = ?, content_mtime_ms = ?, updated_at = ?, revision = revision + 1
   WHERE id = ? AND content_hash = ?
`);

let updated = 0;
db.exec('BEGIN IMMEDIATE');
try {
  for (const p of changed) {
    const now = new Date().toISOString();
    const res = update.run(p.content, p.newHash, Date.now(), now, p.id, p.oldHash);
    if (res.changes !== 1) throw new Error('optimistic update failed for ' + p.id + ' (' + p.title + ')');
    updated++;
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

console.log('updated=' + updated + ' revision_bumped=' + updated);
db.close();