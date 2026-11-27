# guitarGenTool 重构设计：可移植、可扩展的练习生成器

- 状态：待批准
- 日期：2026-11-27
- 对应决策：2026-11-27 讨论（方案 1 + 入库插件 + P2 不出图）

## 1. 意图与动机

当前仓库能跑，但只在这台机器、这个目录、且兄弟仓库 `../guitarTexTool` 完好的前提下能跑。要长期维护并继续加料，必须先拆掉三根柱子：

1. **绝对路径走私仓**：5 个脚本 `import` 写死 `/home/zzx604/work/guitarTexTool/...`（`node_modules/@coderline/alphatab`、`playwright-core`、`shared/dist/index.js`）。
2. **期望值逻辑复制 5 份**：`generate` / `manifest` / `validate-all` / `pnglint` / `validate-t1-keys` 各自 `buildChain` + 循环 `i2..i8`，加一个类型要改 5 处。
3. **扩展点硬编码**：主音是白键白名单、调号靠名字查表、类型是 `if (type === 'T1') else`。

目标状态：**任何机器上 `git clone && npm i` 就能生成、校验、出清单**；加升号/降号主音不加代码；加 T3 只加一个文件；入库作为可选插件，缺失时主流程照常工作。

## 2. 目标 / 非目标 / 反目标

### 目标

- G1 12 个主音（含 `C# D# F# G# A# Db Eb Gb Ab Bb`）都可作为输入，调号由五度圈推导；推导结果超出 alphaTab 合法范围（±7）的**组合**明确拒绝并提示等音主音，绝不静默产出错误谱面。
- G2 类型（T1/T2/T3…）通过注册表扩展：**新增类型只改 `src/types/t3.mjs` + 注册一行**。
- G3 零外部仓库依赖：不读 `guitarTexTool` 的任何源码、`node_modules`、`shared/dist`。
- G4 换目录、换机器可跑：依赖由 `package.json` 声明，路径全部相对 `import.meta.url` 或 CLI 参数。
- G5 行为不变：现有 1253 个 `.atex` 重新生成后**逐字节一致**。
- G6 入库能力保留为插件，只依赖一个 `alphatex.db` 路径。

### 非目标

- N1 不出 PNG，不做任何浏览器/无头渲染。
- N2 不做 Web UI / HTTP 服务。
- N3 不改乐理规则本身（把位链、iN/sN、pivot 判定一律照 SPEC 现状）。
- N4 不定义 T3（`SPEC.md` 4.3 由用户补，本轮只把插槽留好）。
- N5 不做多调弦体系（标准调弦保留常量，但抽成独立模块，以后可换）。
- N6 不迁移历史一次性任务（`update-db-instrument.mjs` 删掉，它的使命已完成）。

### 反目标（做到这样就算失败）

- A1 任一 `.atex` 的音符、弦品、调号、标题与现在不同。
- A2 主流程（generate/validate/manifest）仍需要 `guitarTexTool` 目录存在。
- A3 加一个调式或一个类型仍需改 3 个以上文件。
- A4 校验能力变弱：不再用 alphaTab 真实解析、逐音比对。

## 3. 约束

- Node `>= 22`（`node:sqlite` 用于入库插件；`engines` 显式声明）。当前机器 v24.21.0。
- alphaTab 锁 `1.9.x`（SPEC 的解析基线），只作 `devDependency`，且**只有 validate 用**。
- 标准调弦；`MAX_HIGH_FRET = 19` 保留为常量。
- npm 可用（已验证 `npm ping` 通）。
- 产物目录与代码目录分离。

## 4. 已考虑的方案

### 4.1 仓库边界

| 方案 | 内容 | 取舍 | 结论 |
|---|---|---|---|
| 1 纯生成器 | 本仓只产 `.atex` + `manifest.json`，入库/出图外移 | 边界干净、依赖最少；失去 PNG | **采纳** |
| 2 内核 + bridges | 出图/入库放 `bridges/`，仍依赖 textool | 能力不丢，但绝对路径与 282M chromium 留在仓里，“不依赖”名不副实 | 否 |
| 3 零依赖 | 连 alphaTab 也不要，按 theory 比对文本 | 丢掉真实解析防线（A4） | 否 |

### 4.2 出图

| 方案 | 取舍 | 结论 |
|---|---|---|
| P1 做成默认不装的插件 | 留门、删 282M | 否 |
| **P2 彻底不要** | 删 `export-png.mjs` / `pnglint.mjs` / `export-all.sh` 与 `.tools/` | **采纳（已执行）** |
| P3 插件 + 保留 295M | 开箱即用，体积与可移植冲突 | 否 |

### 4.3 入库

| 方案 | 取舍 | 结论 |
|---|---|---|
| 留在主流程 | 主流程被 DB 与外部源码拖住 | 否 |
| **插件（`plugins/import-textool/`）** | 主流程零影响；插件只认 `--db` | **采纳** |
| 完全删除 | 丢能力 | 否 |

## 5. 目标结构

```
guitarGenTool/
├── package.json            # type:module, engines>=22, bin, scripts, devDep: @coderline/alphatab
├── package-lock.json
├── .gitignore              # dist/  node_modules/
├── README.md               # 重写：用法/结构/扩展指南
├── SPEC.md                 # 保留为唯一规格源；补"如何加类型/加主音"
├── docs/
│   ├── design/optimizations/   # 历史设计稿，原样保留
│   ├── ref/
│   └── superpowers/specs/      # 本文件
├── src/
│   ├── cli.mjs             # 唯一入口
│   ├── plan.mjs            # 唯一真源：练习清单
│   ├── generate.mjs        # plan -> .atex
│   ├── validate.mjs        # plan -> alphaTab 逐音比对
│   ├── manifest.mjs        # plan -> dist/manifest.json (+ MANIFEST.md)
│   ├── plugins.mjs         # 插件加载器
│   ├── core/
│   │   ├── tuning.mjs      # STRINGS
│   │   ├── modes.mjs       # MODES + 相对大调偏移
│   │   ├── keys.mjs        # 12 主音解析、五度圈、\ks 拼写
│   │   ├── scale.mjs       # buildScale
│   │   ├── positions.mjs   # buildPosition / 把位链 / pivot
│   │   └── sequences.mjs   # stepFor, 音型基元
│   ├── types/
│   │   ├── index.mjs       # 注册表
│   │   ├── t1.mjs
│   │   └── t2.mjs          # t3.mjs 待 SPEC 4.3
│   └── render/
│       └── alphatex.mjs    # renderAlphaTex
├── plugins/
│   └── import-textool/
│       ├── index.mjs       # 契约实现
│       └── README.md       # 外部前置条件
└── dist/                   # 产物，git 忽略
    ├── <Key>-<Mode>/*.atex
    └── manifest.json
```

### 5.1 核心不变式：`plan` 是唯一真源

`src/plan.mjs` 导出：

```js
buildPlan({ keys, modes, types }) // -> [{ id, dir, key, mode, interval, type, position, notes }]
buildPlan()                       // 三者都省略时，用 DEFAULT_TARGETS（见 5.4）
```

`generate` 只负责写文件，`validate` 只负责比对，`manifest` 只负责汇总。三者都不再各算一遍期望值。这是消灭 5 份重复的**唯一手段**，不是可选项。

### 5.2 类型注册表（G2 的实现）

```js
// src/types/index.mjs
export const TYPES = {
  T1: {
    label: '同把位上下行',
    slots: (chain) => chain.map((p) => ({ id: p.id, from: [p.id] })),
    name: (k, m, i, s) => `${k}-${m}-i${i}-${s}-T1`,
    notes: (byPos, slot, i) => t1.build(byPos.get(slot.from[0]), i),
  },
  T2: { label: '相邻把位上下行', slots: t2.slots, name: t2.name, notes: t2.notes },
};
```

约定：`slots` 决定“一条 type 在一组把位上产生几个练习/叫什么”，`notes` 决定音符序列，`label` 决定副标题。新增 T3 时**不得**改动 `plan/generate/validate/manifest/render` 中任何 `if type ===` 分支——这些分支必须已经不存在。

### 5.3 调号推导（G1 的实现）

**事实前提（2026-11-27 用 alphaTab 1.9.0 实测）**：`\ks` 的合法范围是 `-7..+7`。`Cb`(=-7)、`C#`(=+7) 通过；`G#`、`D#`、`A#` 直接解析失败。

- 主音输入解析为 `{ pc, spelling }`，接受 `C`、`C#`、`Db`、`Bb` 等形式；非法输入报错并列出合法集合。
- 相对大调 pc = `(tonicPc + MODE_RELATIVE_MAJOR_OFFSET[mode]) % 12`（现有常量保留）。
- 15 个合法调号及其五度圈值：`Cb -7, Gb -6, Db -5, Ab -4, Eb -3, Bb -2, F -1, C 0, G 1, D 2, A 3, E 4, B 5, F# 6, C# 7`。
- 拼写选择：同一 pc 有升/降两种拼写时，**按主音自身的升降号倾向定**（主音用降号 → 相对大调取降号名；否则取升号名）。
- **超出 ±7 即拒绝**（决策 2-B）：该 `(key, mode)` 组合整组跳过，不写任何文件，打印
  `SKIP G# Ionian: 调号需要 8 个升号（alphaTab 上限 7）；请改用等音主音 Ab`。
  `generate` 的退出码：有跳过但其余成功 → `0`；全部被拒 → 非 `0`。
- `validate` 用同一套推导，被拒组合**不产生期望值**，因此不会误报“缺文件”。
- 拒绝是**双向**的，且按组合判定，不是按主音：
  - 升号侧越界：`G# Ionian`(8 升)、`D# Ionian`(9 升)、`A# Ionian`(10 升)；
  - 降号侧越界：`Gb Dorian`（需 `Fb`，8 降，等音 `F#` 合法）；
  - 同一主音换个调式通常就合法：`G# Dorian` 的相对大调是 `F#`（6 升），`Gb Ionian` 是 `Gb`（6 降）。
- 现有 84 行附录表保留在 SPEC 作为**校验用的期望值**，但代码不再读它。

### 5.4 CLI

```
node src/cli.mjs generate  [--keys C,C#,Db] [--modes Ionian,Dorian] [--types T1,T2] [--out dist] [--dry-run]
node src/cli.mjs validate  [--keys ...] [--modes ...] [--types ...] [--sample N] [--root dist]
node src/cli.mjs manifest  [--out dist/manifest.json] [--md MANIFEST.md]
node src/cli.mjs plugins
node src/cli.mjs import --db <path> --user <name> [--dry-run] --json <report.json>
node src/cli.mjs --help
```

- 旧的 `generate.mjs key C` / `key C,D` 子命令**不保留**，README 一次性更新。
- `--sample N` 承接 `gate-modes.mjs` 的门禁用途（每模式先校验 N 条）。
- 未安装/未配置插件时，`import` 报“插件未配置 + 需要什么”，退出码非 0，但**不影响**前三命令。

#### 默认目标集（决策 1-A）

不传 `--keys` / `--modes` 时，生成**与现状等价的 1253 条**，即"7 个自然音 × Ionian" ∪ "C × 6 调式"。这不是笛卡尔积，必须显式声明：

```js
// src/plan.mjs
export const DEFAULT_TARGETS = [
  { keys: ['C','D','E','F','G','A','B'], modes: ['Ionian'] },
  { keys: ['C'], modes: ['Dorian','Phrygian','Lydian','Mixolydian','Aeolian','Locrian'] },
];
```

显式传入 `--keys` 或 `--modes` 时，按传入值做笛卡尔积，`DEFAULT_TARGETS` 不参与。
因此在默认参数下，第 7 节“1253 条逐字节一致”是一条可执行的红线；12 主音属于**显式触发**能力。

### 5.5 插件契约

```js
export default {
  name: 'import-textool',
  command: 'import',
  describe: '把 dist/ 下的练习写入 guitarTexTool 的 SQLite 库',
  options: [{ flag: '--db', required: true, help: 'alphatex.db 路径' }],
  async run(ctx) { /* ctx: { plan, root, argv, log } */ },
};
```

加载器 `src/plugins.mjs`：`readdir('plugins')` → 逐个 `import()`；**单个插件加载失败只告警，不中断 CLI**。插件目录不得被 `src/` 反向引用。

### 5.6 入库插件（G6 的实现）

- 只用 `node:sqlite`，不引入第三方包。
- 只认 `--db <path>`；不 import `guitarTexTool` 的 `shared/dist`。`extractScoreMeta` / `slugify` 在插件内本地实现（解析 `\title` / `\subtitle` / 标题 slug，约 20 行）。
- 幂等键沿用 `(owner_id, content_hash)`；`content_hash` 可用 `manifest.json` 里已算好的 `sha256`。
- 用户名不存在、表不存在、DB 不存在 → 明确报错并给出下一步，绝不建库建用户。

### 5.7 `dist/manifest.json`

```json
{
  "schemaVersion": 1,
  "generatedAt": "ISO8601",
  "tool": { "name": "guitarGenTool", "version": "x.y.z" },
  "totals": { "exercises": 1253, "byType": {...}, "byDir": {...} },
  "exercises": [
    { "id": "...", "dir": "C-Ionian", "key": "C", "mode": "Ionian", "interval": 3,
      "type": "T1", "position": "P1", "frets": "5-8", "notes": 64, "bars": 8,
      "keySignature": "C", "file": "C-Ionian/xxx.atex", "sha256": "..." }
  ]
}
```

## 6. 旧文件去向（一个都不能丢）

| 旧文件 | 新归属 |
|---|---|
| `theory.mjs` | 拆入 `src/core/*` + `src/render/alphatex.mjs` |
| `generate.mjs` | `src/plan.mjs` + `src/generate.mjs` + `src/cli.mjs` |
| `validate-all.mjs` | `src/validate.mjs`（主校验，能力不减） |
| `validate.mjs` | 删除（已被 `validate --keys C --modes Ionian` 覆盖） |
| `validate-t1-keys.mjs` | 删除（能力被 `validate` 覆盖，其抽查值并入第 7 节回归） |
| `gate-modes.mjs` | 删除，能力改为 `validate --sample N` |
| `manifest.mjs` | `src/manifest.mjs` |
| `import-atex.mjs` | `plugins/import-textool/index.mjs` |
| `update-db-instrument.mjs` | 删除（一次性历史任务，已完成） |
| `export-png / pnglint / export-all` | 已删除（P2） |
| `.tools/` | 已删除 |
| 13 个调式目录 | 移入 `dist/`，作为逐字节回归基线 |

## 7. 验收标准

1. `npm i && node src/cli.mjs generate`（**不带任何参数**，走 `DEFAULT_TARGETS`）在 `dist/` 里重生 **1253 个文件**，与迁移前逐字节 `diff -r` **0 差异**（红线，A1 / 决策 1-A）。
2. `node src/cli.mjs validate` 全绿：0 解析错误、0 音符不一致、0 缺失（A4）。
3. 把仓库 `cp -r` 到 `/tmp/xxx` 后，三条命令仍全绿（G4，无绝对路径残留）。
4. `grep -rn "/home/zzx604" src/ plugins/` 无结果（G3）。
5. 在 `plugins/` 为空的情况下，`generate/validate/manifest` 全绿（G6 的隔离性）。
6. 新增 T3 的模拟验证：临时注册一个 T3 stub，**只改 `src/types/`** 即可让 generate/validate/manifest 全部识别（A3）。
7. 12 主音与拒绝语义（G1 / 决策 2-B）：
   - 合法样例：`generate --keys C#,Db,B --modes Dorian` 的 `\ks` 依次为 `B`(5 升)、`Cb`(7 降)、`A`(3 升)；
     `generate --keys Gb --modes Ionian` 的 `\ks` 为 `Gb`(6 降)；
   - 拒绝样例：`generate --keys G# --modes Ionian` 打印 `SKIP G# Ionian: 需 8 个升号…请改用等音主音 Ab`，**不写任何文件**，退出码 `0`；
     `generate --keys Gb --modes Dorian` 同样被拒，提示等音主音 `F#`；
   - 对上述被拒组合执行 `validate` 不报“缺文件”。

## 8. 留给实施者的判断

- 包名、`version` 起始值、`bin` 别名（建议 `ggt`）。
- ~~`@coderline/alphatab` 的导入路径~~ **已核实（2026-11-27）**：`@coderline/alphatab@1.9.0` 的 `exports["."].import = ./dist/alphaTab.mjs`，直接用裸包名 `import * as at from '@coderline/alphatab'` 即可，不需要子路径。
- 是否加最小测试（建议 `node --test`，覆盖 `core/keys` 五度圈与 T1/T2 序列长度）。
- git 初始化、首次提交范围（建议：代码 + 文档 + 产物），`dist/` 忽略但迁移时先移入再验证。
- `MANIFEST.md` 是否继续产出（建议继续，作为人读版，放 `dist/` 或根目录由实施者定）。

## 9. 风险

- **调号拼写/越界**是唯一容易出错的乐理点：`Gb` 与 `F#` 同 pc，且 `G#/D#/A#` 会推出 8+ 个升降号。缓解：五度圈表驱动 + 拒绝语义（决策 2-B）+ 用 SPEC 附录 B 的 84 组结果做回归。
- 逐字节回归依赖“渲染顺序与文件写入顺序”不变；`plan` 的遍历顺序必须与旧 `generate` 一致（key → mode → interval → chain 顺序 → T1 先于 T2）。
- alphaTab 1.9 的小版本差异可能影响解析结果；锁版本并在 README 写明。
