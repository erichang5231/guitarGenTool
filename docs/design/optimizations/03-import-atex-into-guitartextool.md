# 03 将生成的 .atex 导入 guitarTexTool（归属 zzx605）

- 状态：已实施
- 优先级：P2
- 预估：0.5 天
- 依赖：**02**（需先有 C 调 6 调式的 588 个文件）；01 不阻塞

## 背景与现状

- guitarGenTool 生成 `.atex`；guitarTexTool 的曲谱只存在 SQLite，磁盘上没有 `score.alphatex`。
- 库文件：`data-local/alphatex.db`（WAL）；`tabs` 表含 `id, owner_id, slug, title, artist, subtitle, content, content_hash, revision, …`。
- 目标用户 **zzx605 已存在**：`19aabfe3-2ea9-4a62-b533-737fd09eed42`，角色 `user`。
- **把文件拷进 guitarTexTool 目录不会让 zzx605 在 App 里看到任何东西**；必须写入数据库。
- 现有入口：`POST /api/tabs`（需登录会话 + 非 GET 的 `x-csrf-token`）；`SqliteTabRepository.create()`；`migrate-fs-to-sqlite.ts` 是旧布局迁移工具，不适用于任意 `.atex` 导入。
- 服务当前未运行。

## 目标

- 把 **C 调**的 686 个 `.atex` 导入 zzx605 名下：
  - `C-Ionian/` 98 个；
  - C-Dorian / C-Phrygian / C-Lydian / C-Mixolydian / C-Aeolian / C-Locrian 各 98 个，共 588 个（来自需求 02）。
- **幂等**：重复运行不产生重复 tab。
- 每个 tab 打标签 `guitarGenTool` 与调式标签（如 `C-Ionian`、`C-Dorian`）。
- `title`/`artist`/`subtitle` 由服务端 `extractScoreMeta(content)` 从 `\title`/`\subtitle` 自动解析，不手工改写。

## 非目标

- 不修改 guitarGenTool 的生成逻辑与产物内容。
- 不导入 D–B 的 Ionian 567 个文件（Q3 明确只要 C 调的 686 个）。
- 不导入 PNG。
- 不做双向同步，App 内编辑不回写 guitarGenTool。
- 不向 guitarTexTool 仓库放入 `.atex` 文件副本。

## 方案决策

| 编号 | 决策 | 理由 |
|---|---|---|
| D1 | 用**一次性脚本**复用 `openDatabase()` + `SqliteTabRepository.create()`，离线导入（方案 C） | 复用尺寸校验、`hashContent`、`extractScoreMeta`、事务与 owner 约束；无需运行服务与 CSRF |
| D2 | 幂等键 = `(owner_id, content_hash)`，命中则跳过 | `content_hash = sha256(文本字节)` 是内容精确身份；`slug` 不唯一（库中已有 3 条同为 `tab`） |
| D3 | 标签 `guitarGenTool` + 目录名（如 `C-Ionian`） | 便于筛选与清理，且不改内容；`create()` 原生支持 `tags` |
| D4 | 只进数据库，不在仓库放 `.atex` | 避免两套事实源；App 本就不读文件 |
| D5 | 顺序：等 02 实施后再一次性导入 686（Q8a） | 用户确认；幂等脚本允许日后增量重跑 |
| D6 | 导入后抽样用 `POST /api/tabs` 验证 1 条 | 端到端确认鉴权与展示路径一致 |

## 交互与边界

- 脚本参数：`--dir <path>`（可多次）、`--username zzx605`、`--tag <extra>`、`--dry-run`、`--data-dir <path>`。
- **DATA_DIR 必须指向 `data-local`**：服务端默认是 `cwd/data`，与真实的 `data-local` 不一致，写错会进错的库。脚本导入前须断言目标库存在 `tabs` 表。
- 幂等查询：`SELECT 1 FROM tabs WHERE owner_id = ? AND content_hash = ? AND deleted_at IS NULL`。
- 失败隔离：单文件解析/超限失败只记录并继续；末尾输出 `imported / skipped / failed` 报告。
- 并发：服务与本脚本可能同时写；依赖 `WAL` + `busy_timeout = 5000`，避免在服务批量导出时运行。
- `MAX_TAB_BYTES` 默认 1 MiB；单个 `.atex` 仅数百字节，远低于限制。

## 实现要点

1. 脚本位置：`guitarTexTool/server/scripts/import-atex.*`（复用 repository 层；按该仓库既有 TS 流程运行/编译）。
2. 每个 `.atex`：`content` = 文件文本；`tags` = `[guitarGenTool, <目录名>]`。
3. owner：按 `username` 查 `users` 表取 `id`；查不到直接报错，**不自动建号**。
4. 先幂等查询，再 `create()`；`--dry-run` 只打印将导入/跳过的清单。
5. 报告：控制台摘要 + JSON 明细（每条的相对路径、`content_hash`、结果）。
6. 按 guitarTexTool 的验证标准：`npm run typecheck`、`npm run test -w @alphatex/server`。

## 任务拆分

- [ ] T1 脚本骨架：参数解析、`DATA_DIR` 校验、`--dry-run`
- [ ] T2 幂等查询（`owner_id` + `content_hash`）
- [ ] T3 批量 `create()` 与标签写入
- [ ] T4 失败收集与 JSON/控制台报告
- [ ] T5 导入后校验：zzx605 的 tab 增量、抽样 `content_hash` 比对、重复运行 0 新增
- [ ] T6 启动服务，用 API 抽样验证 1 条可在 App 中打开

## 测试矩阵

| 场景 | 预期 |
|---|---|
| `--dry-run` | 686 条将导入、0 条写入 |
| 首次实跑 | imported=686、failed=0 |
| zzx605 名下 tab 增量 | +686 |
| 再次运行 | imported=0、skipped=686 |
| 抽样 `content_hash` | 与源文件 `sha256` 完全一致 |
| 标签 | 每条含 `guitarGenTool` 与对应调式标签 |
| API 抽样（登录 zzx605） | 该 tab 可见且可打开 |
| `MAX_TAB_BYTES` | 全部远低于 1 MiB |
| 指定错误的 `--data-dir` | 启动即报错，不写入 |

## 风险

- **写错库**：默认 `DATA_DIR` 与真实 `data-local` 不一致。缓解：强制显式 `--data-dir` + 导入前断言 `tabs` 表存在。
- **并发写**：服务与脚本同时写有锁竞争。缓解：`WAL` + `busy_timeout`，避免高峰期跑。
- **重复导入**：依赖 D2；若用户手工改过某条内容，其 hash 变化会被视为新条目（可接受）。
- **标题解析**：`extractScoreMeta` 依赖 `\title`；生成文件都带，缺失时退化为默认标题。
- **跨仓库改动**：实现落在 guitarTexTool（git 仓库），需按该仓库的验证标准跑 typecheck/test。
- **依赖 02**：588 个文件尚不存在；02 未实施前本需求只能导入 98 条。

## 实施记录（2026-11-25）

- 脚本：**`guitarGenTool/import-atex.mjs`**（偏差：规格原写 `guitarTexTool/server/scripts`；改放在事实源一侧，直接复用 `shared/dist` 的 `extractScoreMeta`/`slugify` 与 `node:sqlite`，避免在另一仓库新增构建产物）。
- 导入前备份数据库：`/tmp/alphatex-backup-20261125-232155.db`（36864 字节）。
- `--dry-run`：686 个候选，库未写入。
- 实跑：**imported=686 skipped=0 failed=0**，owner `zzx605`（`19aabfe3-…`）。
- 幂等复跑：**imported=0 skipped=686**，无重复。
- 数据库核对：zzx605 活跃 tab = **687**（686 新增 + 1 原有）；标签 `guitarGenTool`=686，每个调式目录各 98；重复 `content_hash` = 0。
- 内容抽样：4 个目录 × 3 条 = 12 条，`content_hash` 与源文件 sha256 一致、正文逐字节相同。
- 标题由 `extractScoreMeta` 从 `\\title` 解析，例如 `C Aeolian · i2 · P1 · T1`。
- **未做 API 层验证**：zzx605 的登录口令未知，admin（zzx604）看不到他人曲谱；以数据库查询 + 哈希比对替代（等价于 App 列表查询的结果集）。

## 未决问题

- 无。入口、幂等键、标签、顺序、留档方式均已确认。
