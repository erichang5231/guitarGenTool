#!/usr/bin/env node
/**
 * Write a Markdown + JSON inventory of the generated exercises.
 * Discovers <Key>-<Mode> directories on disk.
 *
 *   node manifest.mjs [--root .] [--out MANIFEST.md]
 */
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODES, MODE_NAMES, NATURAL_KEY_PCS, buildChain, t2Pairs, t1, t2,
} from './theory.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const pick = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const outFile = path.resolve(ROOT, pick('--out', 'MANIFEST.md'));
const OUT_ROOT = path.resolve(ROOT, pick('--root', '.'));

const bars = (notes) => Math.ceil(notes.length / 8);
const fretRange = (notes) => {
  const frets = notes.map((n) => n.fret);
  return Math.min(...frets) + '-' + Math.max(...frets);
};

// Discover <Key>-<Mode> directories.
const entries = await readdir(OUT_ROOT, { withFileTypes: true });
const targets = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const m = entry.name.match(/^(.+)-(.+)$/);
  if (!m) continue;
  const [, keyName, modeName] = m;
  if (NATURAL_KEY_PCS[keyName] === undefined || !MODES[modeName]) continue;
  targets.push({ keyName, modeName, dir: entry.name });
}
const MODE_ORDER = MODE_NAMES;
const KEY_ORDER = Object.keys(NATURAL_KEY_PCS);
targets.sort((a, b) => {
  const ka = KEY_ORDER.indexOf(a.keyName) - KEY_ORDER.indexOf(b.keyName);
  if (ka !== 0) return ka;
  return MODE_ORDER.indexOf(a.modeName) - MODE_ORDER.indexOf(b.modeName);
});

const rows = [];
const perGroup = [];
for (const { keyName, modeName, dir } of targets) {
  const { chain, k } = buildChain(NATURAL_KEY_PCS[keyName], MODES[modeName]);
  const pairs = t2Pairs(chain);
  const byId = new Map(chain.map((p) => [p.id, p.notes]));
  const prefix = keyName + '-' + modeName;
  let t1c = 0;
  let t2c = 0;
  for (let interval = 2; interval <= 8; interval++) {
    for (const position of chain) {
      const seq = t1(position.notes, interval);
      rows.push({
        id: prefix + '-i' + interval + '-' + position.id + '-T1',
        key: keyName, mode: modeName, dir, interval, type: 'T1', position: position.id,
        frets: fretRange(position.notes), notes: seq.length, bars: bars(seq),
      });
      t1c++;
    }
    for (const [aId, bId] of pairs) {
      const a = byId.get(aId);
      const b = byId.get(bId);
      const seq = t2(a, b, interval);
      rows.push({
        id: prefix + '-i' + interval + '-' + aId + '_' + bId + '-T2',
        key: keyName, mode: modeName, dir, interval, type: 'T2', position: aId + '_' + bId,
        frets: fretRange(a) + ' / ' + fretRange(b), notes: seq.length, bars: bars(seq),
      });
      t2c++;
    }
  }
  perGroup.push({
    key: keyName, mode: modeName, dir, k,
    chain: chain.map((p) => p.id + '(' + fretRange(p.notes) + ')').join(' '),
    t1: t1c, t2: t2c, total: t1c + t2c,
  });
}

const counts = {};
const missing = [];
for (const r of rows) {
  const groupDir = path.join(OUT_ROOT, r.dir);
  counts[r.dir] = counts[r.dir] ?? { files: 0, png: 0 };
  let files = [];
  try { files = await readdir(groupDir); } catch { files = []; }
  if (files.includes(r.id + '.atex')) counts[r.dir].files++;
  else missing.push(r.dir + '/' + r.id + '.atex');
  let pngs = [];
  try { pngs = await readdir(path.join(groupDir, 'png')); } catch { pngs = []; }
  if (pngs.includes(r.id + '.png')) counts[r.dir].png++;
}

const out = [];
out.push('# Ionian / 调式 T1/T2 练习清单');
out.push('');
out.push('覆盖：7 个自然音主音的 Ionian（C/D/E/F/G/A/B），以及 **C 调的 6 种调式**' +
  '（Dorian / Phrygian / Lydian / Mixolydian / Aeolian / Locrian）。');
out.push('');
const t1Total = rows.filter((r) => r.type === 'T1').length;
const t2Total = rows.filter((r) => r.type === 'T2').length;
out.push('总数：**' + rows.length + '** 个 .atex（T1 ' + t1Total + ' / T2 ' + t2Total + '）。');
out.push('');
out.push('## 按目录汇总');
out.push('');
out.push('| 目录 | pivot k | T1 | T2 | 小计 | .atex 在盘 | PNG 在盘 |');
out.push('|---|---|---|---|---|---|---|');
for (const p of perGroup) {
  const c = counts[p.dir] ?? { files: 0, png: 0 };
  out.push('| ' + p.dir + ' | ' + (p.k === 7 ? '-' : 'P' + p.k) + ' | ' + p.t1 + ' | ' + p.t2 + ' | ' + p.total +
    ' | ' + c.files + ' | ' + c.png + ' |');
}
out.push('');
out.push('## 把位链');
out.push('');
out.push('| 目录 | 链 |');
out.push('|---|---|');
for (const p of perGroup) out.push('| ' + p.dir + ' | ' + p.chain + ' |');
out.push('');
out.push('## 明细');
out.push('');
out.push('| 练习 ID | 目录 | 调 | 调式 | iN | 类型 | 把位 | 品格 | 音符数 | 小节 |');
out.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  out.push('| ' + r.id + ' | ' + r.dir + ' | ' + r.key + ' | ' + r.mode + ' | i' + r.interval + ' | ' + r.type +
    ' | ' + r.position + ' | ' + r.frets + ' | ' + r.notes + ' | ' + r.bars + ' |');
}
if (missing.length) {
  out.push('');
  out.push('## 缺失文件');
  out.push('');
  for (const m of missing) out.push('- ' + m);
}
out.push('');

await writeFile(outFile, out.join('\n'), 'utf8');
await writeFile(outFile.slice(0, -3) + '.json', JSON.stringify({ perGroup, rows, counts, missing }, null, 2), 'utf8');
console.log('wrote ' + outFile + ' (' + rows.length + ' exercises, missing=' + missing.length + ')');
