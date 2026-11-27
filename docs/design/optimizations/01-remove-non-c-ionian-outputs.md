# 01 删除除 C 调以外的 Ionian PNG 输出

- 状态：已实施
- 优先级：P2
- 预估：0.05 天
- 依赖：无

## 背景与现状

本仓库已生成 7 个自然音主音 Ionian 调的练习：C、D、E、F、G、A、B，共 665 个 `.atex` 与 665 张 PNG（约 509 MiB）。

- 每个 `*-Ionian/` 目录含 91–98 个 `.atex` 与 `png/` 子目录。
- 现只需要保留 **C 调的图片**；其余 6 调的 PNG 为本次清理对象，`.atex` 全部保留。
- 仓库**不是 git 仓库**（`git rev-parse` 失败），删除无法通过版本控制回滚；但 PNG 可由 `export-png.mjs` 重新生成。

现状明细：

| 调 | .atex（保留） | PNG（本次处理） | PNG 字节 |
|---|---|---|---|
| C（全部保留） | 98 | 98（保留） | 75,451,485 |
| D | 98 | 98（删除） | 77,035,442 |
| E | 91 | 91（删除） | 74,946,504 |
| F | 91 | 91（删除） | 70,950,507 |
| G | 91 | 91（删除） | 70,864,511 |
| A | 98 | 98（删除） | 78,207,161 |
| B | 98 | 98（删除） | 86,235,408 |

待删 PNG 合计 **567 张、458,239,533 字节 ≈ 437 MiB**。

## 目标

- 删除 `D/E/F/G/A/B-Ionian/` 六个 `png/` 目录下的全部 PNG（共 567 张）。
- 保留六个 `<Key>-Ionian/` 目录及其中的 567 个 `.atex`。
- 保留 `C-Ionian/` 完整：98 个 `.atex` + 98 张 PNG。
- 目录最终形态：`<Key>-Ionian/*.atex`；其中 C 额外保留 `png/`。
- 让仓库内的清单与文档与「665 个 .atex + 仅 C 有 PNG」一致。

## 非目标

- 不删除任何 `.atex`。
- 不删除任何 `*-Ionian/` 目录本身。
- 不动 `C-Ionian/png/` 下的任何 PNG。
- 不修改生成算法与乐理规则（`theory.mjs`、`generate.mjs` 不变）。
- 不新增含升降号的调（C#/D#/F#/G#/A#）。

## 方案决策

| 编号 | 决策 | 理由 |
|---|---|---|
| D1 | 删除粒度＝**只删 PNG**，`.atex` 与调目录保留 | 用户已确认调整；`.atex` 体积极小且是唯一事实源 |
| D2 | 删除后移除六个空的 `png/` 子目录，保留 `<Key>-Ionian/` | 避免留下空目录；调目录本身按目标不删 |
| D3 | 不做归档备份 | PNG 可由 `export-png.mjs` 再生；`.atex` 本就保留 |
| D4 | 删除后刷新 `MANIFEST.md`/`MANIFEST.json`，并更新 `README.md`/`SPEC.md` 的 PNG 统计 | 否则文档与磁盘不一致 |

## 交互与边界

- 执行前打印每个待删目录的 PNG 数量与总字节，供人工核对。
- 必须保证 `C-Ionian/png/` 的 98 张 PNG 在操作前后不变。
- 必须保证 567 个非 C 的 `.atex` 在操作前后不变。
- `.logs/` 下的历史导出日志保留，不做清理。

## 实现要点

1. 删除前核对：`for k in D E F G A B; do ls $k-Ionian/png/*.png | wc -l; done` 应为 98/91/91/91/98/98。
2. 显式删除六个 `png/` 子目录（逐条绝对路径，禁止通配符跨目录）。
3. `manifest.mjs` 无需改逻辑：`.atex` 仍在，PNG 计数自然变为 0；直接重跑即可。
4. 更新 `README.md`：PNG 章节改为「仅 C 调 98 张」，其余调只保留 `.atex`。
5. 更新 `SPEC.md`：版本记录追加一条，说明「非 C 调 PNG 已清理」。

## 任务拆分

- [ ] T1 删除前核对路径、PNG 数量与 C 调基线（只读）
- [ ] T2 删除 D/E/F/G/A/B 六个 `png/` 子目录
- [ ] T3 验证：7 个调目录都在，567 个 `.atex` 不变，非 C PNG 为 0，C 的 PNG 仍为 98
- [ ] T4 重新生成 `MANIFEST.md` / `MANIFEST.json`
- [ ] T5 更新 `README.md` / `SPEC.md` 的 PNG 统计与状态
- [ ] T6 验收：磁盘、清单、文档三者一致

## 测试矩阵

| 场景 | 预期 |
|---|---|
| `ls -d *-Ionian` | 7 个目录都在 |
| 非 C `.atex` 计数 | D98 / E91 / F91 / G91 / A98 / B98 |
| 非 C PNG 计数 | 全部 0 |
| C `.atex` / PNG | 98 / 98 |
| `node pnglint.mjs --keys C` | ALL OK |
| `node validate-all.mjs --keys C` | 98/98，errors=0 |
| `node manifest.mjs` | 665 条，PNG 仅 C 计 98 |

## 风险

- **误删 C 的 PNG**：不可回滚。缓解：逐条显式绝对路径，且只删 `D-Ionian/png` 等六个目录。
- **误删 `.atex`**：`.atex` 是唯一事实源。缓解：只删 `png/` 子目录，不触碰目录内其他文件。
- **文档与磁盘不一致**：`MANIFEST`/`README`/`SPEC` 若不同步会误导。缓解：T4–T6 纳入验收。
- **再生成本**：437 MiB 重新出图约 50 分钟，且依赖 textool 服务与内存余量。

## 实施记录（2026-11-25）

- 删除 D/E/F/G/A/B 六个 `png/` 目录，共 **567 张、约 437 MiB**；目录空间从约 810M 降到 370M。
- 保留：7 个调目录、665 个 `.atex`、`C-Ionian/png/` 98 张。
- `node pnglint.mjs --keys C` → 98 张全部 OK。
- `manifest.mjs` 重跑：非 C 调 PNG 计数为 0。
- `README.md` / `SPEC.md` 的 PNG 统计已直接改为「仅 C 98 张」；SPEC 版本 v1.1。

## 未决问题

- **U1（已解决）**：保留 6 个调的 `.atex`，只删 PNG。
- **U2**：规格目录为 `docs/design/optimizations/`（本仓库此前无 `docs/`）；如需改位置，实施前调整。
- **U3（已解决）**：`README.md`/`SPEC.md` 的 PNG 统计直接改为「仅 C 98 张」，不保留历史注记。
