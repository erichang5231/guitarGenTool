/**
 * Inventory of the generated exercises: machine-readable JSON plus a Markdown
 * table for humans. Only `generatedAt` changes between runs.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (content) => createHash('sha256').update(content, 'utf8').digest('hex');
const bars = (notes) => Math.ceil(notes.length / 8);
const fretRange = (notes) => {
  const frets = notes.map((n) => n.fret);
  return Math.min(...frets) + '-' + Math.max(...frets);
};

export async function buildManifest(exercises, root, { version = '0.1.0' } = {}) {
  const rows = [];
  for (const ex of exercises) {
    const rel = `${ex.dir}/${ex.id}.atex`;
    const content = await readFile(path.join(root, rel), 'utf8');
    rows.push({
      id: ex.id,
      dir: ex.dir,
      key: ex.key,
      mode: ex.mode,
      interval: ex.interval,
      type: ex.type,
      position: ex.position,
      frets: fretRange(ex.notes),
      notes: ex.notes.length,
      bars: bars(ex.notes),
      keySignature: ex.keySignature.name,
      file: rel,
      sha256: sha256(content),
    });
  }

  const byType = {};
  const byDir = {};
  for (const row of rows) {
    byType[row.type] = (byType[row.type] ?? 0) + 1;
    byDir[row.dir] = (byDir[row.dir] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tool: { name: 'guitar-gen-tool', version },
    totals: { exercises: rows.length, byType, byDir },
    exercises: rows,
  };
}

function toMarkdown(manifest) {
  const out = [];
  out.push('# 练习清单');
  out.push('');
  out.push(`共 **${manifest.totals.exercises}** 条练习，生成于 ${manifest.generatedAt}。`);
  out.push('');
  out.push('## 按目录汇总');
  out.push('');
  out.push('| 目录 | 条数 |');
  out.push('|---|---|');
  for (const [dir, count] of Object.entries(manifest.totals.byDir).sort()) {
    out.push(`| ${dir} | ${count} |`);
  }
  out.push('');
  out.push('## 明细');
  out.push('');
  out.push('| 练习 ID | 调式 | iN | 类型 | 把位 | 品格 | 音符数 | 小节 |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const r of manifest.exercises) {
    out.push(`| ${r.id} | ${r.mode} | i${r.interval} | ${r.type} | ${r.position} | ${r.frets} | ${r.notes} | ${r.bars} |`);
  }
  out.push('');
  return out.join('\n');
}

export async function writeManifest(manifest, { jsonPath, mdPath }) {
  await writeFile(jsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  if (mdPath) await writeFile(mdPath, toMarkdown(manifest), 'utf8');
}
