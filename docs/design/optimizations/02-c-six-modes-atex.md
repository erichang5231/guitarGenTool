# 02 生成 C 调 6 种调式的 T1/T2 .atex

- 状态：已实施
- 优先级：P2
- 预估：0.5 天
- 依赖：无

## 背景与现状

现有生成器只支持 Ionian：`theory.mjs` 的 `IONIAN` 音程常量同时被 `buildScale` 与 `buildPosition` 使用；`generate.mjs`、`validate-all.mjs`、`manifest.mjs` 也都按 Ionian 推导。

本需求把调式做成参数，先以 **C 为主音** 生成其余 6 种调式的 T1/T2，验证生成正确后再「依次生成全部」。

### 调式与音程（相对主音，半音）

| 调式 | 音程 | C 调音符 |
|---|---|---|
| Ionian | 0,2,4,5,7,9,11 | C D E F G A B |
| Dorian | 0,2,3,5,7,9,10 | C D Eb F G A Bb |
| Phrygian | 0,1,3,5,7,8,10 | C Db Eb F G Ab Bb |
| Lydian | 0,2,4,6,7,9,11 | C D E F# G A B |
| Mixolydian | 0,2,4,5,7,9,10 | C D E F G A Bb |
| Aeolian | 0,2,3,5,7,8,10 | C D Eb F G Ab Bb |
| Locrian | 0,1,3,5,6,8,10 | C Db Eb F Gb Ab Bb |

### 调号（乐理相对大调）

`\ks` 使用 alphaTex 原生调名，取该调式的相对大调调号，不引入新记号。已用 alphaTab 1.9 探针验证解析值：

| 调式（C 为主音） | 相对大调 | `\ks` | alphaTab `keySignature` |
|---|---|---|---|
| Ionian | C 大调 | `C` | 0 |
| Dorian | Bb 大调 | `Bb` | -2 |
| Phrygian | Ab 大调 | `Ab` | -4 |
| Lydian | G 大调 | `G` | 1 |
| Mixolydian | F 大调 | `F` | -1 |
| Aeolian | Eb 大调 | `Eb` | -3 |
| Locrian | Db 大调 | `Db` | -5 |

## 目标

- 以 C 为主音，生成 Dorian / Phrygian / Lydian / Mixolydian / Aeolian / Locrian 六种调式的 T1/T2 `.atex`。
- 每个调式 **98 个**：T1 56（8 把位 × 7 个 iN）+ T2 42（6 个相邻对 × 7 个 iN）。
- 合计 **588 个** `.atex`。
- 目录与命名完全沿用 C Ionian 规范。
- 用 alphaTab 1.9 逐音校验，0 错误。

## 非目标

- 不生成 PNG（用户明确：出图太慢，本轮只验证 `.atex` 是否正确）。
- 不生成其他主音（D–B）或其他调式的其他调。
- 不修改、不覆盖 `C-Ionian/` 现有 98 个文件。
- 不新增乐理概念；调号只按 alphaTex 原生 `\ks` 与相对大调。

## 方案决策

| 编号 | 决策 | 理由 |
|---|---|---|
| D1 | 内置 7 调式音程表，`buildScale`/`buildPosition`/`buildChain` 接受音程参数 | 调式只是音阶音程不同，3NPS/pivot/T1/T2 规则完全复用 |
| D2 | 调号取相对大调，如 C Dorian → `\ks Bb` | 乐理要求；alphaTab 原生支持，不创造新记号 |
| D3 | 目录 `<Key>-<Mode>/`，文件 `<Key>-<Mode>-<iN>-<Pos>-T1.atex` | 与 `C-Ionian/` 及 `C-Ionian-i3-P1-T1.atex` 完全一致 |
| D4 | 先每调式 1 条样例，解析通过后再批量 | 用户要求「验证没问题再依次生成全部」 |
| D5 | 只生成 `.atex`，不导出 PNG | 用户明确，先验证正确性 |

## 交互与边界

- 目录与文件均写入项目根，不触碰 `C-Ionian/`。
- 文件内容：标题 `<Key> <Mode> · iN · Pn · T1`，`\ks <相对大调>`，`\section "<Key>-<Mode>-..."`，音符仍为 `品.弦`。
- pivot 命名规则不变：只有 pivot 标 `H/L`，`PkH-PkL` 断点不生成 T2。
- C 调下 6 个调式的 pivot 均为 **P4**，链长 8（与 SPEC 附录 B 的 C 列一致）。

## 实现要点

1. `theory.mjs`：新增 `MODES`（名称→音程）与 `MODE_KEY_SIGNATURE_C`（调式→`\ks`）；`buildScale`/`buildPosition`/`buildChain` 增加音程参数；`renderAlphaTex` 增加 `mode` 与 `keySignature`。
2. `generate.mjs`：增加 `--mode`、`--key`，目录与 id 使用 `<Key>-<Mode>`；保留 Ionian 旧行为。
3. `validate-all.mjs`：按 `mode` 构造期望序列与调号断言。
4. `manifest.mjs`：按 `mode` 遍历（本轮可不改，但需避免误报缺失）。
5. 门禁脚本：生成 6 条样例 → 解析 → 检查调号/音符数/首尾音 → 全通过才批量。

## 任务拆分

- [ ] T1 `theory.mjs` 支持调式音程与调号
- [ ] T2 `generate.mjs` 支持 `--mode`/`--key`
- [ ] T3 每调式生成 1 条样例，alphaTab 解析并断言调号
- [ ] T4 门禁通过后批量生成 588 个 `.atex`
- [ ] T5 `validate-all.mjs` 支持调式，全量逐音校验 0 错误
- [ ] T6 输出每调式文件清单与校验报告

## 测试矩阵

| 场景 | 预期 |
|---|---|
| 每个调式 T1 数量 | 56 |
| 每个调式 T2 数量 | 42 |
| 6 调式合计 | 588 |
| `\ks` 解析值 | Dorian -2 / Phrygian -4 / Lydian 1 / Mixolydian -1 / Aeolian -3 / Locrian -5 |
| 音符数、弦/品、realValue | 与算法逐音一致，0 错误 |
| `showStandardNotation` / `showTablature` | 均为 true |
| 首尾音 | 等于该把位最低音 |
| 文件名正则 | `^C-(Dorian\|Phrygian\|Lydian\|Mixolydian\|Aeolian\|Locrian)-i[2-8]-P[1-7](H\|L)?(-P[1-7](H\|L)?)?-T[12]\.atex$` |
| `C-Ionian/` 回归 | 98 个文件仍通过，0 错误 |

## 风险

- **调号解析**：已用探针验证 7 个调号全部正确；Dorian/Phrygian/Locrian 的降号谱面需在实施时抽样目视。
- **调式把位链**：C 下全部 pivot=P4，与附录 B 一致；其他主音不在本轮范围。
- **回归破坏 Ionian**：改造函数时保持默认参数为 Ionian，并跑 `validate-all.mjs --keys C`。
- **生成量**：588 个纯文本文件，秒级完成，无出图耗时。

## 实施记录（2026-11-25）

- `theory.mjs`：新增 `MODES`（7 调式音程）、`MODE_RELATIVE_MAJOR_OFFSET`、`keySignatureFor()`；`buildScale/buildChain` 接受音程参数，默认仍为 Ionian。
- `generate.mjs`：新增 `modes`/`mode` 命令与 `--key`/`--mode`/`--dry-run`；目录 `<Key>-<Mode>/`。
- 新增 `gate-modes.mjs`：每调式 1 条样例门禁（7/7 通过，调号 C/Bb/Ab/G/F/Eb/Db 全部正确）。
- 生成 **588** 个 `.atex`：C-Dorian / C-Phrygian / C-Lydian / C-Mixolydian / C-Aeolian / C-Locrian 各 98（T1 56 + T2 42）。
- `validate-all.mjs` 增加调式与调号断言：**686/686，0 错误**（含 C-Ionian 回归）。
- Ionian 回归：7 个调重新生成后与原文件**逐字节一致**。
- `manifest.mjs` 改为按磁盘发现的 `<Key>-<Mode>` 目录生成清单，总计 1253 条。

## 未决问题

- 无。范围（C × 6 调式）、产物（仅 `.atex`）、调号（相对大调）均已确认。
