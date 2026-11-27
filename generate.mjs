#!/usr/bin/env node
/**
 * Generate alphaTex scale-sequence exercises for Ionian and the other modes.
 *
 * Usage:
 *   node generate.mjs sample                  # C-Ionian-i3-P1-T1 only
 *   node generate.mjs key C                   # one key, Ionian
 *   node generate.mjs mode Dorian             # one mode, all natural keys
 *   node generate.mjs modes Dorian,Aeolian    # several modes, all natural keys
 *   node generate.mjs all                     # all natural keys x Ionian (legacy)
 *
 * Options:
 *   --root <dir>    output root (default: this directory)
 *   --key C         restrict to one tonic (natural-note tonics only)
 *   --mode Dorian   mode name (default: Ionian)
 *   --dry-run       print counts without writing
 *
 * Files are written flat to <root>/<Key>-<Mode>/<exercise-id>.atex.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NATURAL_KEY_PCS, NATURAL_KEYS, MODES, MODE_NAMES,
  buildChain, t2Pairs, t1, t2, renderAlphaTex, keySignatureFor,
} from './theory.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

let outRootArg = '.';
let keyFilter = null;
let modeFilter = null;
let dryRun = false;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--root') { outRootArg = argv[++i]; continue; }
  if (a === '--key') { keyFilter = argv[++i]; continue; }
  if (a === '--mode') { modeFilter = argv[++i]; continue; }
  if (a === '--dry-run') { dryRun = true; continue; }
  if (a.startsWith('--')) continue;
  positional.push(a);
}
const outRoot = path.resolve(ROOT, outRootArg);
const command = positional[0] ?? 'sample';

function parseList(value) {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function resolveModes(tokens) {
  const list = tokens && tokens.length ? tokens : (modeFilter ? [modeFilter] : ['Ionian']);
  for (const m of list) if (!MODES[m]) throw new Error('unknown mode: ' + m + ' (expected ' + MODE_NAMES.join('/') + ')');
  return list;
}

function resolveKeys() {
  if (!keyFilter) return NATURAL_KEYS;
  if (!Object.prototype.hasOwnProperty.call(NATURAL_KEY_PCS, keyFilter)) {
    throw new Error('unsupported key (natural-note tonics only): ' + keyFilter);
  }
  return [keyFilter];
}

async function writeExercise(keyName, modeName, { id, interval, type, notes, positionLabel }) {
  const dir = path.join(outRoot, keyName + '-' + modeName);
  const file = path.join(dir, id + '.atex');
  if (dryRun) return file;
  await mkdir(dir, { recursive: true });
  const content = renderAlphaTex({
    keyName, modeName, id, interval, type, notes, positionLabel,
    keySignature: keySignatureFor(NATURAL_KEY_PCS[keyName], modeName),
  });
  await writeFile(file, content, 'utf8');
  return file;
}

async function generateKeyMode(keyName, modeName) {
  const intervals = MODES[modeName];
  const { chain } = buildChain(NATURAL_KEY_PCS[keyName], intervals);
  const pairs = t2Pairs(chain);
  const byId = new Map(chain.map((p) => [p.id, p.notes]));
  const prefix = keyName + '-' + modeName;
  let n = 0;
  for (let interval = 2; interval <= 8; interval++) {
    for (const position of chain) {
      await writeExercise(keyName, modeName, {
        id: prefix + '-i' + interval + '-' + position.id + '-T1',
        interval, type: 'T1', notes: t1(position.notes, interval), positionLabel: position.id,
      });
      n++;
    }
    for (const [aId, bId] of pairs) {
      await writeExercise(keyName, modeName, {
        id: prefix + '-i' + interval + '-' + aId + '_' + bId + '-T2',
        interval, type: 'T2',
        notes: t2(byId.get(aId), byId.get(bId), interval),
        positionLabel: aId + '_' + bId,
      });
      n++;
    }
  }
  return n;
}

if (command === 'sample') {
  const chain = buildChain(NATURAL_KEY_PCS.C).chain;
  const p1 = chain.find((p) => p.id === 'P1').notes;
  const file = await writeExercise('C', 'Ionian', {
    id: 'C-Ionian-i3-P1-T1', interval: 3, type: 'T1', notes: t1(p1, 3), positionLabel: 'P1',
  });
  console.log(file);
} else if (command === 'all') {
  for (const keyName of resolveKeys()) {
    console.log(keyName + '-Ionian: ' + (await generateKeyMode(keyName, 'Ionian')) + ' files');
  }
} else if (command === 'key' || command === 'keys') {
  const keys = parseList(positional.slice(1).join(','));
  if (!keys.length) throw new Error('no keys given');
  const modes = resolveModes(null);
  for (const keyName of keys) {
    for (const modeName of modes) {
      console.log(keyName + '-' + modeName + ': ' + (await generateKeyMode(keyName, modeName)) + ' files');
    }
  }
} else if (command === 'mode' || command === 'modes') {
  const modes = resolveModes(parseList(positional.slice(1).join(',')));
  for (const modeName of modes) {
    for (const keyName of resolveKeys()) {
      console.log(keyName + '-' + modeName + ': ' + (await generateKeyMode(keyName, modeName)) + ' files');
    }
  }
} else {
  console.error('unknown command: ' + command);
  process.exit(1);
}
