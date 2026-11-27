/**
 * The seven diatonic modes, as semitone offsets from the tonic.
 * Order matters: it is the canonical display order.
 */
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
 * Semitone offset from a mode's tonic up to the tonic of its relative major.
 * A mode and its relative major share a key signature.
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
