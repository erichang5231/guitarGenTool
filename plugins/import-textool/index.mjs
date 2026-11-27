/**
 * Optional plugin: copy generated exercises into a guitarTexTool SQLite library.
 *
 * It knows one external thing — the path to `alphatex.db`. It does not import
 * anything from that project, and the core commands run without it.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SOURCE_TAG = 'guitarGenTool';

export function extractScoreMeta(content) {
  const field = (name) => {
    const m = content.match(new RegExp('\\\\' + name + '\\s+"([^"]*)"'));
    return m ? m[1] : null;
  };
  return { title: field('title'), subtitle: field('subtitle'), artist: null };
}

export function slugify(value) {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'tab';
}

const sha256 = (content) => 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex');

async function run({ flags, root, exercises, log }) {
  const dbPath = flags.db;
  const username = flags.user;
  if (!dbPath) { console.error('import 需要 --db <alphatex.db 路径>'); return 2; }
  if (!username) { console.error('import 需要 --user <用户名>'); return 2; }

  let db;
  try {
    db = new DatabaseSync(path.resolve(String(dbPath)));
  } catch (err) {
    console.error(`无法打开数据库 ${dbPath}：${err.message}`);
    return 3;
  }

  const hasTabs = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tabs'")
    .get();
  if (!hasTabs) {
    console.error(`${dbPath} 里没有 tabs 表；--db 是否指向 guitarTexTool 的 alphatex.db？`);
    db.close();
    return 3;
  }

  const user = db
    .prepare('SELECT id, username FROM users WHERE username = ? AND deleted_at IS NULL')
    .get(String(username));
  if (!user) {
    console.error(`用户不存在：${username}（不会自动创建）`);
    db.close();
    return 3;
  }

  if (flags['dry-run']) {
    log(`DRY RUN: ${exercises.length} 个候选文件，数据库未改动`);
    db.close();
    return 0;
  }

  const exists = db.prepare(
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

  for (const exercise of exercises) {
    const rel = `${exercise.dir}/${exercise.id}.atex`;
    try {
      const content = await readFile(path.join(root, rel), 'utf8');
      const hash = sha256(content);
      if (exists.get(user.id, hash)) { skipped++; continue; }

      const meta = extractScoreMeta(content);
      const id = randomUUID();
      const now = new Date().toISOString();

      db.exec('BEGIN IMMEDIATE');
      try {
        insertTab.run(
          id, user.id, slugify(meta.title), meta.title, meta.artist, meta.subtitle,
          content, hash, Date.now(), now, now,
        );
        [...new Set([SOURCE_TAG, exercise.dir])].forEach((tag, position) => {
          insertTag.run(id, tag, position);
        });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      imported++;
    } catch (err) {
      failed.push(`${rel}: ${err.message}`);
    }
  }

  db.close();
  log(`imported=${imported} skipped=${skipped} failed=${failed.length}`);
  for (const line of failed.slice(0, 10)) console.error('  FAIL ' + line);

  if (flags.json) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.resolve(String(flags.json)), JSON.stringify({ imported, skipped, failed }, null, 2) + '\n', 'utf8');
    log(`report: ${flags.json}`);
  }

  return failed.length ? 1 : 0;
}

export default {
  name: 'import-textool',
  command: 'import',
  describe: '把生成好的 .atex 写入 guitarTexTool 的 SQLite 曲谱库',
  options: [
    { flag: '--db', required: true, help: 'alphatex.db 路径' },
    { flag: '--user', required: true, help: '曲谱归属的用户名（必须已存在）' },
    { flag: '--root', required: false, help: '生成产物目录，默认 dist' },
  ],
  run,
};
