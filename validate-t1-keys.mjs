#!/usr/bin/env node
/**
 * Validate T1 generation for three Ionian keys other than C and D.
 * Keys: G (k=7, no pivot), A (k=6, pivot P6), E (k=7, no pivot).
 *
 * For every chain position and every iN in 2..8:
 * - build the T1 sequence from the current spec algorithm
 * - render it as alphaTex
 * - parse it with alphaTab 1.9
 * - compare every note, note count, bar count, first/last note, and staff flags
 *
 * Also writes one sample .atex per key to validation/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as at from '/home/zzx604/work/guitarTexTool/guitarTexTool/node_modules/@coderline/alphatab/dist/alphaTab.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, 'validation');

const STRINGS = [
  { string: 6, open: 40 },
  { string: 5, open: 45 },
  { string: 4, open: 50 },
  { string: 3, open: 55 },
  { string: 2, open: 59 },
  { string: 1, open: 64 },
];
const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const KEYS = [
  { name: 'G', pc: 7, samplePosition: 'P1' },
  { name: 'A', pc: 9, samplePosition: 'P6L' },
  { name: 'E', pc: 4, samplePosition: 'P1' },
];
const INTERVAL_NAMES = {
  2: '二度模进',
  3: '三度模进',
  4: '四度模进',
  5: '五度模进',
  6: '六度模进',
  7: '七度模进',
  8: '八度模进',
};

function lowestMidiForPc(pc) {
  return 40 + ((pc - (40 % 12) + 12) % 12);
}

function buildScale(pc) {
  const base = lowestMidiForPc(pc);
  const notes = [];
  for (let octave = 0; octave < 6; octave++) {
    for (const interval of IONIAN) notes.push(base + octave * 12 + interval);
  }
  return { base, notes };
}

function buildPosition(scale, degree) {
  const start = scale.base + IONIAN[degree - 1];
  const startIndex = scale.notes.indexOf(start);
  if (startIndex < 0) throw new Error(`start not found for degree ${degree}`);
  const notes = [];
  for (let i = 0; i < 18; i++) {
    const midi = scale.notes[startIndex + i];
    const stringIndex = Math.floor(i / 3);
    const tuning = STRINGS[stringIndex];
    const fret = midi - tuning.open;
    if (fret < 0) throw new Error(`negative fret for degree ${degree}`);
    notes.push({ midi, fret, string: tuning.string });
  }
  return {
    notes,
    min: Math.min(...notes.map((n) => n.fret)),
    max: Math.max(...notes.map((n) => n.fret)),
  };
}

function transposeDown(position) {
  return {
    notes: position.notes.map((n) => ({ ...n, midi: n.midi - 12, fret: n.fret - 12 })),
    min: position.min - 12,
    max: position.max - 12,
  };
}

function buildChain(scale) {
  const high = {};
  for (let degree = 1; degree <= 7; degree++) high[degree] = buildPosition(scale, degree);
  let k = 0;
  for (let degree = 1; degree <= 7; degree++) if (high[degree].max <= 19) k = degree;
  const chain = [];
  if (k === 7) {
    for (let degree = 1; degree <= 7; degree++) {
      chain.push({ id: `P${degree}`, ...high[degree] });
    }
  } else if (k > 0) {
    for (let degree = 1; degree < k; degree++) chain.push({ id: `P${degree}`, ...high[degree] });
    chain.push({ id: `P${k}H`, ...high[k] });
    chain.push({ id: `P${k}L`, ...transposeDown(high[k]) });
    for (let degree = k + 1; degree <= 7; degree++) {
      chain.push({ id: `P${degree}`, ...transposeDown(high[degree]) });
    }
  } else {
    throw new Error('no high position fits under fret 19');
  }
  return { high, k, chain };
}

function t1(notes, interval) {
  const top = 17 - (interval - 1);
  const out = [];
  for (let k = 0; k <= top; k++) out.push(notes[k], notes[k + interval - 1]);
  for (let k = top; k >= 0; k--) out.push(notes[k + interval - 1], notes[k]);
  return out;
}

function noteToken(note) {
  return `${note.fret}.${note.string}`;
}

function renderTex(keyName, positionId, interval, notes) {
  const id = `${keyName}-Ionian-i${interval}-${positionId}-T1`;
  const bars = [];
  for (let i = 0; i < notes.length; i += 8) {
    const chunk = notes.slice(i, i + 8).map(noteToken);
    while (chunk.length < 8) chunk.push('r');
    bars.push(chunk.join(' '));
  }
  return [
    `\\title "${keyName} Ionian · i${interval} · ${positionId} · T1"`,
    `\\subtitle "${INTERVAL_NAMES[interval]} · 同把位上下行"`,
    '\\tempo 70',
    '\\track "Guitar" { instrument acousticguitarsteel }',
    '\\staff { score tabs }',
    '\\tuning (E4 B3 G3 D3 A2 E2)',
    '\\ts 4 4',
    `\\ks ${keyName}`,
    `\\section "${id}"`,
    ':8 ' + bars.join(' |\n') + ' |',
    '',
  ].join('\n');
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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let totalExercises = 0;
  let totalErrors = 0;

  for (const key of KEYS) {
    const scale = buildScale(key.pc);
    const { k, chain } = buildChain(scale);
    console.log(`\n${key.name} Ionian: k=${k}`);
    console.log('  chain:', chain.map((p) => `${p.id}(${p.min}-${p.max})`).join(' '));

    let keyExercises = 0;
    let keyErrors = 0;
    for (const position of chain) {
      for (let interval = 2; interval <= 8; interval++) {
        const expected = t1(position.notes, interval);
        const tex = renderTex(key.name, position.id, interval, expected);
        keyExercises++;
        totalExercises++;

        let score;
        try {
          const importer = new at.importer.AlphaTexImporter();
          importer.initFromString(tex, new at.Settings());
          score = importer.readScore();
        } catch (err) {
          console.log(`  PARSE ERROR ${position.id} i${interval}: ${err.message}`);
          keyErrors++;
          totalErrors++;
          continue;
        }

        const staff = score.tracks[0]?.staves[0];
        if (!staff) {
          console.log(`  NO STAFF ${position.id} i${interval}`);
          keyErrors++;
          totalErrors++;
          continue;
        }
        if (!staff.showStandardNotation || !staff.showTablature) {
          console.log(`  STAFF FLAGS ${position.id} i${interval}`);
          keyErrors++;
          totalErrors++;
        }

        const parsed = flatten(staff);
        if (parsed.length !== expected.length) {
          console.log(`  NOTE COUNT ${position.id} i${interval}: ${parsed.length} != ${expected.length}`);
          keyErrors++;
          totalErrors++;
          continue;
        }
        const expectedBars = Math.ceil(expected.length / 8);
        if (score.masterBars.length !== expectedBars) {
          console.log(`  BAR COUNT ${position.id} i${interval}: ${score.masterBars.length} != ${expectedBars}`);
          keyErrors++;
          totalErrors++;
        }

        let mismatches = 0;
        for (let i = 0; i < parsed.length; i++) {
          const p = parsed[i];
          const e = expected[i];
          if (p.fret !== e.fret || p.string !== 7 - e.string || p.realValue !== e.midi) {
            mismatches++;
            if (mismatches <= 3) {
              console.log(`  NOTE MISMATCH ${position.id} i${interval} #${i}: parsed ${p.fret}/${p.string}/${p.realValue} expected ${e.fret}/${7 - e.string}/${e.midi}`);
            }
          }
        }
        if (mismatches) {
          console.log(`  MISMATCHES ${position.id} i${interval}: ${mismatches}`);
          keyErrors++;
          totalErrors++;
          continue;
        }

        const first = parsed[0];
        const last = parsed[parsed.length - 1];
        if (first.realValue !== position.notes[0].midi || last.realValue !== position.notes[0].midi) {
          console.log(`  ENDPOINT ${position.id} i${interval}: first ${first.realValue}, last ${last.realValue}, expected ${position.notes[0].midi}`);
          keyErrors++;
          totalErrors++;
        }
      }
    }
    console.log(`  T1 exercises: ${keyExercises}, errors: ${keyErrors}`);

    const samplePosition = chain.find((p) => p.id === key.samplePosition);
    if (samplePosition) {
      const sampleNotes = t1(samplePosition.notes, 3);
      const sampleTex = renderTex(key.name, samplePosition.id, 3, sampleNotes);
      const sampleFile = path.join(OUT_DIR, `${key.name}-Ionian-i3-${samplePosition.id}-T1.atex`);
      await writeFile(sampleFile, sampleTex, 'utf8');
      console.log(`  sample: ${sampleFile}`);
    }
  }

  console.log(`\nTotal T1 exercises: ${totalExercises}, total errors: ${totalErrors}`);
  if (totalErrors) process.exit(1);
}

await main();