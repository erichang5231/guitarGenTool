/**
 * Shared Ionian/modal theory + alphaTex rendering.
 * Used by generate.mjs, validate-all.mjs and manifest.mjs.
 * Spec: SPEC.md (3NPS positions, pivot chain, iN/sN, T1/T2).
 */

// Standard tuning, low E -> high E.
export const STRINGS = [
  { string: 6, open: 40, name: 'E2' },
  { string: 5, open: 45, name: 'A2' },
  { string: 4, open: 50, name: 'D3' },
  { string: 3, open: 55, name: 'G3' },
  { string: 2, open: 59, name: 'B3' },
  { string: 1, open: 64, name: 'E4' },
];

// Scale intervals in semitones from the tonic.
export const IONIAN = [0, 2, 4, 5, 7, 9, 11];

export const MODES = {
  Ionian: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
};

export const MODE_NAMES = Object.keys(MODES);

/**
 * Semitone offset from the mode's tonic down to its relative major tonic.
 * A mode and its relative major share a key signature (SPEC / music theory).
 *   C Ionian -> C, C Dorian -> Bb, C Phrygian -> Ab, C Lydian -> G,
 *   C Mixolydian -> F, C Aeolian -> Eb, C Locrian -> Db
 */
export const MODE_RELATIVE_MAJOR_OFFSET = {
  Ionian: 0,
  Dorian: 10,
  Phrygian: 8,
  Lydian: 7,
  Mixolydian: 5,
  Aeolian: 3,
  Locrian: 1,
};

/**
 * Pitch class -> alphaTex \\ks name. Prefers flat spellings, which is correct
 * for every relative major reachable from the natural-note tonics.
 */
const KEY_NAME_BY_PC = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const INTERVAL_NAMES = {
  2: '二度模进',
  3: '三度模进',
  4: '四度模进',
  5: '五度模进',
  6: '六度模进',
  7: '七度模进',
  8: '八度模进',
};

// Natural-note tonics only (no sharps/flats) for this phase.
export const NATURAL_KEY_PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const NATURAL_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const MAX_HIGH_FRET = 19;

/** Lowest MIDI note >= low E (40) with the given pitch class. */
export function lowestMidiForPc(pc) {
  return 40 + ((pc - (40 % 12) + 12) % 12);
}

/** alphaTex \\ks value for a mode built on a tonic pitch class. */
export function keySignatureFor(tonicPc, modeName) {
  const offset = MODE_RELATIVE_MAJOR_OFFSET[modeName];
  if (offset === undefined) throw new Error('unknown mode: ' + modeName);
  return KEY_NAME_BY_PC[(tonicPc + offset) % 12];
}

/** Six octaves of the scale starting at the tonic, lowest note >= low E. */
export function buildScale(pc, intervals = IONIAN) {
  const base = lowestMidiForPc(pc);
  const notes = [];
  for (let octave = 0; octave < 6; octave++) {
    for (const interval of intervals) notes.push(base + octave * 12 + interval);
  }
  return { base, notes, intervals };
}

/** 18-note 3NPS position starting on the given scale degree (1..7). */
export function buildPosition(scale, degree) {
  const intervals = scale.intervals ?? IONIAN;
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
 * Build the position chain per SPEC 3.2.
 * k = 7 -> all high P1..P7 (no pivot); k < 7 -> P1..P(k-1), PkH, PkL, P(k+1)..P7.
 */
export function buildChain(pc, intervals = IONIAN) {
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

/** Adjacent chain pairs, excluding the pivot H -> L break (SPEC 3.2). */
export function t2Pairs(chain) {
  const pairs = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i].id;
    const b = chain[i + 1].id;
    const pivotBreak = /H$/.test(a) && /^P[1-7]L$/.test(b) && a.slice(0, -1) === b.slice(0, -1);
    if (pivotBreak) continue;
    pairs.push([a, b]);
  }
  return pairs;
}

/** Step s(iN): i2 uses s2, every other interval uses s1. See SPEC 2.2. */
export function stepFor(interval) {
  return interval === 2 ? 2 : 1;
}

/** T1: same position, up then mirror down, step s. */
export function t1(notes, interval) {
  const step = stepFor(interval);
  const top = Math.floor((17 - (interval - 1)) / step) * step;
  const out = [];
  for (let k = 0; k <= top; k += step) out.push(notes[k], notes[k + interval - 1]);
  for (let k = top; k >= 0; k -= step) out.push(notes[k + interval - 1], notes[k]);
  return out;
}

/** T2: A up, B mirror down, A bottom pair as coda, step s. */
export function t2(aNotes, bNotes, interval) {
  const step = stepFor(interval);
  const top = Math.floor((17 - (interval - 1)) / step) * step;
  const out = [];
  for (let k = 0; k <= top; k += step) out.push(aNotes[k], aNotes[k + interval - 1]);
  for (let k = top; k >= 0; k -= step) out.push(bNotes[k + interval - 1], bNotes[k]);
  out.push(aNotes[interval - 1], aNotes[0]);
  return out;
}

export function noteToken(note) {
  return note.fret + '.' + note.string;
}

/** Render one exercise as alphaTex (SPEC 6). */
export function renderAlphaTex({ keyName, modeName = 'Ionian', id, interval, type, notes, positionLabel, keySignature }) {
  const title = keyName + ' ' + modeName + ' · i' + interval + ' · ' + positionLabel + ' · ' + type;
  const typeName = type === 'T1' ? '同把位上下行' : '相邻把位上下行';
  const subtitle = INTERVAL_NAMES[interval] + ' · ' + typeName;

  const bars = [];
  for (let i = 0; i < notes.length; i += 8) {
    const chunk = notes.slice(i, i + 8).map(noteToken);
    while (chunk.length < 8) chunk.push('r');
    bars.push(chunk.join(' '));
  }

  return [
    '\\title "' + title + '"',
    '\\subtitle "' + subtitle + '"',
    '\\tempo 70',
    '\\track "Guitar" { instrument acousticguitarsteel }',
    '\\staff { score tabs }',
    '\\tuning (E4 B3 G3 D3 A2 E2)',
    '\\ts 4 4',
    '\\ks ' + (keySignature ?? keySignatureFor(NATURAL_KEY_PCS[keyName] ?? 0, modeName)),
    '\\section "' + id + '"',
    ':8 ' + bars.join(' |\n') + ' |',
    '',
  ].join('\n');
}
