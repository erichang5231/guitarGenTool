/**
 * Parse every generated file with alphaTab and compare it note by note with
 * the plan. alphaTab is a devDependency loaded lazily: generate and manifest
 * work without it.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function flatten(staff) {
  const notes = [];
  for (const bar of staff.bars) {
    for (const voice of bar.voices) {
      for (const beat of voice.beats) {
        for (const note of beat.notes) notes.push(note);
      }
    }
  }
  return notes;
}

function checkScore(at, tex, exercise, push, label) {
  const importer = new at.importer.AlphaTexImporter();
  importer.initFromString(tex, new at.Settings());
  const score = importer.readScore();

  const track = score.tracks[0];
  const staff = track?.staves[0];
  if (!staff) { push(`NO STAFF ${label}`); return; }
  if (!staff.showStandardNotation || !staff.showTablature) push(`STAFF FLAGS ${label}`);
  if (track.playbackInfo.program !== 25 || staff.displayTranspositionPitch !== -12) {
    push(`INSTRUMENT ${label}: program=${track.playbackInfo.program} displayTranspose=${staff.displayTranspositionPitch}`);
  }
  if (score.masterBars[0].keySignature !== exercise.keySignature.fifths) {
    push(`KEY SIGNATURE ${label}: ${score.masterBars[0].keySignature} != ${exercise.keySignature.fifths}`);
  }

  const parsed = flatten(staff);
  const expected = exercise.notes;
  if (parsed.length !== expected.length) {
    push(`NOTE COUNT ${label}: ${parsed.length} != ${expected.length}`);
    return;
  }
  const expectedBars = Math.ceil(expected.length / 8);
  if (score.masterBars.length !== expectedBars) {
    push(`BAR COUNT ${label}: ${score.masterBars.length} != ${expectedBars}`);
  }
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    const e = expected[i];
    if (p.fret !== e.fret || p.string !== 7 - e.string || p.realValue !== e.midi) {
      push(`NOTE MISMATCH ${label} #${i}: parsed ${p.fret}/${p.string}/${p.realValue} expected ${e.fret}/${7 - e.string}/${e.midi}`);
      return;
    }
  }
  if (parsed[0].realValue !== expected[0].midi || parsed.at(-1).realValue !== expected[0].midi) {
    push(`ENDPOINT ${label}`);
  }
}

/**
 * @param {object[]} exercises
 * @param {string} root
 * @returns {Promise<{ groups: {dir:string, found:number, expected:number, errors:string[]}[],
 *   totals: { files: number, errors: number } }>}
 */
export async function validatePlan(exercises, root) {
  let at;
  try {
    at = await import('@coderline/alphatab');
  } catch {
    const err = new Error('validate 需要 devDependency @coderline/alphatab，请先运行 npm install');
    err.code = 'DEP_MISSING';
    throw err;
  }

  const groups = new Map();
  for (const exercise of exercises) {
    const group = groups.get(exercise.dir) ?? { dir: exercise.dir, found: 0, expected: 0, errors: [] };
    group.expected++;
    groups.set(exercise.dir, group);

    const label = `${exercise.dir}/${exercise.id}.atex`;
    let tex;
    try {
      tex = await readFile(path.join(root, exercise.dir, exercise.id + '.atex'), 'utf8');
    } catch {
      group.errors.push(`MISSING ${label}`);
      continue;
    }
    group.found++;
    try {
      checkScore(at, tex, exercise, (msg) => group.errors.push(msg), label);
    } catch (err) {
      group.errors.push(`PARSE ERROR ${label}: ${err.message}`);
    }
  }

  const list = [...groups.values()];
  const totals = {
    files: list.reduce((n, g) => n + g.found, 0),
    errors: list.reduce((n, g) => n + g.errors.length, 0),
  };
  return { groups: list, totals };
}
