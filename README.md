# 吉他指板音阶模进训练 · Ionian 自然音主音

## 这是什么

这套练习用于吉他指板的音阶模进训练。当前覆盖 **7 个自然音主音（白键）的 Ionian 调式**：C、D、E、F、G、A、B，共 **665 个 alphaTex 文件**（`.atex`）。

- 模进步距 `sN` 由 `iN` 决定：`i2 → s2`（每次移动 2 个音级），`i3`–`i8 → s1`（每次移动 1 个音级）。
- 模进度数 `iN` 覆盖 `i2`–`i8`：二度、三度、四度、五度、六度、七度、八度模进。
- 每个 `iN` 有 14 个文件（含 pivot 的调）或 13 个文件（无 pivot 的调）。
- 每个文件是一条独立练习，包含标题、副标题、五线谱与六线谱。

> 含升降号的主音（C#、D#、F#、G#、A#）本轮未生成，规则与代码已支持，后续可直接扩展。

## 怎么用

1. 把 `<Key>-Ionian/` 目录导入 alphaTab 1.9 / guitarTexTool。
2. 建议从样例开始：[C-Ionian-i3-P1-T1.atex](C-Ionian/C-Ionian-i3-P1-T1.atex)。
3. 默认速度 70 BPM、4/4、八分音符；初练建议从 60 BPM 开始。
4. 谱面同时显示五线谱和六线谱；六线谱上的数字是“品”，弦序按 alphaTab 的六线谱显示。

## 术语

| 符号 | 含义 |
|---|---|
| `iN` | 模进度数 / 音型音程：`i3` = 三度模进，音型 `1-3` |
| `sN` | 模进步距；`i2 → s2`，`i3`–`i8 → s1` |
| 3NPS | 每弦 3 个连续音阶音 |
| `P1`–`P7` | 从调式第 1–7 级开始的 3NPS 把位型 |
| `P4H` / `P4L` | P4 的高/低八度实例（pivot） |
| `T1` | 同把位上下行 |
| `T2` | 相邻把位上下行 |
| `T3` | 待定义，目录/命名预留 |

### `iN` 与 `sN`

```text
iN：音型 = [ d, d + (N-1) ]
s(i2) = s2：下一次起点 = d + 2
s(i3..i8) = s1：下一次起点 = d + 1
```

| 符号 | 音型 | C 大调例子 |
|---|---|---|
| i2 | 1-2, 2-3, 3-4… | C-D, D-E, E-F… |
| i3 | 1-3, 2-4, 3-5… | C-E, D-F, E-G… |
| i4 | 1-4, 2-5, 3-6… | C-F, D-G, E-A… |
| i5 | 1-5, 2-6, 3-7… | C-G, D-A, E-B… |
| i6 | 1-6, 2-7, 3-8… | C-A, D-B, E-C… |
| i7 | 1-7, 2-8, 3-9… | C-B, D-C, E-D… |
| i8 | 1-8, 2-9, 3-10… | C-C, D-D, E-E… |

> `i2` 使用 `s2`（起点音级 0, 2, 4, 6…）；`i3`–`i8` 使用 `s1`（逐级上行）。

## 把位链（按调）

pivot 规则：取最大的 `k` 使 `max(PkH) ≤ 19`；`k = 7` 时全用高实例、无 pivot。
只有 pivot 标 `H/L`；`PkH-PkL` 是断点，不生成 T2。

| 调 | pivot | 链 | T1 | T2 | 小计 |
|---|---|---|---|---|---|
| C | P4 | P1(8-13) P2(10-15) P3(12-17) P4H(13-19) P4L(1-7) P5(3-8) P6(5-10) P7(7-12) | 56 | 42 | 98 |
| D | P3 | P1(10-15) P2(12-17) P3H(14-19) P3L(2-7) P4(3-9) P5(5-10) P6(7-12) P7(9-14) | 56 | 42 | 98 |
| E | – | P1(0-5) P2(2-7) P3(4-9) P4(5-11) P5(7-12) P6(9-14) P7(11-16) | 49 | 42 | 91 |
| F | – | P1(1-6) P2(3-8) P3(5-10) P4(6-12) P5(8-13) P6(10-15) P7(12-17) | 49 | 42 | 91 |
| G | – | P1(3-8) P2(5-10) P3(7-12) P4(8-14) P5(10-15) P6(12-17) P7(14-19) | 49 | 42 | 91 |
| A | P6 | P1(5-10) P2(7-12) P3(9-14) P4(10-16) P5(12-17) P6H(14-19) P6L(2-7) P7(4-9) | 56 | 42 | 98 |
| B | P5 | P1(7-12) P2(9-14) P3(11-16) P4(12-18) P5H(14-19) P5L(2-7) P6(4-9) P7(6-11) | 56 | 42 | 98 |
| **合计** | | | **371** | **294** | **665** |

说明：

- 无 pivot 的调（E/F/G）链长 7，T1 每 `iN` 7 条，T2 每 `iN` 6 条（首尾不在断点上）。
- 有 pivot 的调（C/D/A/B）链长 8，但 pivot 断点吃掉 1 个 T2 对，仍是每 `iN` 6 条 T2。

## 文件结构

```text
C-Ionian/
  C-Ionian-i2-P1-T1.atex
  C-Ionian-i2-P1_P2-T2.atex
  …
  C-Ionian-i8-P7-T1.atex
  C-Ionian-i8-P6_P7-T2.atex
  png/
    C-Ionian-i2-P1-T1.png
    …
D-Ionian/ … B-Ionian/（同结构）
```

命名规则：

- T1：`<Key>-Ionian-iN-Pn-T1.atex`
- T2：`<Key>-Ionian-iN-Pn_Pm-T2.atex`（`Pm` 是链上的下一个位置）
- pivot：`P4H` / `P4L`
- 文件名即练习 ID，不含 `sN`；`sN` 由 `iN` 决定（`i2 → s2`，`i3`–`i8 → s1`），见 [SPEC.md](SPEC.md) 2.2。

完整清单见 [MANIFEST.md](MANIFEST.md)（每条练习的品格区间、音符数、小节数）。

## 工具脚本

| 脚本 | 作用 |
|---|---|
| [theory.mjs](theory.mjs) | 共享乐理与 alphaTex 渲染（音阶、3NPS、pivot 链、T1/T2、模板） |
| [generate.mjs](generate.mjs) | 生成练习：`node generate.mjs key C` / `keys C,D` / `all` |
| [validate-all.mjs](validate-all.mjs) | 用 alphaTab 1.9 解析并逐音比对全部文件 |
| [manifest.mjs](manifest.mjs) | 生成 [MANIFEST.md](MANIFEST.md) 与 `MANIFEST.json` |
| [export-png.mjs](export-png.mjs) | 通过 guitarTexTool 导出 PNG，支持 `--workers`、`--shard`、断点续跑 |
| [export-all.sh](export-all.sh) | 全量导出入口 |
| [pnglint.mjs](pnglint.mjs) | 校验 PNG 签名、宽度、尺寸、完整性 |

```bash
node generate.mjs all                  # 生成 7 个自然音主音的全部练习
node validate-all.mjs                  # 逐音校验（期望 0 错误）
node manifest.mjs                      # 刷新清单
./export-all.sh                        # 全量导出 PNG（WORKERS=3 可调）
node pnglint.mjs                       # 校验图片完整性
```

## 练习建议

- **T1**：先慢速，注意保留指、跨弦和左右手同步；到顶折返时不要抢拍。
- **T2**：注意 A 到 B 的跳把，以及最后 A 的收尾音型；先分手/分声部练，再合起来。
- 建议顺序：`i2` → `i3` → `i4` → `i5`，每个 `iN` 先把 P1–P4 练稳，再练 P4L–P7。
- 速度：60 BPM 起，稳定后每次 +5 BPM；不要以牺牲音质换速度。
- 右手指法可先用交替拨弦；进阶可换连奏/经济拨弦。

## 调式（C 调）

在 Ionian 之外，C 调还生成了 6 种调式的练习，命名与目录规则与 Ionian 完全一致：

| 调式 | 目录 | 相对大调（`\ks`） | pivot | 文件数 |
|---|---|---|---|---|
| Dorian | `C-Dorian/` | Bb | P4 | 98 |
| Phrygian | `C-Phrygian/` | Ab | P4 | 98 |
| Lydian | `C-Lydian/` | G | P4 | 98 |
| Mixolydian | `C-Mixolydian/` | F | P4 | 98 |
| Aeolian | `C-Aeolian/` | Eb | P4 | 98 |
| Locrian | `C-Locrian/` | Db | P4 | 98 |

- 合计 **588** 个 `.atex`（每调式 T1 56 + T2 42）。
- 调号按乐理取**相对大调**，使用 alphaTex 原生 `\ks`，不引入新记号。
- 本轮**只生成 `.atex`，不出 PNG**。

```bash
node generate.mjs modes Dorian,Phrygian,Lydian,Mixolydian,Aeolian,Locrian --key C
node gate-modes.mjs --key C        # 每调式样例门禁
node validate-all.mjs --keys C     # 全量逐音校验（686 条）
```

## 验证

- **1253/1253** 个文件用 **alphaTab 1.9** 的 `AlphaTexImporter` 解析通过，逐音比对 **0 处不一致**。
  - 音色统一为钢弦吉他 `acousticguitarsteel`（GM 25）；`program != 25` 或 `displayTranspositionPitch != -12` 会被校验直接判错。
  - 五线谱按吉他惯例记谱（比实际音高上移一个八度），六线谱品位与播放音高不变。
  - 其中 C 调 7 种调式（Ionian + 6 调式）共 **686** 条，逐音与调号全部通过。
  - 校验项：音符数、弦/品、实际音高（`realValue`）、小节数、`showStandardNotation`/`showTablature`、首尾落音。
- 各调把位链与 [SPEC.md](SPEC.md) 附录 B 的 pivot 推导表逐项吻合。
- 样例 `C-Ionian-i3-P1-T1.atex`：8 小节、64 个音，首尾均落在 C3（8 品 6 弦）。
- `i2` 系列为 `s2`：`C-Ionian-i2-P1-T1.atex` 5 小节、37 个音，首尾均落在 C3（8 品 6 弦）。
- 视觉渲染（中文标题、五线谱+六线谱、2 小节/行）已抽样确认。
- PNG 仅保留 C 调 98 张，`node pnglint.mjs --keys C` 全部通过。

## PNG 导出

- 规格：**2400px 宽、2 小节/行、长图、白底**；隐藏调弦标签与默认力度记号。
- 输出：`C-Ionian/png/<exercise-id>.png`，文件名与练习 ID 一致。**本轮仅 C 调保留 PNG**，其余 6 个调只保留 `.atex`。
- 导出方式：临时 textool 实例 + headless Chromium，单浏览器多标签页并行；补丁只作用于临时 client，不修改线上 app。
- 完整性由 [pnglint.mjs](pnglint.mjs) 校验（签名、宽度、尺寸、文件大小、与清单一一对应）。
- 本次交付规模：**98 张 PNG（仅 C 调），合计 75,451,485 字节 ≈ 72.0 MiB**；665 个 `.atex` 合计 329,107 字节 ≈ 321.4 KiB。
- 其余 6 个调（D/E/F/G/A/B）的 PNG 已清理，只保留 `.atex`。

{{PNG_SAMPLES}}

## 导入 guitarTexTool

C 调的 686 个 `.atex`（Ionian + 6 调式）可导入 guitarTexTool，归属 App 用户 `zzx605`：

```bash
node import-atex.mjs --dry-run                 # 只统计，不写库
node import-atex.mjs --username zzx605         # 实际导入（幂等）
```

- 目标库：`../guitarTexTool/guitarTexTool/data-local/alphatex.db`，可用 `--data-dir` 覆盖。
- 幂等键：`(owner_id, content_hash)`；重复运行不会产生重复曲谱。
- 标签：`guitarGenTool` + 调式目录名（如 `C-Dorian`）。
- 标题/艺术家/副标题由 `extractScoreMeta` 从 `\title`/`\subtitle` 解析。

## 备注

- 讨论稿里的 `6.8` 表示“6 弦 8 品”；alphaTex 写作 `8.6`（品.弦）。
- 规格与算法细节见 [SPEC.md](SPEC.md)；84 个“调式 × 调”的 pivot 表见其附录 B。
