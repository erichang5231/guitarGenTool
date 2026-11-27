import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, MAX_HIGH_FRET } from '../src/core/tuning.mjs';
import { MODES, MODE_NAMES, MODE_RELATIVE_MAJOR_OFFSET } from '../src/core/modes.mjs';

test('standard tuning, low E first', () => {
  assert.deepEqual(STRINGS.map((s) => [s.string, s.open]),
    [[6, 40], [5, 45], [4, 50], [3, 55], [2, 59], [1, 64]]);
  assert.equal(MAX_HIGH_FRET, 19);
});

test('seven modes with correct intervals', () => {
  assert.equal(MODE_NAMES.length, 7);
  assert.deepEqual(MODES.Ionian,    [0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual(MODES.Dorian,    [0, 2, 3, 5, 7, 9, 10]);
  assert.deepEqual(MODES.Phrygian,  [0, 1, 3, 5, 7, 8, 10]);
  assert.deepEqual(MODES.Lydian,    [0, 2, 4, 6, 7, 9, 11]);
  assert.deepEqual(MODES.Mixolydian,[0, 2, 4, 5, 7, 9, 10]);
  assert.deepEqual(MODES.Aeolian,   [0, 2, 3, 5, 7, 8, 10]);
  assert.deepEqual(MODES.Locrian,   [0, 1, 3, 5, 6, 8, 10]);
});

test('relative major offsets match existing behaviour', () => {
  assert.deepEqual(MODE_RELATIVE_MAJOR_OFFSET,
    { Ionian: 0, Dorian: 10, Phrygian: 8, Lydian: 7, Mixolydian: 5, Aeolian: 3, Locrian: 1 });
});
