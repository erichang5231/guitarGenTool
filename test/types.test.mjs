import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, TYPE_NAMES } from '../src/types/index.mjs';
import { buildChain } from '../src/core/positions.mjs';
import { MODES } from '../src/core/modes.mjs';

const { chain } = buildChain(0, MODES.Ionian);
const byPos = new Map(chain.map((p) => [p.id, p.notes]));

test('registry exposes T1 and T2 only', () => {
  assert.deepEqual(TYPE_NAMES.sort(), ['T1', 'T2']);
});

test('T1 slots are one per position, named <key>-<mode>-i<n>-<pos>-T1', () => {
  const spec = TYPES.T1;
  const slots = spec.slots(chain);
  assert.equal(slots.length, chain.length);
  assert.equal(spec.name('C', 'Ionian', 3, 'P1'), 'C-Ionian-i3-P1-T1');
  assert.equal(spec.notes(byPos, slots[0], 3).length, 64); // i3, step 1, top=15 -> 16 pairs
});

test('T2 slots are adjacent pairs, named with A_B', () => {
  const spec = TYPES.T2;
  const slots = spec.slots(chain);
  assert.ok(slots.every((s) => s.from.length === 2));
  assert.match(spec.name('C', 'Ionian', 3, slots[0].id), /^C-Ionian-i3-P\d+_P\d+-T2$/);
});

test('every slot produces a non-empty note sequence', () => {
  for (const t of TYPE_NAMES) {
    for (const slot of TYPES[t].slots(chain)) {
      const seq = TYPES[t].notes(byPos, slot, 3);
      assert.ok(seq.length > 0, `${t} ${slot.id}`);
      assert.ok(seq.every((n) => typeof n.fret === 'number' && typeof n.string === 'number'));
    }
  }
});

test('adding a T3 stub needs only a registry entry', () => {
  const stub = {
    label: '测试类型',
    slots: (c) => [{ id: 'X', from: [c[0].id] }],
    name: (k, m, i, s) => `${k}-${m}-i${i}-${s}-T3`,
    notes: (pos, slot, i) => TYPES.T1.notes(pos, slot, i),
  };
  TYPES.T3 = stub;
  assert.equal(TYPES.T3.name('C', 'Ionian', 3, 'X'), 'C-Ionian-i3-X-T3');
  delete TYPES.T3;
});
