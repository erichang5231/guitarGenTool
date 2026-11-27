#!/usr/bin/env node
/**
 * Single entry point. Exit codes are part of the contract:
 *   0 success, 1 nothing produced / validation failed, 2 bad arguments,
 *   3 missing dependency or unconfigured plugin.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlan } from './plan.mjs';
import { TYPE_NAMES } from './types/index.mjs';
import { writePlan } from './generate.mjs';
import { buildManifest, writeManifest } from './manifest.mjs';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const HERE = path.resolve(SRC, '..');

const USAGE = `guitarGenTool — 吉他指板模进练习生成器

用法:
  node src/cli.mjs generate  [--keys C,C#,Db] [--modes Ionian,Dorian] [--types T1,T2] [--out dist] [--dry-run]
  node src/cli.mjs validate  [--root dist] [--keys ...] [--modes ...] [--types ...] [--sample N]
  node src/cli.mjs manifest  [--root dist] [--out dist/manifest.json]
  node src/cli.mjs import    --db <path> --user <name> [--root dist] [--dry-run]
  node src/cli.mjs plugins
  node src/cli.mjs --help

不带 --keys/--modes 时生成默认的 1253 条练习（7 个自然音 Ionian + C 调 6 种调式）。`;

class UsageError extends Error {}

const BOOLEAN_FLAGS = new Set(['dry-run', 'help', 'force']);

function parseArgv(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h') { flags.help = true; continue; }
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (BOOLEAN_FLAGS.has(name)) { flags[name] = true; continue; }
      const value = argv[++i];
      if (value === undefined) throw new UsageError(`--${name} 需要一个值`);
      flags[name] = value;
      continue;
    }
    positional.push(arg);
  }
  return { flags, positional };
}

const splitList = (value) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

function selection(flags) {
  return {
    keys: splitList(flags.keys),
    modes: splitList(flags.modes),
    types: splitList(flags.types),
  };
}

function announceSkips(skipped) {
  for (const s of skipped) console.log(`SKIP ${s.reason}`);
}

async function runGenerate(flags) {
  const { exercises, skipped } = buildPlan(selection(flags));
  announceSkips(skipped);

  if (exercises.length === 0) {
    console.error('没有任何练习可以生成（全部组合被拒绝）');
    return 1;
  }

  const outRoot = path.resolve(HERE, flags.out ?? 'dist');
  if (flags['dry-run']) {
    console.log(`planned=${exercises.length} skipped=${skipped.length} out=${outRoot}`);
    return 0;
  }

  const { written } = await writePlan(exercises, outRoot);
  const manifest = await buildManifest(exercises, outRoot);
  await writeManifest(manifest, {
    jsonPath: path.join(outRoot, 'manifest.json'),
    mdPath: path.join(outRoot, 'MANIFEST.md'),
  });
  console.log(`written=${written} skipped=${skipped.length} out=${outRoot}`);
  return 0;
}

async function runValidate(flags) {
  const { validatePlan } = await import('./validate.mjs');
  const { exercises } = buildPlan(selection(flags));
  const root = path.resolve(HERE, flags.root ?? 'dist');

  let selected = exercises;
  if (flags.sample) {
    const limit = Number(flags.sample);
    const seen = new Map();
    selected = exercises.filter((e) => {
      const n = seen.get(e.dir) ?? 0;
      if (n >= limit) return false;
      seen.set(e.dir, n + 1);
      return true;
    });
  }

  const { groups, totals } = await validatePlan(selected, root);
  for (const g of groups) {
    console.log(`${g.dir}: ${g.found}/${g.expected} files, errors=${g.errors.length}`);
    for (const e of g.errors.slice(0, 3)) console.log('  ' + e);
  }
  console.log(`TOTAL files=${totals.files} errors=${totals.errors}`);
  return totals.errors ? 1 : 0;
}

async function runManifest(flags) {
  const { exercises } = buildPlan(selection(flags));
  const root = path.resolve(HERE, flags.root ?? 'dist');
  const jsonPath = path.resolve(HERE, flags.out ?? path.join(root, 'manifest.json'));
  const manifest = await buildManifest(exercises, root);
  await writeManifest(manifest, { jsonPath, mdPath: jsonPath.replace(/\.json$/, '.md') });
  console.log(`wrote ${jsonPath} (${manifest.totals.exercises} exercises)`);
  return 0;
}

async function runImport(flags) {
  const { runImportCommand } = await import('./plugins.mjs');
  return runImportCommand(flags, { root: path.resolve(HERE, flags.root ?? 'dist') });
}

async function main(argv) {
  const { flags, positional } = parseArgv(argv);
  if (flags.help || positional.length === 0) {
    console.log(USAGE);
    return 0;
  }
  const [command] = positional;
  switch (command) {
    case 'generate': return runGenerate(flags);
    case 'validate': return runValidate(flags);
    case 'manifest': return runManifest(flags);
    case 'import': return runImport(flags);
    case 'plugins': console.log(TYPE_NAMES.map((t) => `type ${t}`).join('\n')); return 0;
    default: throw new UsageError(`未知命令 "${command}"；可用：generate, validate, manifest, import, plugins`);
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (err) {
  if (err instanceof UsageError) {
    console.error(err.message);
    process.exitCode = 2;
  } else {
    console.error(err.message ?? String(err));
    process.exitCode = err.code === 'DEP_MISSING' ? 3 : 2;
  }
}
