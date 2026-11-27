/**
 * Standard guitar tuning and fretboard limits.
 * Listed low string (6) to high string (1); `open` is the MIDI note.
 */
export const STRINGS = [
  { string: 6, open: 40, name: 'E2' },
  { string: 5, open: 45, name: 'A2' },
  { string: 4, open: 50, name: 'D3' },
  { string: 3, open: 55, name: 'G3' },
  { string: 2, open: 59, name: 'B3' },
  { string: 1, open: 64, name: 'E4' },
];

/** Highest fret a 3NPS position may reach before it is transposed down. */
export const MAX_HIGH_FRET = 19;
