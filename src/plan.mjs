/**
 * The single source of truth: every exercise the tool can produce.
 *
 * generate, validate and manifest all derive from this, so the expected note
 * sequence is computed in exactly one place.
 */
import { MODES, MODE_NAMES } from './core/modes.mjs';
import { parseKey, keySignatureFor } from './core/keys.mjs';
import { buildChain } from './core/positions.mjs';
import { TYPES, TYPE_NAMES } from './types/index.mjs';

export const NATURAL_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * What `generate` produces with no flags: the historical 1253-exercise set.
 * Not a cartesian product, hence two explicit targets.
 */
export const DEFAULT_TARGETS = [
  { keys: NATURAL_KEYS, modes: ['Ionian'] },
  { keys: ['C'], modes: ['Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'] },
];

/**
 * @typedef {{ id: string, dir: string, key: string, mode: string, interval: number,
 *   type: string, position: string, keySignature: { name: string, fifths: number },
 *   notes: { midi: number, fret: number, string: number }[] }} Exercise
 * @typedef {{ key: string, mode: string, reason: string, suggestion: string|null }} Skip
 */

function resolveTargets({ keys, modes }) {
  if (keys?.length || modes?.length) {
    return [{ keys: keys?.length ? keys : NATURAL_KEYS, modes: modes?.length ? modes : ['Ionian'] }];
  }
  return DEFAULT_TARGETS;
}

/**
 * @param {{ keys?: string[], modes?: string[], types?: string[] }} [selection]
 * @returns {{ exercises: Exercise[], skipped: Skip[] }}
 */
export function buildPlan({ keys, modes, types } = {}) {
  const typeList = types?.length ? types : TYPE_NAMES;
  for (const t of typeList) {
    if (!TYPES[t]) throw new Error(`未知类型 "${t}"；可用：${TYPE_NAMES.join(', ')}`);
  }

  const exercises = [];
  const skipped = [];

  for (const target of resolveTargets({ keys, modes })) {
    for (const keyName of target.keys) {
      const tonic = parseKey(keyName);
      for (const mode of target.modes) {
        if (!MODES[mode]) throw new Error(`未知调式 "${mode}"；可用：${MODE_NAMES.join(', ')}`);

        let keySignature;
        try {
          keySignature = keySignatureFor(tonic, mode);
        } catch (err) {
          if (err.code !== 'KEY_SIG_OUT_OF_RANGE') throw err;
          skipped.push({ key: keyName, mode, reason: err.message, suggestion: err.suggestion });
          continue;
        }

        const { chain } = buildChain(tonic.pc, MODES[mode]);
        const byPos = new Map(chain.map((p) => [p.id, p.notes]));

        for (let interval = 2; interval <= 8; interval++) {
          for (const type of typeList) {
            const spec = TYPES[type];
            for (const slot of spec.slots(chain)) {
              exercises.push({
                id: spec.name(keyName, mode, interval, slot.id),
                dir: `${keyName}-${mode}`,
                key: keyName,
                mode,
                interval,
                type,
                position: slot.id,
                keySignature,
                notes: spec.notes(byPos, slot, interval),
              });
            }
          }
        }
      }
    }
  }

  return { exercises, skipped };
}
