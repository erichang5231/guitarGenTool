import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepFor, t1, t2, t2Pairs } from '../src/core/sequences.mjs';
import { buildChain } from '../src/core/positions.mjs';
import { MODES } from '../src/core/modes.mjs';

const chain = buildChain(0, MODES.Ionian).chain;
const byId = new Map(chain.map((p) => [p.id, p.notes]));

test('step is 2 only for i2', () => {
  assert.equal(stepFor(2), 2);
  for (const i of [3, 4, 5, 6, 7, 8]) assert.equal(stepFor(i), 1);
});

test('T1 mirrors at the top and returns to the first note', () => {
  const seq = t1(byId.get('P1'), 3);
  assert.equal(seq[0].fret, byId.get('P1')[0].fret);
  assert.equal(seq.at(-1).fret, byId.get('P1')[0].fret);
  assert.equal(seq.length, 64); // i3: 16 pairs up + 16 pairs down
});

test('T1 note count shrinks from i3 upward, i2 uses the wider s2 step', () => {
  const lens = [2, 3, 4, 5, 6, 7, 8].map((i) => t1(byId.get('P1'), i).length);
  assert.deepEqual(lens, [36, 64, 60, 56, 52, 48, 44]);
});

test('T2 ends with the A position coda', () => {
  const a = byId.get('P1'); const b = byId.get('P2');
  const seq = t2(a, b, 3);
  assert.equal(seq.at(-2).fret, a[2].fret);
  assert.equal(seq.at(-1).fret, a[0].fret);
});

test('t2Pairs drops the PkH -> PkL break', () => {
  const { chain: c, k } = buildChain(0, MODES.Ionian);
  const pairs = t2Pairs(c);
  if (k < 7) {
    assert.ok(!pairs.some(([x, y]) => x === `P${k}H` && y === `P${k}L`));
    assert.equal(pairs.length, c.length - 2);
  } else {
    assert.equal(pairs.length, c.length - 1);
  }
});
