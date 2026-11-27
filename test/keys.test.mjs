import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKey, keySignatureFor, KEY_SIGNATURES } from '../src/core/keys.mjs';

test('parses sharps, flats and naturals', () => {
  assert.deepEqual(parseKey('C'),  { name: 'C',  pc: 0,  accidental: 'natural' });
  assert.deepEqual(parseKey('C#'), { name: 'C#', pc: 1,  accidental: 'sharp' });
  assert.deepEqual(parseKey('Db'), { name: 'Db', pc: 1,  accidental: 'flat' });
  assert.deepEqual(parseKey('B'),  { name: 'B',  pc: 11, accidental: 'natural' });
});

test('rejects invalid tonic names instead of defaulting to C', () => {
  for (const bad of ['H', 'C##', 'c#', '', 'Xb']) {
    assert.throws(() => parseKey(bad), /C#|Db|合法/);
  }
});

test('15 key signatures span -7..+7', () => {
  assert.equal(KEY_SIGNATURES.length, 15);
  assert.equal(KEY_SIGNATURES[0].fifths, -7);
  assert.equal(KEY_SIGNATURES.at(-1).fifths, 7);
});

test('derives relative-major signature for natural keys (regression)', () => {
  const expect = {
    Ionian: { C: 'C', D: 'D' }, Dorian: { C: 'Bb' }, Phrygian: { C: 'Ab' },
    Lydian: { C: 'G' }, Mixolydian: { C: 'F' }, Aeolian: { C: 'Eb' }, Locrian: { C: 'Db' },
  };
  for (const [mode, table] of Object.entries(expect)) {
    for (const [key, ks] of Object.entries(table)) {
      assert.equal(keySignatureFor(parseKey(key), mode).name, ks, `${key} ${mode}`);
    }
  }
});

test('twelve tonics, sharp/flat side decides spelling', () => {
  assert.deepEqual(keySignatureFor(parseKey('C#'), 'Dorian'), { name: 'B',  fifths: 5 });
  assert.deepEqual(keySignatureFor(parseKey('Db'), 'Dorian'), { name: 'Cb', fifths: -7 });
  assert.deepEqual(keySignatureFor(parseKey('B'),  'Dorian'), { name: 'A',  fifths: 3 });
  assert.deepEqual(keySignatureFor(parseKey('Gb'), 'Ionian'), { name: 'Gb', fifths: -6 });
  assert.deepEqual(keySignatureFor(parseKey('C#'), 'Ionian'), { name: 'C#', fifths: 7 });
});

test('rejects signatures beyond +-7 with enharmonic suggestion', () => {
  for (const [key, mode, suggestion] of [['G#', 'Ionian', 'Ab'], ['D#', 'Ionian', 'Eb'], ['A#', 'Ionian', 'Bb'], ['Gb', 'Dorian', 'F#']]) {
    try {
      keySignatureFor(parseKey(key), mode);
      assert.fail(`${key} ${mode} should throw`);
    } catch (err) {
      assert.equal(err.code, 'KEY_SIG_OUT_OF_RANGE');
      assert.equal(err.suggestion, suggestion);
      assert.match(err.message, /请改用等音主音/);
    }
  }
});

test('same tonic stays legal in another mode', () => {
  assert.equal(keySignatureFor(parseKey('G#'), 'Dorian').name, 'F#');
});
