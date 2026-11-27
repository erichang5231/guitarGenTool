/**
 * Sequence primitives: how a position (T1) or an adjacent pair (T2) is walked.
 * SPEC 2.2 and 4.1/4.2.
 */

/** Step s(iN): i2 uses s2, every other interval uses s1. */
export function stepFor(interval) {
  return interval === 2 ? 2 : 1;
}

/** Highest start index that still fits a full interval inside 18 notes. */
function topIndex(interval) {
  const step = stepFor(interval);
  return Math.floor((17 - (interval - 1)) / step) * step;
}

/** T1: same position, up then mirror down, step s. */
export function t1(notes, interval) {
  const step = stepFor(interval);
  const top = topIndex(interval);
  const out = [];
  for (let k = 0; k <= top; k += step) out.push(notes[k], notes[k + interval - 1]);
  for (let k = top; k >= 0; k -= step) out.push(notes[k + interval - 1], notes[k]);
  return out;
}

/** T2: A up, B mirror down, A bottom pair as coda, step s. */
export function t2(aNotes, bNotes, interval) {
  const step = stepFor(interval);
  const top = topIndex(interval);
  const out = [];
  for (let k = 0; k <= top; k += step) out.push(aNotes[k], aNotes[k + interval - 1]);
  for (let k = top; k >= 0; k -= step) out.push(bNotes[k + interval - 1], bNotes[k]);
  out.push(aNotes[interval - 1], aNotes[0]);
  return out;
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
