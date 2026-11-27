/**
 * Scale material: pitch classes expanded into MIDI notes across six octaves.
 */
import { MODES } from './modes.mjs';

/** Lowest MIDI note at or above low E (40) with the given pitch class. */
export function lowestMidiForPc(pc) {
  return 40 + ((pc - (40 % 12) + 12) % 12);
}

/**
 * Six octaves of the scale starting at the tonic.
 * @returns {{ base: number, notes: number[], intervals: number[] }}
 */
export function buildScale(pc, intervals = MODES.Ionian) {
  const base = lowestMidiForPc(pc);
  const notes = [];
  for (let octave = 0; octave < 6; octave++) {
    for (const interval of intervals) notes.push(base + octave * 12 + interval);
  }
  return { base, notes, intervals };
}
