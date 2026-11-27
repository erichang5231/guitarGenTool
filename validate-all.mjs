#!/usr/bin/env node
/**
 * Validate every generated .atex against the spec algorithms.
 *
 *   node validate-all.mjs                       # all <Key>-<Mode> dirs on disk
 *   node validate-all.mjs --root . --keys C --modes Dorian,Aeolian
 *
 * For each file it checks:
 *  - alphaTab 1.9 parses it without error
 *  - \\ks resolves to the mode's relative-major key signature
 *  - staff shows both standard notation and tablature
 *  - note count, fret, string, realValue match the expected sequence
 *  - master bar count matches ceil(notes / 8)
 *  - first and last note are the position's lowest note
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as at from '/home/zzx604/work/guitarTexTool/guitarTexTool/node_modules/@coderline/alphatab/dist/alphaTab.mjs';
import {
  MODES, MODE_NAMES, NATURAL_KEY_PCS, NATURAL_KEYS,
  buildChain, t2Pairs, t1, t2, keySignatureFor,
} from './theory.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const pick = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT_ROOT = path.resolve(ROOT, pick('--root', '.'));
const KEYS = pick('--keys', NATURAL_KEYS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const MODES_ARG = pick('--modes', null);
const MODES_TO_CHECK = MODES_ARG ? MODES_ARG.split(',').map((s) => s.trim()).filter(Boolean) : MODE_NAMES;

const KS_NUMBER = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6 };

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

/** id -> { notes, firstMidi } for one key + mode. */
function expectations(keyName, modeName) {
  const { chain } = buildChain(NATURAL_KEY_PCS[keyName], MODES[modeName]);
  const pairs = t2Pairs(chain);
  const byId = new Map(chain.map((p) => [p.id, p.notes]));
  const prefix = keyName + '-' + modeName;
  const table = new Map();
  for (let interval = 2; interval <= 8; interval++) {
    for (const position of chain) {
      table.set(prefix + '-i' + interval + '-' + position.id + '-T1', {
        notes: t1(position.notes, interval), firstMidi: position.notes[0].midi,
      });
    }
    for (const [aId, bId] of pairs) {
      const a = byId.get(aId);
      table.set(prefix + '-i' + interval + '-' + aId + '_' + bId + '-T2', {
        notes: t2(a, byId.get(bId), interval), firstMidi: a[0].midi,
      });
    }
  }
  return table;
}

async function main() {
  let totalFiles = 0;
  let totalErrors = 0;

  for (const keyName of KEYS) {
    for (const modeName of MODES_TO_CHECK) {
      const dirName = keyName + '-' + modeName;
      const dir = path.join(OUT_ROOT, dirName);
      let entries;
      try {
        entries = await readdir(dir);
      } catch {
        console.log('MISSING DIR ' + dirName);
        totalErrors++;
        continue;
      }
      const files = entries.filter((f) => f.endsWith('.atex')).sort();
      const expected = expectations(keyName, modeName);
      const wantKs = KS_NUMBER[keySignatureFor(NATURAL_KEY_PCS[keyName], modeName)];
      let errors = 0;
      const seen = new Set();

      for (const file of files) {
        const id = file.replace(/\.atex$/, '');
        const exp = expected.get(id);
        if (!exp) { console.log('UNKNOWN NAME ' + dirName + '/' + file); errors++; continue; }
        seen.add(id);

        const tex = await readFile(path.join(dir, file), 'utf8');
        let score;
        try {
          const importer = new at.importer.AlphaTexImporter();
          importer.initFromString(tex, new at.Settings());
          score = importer.readScore();
        } catch (err) {
          console.log('PARSE ERROR ' + dirName + '/' + file + ': ' + err.message);
          errors++;
          continue;
        }
        const staff = score.tracks[0]?.staves[0];
        if (!staff) { console.log('NO STAFF ' + dirName + '/' + file); errors++; continue; }
        if (!staff.showStandardNotation || !staff.showTablature) {
          console.log('STAFF FLAGS ' + dirName + '/' + file);
          errors++;
        }
        // Steel-string acoustic guitar (GM program 25). alphaTab derives
        // displayTranspositionPitch=-12 from the program, so standard notation
        // is written an octave above sounding pitch, as guitar notation requires.
        if (score.tracks[0].playbackInfo.program !== 25 || staff.displayTranspositionPitch !== -12) {
          console.log('INSTRUMENT ' + dirName + '/' + file + ': program=' +
            score.tracks[0].playbackInfo.program + ' displayTranspose=' + staff.displayTranspositionPitch);
          errors++;
        }
        if (score.masterBars[0].keySignature !== wantKs) {
          console.log('KEY SIGNATURE ' + dirName + '/' + file + ': ' + score.masterBars[0].keySignature + ' != ' + wantKs);
          errors++;
        }

        const parsed = flatten(staff);
        if (parsed.length !== exp.notes.length) {
          console.log('NOTE COUNT ' + dirName + '/' + file + ': ' + parsed.length + ' != ' + exp.notes.length);
          errors++;
          continue;
        }
        const expectedBars = Math.ceil(exp.notes.length / 8);
        if (score.masterBars.length !== expectedBars) {
          console.log('BAR COUNT ' + dirName + '/' + file + ': ' + score.masterBars.length + ' != ' + expectedBars);
          errors++;
        }
        let mismatches = 0;
        for (let i = 0; i < parsed.length; i++) {
          const p = parsed[i];
          const e = exp.notes[i];
          if (p.fret !== e.fret || p.string !== 7 - e.string || p.realValue !== e.midi) {
            mismatches++;
            if (mismatches <= 3) {
              console.log('NOTE MISMATCH ' + dirName + '/' + file + ' #' + i + ': parsed ' +
                p.fret + '/' + p.string + '/' + p.realValue + ' expected ' + e.fret + '/' + (7 - e.string) + '/' + e.midi);
            }
          }
        }
        if (mismatches) { console.log('MISMATCHES ' + dirName + '/' + file + ': ' + mismatches); errors++; continue; }

        if (parsed[0].realValue !== exp.firstMidi || parsed[parsed.length - 1].realValue !== exp.firstMidi) {
          console.log('ENDPOINT ' + dirName + '/' + file);
          errors++;
        }
      }

      const missing = [...expected.keys()].filter((id) => !seen.has(id));
      if (missing.length) {
        console.log('MISSING ' + dirName + ': ' + missing.length + ' -> ' + missing.slice(0, 3).join(', '));
        errors += missing.length;
      }

      totalFiles += files.length;
      totalErrors += errors;
      console.log(dirName + ': ' + files.length + '/' + expected.size + ' files, errors=' + errors);
    }
  }

  console.log('\nTOTAL files=' + totalFiles + ' errors=' + totalErrors);
  process.exit(totalErrors ? 1 : 0);
}

await main();
