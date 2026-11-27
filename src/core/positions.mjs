/**
 * 3NPS positions and the pivot chain (SPEC 3.2).
 *
 * Each position is 18 notes: three consecutive scale tones per string, low
 * string first. Positions above `MAX_HIGH_FRET` are refused, and the highest
 * such degree becomes the pivot: it appears once high (`PkH`) and once an
 * octave lower (`PkL`), with everything above it shifted down.
 */
import { STRINGS, MAX_HIGH_FRET } from './tuning.mjs';
import { MODES } from './modes.mjs';
import { buildScale } from './scale.mjs';

/** 18-note 3NPS position starting on the given scale degree (1..7). */
export function buildPosition(scale, degree) {
  const intervals = scale.intervals ?? MODES.Ionian;
  const start = scale.base + intervals[degree - 1];
  const startIndex = scale.notes.indexOf(start);
  if (startIndex < 0) throw new Error('scale start not found for degree ' + degree);
  const notes = [];
  for (let i = 0; i < 18; i++) {
    const midi = scale.notes[startIndex + i];
    const stringIndex = Math.floor(i / 3);
    const tuning = STRINGS[stringIndex];
    const fret = midi - tuning.open;
    if (fret < 0) throw new Error('negative fret for degree ' + degree + ': ' + fret);
    notes.push({ midi, fret, string: tuning.string });
  }
  return notes;
}

export function transposeDown(notes) {
  return notes.map((n) => ({ ...n, midi: n.midi - 12, fret: n.fret - 12 }));
}

/**
 * k = 7 -> all high P1..P7 (no pivot);
 * k < 7 -> P1..P(k-1), PkH, PkL, P(k+1)..P7 (transposed down).
 */
export function buildChain(pc, intervals = MODES.Ionian) {
  const scale = buildScale(pc, intervals);
  const high = {};
  for (let d = 1; d <= 7; d++) high[d] = buildPosition(scale, d);
  let k = 0;
  for (let d = 1; d <= 7; d++) {
    if (Math.max(...high[d].map((n) => n.fret)) <= MAX_HIGH_FRET) k = d;
  }
  if (k === 0) throw new Error('no high position fits under fret ' + MAX_HIGH_FRET);
  const chain = [];
  if (k === 7) {
    for (let d = 1; d <= 7; d++) chain.push({ id: 'P' + d, notes: high[d] });
  } else {
    for (let d = 1; d < k; d++) chain.push({ id: 'P' + d, notes: high[d] });
    chain.push({ id: 'P' + k + 'H', notes: high[k] });
    chain.push({ id: 'P' + k + 'L', notes: transposeDown(high[k]) });
    for (let d = k + 1; d <= 7; d++) chain.push({ id: 'P' + d, notes: transposeDown(high[d]) });
  }
  return { scale, high, k, chain };
}
