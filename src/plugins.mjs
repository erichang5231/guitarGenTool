/**
 * Optional capability loader.
 *
 * Each directory under `plugins/` exports a default object:
 *   { name, command, describe, options, run(ctx) }
 * A plugin that fails to load only warns; the core commands never depend on one.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPlan } from './plan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGINS_DIR = path.resolve(HERE, '..', 'plugins');

export async function loadPlugins(dir = PLUGINS_DIR) {
  const plugins = new Map();
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return plugins;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const mod = await import(pathToFileURL(path.join(dir, entry.name, 'index.mjs')).href);
      const plugin = mod.default;
      if (!plugin?.command || typeof plugin.run !== 'function') {
        console.warn(`plugin ${entry.name}: 缺少 command/run，已跳过`);
        continue;
      }
      plugins.set(plugin.command, plugin);
    } catch (err) {
      console.warn(`plugin ${entry.name} 加载失败：${err.message}`);
    }
  }
  return plugins;
}

/**
 * What to import: whatever `--root` actually holds. The manifest written by
 * `generate` is the authority; only when it is absent do we fall back to the
 * default plan.
 */
async function exercisesFrom(root) {
  try {
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    if (Array.isArray(manifest.exercises) && manifest.exercises.length) {
      return manifest.exercises.map((e) => ({ id: e.id, dir: e.dir }));
    }
  } catch { /* no manifest: fall through to the default plan */ }
  return buildPlan().exercises;
}

/**
 * Run the plugin that owns the `import` command.
 * @param {Record<string, unknown>} flags
 * @param {{ root: string }} ctx
 */
export async function runImportCommand(flags, { root }) {
  const plugins = await loadPlugins();
  const plugin = plugins.get('import');
  if (!plugin) {
    console.error('import 插件未安装：需要在 plugins/ 下提供一个 command="import" 的插件');
    return 3;
  }
  const exercises = await exercisesFrom(root);
  return plugin.run({ flags, root, exercises, log: console.log });
}
