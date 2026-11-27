/**
 * Tonic parsing and key-signature derivation.
 *
 * Key signatures are derived diatonically: the relative major's letter name
 * comes from the mode's letter distance to the tonic, and its accidental from
 * the pitch-class distance. That keeps `F Dorian` (Eb major, 3 flats) legal
 * while rejecting `G# Ionian` (8 sharps), which no notation allows.
 */
import { MODE_RELATIVE_MAJOR_OFFSET } from './modes.mjs';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_FIFTHS = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

/** How many letter names down from the tonic its relative major sits. */
const MODE_LETTER_SHIFT = {
  Ionian: 0, Dorian: 6, Phrygian: 5, Lydian: 4, Mixolydian: 3, Aeolian: 2, Locrian: 1,
};

export const KEY_SIGNATURES = [
  { name: 'Cb', fifths: -7 }, { name: 'Gb', fifths: -6 }, { name: 'Db', fifths: -5 },
  { name: 'Ab', fifths: -4 }, { name: 'Eb', fifths: -3 }, { name: 'Bb', fifths: -2 },
  { name: 'F', fifths: -1 }, { name: 'C', fifths: 0 }, { name: 'G', fifths: 1 },
  { name: 'D', fifths: 2 }, { name: 'A', fifths: 3 }, { name: 'E', fifths: 4 },
  { name: 'B', fifths: 5 }, { name: 'F#', fifths: 6 }, { name: 'C#', fifths: 7 },
];

const FLAT_SPELLING = { 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' };
const SHARP_SPELLING = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };

const LEGAL_TONICS = "A B C D E F G A# Ab Bb B C# Cb D# Db E# Eb F# Fb G# Gb";

/**
 * @param {string} input tonic name such as `C`, `C#`, `Db`
 * @returns {{ name: string, pc: number, accidental: 'sharp'|'flat'|'natural' }}
 */
export function parseKey(input) {
  if (typeof input !== 'string' || !/^[A-G][#b]?$/.test(input)) {
    throw new Error(`非法主音 "${input}"；合法取值：${LEGAL_TONICS}`);
  }
  const letter = input[0];
  const accidental = input.length === 1 ? 'natural' : input[1] === '#' ? 'sharp' : 'flat';
  const delta = accidental === 'sharp' ? 1 : accidental === 'flat' ? -1 : 0;
  return { name: input, pc: (LETTER_PC[letter] + delta + 12) % 12, accidental };
}

/**
 * @param {{ name: string, pc: number, accidental: string }} tonic
 * @param {string} modeName one of MODES
 * @returns {{ name: string, fifths: number }}
 */
export function keySignatureFor(tonic, modeName) {
  const shift = MODE_LETTER_SHIFT[modeName];
  const offset = MODE_RELATIVE_MAJOR_OFFSET[modeName];
  if (shift === undefined || offset === undefined) throw new Error('unknown mode: ' + modeName);

  const relPc = (tonic.pc + offset) % 12;
  const relLetter = LETTERS[(LETTERS.indexOf(tonic.name[0]) + shift) % 7];
  const delta = ((relPc - LETTER_PC[relLetter] + 6) % 12) - 6;
  const fifths = LETTER_FIFTHS[relLetter] + 7 * delta;

  if (Math.abs(fifths) > 7 || Math.abs(delta) > 2) {
    const suggestion = tonic.accidental === 'sharp'
      ? FLAT_SPELLING[tonic.pc] ?? null
      : tonic.accidental === 'flat' ? SHARP_SPELLING[tonic.pc] ?? null : null;
    const err = new RangeError(
      `${tonic.name} ${modeName}: 调号需要 ${Math.abs(fifths)} 个${fifths > 0 ? '升' : '降'}号` +
      `（alphaTab 上限 7）；请改用等音主音 ${suggestion ?? '（无可用等音拼写）'}`,
    );
    err.code = 'KEY_SIG_OUT_OF_RANGE';
    err.suggestion = suggestion;
    throw err;
  }

  const accidental = delta > 0 ? '#'.repeat(delta) : 'b'.repeat(-delta);
  return { name: relLetter + accidental, fifths };
}
