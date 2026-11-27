# guitarGenTool 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpower-subagent-driven-development (recommended) or superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 guitarGenTool 从"依赖兄弟仓库绝对路径的一次性脚本集"改造成纯 Node 生成器：可移植、可扩展（12 主音 / T3 注册表）、入库作为可选插件，且重新生成的 1253 个 `.atex` 与现状逐字节一致。

**Architecture:** 拆成 `src/core`（乐理与把位）、`src/types`（T1/T2 注册表）、`src/render`（alphaTex 文本）、`src/plan.mjs`（唯一真源）、`src/cli.mjs`（唯一入口）；`plugins/` 存放可选能力，主流程零依赖。产物输出到 `dist/`。

**Tech Stack:** Node ≥ 22（ESM、`node:test`、`node:sqlite`），`@coderline/alphatab@1.9` 仅作 devDependency 供 `validate` 使用。

**Spec:** `docs/superpowers/specs/2026-11-27-generator-restructure-design.md`

## Global Constraints

- Node `>= 22`；`package.json` 中 `"type": "module"`、`engines.node = ">=22"`。
- `@coderline/alphatab` 锁 `1.9.x`，**只**出现在 `devDependencies`；`src/generate.mjs`、`src/manifest.mjs`、`src/plan.mjs` 不得 import 它。
- `\ks` 合法取值仅 15 个：`Cb -7, Gb -6, Db -5, Ab -4, Eb -3, Bb -2, F -1, C 0, G 1, D 2, A 3, E 4, B 5, F# 6, C# 7`；超出即拒绝该 (key, mode) 组合。
- 标准调弦固定：`6=E2(40) 5=A2(45) 4=D3(50) 3=G3(55) 2=B3(59) 1=E4(64)`；`MAX_HIGH_FRET = 19`。
- 谱面固定：`\tempo 70`、`\ts 4 4`、`\staff { score tabs }`、`instrument acousticguitarsteel`、`\tuning (E4 B3 G3 D3 A2 E2)`、每小节 8 个八分音符、不足补 `r`。
- 命名固定：目录 `<Key>-<Mode>`，文件 `<Key>-<Mode>-i<N>-<position>-<Type>`（T2 的 position 为 `<A>_<B>`）。
- 默认目标集 = 7 自然音 × Ionian ∪ C × 6 调式 = **1253** 个文件。
- 红线：默认参数重新生成后，1253 个文件与改动前**逐字节一致**。
- 不得出现 `/home/zzx604` 等绝对路径；所有路径相对 `import.meta.url` 或 CLI 参数。

## Review Focus

1. **非法主音输入**（`H`、`C##`、`c#`、空串）必须报错并列出合法集合，绝不静默回落成 C。测试归 Task 3。
2. **未知类型**（`--types T9`）必须非 0 退出并列出可用类型，不能"生成 0 条后静默成功"。测试归 Task 9。
3. **`.atex` 幂等**：连续两次 generate 产物字节相同，不得混入时间戳。测试归 Task 10。
4. **全部组合被拒**（如 `--keys G# --modes Ionian`）必须非 0 退出，否则 CI 会误判成功。测试归 Task 9。
5. **入库前置条件缺失**（DB 无 `tabs` 表、无该用户）必须明确报错且不建表、不建用户。测试归 Task 11。

---

### Task 1: 仓库基线

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `test/smoke.test.mjs`

**Interfaces:**
- Produces: `npm test` 可运行（`node --test`）；git 基线提交，后续任务用 `git diff` 证明字节一致。

- [ ] **Step 1: 建 `package.json`**

```json
{
  "name": "guitar-gen-tool",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": { "test": "node --test", "generate": "node src/cli.mjs generate" },
  "devDependencies": { "@coderline/alphatab": "1.9.0" }
}
```

- [ ] **Step 2: 建 `.gitignore`**（此时**不要**忽略 `dist/`，产物还在根目录且需要基线提交）

```
node_modules/
*.log
```

- [ ] **Step 3: 写第一个测试 `test/smoke.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package.json is ESM with node>=22 engine', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '>=22');
});
```

- [ ] **Step 4: 运行测试**

Run: `npm test`
Expected: `# pass 1`、`# fail 0`

- [ ] **Step 5: 安装依赖**

Run: `npm install`
Expected: 生成 `node_modules/` 与 `package-lock.json`；`node -e "import('@coderline/alphatab').then(()=>console.log('ok'))"` 输出 `ok`

- [ ] **Step 6: git 基线提交（含现有 1253 个产物）**

```bash
git init
git config user.email >/dev/null 2>&1 || git config user.email "dev@local"
git config user.name  >/dev/null 2>&1 || git config user.name "dev"
git add -A
git commit -m "chore: baseline before refactor"
```

验证：`git status --short` 输出为空；`git ls-files | wc -l` ≥ 1260

---

### Task 2: core 常量（调弦与调式）

**Files:**
- Create: `src/core/tuning.mjs`
- Create: `src/core/modes.mjs`
- Test: `test/core-constants.test.mjs`

**Interfaces:**
- Produces: `STRINGS`（`[{string, open, name}]`，6→1 弦）、`MAX_HIGH_FRET = 19`；`MODES`（7 项，值为半音数组）、`MODE_NAMES`（`string[]`）、`MODE_RELATIVE_MAJOR_OFFSET`（主音到相对大调的半音偏移）。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, MAX_HIGH_FRET } from '../src/core/tuning.mjs';
import { MODES, MODE_NAMES, MODE_RELATIVE_MAJOR_OFFSET } from '../src/core/modes.mjs';

test('standard tuning, low E first', () => {
  assert.deepEqual(STRINGS.map((s) => [s.string, s.open]),
    [[6, 40], [5, 45], [4, 50], [3, 55], [2, 59], [1, 64]]);
  assert.equal(MAX_HIGH_FRET, 19);
});

test('seven modes with correct intervals', () => {
  assert.equal(MODE_NAMES.length, 7);
  assert.deepEqual(MODES.Ionian,    [0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual(MODES.Dorian,    [0, 2, 3, 5, 7, 9, 10]);
  assert.deepEqual(MODES.Phrygian,  [0, 1, 3, 5, 7, 8, 10]);
  assert.deepEqual(MODES.Lydian,    [0, 2, 4, 6, 7, 9, 11]);
  assert.deepEqual(MODES.Mixolydian,[0, 2, 4, 5, 7, 9, 10]);
  assert.deepEqual(MODES.Aeolian,   [0, 2, 3, 5, 7, 8, 10]);
  assert.deepEqual(MODES.Locrian,   [0, 1, 3, 5, 6, 8, 10]);
});

test('relative major offsets match existing behaviour', () => {
  assert.deepEqual(MODE_RELATIVE_MAJOR_OFFSET,
    { Ionian: 0, Dorian: 10, Phrygian: 8, Lydian: 7, Mixolydian: 5, Aeolian: 3, Locrian: 1 });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/core-constants.test.mjs`
Expected: FAIL，`Cannot find module '../src/core/tuning.mjs'`

- [ ] **Step 3: 实现两个模块**（值从上一步测试里逐字抄）

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/core-constants.test.mjs`
Expected: `# pass 3`

- [ ] **Step 5: 提交**

```bash
git add src/core/tuning.mjs src/core/modes.mjs test/core-constants.test.mjs
git commit -m "feat(core): tuning and mode tables"
```

---

### Task 3: 主音解析与调号推导

**Files:**
- Create: `src/core/keys.mjs`
- Test: `test/keys.test.mjs`

**Interfaces:**
- Produces:
  - `KEY_SIGNATURES: { name: string, fifths: number }[]`，15 项，`fifths` 从 `-7` 到 `+7`。
  - `parseKey(input: string) -> { name: string, pc: number, accidental: 'sharp'|'flat'|'natural' }`，非法输入抛 `Error`，消息含合法集合。
  - `keySignatureFor(tonic: ReturnType<parseKey>, modeName: string) -> { name: string, fifths: number }`；越界抛 `RangeError`，附加 `err.code = 'KEY_SIG_OUT_OF_RANGE'`、`err.message` 含 `请改用等音主音 <Name>`、`err.suggestion = '<Name>'`。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKey, keySignatureFor, KEY_SIGNATURES } from '../src/core/keys.mjs';

test('parses sharps, flats and naturals', () => {
  assert.deepEqual(parseKey('C'),  { name: 'C',  pc: 0,  accidental: 'natural' });
  assert.deepEqual(parseKey('C#'), { name: 'C#', pc: 1,  accidental: 'sharp' });
  assert.deepEqual(parseKey('Db'), { name: 'Db', pc: 1,  accidental: 'flat' });
  assert.deepEqual(parseKey('B'),  { name: 'B',  pc: 11, accidental: 'natural' });
});

test('rejects invalid tonic names instead of defaulting to C', () => {
  for (const bad of ['H', 'C##', 'c#', '', 'Xb']) {
    assert.throws(() => parseKey(bad), /C#|Db|合法/);
  }
});

test('15 key signatures span -7..+7', () => {
  assert.equal(KEY_SIGNATURES.length, 15);
  assert.equal(KEY_SIGNATURES[0].fifths, -7);
  assert.equal(KEY_SIGNATURES.at(-1).fifths, 7);
});

test('derives relative-major signature for natural keys (regression)', () => {
  const expect = {
    Ionian: { C: 'C', D: 'D' }, Dorian: { C: 'Bb' }, Phrygian: { C: 'Ab' },
    Lydian: { C: 'G' }, Mixolydian: { C: 'F' }, Aeolian: { C: 'Eb' }, Locrian: { C: 'Db' },
  };
  for (const [mode, table] of Object.entries(expect)) {
    for (const [key, ks] of Object.entries(table)) {
      assert.equal(keySignatureFor(parseKey(key), mode).name, ks, `${key} ${mode}`);
    }
  }
});

test('twelve tonics, sharp/flat side decides spelling', () => {
  assert.deepEqual(keySignatureFor(parseKey('C#'), 'Dorian'), { name: 'B',  fifths: 5 });
  assert.deepEqual(keySignatureFor(parseKey('Db'), 'Dorian'), { name: 'Cb', fifths: -7 });
  assert.deepEqual(keySignatureFor(parseKey('B'),  'Dorian'), { name: 'A',  fifths: 3 });
  assert.deepEqual(keySignatureFor(parseKey('Gb'), 'Ionian'), { name: 'Gb', fifths: -6 });
  assert.deepEqual(keySignatureFor(parseKey('C#'), 'Ionian'), { name: 'C#', fifths: 7 });
});

test('rejects signatures beyond +-7 with enharmonic suggestion', () => {
  for (const [key, mode, suggestion] of [['G#', 'Ionian', 'Ab'], ['D#', 'Ionian', 'Eb'], ['A#', 'Ionian', 'Bb'], ['Gb', 'Dorian', 'F#']]) {
    try {
      keySignatureFor(parseKey(key), mode);
      assert.fail(`${key} ${mode} should throw`);
    } catch (err) {
      assert.equal(err.code, 'KEY_SIG_OUT_OF_RANGE');
      assert.equal(err.suggestion, suggestion);
      assert.match(err.message, /请改用等音主音/);
    }
  }
});

test('same tonic stays legal in another mode', () => {
  assert.equal(keySignatureFor(parseKey('G#'), 'Dorian').name, 'F#');
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/keys.test.mjs`
Expected: FAIL，`Cannot find module '../src/core/keys.mjs'`

- [ ] **Step 3: 实现 `src/core/keys.mjs`**

要点（签名与取值已由测试锁定，只需实现）：`SPELLINGS` 表把 `{name, pc, fifths, accidental}` 全列 15 项；`parseKey` 只接受该表的 15 个名字 + 7 个自然名；`keySignatureFor` 先算 `(tonic.pc + MODE_RELATIVE_MAJOR_OFFSET[mode]) % 12`，再按 `tonic.accidental === 'flat' ? 降侧名字 : 升侧名字` 选出相对大调 pc 对应的拼写，查 `fifths`，`Math.abs(fifths) > 7` 时构造 `RangeError` 并挂 `code`/`suggestion`（等音名 = 同 pc 的另一种拼写）。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/keys.test.mjs`
Expected: `# pass 7`

- [ ] **Step 5: 提交**

```bash
git add src/core/keys.mjs test/keys.test.mjs
git commit -m "feat(core): 12-tonic parsing and circle-of-fifths key signatures"
```

---

### Task 4: 音阶与把位链

**Files:**
- Create: `src/core/scale.mjs`
- Create: `src/core/positions.mjs`
- Test: `test/positions.test.mjs`

**Interfaces:**
- Consumes: `STRINGS`, `MAX_HIGH_FRET`（Task 2）。
- Produces:
  - `buildScale(pc: number, intervals: number[]) -> { base: number, notes: number[], intervals: number[] }`，6 个八度共 42 音，`notes[0] = lowestMidiForPc(pc)`。
  - `lowestMidiForPc(pc: number) -> number`。
  - `buildPosition(scale, degree) -> { midi, fret, string }[]`（18 音，每弦 3 音）。
  - `buildChain(pc, intervals) -> { scale, high: Record<number, Note[]>, k: number, chain: { id: string, notes: Note[] }[] }`。
  - `transposeDown(notes) -> Note[]`。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScale, lowestMidiForPc } from '../src/core/scale.mjs';
import { buildPosition, buildChain, transposeDown } from '../src/core/positions.mjs';
import { MODES } from '../src/core/modes.mjs';

test('lowest midi for a pitch class sits at or above low E', () => {
  assert.equal(lowestMidiForPc(0), 48);   // C3
  assert.equal(lowestMidiForPc(4), 40);   // E2
  assert.equal(lowestMidiForPc(11), 47);  // B2
});

test('scale has six octaves starting at the tonic', () => {
  const s = buildScale(0, MODES.Ionian);
  assert.equal(s.notes.length, 42);
  assert.equal(s.notes[0], 48);
  assert.equal(s.notes[7], 60);
});

test('position is 18 notes, three per string, low string first', () => {
  const s = buildScale(0, MODES.Ionian);
  const p = buildPosition(s, 1);
  assert.equal(p.length, 18);
  assert.equal(p[0].string, 6);
  assert.equal(p[0].fret, 8);            // C on low E
  assert.deepEqual(p.slice(0, 3).map((n) => n.string), [6, 6, 6]);
});

test('chain is 7 (no pivot) or 8 (pivot) positions, ids follow Pn/PnH/PnL', () => {
  for (const [pc, mode] of [[0, 'Ionian'], [2, 'Ionian'], [11, 'Ionian']]) {
    const { chain, k } = buildChain(pc, MODES[mode]);
    assert.ok(chain.length === 7 || chain.length === 8, `${pc} ${mode} -> ${chain.length}`);
    if (k < 7) {
      assert.ok(chain.some((p) => p.id === `P${k}H`));
      assert.ok(chain.some((p) => p.id === `P${k}L`));
    } else {
      assert.equal(chain.length, 7);
    }
  }
});

test('every fret is within 0..19', () => {
  const { chain } = buildChain(0, MODES.Ionian);
  for (const p of chain) for (const n of p.notes) {
    assert.ok(n.fret >= 0 && n.fret <= 19, `${p.id} fret ${n.fret}`);
  }
});

test('transposeDown drops one octave', () => {
  const { chain } = buildChain(0, MODES.Ionian);
  const t = transposeDown(chain[0].notes);
  assert.equal(t[0].midi, chain[0].notes[0].midi - 12);
  assert.equal(t[0].fret, chain[0].notes[0].fret - 12);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/positions.test.mjs`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现 `scale.mjs` 与 `positions.mjs`**

算法直接照搬现有 `theory.mjs` 的 `lowestMidiForPc` / `buildScale` / `buildPosition` / `buildChain` / `transposeDown`（行为必须一致，只改文件归属）。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/positions.test.mjs`
Expected: `# pass 6`

- [ ] **Step 5: 提交**

```bash
git add src/core/scale.mjs src/core/positions.mjs test/positions.test.mjs
git commit -m "feat(core): scale and 3NPS position chain"
```

---

### Task 5: 模进序列基元

**Files:**
- Create: `src/core/sequences.mjs`
- Test: `test/sequences.test.mjs`

**Interfaces:**
- Produces: `stepFor(interval) -> number`（`i2 -> 2`，其余 `1`）；`t1(notes, interval) -> Note[]`；`t2(a, b, interval) -> Note[]`；`t2Pairs(chain) -> [string, string][]`（跳过 pivot 断点 `PkH -> PkL`）。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepFor, t1, t2, t2Pairs } from '../src/core/sequences.mjs';
import { buildChain } from '../src/core/positions.mjs';
import { MODES } from '../src/core/modes.mjs';

const chain = buildChain(0, MODES.Ionian).chain;
const byId = new Map(chain.map((p) => [p.id, p.notes]));

test('step is 2 only for i2', () => {
  assert.equal(stepFor(2), 2);
  for (const i of [3, 4, 5, 6, 7, 8]) assert.equal(stepFor(i), 1);
});

test('T1 mirrors at the top and returns to the first note', () => {
  const seq = t1(byId.get('P1'), 3);
  assert.equal(seq[0].fret, byId.get('P1')[0].fret);
  assert.equal(seq.at(-1).fret, byId.get('P1')[0].fret);
  assert.equal(seq.length, 32); // i3: 16 pairs up + 16 pairs down
});

test('T1 note count shrinks as the interval grows', () => {
  const lens = [2, 3, 4, 5, 6, 7, 8].map((i) => t1(byId.get('P1'), i).length);
  for (let k = 1; k < lens.length; k++) assert.ok(lens[k] < lens[k - 1], lens.join(','));
});

test('T2 ends with the A position coda', () => {
  const a = byId.get('P1'); const b = byId.get('P2');
  const seq = t2(a, b, 3);
  assert.equal(seq.at(-2).fret, a[2].fret);
  assert.equal(seq.at(-1).fret, a[0].fret);
});

test('t2Pairs drops the PkH -> PkL break', () => {
  const { chain: c, k } = buildChain(0, MODES.Ionian);
  const pairs = t2Pairs(c);
  if (k < 7) {
    assert.ok(!pairs.some(([x, y]) => x === `P${k}H` && y === `P${k}L`));
    assert.equal(pairs.length, c.length - 2);
  } else {
    assert.equal(pairs.length, c.length - 1);
  }
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/sequences.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 `sequences.mjs`**（照搬 `theory.mjs` 的 `stepFor`/`t1`/`t2`/`t2Pairs`）

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/sequences.test.mjs`
Expected: `# pass 5`

- [ ] **Step 5: 提交**

```bash
git add src/core/sequences.mjs test/sequences.test.mjs
git commit -m "feat(core): T1/T2 sequence primitives"
```

---

### Task 6: 类型注册表

**Files:**
- Create: `src/types/t1.mjs`
- Create: `src/types/t2.mjs`
- Create: `src/types/index.mjs`
- Test: `test/types.test.mjs`

**Interfaces:**
- Consumes: `t1`/`t2`（Task 5）、`t2Pairs`。
- Produces: 每个类型模块 `export const label: string`、`export const slots: (chain) => { id: string, from: string[] }[]`、`export const name: (key, mode, interval, slotId) => string`、`export const notes: (byPos, slot, interval) => Note[]`；`TYPES: Record<string, TypeSpec>`、`TYPE_NAMES: string[]`。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, TYPE_NAMES } from '../src/types/index.mjs';
import { buildChain } from '../src/core/positions.mjs';
import { MODES } from '../src/core/modes.mjs';

const { chain } = buildChain(0, MODES.Ionian);
const byPos = new Map(chain.map((p) => [p.id, p.notes]));

test('registry exposes T1 and T2 only', () => {
  assert.deepEqual(TYPE_NAMES.sort(), ['T1', 'T2']);
});

test('T1 slots are one per position, named <key>-<mode>-i<n>-<pos>-T1', () => {
  const spec = TYPES.T1;
  const slots = spec.slots(chain);
  assert.equal(slots.length, chain.length);
  assert.equal(spec.name('C', 'Ionian', 3, 'P1'), 'C-Ionian-i3-P1-T1');
  assert.equal(spec.notes(byPos, slots[0], 3).length, 32); // i3, step 1, top=15 -> 16 pairs
});

test('T2 slots are adjacent pairs, named with A_B', () => {
  const spec = TYPES.T2;
  const slots = spec.slots(chain);
  assert.ok(slots.every((s) => s.from.length === 2));
  assert.match(spec.name('C', 'Ionian', 3, slots[0].id), /^C-Ionian-i3-P\d+_P\d+-T2$/);
});

test('every slot produces a non-empty note sequence', () => {
  for (const t of TYPE_NAMES) {
    for (const slot of TYPES[t].slots(chain)) {
      const seq = TYPES[t].notes(byPos, slot, 3);
      assert.ok(seq.length > 0, `${t} ${slot.id}`);
      assert.ok(seq.every((n) => typeof n.fret === 'number' && typeof n.string === 'number'));
    }
  }
});

test('adding a T3 stub needs only a registry entry', () => {
  const stub = {
    label: '测试类型',
    slots: (c) => [{ id: 'X', from: [c[0].id] }],
    name: (k, m, i, s) => `${k}-${m}-i${i}-${s}-T3`,
    notes: (pos, slot, i) => TYPES.T1.notes(pos, slot, i),
  };
  TYPES.T3 = stub;
  assert.equal(TYPES.T3.name('C', 'Ionian', 3, 'X'), 'C-Ionian-i3-X-T3');
  delete TYPES.T3;
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/types.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现三个模块**

`t1.mjs`：`label = '同把位上下行'`；`slots = (chain) => chain.map(p => ({ id: p.id, from: [p.id] }))`；`name = (k,m,i,s) => \`${k}-${m}-i${i}-${s}-T1\``；`notes = (byPos, slot, i) => t1(byPos.get(slot.from[0]), i)`。
`t2.mjs`：`label = '相邻把位上下行'`；`slots = (chain) => t2Pairs(chain).map(([a,b]) => ({ id: \`${a}_${b}\`, from: [a,b] }))`；`name = \`${k}-${m}-i${i}-${s}-T2\``；`notes = (byPos, slot, i) => t2(byPos.get(slot.from[0]), byPos.get(slot.from[1]), i)`。
`index.mjs`：`export const TYPES = { T1: t1, T2: t2 }`；`export const TYPE_NAMES = Object.keys(TYPES)`。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/types.test.mjs`
Expected: `# pass 5`

- [ ] **Step 5: 提交**

```bash
git add src/types test/types.test.mjs
git commit -m "feat(types): T1/T2 registry driven by type specs"
```

---

### Task 7: alphaTex 渲染

**Files:**
- Create: `src/render/alphatex.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: `INTERVAL_NAMES`（新建在本任务或 Task 2，本任务内定义并导出）。
- Produces: `renderAlphaTex({ keyName, modeName, id, interval, typeLabel, notes, positionLabel, keySignatureName }) -> string`；`noteToken(note) -> string`（`'8.6'` 形式）。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAlphaTex, noteToken } from '../src/render/alphatex.mjs';

const notes = Array.from({ length: 10 }, (_, i) => ({ fret: 5 + i, string: 6, midi: 48 + i }));
const tex = renderAlphaTex({
  keyName: 'C', modeName: 'Ionian', id: 'C-Ionian-i3-P1-T1',
  interval: 3, typeLabel: '同把位上下行', notes, positionLabel: 'P1', keySignatureName: 'C',
});

test('note token is fret.string', () => {
  assert.equal(noteToken({ fret: 8, string: 6 }), '8.6');
});

test('header block is exact', () => {
  const lines = tex.split('\n');
  assert.equal(lines[0], '\\title "C Ionian · i3 · P1 · T1"');
  assert.equal(lines[1], '\\subtitle "三度模进 · 同把位上下行"');
  assert.equal(lines[2], '\\tempo 70');
  assert.equal(lines[3], '\\track "Guitar" { instrument acousticguitarsteel }');
  assert.equal(lines[4], '\\staff { score tabs }');
  assert.equal(lines[5], '\\tuning (E4 B3 G3 D3 A2 E2)');
  assert.equal(lines[6], '\\ts 4 4');
  assert.equal(lines[7], '\\ks C');
  assert.equal(lines[8], '\\section "C-Ionian-i3-P1-T1"');
});

test('bars hold 8 eighths and pad with rests', () => {
  // 10 notes -> 2 bars: 8 notes + 2 notes + 6 rests
  assert.match(tex, /^:8 5\.6 6\.6 7\.6 8\.6 9\.6 10\.6 11\.6 12\.6 \| 13\.6 14\.6 r r r r r r \|$/m);
});

test('title uses the type label, not a hardcoded T1/T2 branch', () => {
  const other = renderAlphaTex({
    keyName: 'C', modeName: 'Dorian', id: 'x', interval: 5,
    typeLabel: '测试类型', notes, positionLabel: 'P2', keySignatureName: 'Bb',
  });
  assert.match(other, /\\subtitle "五度模进 · 测试类型"/);
  assert.match(other, /\\ks Bb/);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/render.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 `alphatex.mjs`**

逐行模板照搬现有 `theory.mjs:renderAlphaTex`，唯一改动：副标题的 type 中文名来自参数 `typeLabel`，不再有 `type === 'T1' ? ... : ...`。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/render.test.mjs`
Expected: `# pass 4`

- [ ] **Step 5: 提交**

```bash
git add src/render/alphatex.mjs test/render.test.mjs
git commit -m "feat(render): alphaTex emitter without type branching"
```

---

### Task 8: plan —— 唯一真源

**Files:**
- Create: `src/plan.mjs`
- Test: `test/plan.test.mjs`

**Interfaces:**
- Consumes: `parseKey`/`keySignatureFor`（Task 3）、`buildChain`（Task 4）、`TYPES`/`TYPE_NAMES`（Task 6）。
- Produces:
  - `DEFAULT_TARGETS`（见 §5.4）。
  - `buildPlan({ keys, modes, types } = {}) -> { exercises: Exercise[], skipped: Skip[] }`。
  - `Exercise = { id, dir, key, mode, interval, type, position, keySignature: { name, fifths }, notes }`。
  - `Skip = { key, mode, reason, suggestion }`。
  - 未知 key/mode/type 抛 `Error`（消息列出合法值）。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, DEFAULT_TARGETS } from '../src/plan.mjs';

test('default plan is the 1253-exercise set', () => {
  const { exercises, skipped } = buildPlan();
  assert.equal(skipped.length, 0);
  assert.equal(exercises.length, 1253);
});

test('default plan covers exactly the expected dirs', () => {
  const dirs = new Set(buildPlan().exercises.map((e) => e.dir));
  assert.deepEqual([...dirs].sort(), [
    'A-Ionian', 'B-Ionian', 'C-Aeolian', 'C-Dorian', 'C-Ionian', 'C-Locrian',
    'C-Lydian', 'C-Mixolydian', 'C-Phrygian', 'D-Ionian', 'E-Ionian', 'F-Ionian', 'G-Ionian',
  ]);
});

test('exercise shape carries everything downstream needs', () => {
  const ex = buildPlan().exercises[0];
  for (const k of ['id', 'dir', 'key', 'mode', 'interval', 'type', 'position', 'notes', 'keySignature']) {
    assert.ok(k in ex, `missing ${k}`);
  }
  assert.match(ex.id, /^[A-G]b?#?-[A-Za-z]+-i[2-8]-.+-(T1|T2)$/);
});

test('explicit keys x modes is a cartesian product', () => {
  const { exercises } = buildPlan({ keys: ['Db'], modes: ['Dorian'], types: ['T1'] });
  assert.ok(exercises.length > 0);
  assert.ok(exercises.every((e) => e.key === 'Db' && e.mode === 'Dorian' && e.type === 'T1'));
});

test('out-of-range signature is skipped with a suggestion, not thrown', () => {
  const { exercises, skipped } = buildPlan({ keys: ['G#'], modes: ['Ionian'] });
  assert.equal(exercises.length, 0);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].suggestion, 'Ab');
});

test('unknown type / mode / key throw with the valid set listed', () => {
  assert.throws(() => buildPlan({ types: ['T9'] }), /T1.*T2/);
  assert.throws(() => buildPlan({ modes: ['Blues'] }), /Ionian/);
  assert.throws(() => buildPlan({ keys: ['H'] }), /C#|合法/);
});

test('a new T3 registered in the type registry flows through plan', async () => {
  const { TYPES } = await import('../src/types/index.mjs');
  TYPES.T3 = {
    label: 'stub',
    slots: (c) => [{ id: c[0].id, from: [c[0].id] }],
    name: (k, m, i, s) => `${k}-${m}-i${i}-${s}-T3`,
    notes: (pos, slot, i) => TYPES.T1.notes(pos, slot, i),
  };
  try {
    const { exercises } = buildPlan({ keys: ['C'], modes: ['Ionian'], types: ['T3'] });
    assert.ok(exercises.length > 0);
    assert.ok(exercises.every((e) => e.type === 'T3'));
  } finally { delete TYPES.T3; }
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/plan.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 `src/plan.mjs`**

遍历顺序（决定 `.atex` 内容无影响，但 manifest/日志稳定）：`targets -> key -> mode -> interval(2..8) -> type -> slot`，与旧 `generate.mjs` 一致（每个 interval 内先 T1 全部把位，再 T2 全部对）。`keySignatureFor` 抛 `KEY_SIG_OUT_OF_RANGE` 时压入 `skipped` 并 `continue`，不中断。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/plan.test.mjs`
Expected: `# pass 7`

- [ ] **Step 5: 提交**

```bash
git add src/plan.mjs test/plan.test.mjs
git commit -m "feat(plan): single source of truth for exercises"
```

---

### Task 9: CLI 骨架与错误语义

**Files:**
- Create: `src/cli.mjs`
- Test: `test/cli.test.mjs`

**Interfaces:**
- Consumes: `buildPlan`（Task 8）。
- Produces: `node src/cli.mjs <generate|validate|manifest|plugins|import> [flags]`；退出码约定：`0` 成功、`1` 全部被拒或校验失败、`2` 参数错误、`3` 依赖缺失（如 alphatab 未安装）。

- [ ] **Step 1: 写失败测试**（用子进程跑真实 CLI）

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
const call = async (...args) => {
  try { const r = await run(process.execPath, [cli, ...args], { cwd: '/' }); return { code: 0, ...r }; }
  catch (e) { return { code: e.code, stdout: e.stdout, stderr: e.stderr }; }
};

test('help exits 0 and lists commands', async () => {
  const r = await call('--help');
  assert.equal(r.code, 0);
  for (const c of ['generate', 'validate', 'manifest', 'import']) assert.match(r.stdout, new RegExp(c));
});

test('unknown command exits 2', async () => {
  assert.equal((await call('frobnicate')).code, 2);
});

test('unknown type exits 2 and lists T1/T2', async () => {
  const r = await call('generate', '--types', 'T9', '--dry-run');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /T9/);
  assert.match(r.stderr, /T1/);
});

test('invalid key exits 2 and lists legal tonics', async () => {
  const r = await call('generate', '--keys', 'H', '--dry-run');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /C#|Db/);
});

test('dry-run default plan reports 1253 and works from any cwd', async () => {
  const r = await call('generate', '--dry-run');
  assert.equal(r.code, 0);
  assert.match(r.stdout, /1253/);
});

test('all targets rejected exits 1', async () => {
  const r = await call('generate', '--keys', 'G#', '--modes', 'Ionian', '--dry-run');
  assert.equal(r.code, 1);
  assert.match(r.stdout + r.stderr, /等音主音/);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/cli.test.mjs`
Expected: FAIL，`Cannot find module '../src/cli.mjs'`

- [ ] **Step 3: 实现 `src/cli.mjs`**

手写参数解析（不引第三方）：`--keys`、`--modes`、`--types`、`--out`、`--root`、`--sample`、`--dry-run`、`--help`。`generate` 先 `buildPlan`，`--dry-run` 只打印 `planned=<n> skipped=<n>`；被拒时每行打印 `SKIP <key> <mode>: <reason>；请改用等音主音 <suggestion>`。参数错误写 `stderr` 并 `process.exit(2)`。本任务 generate 的落盘先留空实现（Task 10 接），仅保证退出码与输出语义。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/cli.test.mjs`
Expected: `# pass 6`

- [ ] **Step 5: 提交**

```bash
git add src/cli.mjs test/cli.test.mjs
git commit -m "feat(cli): entry point with explicit exit-code contract"
```

---

### Task 10: 落盘、清单与逐字节回归

**Files:**
- Create: `src/generate.mjs`
- Create: `src/manifest.mjs`
- Create: `src/validate.mjs`
- Modify: `src/cli.mjs`（接上三个实现）
- Test: `test/regression.test.mjs`

**Interfaces:**
- Consumes: `buildPlan`、`renderAlphaTex`、`TYPES`。
- Produces:
  - `writePlan(exercises, outRoot) -> { written: number }`（`src/generate.mjs`）。
  - `buildManifest(exercises, root) -> Manifest`（含 `schemaVersion`、`generatedAt`、`totals`、`exercises[].sha256`）；`writeManifest(manifest, { jsonPath, mdPath })` 同时写 `manifest.json` 与人读版 `MANIFEST.md`。
  - `validatePlan(exercises, root) -> { errors: string[] }`（动态 `import('@coderline/alphatab')`，失败抛 `code='DEP_MISSING'`）；CLI 每个目录打印 `<dir>: <found>/<expected> files, errors=<n>`，末尾打印 `TOTAL files=<n> errors=<n>`。

- [ ] **Step 1: 写失败测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPlan } from '../src/plan.mjs';
import { writePlan } from '../src/generate.mjs';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;

test('regenerates byte-identical output for the default plan', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'ggt-'));
  try {
    const { exercises } = buildPlan();
    await writePlan(exercises, out);
    for (const dir of new Set(exercises.map((e) => e.dir))) {
      const files = (await readdir(path.join(out, dir))).sort();
      assert.ok(files.length > 0, dir);
      for (const f of files) {
        const a = await readFile(new URL(`../${dir}/${f}`, import.meta.url), 'utf8');
        const b = await readFile(path.join(out, dir, f), 'utf8');
        assert.equal(b, a, `${dir}/${f}`);
      }
    }
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('generating twice produces identical bytes (no timestamp in .atex)', async () => {
  const a = await mkdtemp(path.join(tmpdir(), 'ggt-a-'));
  const b = await mkdtemp(path.join(tmpdir(), 'ggt-b-'));
  try {
    const { exercises } = buildPlan();
    await writePlan(exercises, a); await writePlan(exercises, b);
    const one = path.join(a, 'C-Ionian', 'C-Ionian-i3-P1-T1.atex');
    const two = path.join(b, 'C-Ionian', 'C-Ionian-i3-P1-T1.atex');
    assert.equal(await readFile(two, 'utf8'), await readFile(one, 'utf8'));
  } finally { await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('manifest counts match the plan', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'ggt-m-'));
  try {
    await run(process.execPath, [cli, 'generate', '--out', out], { cwd: '/' });
    const m = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
    assert.equal(m.schemaVersion, 1);
    assert.equal(m.totals.exercises, 1253);
    assert.equal(m.exercises.length, 1253);
    assert.match(m.exercises[0].sha256, /^[0-9a-f]{64}$/);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('validate reports zero errors on a fresh generation', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'ggt-v-'));
  try {
    await run(process.execPath, [cli, 'generate', '--out', out], { cwd: '/' });
    const r = await run(process.execPath, [cli, 'validate', '--root', out], { cwd: '/' });
    assert.match(r.stdout, /errors=0/);
  } finally { await rm(out, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/regression.test.mjs`
Expected: FAIL，`writePlan` 未定义

- [ ] **Step 3: 实现 `generate.mjs` / `manifest.mjs` / `validate.mjs`，并在 `cli.mjs` 接上**

`writePlan`：逐条 `renderAlphaTex`（`typeLabel` 取 `TYPES[type].label`），`mkdir` 后 `writeFile(..., 'utf8')`。
`validate.mjs`：逐文件用 `AlphaTexImporter` 解析，比对 `fret`、`7 - string`、`realValue`、`masterBars.length === Math.ceil(notes/8)`、`keySignature`、`program === 25`、`displayTranspositionPitch === -12`、首尾音。
`manifest.mjs`：`sha256` 用 `node:crypto` 对内容计算；`generatedAt` 只进 manifest，不进 `.atex`。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/regression.test.mjs`
Expected: `# pass 4`（若 alphatab 未装，validate 用例报 `DEP_MISSING`，先 `npm install`）

- [ ] **Step 5: 提交**

```bash
git add src/generate.mjs src/manifest.mjs src/validate.mjs src/cli.mjs test/regression.test.mjs
git commit -m "feat: generate, manifest and alphaTab validation wired"
```

---

### Task 11: 入库插件

**Files:**
- Create: `src/plugins.mjs`
- Create: `plugins/import-textool/index.mjs`
- Create: `plugins/import-textool/README.md`
- Test: `test/plugin-import.test.mjs`

**Interfaces:**
- Consumes: `manifest`（可选，取 `sha256`）、`node:sqlite`。
- Produces: `loadPlugins(dir) -> Map<string, Plugin>`（加载失败只 `console.warn`）；插件契约 `{ name, command, describe, options, run(ctx) }`，`ctx = { argv, log, root }`。
- 插件参数：`--db <path>`（必填）、`--user <name>`（必填）、`--root <dir>`（默认 `dist`）、`--dry-run`、`--json <path>`。

- [ ] **Step 1: 写失败测试**（用临时 DB 夹具）

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildPlan } from '../src/plan.mjs';
import { writePlan } from '../src/generate.mjs';

const run = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url).pathname;
const repoRoot = new URL('..', import.meta.url).pathname;

const SCHEMA = `
CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE, deleted_at TEXT);
CREATE TABLE tabs (id TEXT PRIMARY KEY, owner_id TEXT, slug TEXT, title TEXT, artist TEXT,
  subtitle TEXT, content TEXT, content_hash TEXT, revision INTEGER, content_mtime_ms INTEGER,
  created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE tab_tags (tab_id TEXT, tag TEXT, position INTEGER, PRIMARY KEY (tab_id, tag));
`;

async function makeDb(withUser = true) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ggt-db-'));
  const db = new DatabaseSync(path.join(dir, 'alphatex.db'));
  db.exec(SCHEMA);
  if (withUser) db.prepare('INSERT INTO users VALUES (?,?,NULL)').run('u1', 'tester');
  db.close();
  return dir;
}

test('imports every exercise once, then skips duplicates', async () => {
  const dir = await makeDb();
  const products = await mkdtemp(path.join(tmpdir(), 'ggt-prod-'));
  try {
    await writePlan(buildPlan().exercises, products);   // self-contained, survives the dist/ migration
    const args = [cli, 'import', '--db', path.join(dir, 'alphatex.db'), '--user', 'tester', '--root', products];
    const r1 = await run(process.execPath, args, { cwd: '/' });
    assert.match(r1.stdout, /imported=1253/);
    const r2 = await run(process.execPath, args, { cwd: '/' });
    assert.match(r2.stdout, /imported=0/);
    const db = new DatabaseSync(path.join(dir, 'alphatex.db'));
    assert.equal(db.prepare('SELECT COUNT(*) c FROM tabs').get().c, 1253);
    db.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(products, { recursive: true, force: true });
  }
});

test('missing tabs table fails without creating anything', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ggt-empty-'));
  try {
    const dbPath = path.join(dir, 'alphatex.db');
    new DatabaseSync(dbPath).close();
    const r = await run(process.execPath, [cli, 'import', '--db', dbPath, '--user', 'tester', '--root', repoRoot], { cwd: '/' })
      .catch((e) => e);
    assert.notEqual(r.code, 0);
    const db = new DatabaseSync(dbPath);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE name='tabs'").get().c, 0);
    db.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('unknown user fails without creating the user', async () => {
  const dir = await makeDb(false);
  try {
    const r = await run(process.execPath, [cli, 'import', '--db', path.join(dir, 'alphatex.db'), '--user', 'ghost', '--root', repoRoot], { cwd: '/' })
      .catch((e) => e);
    assert.notEqual(r.code, 0);
    const db = new DatabaseSync(path.join(dir, 'alphatex.db'));
    assert.equal(db.prepare('SELECT COUNT(*) c FROM users').get().c, 0);
    db.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('main flow works with plugins present', async () => {
  const r = await run(process.execPath, [cli, 'generate', '--dry-run'], { cwd: '/' });
  assert.equal(r.code, 0);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/plugin-import.test.mjs`
Expected: FAIL，`unknown command: import`（退出码 2）

- [ ] **Step 3: 实现加载器与插件**

`src/plugins.mjs`：`readdir(pluginsDir, { withFileTypes: true })` → 对每个目录 `await import(fileURLToPath(.../index.mjs))`，`try/catch` 后 `warn` 跳过。
`plugins/import-textool/index.mjs`：本地实现 `extractScoreMeta(tex)`（正则取 `\title` / `\subtitle`）与 `slugify`；`node:sqlite` 打开 `--db`；先校验 `tabs` 表与 `users` 行，缺则 `process.exit(3)` 并打印所需条件；按 `(owner_id, content_hash)` 幂等；`--dry-run` 只统计。

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/plugin-import.test.mjs`
Expected: `# pass 4`

- [ ] **Step 5: 提交**

```bash
git add src/plugins.mjs plugins/import-textool test/plugin-import.test.mjs
git commit -m "feat(plugin): textool import as optional plugin"
```

---

### Task 12: 迁移收尾与最终验收

**Files:**
- Modify: `package.json`（`scripts.generate` 指向 `dist`）
- Modify: `.gitignore`（加 `dist/`）
- Delete: `theory.mjs`、`generate.mjs`、`manifest.mjs`、`validate-all.mjs`、`validate.mjs`、`validate-t1-keys.mjs`、`gate-modes.mjs`、`import-atex.mjs`、`update-db-instrument.mjs`、`MANIFEST.json`
- Move: 13 个 `<Key>-<Mode>/` 目录 → `dist/`
- Modify: `README.md`、`SPEC.md`（去掉 PNG 章节与旧脚本表）

**Interfaces:**
- Consumes: 前面全部任务。
- Produces: 可交付仓库。

- [ ] **Step 1: 产物迁入 `dist/`**

```bash
mkdir -p dist
for d in A-Ionian B-Ionian C-Aeolian C-Dorian C-Ionian C-Locrian C-Lydian C-Mixolydian C-Phrygian D-Ionian E-Ionian F-Ionian G-Ionian; do git mv "$d" dist/; done
git rm -r --cached dist >/dev/null
echo "dist/" >> .gitignore
```

- [ ] **Step 2: 删除旧脚本**

```bash
git rm theory.mjs generate.mjs manifest.mjs validate-all.mjs validate.mjs validate-t1-keys.mjs gate-modes.mjs import-atex.mjs update-db-instrument.mjs MANIFEST.json MANIFEST.md
```

- [ ] **Step 3: 全量测试**

Run: `npm test`
Expected: 所有用例通过，`# fail 0`

- [ ] **Step 4: 红线回归（与基线提交逐字节比对）**

```bash
rm -rf /tmp/ggt-check && node src/cli.mjs generate --out /tmp/ggt-check
for d in dist/*/; do diff -r "$d" "/tmp/ggt-check/$(basename "$d")" || exit 1; done
echo REGRESSION_OK
```

Expected: 输出 `REGRESSION_OK`（无任何 diff 行）

- [ ] **Step 5: 可移植性验证**

```bash
rm -rf /tmp/ggt-copy && cp -r . /tmp/ggt-copy && rm -rf /tmp/ggt-copy/node_modules /tmp/ggt-copy/dist
cd /tmp/ggt-copy && npm install --silent && node src/cli.mjs generate --out dist && node src/cli.mjs validate --root dist && node src/cli.mjs manifest --out dist/manifest.json
```

Expected: `errors=0`；退出码 0

- [ ] **Step 6: 无绝对路径检查**

Run: `grep -rn "/home/zzx604" src plugins test || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 7: 更新 README 与 SPEC**

README 重写为：安装（`npm i`）、三条命令、如何加一个主音、如何加一个类型（指向 `src/types/index.mjs`）、入库插件用法与前置条件。SPEC 保留乐理规格，删除 PNG 相关段落与旧脚本表；顶部统计改为"1253 个 `.atex`"。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "refactor: portable generator with type registry; products moved to dist/"
```

---

## Self-Review

**Spec coverage**

| Spec 章节 | 任务 |
|---|---|
| §5.1 plan 唯一真源 | Task 8 |
| §5.2 类型注册表 | Task 6、Task 8（T3 stub 用例） |
| §5.3 调号推导与拒绝 | Task 3 |
| §5.4 CLI 与默认目标集 | Task 9、Task 8（`DEFAULT_TARGETS`） |
| §5.5 插件契约 | Task 11 |
| §5.6 入库插件 | Task 11 |
| §5.7 manifest.json | Task 10 |
| §6 旧文件去向 | Task 12（Step 1–2） |
| §7 验收 1–7 | Task 10（1–3）、Task 9（4）、Task 11（5）、Task 12（Step 4–6） |

**类型一致性**：`buildPlan` 返回 `{ exercises, skipped }`；`writePlan(exercises, outRoot)`；`validatePlan(exercises, root)`；`buildManifest(exercises, root)`。Task 8/9/10 三处用法一致。`TYPE` spec 的四个键（`label/slots/name/notes`）在 Task 6 定义、Task 8/10 消费，未出现别名。

**已知取舍**：Task 9 的 `generate` 先只实现 `--dry-run` 语义，落盘在 Task 10 接上——这样 CLI 的退出码契约能独立验收，避免一个任务里同时赌两件事。
