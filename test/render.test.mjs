import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAlphaTex, noteToken } from '../src/render/alphatex.mjs';

const notes = Array.from({ length: 10 }, (_, i) => ({ fret: 5 + i, string: 6, midi: 48 + i }));
const tex = renderAlphaTex({
  keyName: 'C', modeName: 'Ionian', id: 'C-Ionian-i3-P1-T1',
  interval: 3, typeLabel: '同把位上下行', notes, positionLabel: 'P1', keySignatureName: 'C',
});

test('note token is fret.string', () => {
  assert.equal(noteToken({ fret: 8, string: 6 }), '8.6');
});

test('header block is exact', () => {
  const lines = tex.split('\n');
  assert.equal(lines[0], '\\title "C Ionian · i3 · P1 · T1"');
  assert.equal(lines[1], '\\subtitle "三度模进 · 同把位上下行"');
  assert.equal(lines[2], '\\tempo 70');
  assert.equal(lines[3], '\\track "Guitar" { instrument acousticguitarsteel }');
  assert.equal(lines[4], '\\staff { score tabs }');
  assert.equal(lines[5], '\\tuning (E4 B3 G3 D3 A2 E2)');
  assert.equal(lines[6], '\\ts 4 4');
  assert.equal(lines[7], '\\ks C');
  assert.equal(lines[8], '\\section "C-Ionian-i3-P1-T1"');
});

test('bars hold 8 eighths, end with a pipe, and pad with rests', () => {
  // 10 notes -> bar 1 full, bar 2 has 2 notes + 6 rests; bars are newline-separated
  const bars = tex.split('\n').filter((l) => /^(:8 )?\d/.test(l));
  assert.equal(bars[0], ':8 5.6 6.6 7.6 8.6 9.6 10.6 11.6 12.6 |');
  assert.equal(bars[1], '13.6 14.6 r r r r r r |');
  assert.equal(bars.length, 2);
});

test('title uses the type label, not a hardcoded T1/T2 branch', () => {
  const other = renderAlphaTex({
    keyName: 'C', modeName: 'Dorian', id: 'x', interval: 5,
    typeLabel: '测试类型', notes, positionLabel: 'P2', keySignatureName: 'Bb',
  });
  assert.match(other, /\\subtitle "五度模进 · 测试类型"/);
  assert.match(other, /\\ks Bb/);
});
