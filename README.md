# 吉他指板模进练习生成器

把乐理规格（[SPEC.md](SPEC.md)）编译成 alphaTab 1.9 的 `.atex` 练习：3NPS 把位、pivot 链、i2–i8 模进、T1/T2 两种走向。

- 当前产物：**1253 个 `.atex`**（7 个自然音 Ionian + C 调 6 种调式），全部通过 alphaTab 逐音校验。
- 可移植：`npm install` 后在任何目录、任何机器都能跑；不依赖其它仓库。
- 可扩展：12 个主音随取随用；加一种练习类型（如 T3）只需新增一个文件。

## 快速开始

```bash
npm install                       # 只装一个 devDependency（校验用的 alphaTab）

node src/cli.mjs generate         # 产出 dist/<Key>-<Mode>/*.atex + dist/manifest.json
node src/cli.mjs validate         # 用 alphaTab 解析并逐音比对，期望 errors=0
node src/cli.mjs manifest         # 只刷新清单
```

`dist/` 是生成物，已被 git 忽略；随时可以删掉重新生成。

## 目录结构

```
src/
  cli.mjs              唯一入口，退出码契约见文件头
  plan.mjs             唯一真源：所有练习的 id / 音符序列 / 调号
  generate.mjs         plan -> .atex
  validate.mjs         plan <-> .atex 逐音比对（仅此命令需要 alphaTab）
  manifest.mjs         plan -> manifest.json + MANIFEST.md
  plugins.mjs          可选插件加载器
  core/                乐理与把位：tuning / modes / keys / scale / positions / sequences
  types/               练习类型注册表：t1.mjs / t2.mjs / index.mjs
  render/alphatex.mjs  文本渲染（不含任何类型分支）
plugins/import-textool/  可选：把产物写入 guitarTexTool 的 SQLite 库
test/                  node --test 用例
dist/                  产物（git 忽略）
```

**核心不变式**：`plan.mjs` 是唯一真源。generate / validate / manifest 都从同一份 plan 派生，所以"生成了但没被校验到"这类漂移在结构上不可能发生。

## 命令参考

```bash
node src/cli.mjs generate [--keys C,C#,Db] [--modes Ionian,Dorian] [--types T1,T2]
                          [--out dist] [--dry-run]
node src/cli.mjs validate [--root dist] [--keys ...] [--modes ...] [--types ...] [--sample N]
node src/cli.mjs manifest [--root dist] [--out dist/manifest.json]
node src/cli.mjs import   --db <alphatex.db> --user <name> [--root dist] [--dry-run] [--json <path>]
node src/cli.mjs plugins
```

退出码：`0` 成功、`1` 全部组合被拒或校验失败、`2` 参数错误、`3` 依赖或插件不可用。

不带 `--keys` / `--modes` 时生成默认的 1253 条（7 个自然音 × Ionian，加 C × 6 种调式）。显式传入时按笛卡尔积生成；只给 `--keys` 时调式默认 Ionian。

## 扩展

### 加一个主音

不需要改代码。12 个主音都可用，`--keys C#`、`--keys Db`、`--keys F#` 等直接生效。

调号按五度圈推导，**超出 ±7 的组合会被拒绝**并提示等音主音：

```bash
$ node src/cli.mjs generate --keys G# --modes Ionian --dry-run
SKIP G# Ionian: 调号需要 8 个升号（alphaTab 上限 7）；请改用等音主音 Ab
```

拒绝是按（主音, 调式）组合判定的：`G# Ionian` 不行，但 `G# Dorian`（相对大调 F#，6 升）可以。

### 加一种练习类型（T3）

只动 `src/types/` 一个目录：

1. 新建 `src/types/t3.mjs`，导出 `label` / `slots` / `name` / `notes` 四项（照 `t1.mjs` 抄结构）。
2. 在 `src/types/index.mjs` 的 `TYPES` 里加一行。

之后 generate / validate / manifest 会自动识别 T3，不需要改其它文件——测试里有一条用例专门守这个约束。

### 加一种调式

在 `src/core/modes.mjs` 的 `MODES` 里加半音数组，并给 `MODE_RELATIVE_MAJOR_OFFSET`（相对大调偏移）和 `keys.mjs` 的 `MODE_LETTER_SHIFT`（音名距离）各补一项。后者决定调号怎么拼写，写错会产出错误的 `\ks`。

## 入库（可选插件）

`plugins/import-textool/` 把产物写进 guitarTexTool 的曲谱库。它只认 `--db` 指向的 SQLite 文件，不 import 该项目的任何代码：

```bash
node src/cli.mjs import --db /path/to/alphatex.db --user zzx605
```

幂等键 `(owner_id, content_hash)`，重复导入会跳过。详见 [plugins/import-textool/README.md](plugins/import-textool/README.md)。

插件是可选的：`plugins/` 为空时，前三命令照常工作。

## 开发

```bash
npm test        # node --test，52 个用例
```

测试覆盖：把位链不变量、调号推导与越界拒绝、序列基元、类型注册表、CLI 退出码、**1253 文件逐字节回归**、插件幂等。

## 与 v1 的差异

| v1 | v2 |
|---|---|
| 5 个脚本 `import` 兄弟仓库的绝对路径 | 零外部仓库依赖，`npm i` 即用 |
| 期望值逻辑复制 5 份 | `plan.mjs` 一份 |
| `if (type === 'T1')` 分支散落各处 | 类型注册表 |
| 主音写死 7 个白键，调号查名字表 | 12 主音，五度圈推导 |
| 产物与代码同层，无版本控制 | `dist/` 分离，git 管理 |
| 附带 PNG 导出（295M chromium） | 移除 |

乐理规则本身没有变化：1253 个文件重新生成后与 v1 **逐字节一致**。
