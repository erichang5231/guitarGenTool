# import-textool

可选插件：把本仓库生成的 `.atex` 写入 guitarTexTool 的曲谱库。

## 前置条件

- 一个已初始化过的 `alphatex.db`（含 `tabs` / `users` / `tab_tags` 表）。
- 目标用户已存在（插件不会建用户，也不会建表）。
- 不需要 guitarTexTool 的源码或 `node_modules`。

## 用法

```bash
node src/cli.mjs generate                       # 先产出 dist/
node src/cli.mjs import --db /path/to/alphatex.db --user <用户名>
node src/cli.mjs import --db ... --user ... --dry-run
```

参数：

| 参数 | 说明 |
|---|---|
| `--db` | `alphatex.db` 路径（必填） |
| `--user` | 曲谱归属用户名（必填，必须已存在） |
| `--root` | 产物目录，默认 `dist` |
| `--dry-run` | 只统计，不动数据库 |
| `--json` | 写一份导入报告 |

## 语义

- 幂等键：`(owner_id, content_hash)`。同一份内容重复导入会被跳过。
- 标签：`guitarGenTool` + 所在目录名（如 `C-Dorian`）。
- 标题/副标题从 `\title` / `\subtitle` 解析。
- 退出码：`0` 全部成功、`1` 有失败文件、`2` 参数缺失、`3` 数据库或用户不可用。
