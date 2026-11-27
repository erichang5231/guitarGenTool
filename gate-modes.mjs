#!/usr/bin/env node
/**
 * Mode gate: before a bulk run, render one sample exercise per mode and check
 * that alphaTab 1.9 parses it with the expected key signature, note count,
 * staff flags and endpoints.
 *
 *   node gate-modes.mjs [--key C]
 */
import * as at from '/home/zzx604/work/guitarTexTool/guitarTexTool/node_modules/@coderline/alphatab/dist/alphaTab.mjs';
import {
  MODES, MODE_NAMES, NATURAL_KEY_PCS, buildChain, t1, renderAlphaTex, keySignatureFor,
} from './theory.mjs';

const argv = process.argv.slice(2);
const keyIdx = argv.indexOf('--key');
const keyName = keyIdx >= 0 ? argv[keyIdx + 1] : 'C';
const tonicPc = NATURAL_KEY_PCS[keyName];
if (tonicPc === undefined) throw new Error('unsupported key: ' + keyName);

// alphaTab's numeric keySignature for the expected \ks spelling.
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

let errors = 0;
for (const modeName of MODE_NAMES) {
  const intervals = MODES[modeName];
  const { chain } = buildChain(tonicPc, intervals);
  const position = chain.find((p) => p.id === 'P1');
  const expected = t1(position.notes, 3);
  const ks = keySignatureFor(tonicPc, modeName);
  const id = keyName + '-' + modeName + '-i3-P1-T1';
  const tex = renderAlphaTex({
    keyName, modeName, id, interval: 3, type: 'T1',
    notes: expected, positionLabel: 'P1', keySignature: ks,
  });

  try {
    const importer = new at.importer.AlphaTexImporter();
    importer.initFromString(tex, new at.Settings());
    const score = importer.readScore();
    const staff = score.tracks[0]?.staves[0];
    if (!staff) throw new Error('no staff');

    const actualKs = score.masterBars[0].keySignature;
    const wantKs = KS_NUMBER[ks];
    if (actualKs !== wantKs) throw new Error('keySignature ' + actualKs + ' != ' + wantKs + ' (\\ks ' + ks + ')');
    if (!staff.showStandardNotation || !staff.showTablature) throw new Error('staff flags not both true');

    const parsed = flatten(staff);
    if (parsed.length !== expected.length) throw new Error('note count ' + parsed.length + ' != ' + expected.length);
    const bars = Math.ceil(expected.length / 8);
    if (score.masterBars.length !== bars) throw new Error('bar count ' + score.masterBars.length + ' != ' + bars);

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const e = expected[i];
      if (p.fret !== e.fret || p.string !== 7 - e.string || p.realValue !== e.midi) {
        throw new Error('note #' + i + ' ' + p.fret + '/' + p.string + '/' + p.realValue +
          ' != ' + e.fret + '/' + (7 - e.string) + '/' + e.midi);
      }
    }
    const first = parsed[0].realValue;
    const last = parsed[parsed.length - 1].realValue;
    if (first !== position.notes[0].midi || last !== position.notes[0].midi) {
      throw new Error('endpoints ' + first + '..' + last + ' != ' + position.notes[0].midi);
    }

    console.log('OK   ' + modeName.padEnd(11) + ' \\ks ' + ks.padEnd(3) + ' notes=' + parsed.length + ' bars=' + bars);
  } catch (err) {
    errors++;
    console.log('FAIL ' + modeName.padEnd(11) + ' ' + err.message);
  }
}

console.log(errors ? 'GATE FAILED (' + errors + ')' : 'GATE PASSED');
process.exit(errors ? 1 : 0);
