/**
 * Render the plan to `.atex` files on disk.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderAlphaTex } from './render/alphatex.mjs';
import { TYPES } from './types/index.mjs';

export function renderExercise(exercise) {
  return renderAlphaTex({
    keyName: exercise.key,
    modeName: exercise.mode,
    id: exercise.id,
    interval: exercise.interval,
    typeLabel: TYPES[exercise.type].label,
    notes: exercise.notes,
    positionLabel: exercise.position,
    keySignatureName: exercise.keySignature.name,
  });
}

/**
 * @param {object[]} exercises
 * @param {string} outRoot
 * @returns {Promise<{ written: number }>}
 */
export async function writePlan(exercises, outRoot) {
  const made = new Set();
  let written = 0;
  for (const exercise of exercises) {
    const dir = path.join(outRoot, exercise.dir);
    if (!made.has(dir)) { await mkdir(dir, { recursive: true }); made.add(dir); }
    await writeFile(path.join(dir, exercise.id + '.atex'), renderExercise(exercise), 'utf8');
    written++;
  }
  return { written };
}
