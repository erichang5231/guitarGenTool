/**
 * Optional capability loader.
 *
 * Each directory under `plugins/` exports a default object:
 *   { name, command, describe, options, run(ctx) }
 * A plugin that fails to load only warns; the core commands never depend on one.
 */
import { readdir } from 'node:fs/promises';
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
  const { exercises } = buildPlan();
  return plugin.run({ flags, root, exercises, log: console.log });
}
