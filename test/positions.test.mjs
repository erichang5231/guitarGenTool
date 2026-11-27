import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScale, lowestMidiForPc } from '../src/core/scale.mjs';
import { buildPosition, buildChain, transposeDown } from '../src/core/positions.mjs';
import { MODES } from '../src/core/modes.mjs';

test('lowest midi for a pitch class sits at or above low E', () => {
  assert.equal(lowestMidiForPc(0), 48);   // C3
  assert.equal(lowestMidiForPc(4), 40);   // E2
  assert.equal(lowestMidiForPc(11), 47);  // B2
});

test('scale has six octaves starting at the tonic', () => {
  const s = buildScale(0, MODES.Ionian);
  assert.equal(s.notes.length, 42);
  assert.equal(s.notes[0], 48);
  assert.equal(s.notes[7], 60);
});

test('position is 18 notes, three per string, low string first', () => {
  const s = buildScale(0, MODES.Ionian);
  const p = buildPosition(s, 1);
  assert.equal(p.length, 18);
  assert.equal(p[0].string, 6);
  assert.equal(p[0].fret, 8);            // C on low E
  assert.deepEqual(p.slice(0, 3).map((n) => n.string), [6, 6, 6]);
});

test('chain is 7 (no pivot) or 8 (pivot) positions, ids follow Pn/PnH/PnL', () => {
  for (const [pc, mode] of [[0, 'Ionian'], [2, 'Ionian'], [11, 'Ionian']]) {
    const { chain, k } = buildChain(pc, MODES[mode]);
    assert.ok(chain.length === 7 || chain.length === 8, `${pc} ${mode} -> ${chain.length}`);
    if (k < 7) {
      assert.ok(chain.some((p) => p.id === `P${k}H`));
      assert.ok(chain.some((p) => p.id === `P${k}L`));
    } else {
      assert.equal(chain.length, 7);
    }
  }
});

test('every fret is within 0..19', () => {
  const { chain } = buildChain(0, MODES.Ionian);
  for (const p of chain) for (const n of p.notes) {
    assert.ok(n.fret >= 0 && n.fret <= 19, `${p.id} fret ${n.fret}`);
  }
});

test('transposeDown drops one octave', () => {
  const { chain } = buildChain(0, MODES.Ionian);
  const t = transposeDown(chain[0].notes);
  assert.equal(t[0].midi, chain[0].notes[0].midi - 12);
  assert.equal(t[0].fret, chain[0].notes[0].fret - 12);
});
