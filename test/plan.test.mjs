import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, DEFAULT_TARGETS } from '../src/plan.mjs';

test('default plan is the 1253-exercise set', () => {
  const { exercises, skipped } = buildPlan();
  assert.equal(skipped.length, 0);
  assert.equal(exercises.length, 1253);
});

test('default plan covers exactly the expected dirs', () => {
  const dirs = new Set(buildPlan().exercises.map((e) => e.dir));
  assert.deepEqual([...dirs].sort(), [
    'A-Ionian', 'B-Ionian', 'C-Aeolian', 'C-Dorian', 'C-Ionian', 'C-Locrian',
    'C-Lydian', 'C-Mixolydian', 'C-Phrygian', 'D-Ionian', 'E-Ionian', 'F-Ionian', 'G-Ionian',
  ]);
});

test('exercise shape carries everything downstream needs', () => {
  const ex = buildPlan().exercises[0];
  for (const k of ['id', 'dir', 'key', 'mode', 'interval', 'type', 'position', 'notes', 'keySignature']) {
    assert.ok(k in ex, `missing ${k}`);
  }
  assert.match(ex.id, /^[A-G]b?#?-[A-Za-z]+-i[2-8]-.+-(T1|T2)$/);
});

test('explicit keys x modes is a cartesian product', () => {
  const { exercises } = buildPlan({ keys: ['Db'], modes: ['Dorian'], types: ['T1'] });
  assert.ok(exercises.length > 0);
  assert.ok(exercises.every((e) => e.key === 'Db' && e.mode === 'Dorian' && e.type === 'T1'));
});

test('out-of-range signature is skipped with a suggestion, not thrown', () => {
  const { exercises, skipped } = buildPlan({ keys: ['G#'], modes: ['Ionian'] });
  assert.equal(exercises.length, 0);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].suggestion, 'Ab');
});

test('unknown type / mode / key throw with the valid set listed', () => {
  assert.throws(() => buildPlan({ types: ['T9'] }), /T1.*T2/);
  assert.throws(() => buildPlan({ modes: ['Blues'] }), /Ionian/);
  assert.throws(() => buildPlan({ keys: ['H'] }), /C#|合法/);
});

test('a new T3 registered in the type registry flows through plan', async () => {
  const { TYPES } = await import('../src/types/index.mjs');
  TYPES.T3 = {
    label: 'stub',
    slots: (c) => [{ id: c[0].id, from: [c[0].id] }],
    name: (k, m, i, s) => `${k}-${m}-i${i}-${s}-T3`,
    notes: (pos, slot, i) => TYPES.T1.notes(pos, slot, i),
  };
  try {
    const { exercises } = buildPlan({ keys: ['C'], modes: ['Ionian'], types: ['T3'] });
    assert.ok(exercises.length > 0);
    assert.ok(exercises.every((e) => e.type === 'T3'));
  } finally { delete TYPES.T3; }
});
