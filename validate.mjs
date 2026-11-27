#!/usr/bin/env node
/**
 * Validate generated C Ionian alphaTex files against the spec algorithms.
 * Reads all .atex files in C-Ionian/, parses them with alphaTab 1.9,
 * and compares every note with the expected sequence.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as at from '/home/zzx604/work/guitarTexTool/guitarTexTool/node_modules/@coderline/alphatab/dist/alphaTab.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(ROOT, 'C-Ionian');

const STRINGS = [
  { string: 6, open: 40 },
  { string: 5, open: 45 },
  { string: 4, open: 50 },
  { string: 3, open: 55 },
  { string: 2, open: 59 },
  { string: 1, open: 64 },
];
const SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const LOWEST_TONIC = 48;
const SCALE = [];
for (let octave = 0; octave < 6; octave++) {
  for (const interval of SCALE_INTERVALS) SCALE.push(LOWEST_TONIC + octave * 12 + interval);
}

function buildPosition(degree) {
  const start = LOWEST_TONIC + SCALE_INTERVALS[degree - 1];
  const startIndex = SCALE.indexOf(start);
  const notes = [];
  for (let i = 0; i < 18; i++) {
    const midi = SCALE[startIndex + i];
    const stringIndex = Math.floor(i / 3);
    const tuning = STRINGS[stringIndex];
    notes.push({ midi, fret: midi - tuning.open, string: tuning.string });
  }
  return notes;
}
const high = {};
for (let d = 1; d <= 7; d++) high[d] = buildPosition(d);
const POSITIONS = {
  P1: high[1],
  P2: high[2],
  P3: high[3],
  P4H: high[4],
  P4L: high[4].map(n => ({ ...n, midi: n.midi - 12, fret: n.fret - 12 })),
  P5: high[5].map(n => ({ ...n, midi: n.midi - 12, fret: n.fret - 12 })),
  P6: high[6].map(n => ({ ...n, midi: n.midi - 12, fret: n.fret - 12 })),
  P7: high[7].map(n => ({ ...n, midi: n.midi - 12, fret: n.fret - 12 })),
};
const T2_PAIRS = [
  ['P1', 'P2'],
  ['P2', 'P3'],
  ['P3', 'P4H'],
  ['P4L', 'P5'],
  ['P5', 'P6'],
  ['P6', 'P7'],
];

function stepFor(interval) {
  return interval === 2 ? 2 : 1;
}
function t1(notes, interval) {
  const step = stepFor(interval);
  const top = Math.floor((17 - (interval - 1)) / step) * step;
  const out = [];
  for (let k = 0; k <= top; k += step) out.push(notes[k], notes[k + interval - 1]);
  for (let k = top; k >= 0; k -= step) out.push(notes[k + interval - 1], notes[k]);
  return out;
}
function t2(a, b, interval) {
  const step = stepFor(interval);
  const top = Math.floor((17 - (interval - 1)) / step) * step;
  const out = [];
  for (let k = 0; k <= top; k += step) out.push(a[k], a[k + interval - 1]);
  for (let k = top; k >= 0; k -= step) out.push(b[k + interval - 1], b[k]);
  out.push(a[interval - 1], a[0]);
  return out;
}

function expectedFor(name) {
  let m = name.match(/^C-Ionian-i(\d+)-(.+)-T1\.atex$/);
  if (m) return { interval: Number(m[1]), type: 'T1', notes: t1(POSITIONS[m[2]], Number(m[1])) };
  m = name.match(/^C-Ionian-i(\d+)-(.+)_(.+)-T2\.atex$/);
  if (m) {
    const interval = Number(m[1]);
    return { interval, type: 'T2', notes: t2(POSITIONS[m[2]], POSITIONS[m[3]], interval) };
  }
  return null;
}

function flatten(staff) {
  const notes = [];
  for (const bar of staff.bars) {
    for (const voice of bar.voices) {
      for (const beat of voice.beats) {
        for (const note of beat.notes) notes.push(note);
      }
    }
  }
  return notes;
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.atex')).sort();
let errors = 0;
let checked = 0;
for (const file of files) {
  const expected = expectedFor(file);
  if (!expected) {
    console.log('SKIP unknown name', file);
    continue;
  }
  const tex = await readFile(path.join(DIR, file), 'utf8');
  let score;
  try {
    const importer = new at.importer.AlphaTexImporter();
    importer.initFromString(tex, new at.Settings());
    score = importer.readScore();
  } catch (err) {
    console.log('PARSE ERROR', file, err.message);
    errors++;
    continue;
  }
  const staff = score.tracks[0]?.staves[0];
  if (!staff) {
    console.log('NO STAFF', file);
    errors++;
    continue;
  }
  if (!staff.showStandardNotation || !staff.showTablature) {
    console.log('STAFF FLAGS', file, staff.showStandardNotation, staff.showTablature);
    errors++;
  }
  const parsed = flatten(staff);
  if (parsed.length !== expected.notes.length) {
    console.log('NOTE COUNT', file, parsed.length, '!=', expected.notes.length);
    errors++;
    continue;
  }
  const expectedBars = Math.ceil(expected.notes.length / 8);
  if (score.masterBars.length !== expectedBars) {
    console.log('BAR COUNT', file, score.masterBars.length, '!=', expectedBars);
    errors++;
  }
  let mismatch = 0;
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const e = expected.notes[i];
    if (p.fret !== e.fret || p.string !== 7 - e.string || p.realValue !== e.midi) {
      mismatch++;
      if (mismatch <= 3) {
        console.log('NOTE MISMATCH', file, i, 'parsed', p.fret, p.string, p.realValue, 'expected', e.fret, 7 - e.string, e.midi);
      }
    }
  }
  if (mismatch) {
    console.log('MISMATCHES', file, mismatch);
    errors++;
  }
  checked++;
}
console.log(`checked ${checked}/${files.length} files, errors=${errors}`);
process.exit(errors ? 1 : 0);