# 课时薪资 · 微信小程序版 实现计划

> **设计依据：** `docs/superpowers/specs/2026-10-10-wechat-miniprogram-design.md`（已提交，commit `502cdc8`）。本计划中的所有决策编号（D1~D8）、风险编号（R1~R5）、待决项（T1~T3）均引用该文档。

**Goal:** 把现有纯本地 PWA 改造为**原生微信小程序**（TypeScript），通过"单一 core 源 + 双端适配"保住现有 83 个测试与全部容错解析逻辑，并满足个人主体上架要求。

**Architecture:** 纯逻辑抽到 `src/core/`（零平台依赖），web 与小程序各自做薄适配层。小程序数据用 wx storage（按月分片），Excel 能力（SheetJS）全部放分包，主包只留记账核心。

**Tech Stack:** 原生小程序（TS）+ 现有 Vite/React/Vitest（web 侧回归安全网）+ esbuild（core 构建）+ SheetJS + wx storage API。

---

## Global Constraints

沿用设计文档与既有规范，实施时必须满足：

1. 全部界面文案为**简体中文**。
2. **纯本地**：运行时不得发起任何网络请求；无服务器、无账号、无云同步（D2）。
3. `src/core/` **零平台依赖**：不得出现 `window` / `document` / `navigator` / `wx` / `crypto.subtle` / `localStorage`。唯一例外是 `core/workbook.ts` 可依赖 `xlsx`。
4. 金额显示保留 2 位小数；小时数保留 1~2 位小数。**金额不落库**，始终由 `rate × hours` 计算。
5. 小程序硬限制：**主包 ≤ 2 MB**；**单个 storage key ≤ 1 MB**；**storage 总量 ≤ 10 MB**。
6. `src/db/repo.ts` 现有的 **12 个函数签名保持不变**（设计 §4.1），只新增 `transaction`。
7. 小程序**页面层不含业务逻辑**（设计 §10.3）：只做 `setData` 准备、事件转发、平台 API 调用。
8. 移动端触控目标 ≥ 44×44px；字号 ≥ 16px；适配 `env(safe-area-inset-*)`。
9. Excel 导入列别名与解析规则沿用既有设计文档第 6 节，**不得改动行为**。
10. **web 端在每个阶段结束时必须 `npm test` 全绿 + `npm run build` 成功**（设计 §10.2 的回归安全网）。
11. 每个 Task 完成后提交 git；git 命令需带 `-c safe.directory=E:/rio/code/self/lesson-salary`。
12. 未决项 T1/T2/T3 在对应 Task 处处理，不得静默跳过。
13. 命令示例以 **pwsh（Windows）** 为准；文中 `grep` 用于表达"检查此项"，实际执行可用 grep 工具替代（Windows 无 `grep` 命令）。

## File Structure

```
lesson-salary/
├─ index.html                      # 改：入口指向 /src/web/main.tsx
├─ vite.config.ts                  # 不变
├─ vitest.config.ts                # 不变（tests/**/*.test.ts）
├─ scripts/
│  └─ build-core.mjs               # 新增：esbuild 构建 core 到小程序（Task 8）
├─ src/
│  ├─ core/                        # 新增：零平台依赖的纯逻辑
│  │  ├─ types.ts                  # ← src/types.ts
│  │  ├─ time.ts  format.ts  summary.ts  calendar.ts  dedup.ts
│  │  ├─ sha256.ts                 # 新增（Task 4）
│  │  ├─ parser.ts                 # ← 拆分自 src/lib/parser.ts（Task 2）
│  │  ├─ workbook.ts               # ← 拆分自 parser.ts + export.ts（Task 2/3）
│  │  ├─ repo.ts                   # 新增：Repo 接口（Task 5）
│  │  ├─ memoryRepo.ts             # 新增：内存实现（Task 5）
│  │  ├─ index.ts                  # 新增：主包入口（不含 XLSX）
│  │  └─ services/
│  │     ├─ importService.ts       # ← src/lib/importService.ts（Task 3）
│  │     └─ restoreService.ts      # ← src/lib/restoreService.ts（Task 3）
│  └─ web/                         # 新增：现有 PWA 适配层
│     ├─ main.tsx  App.tsx  index.css
│     ├─ db/{db.ts,repo.ts}        # ← src/db/*（Task 6 改为实现 Repo）
│     ├─ lib/{export.ts,pin.ts,installGuide.ts}
│     ├─ hooks/  components/  pages/
├─ miniprogram/                    # 新增：原生小程序
│  ├─ app.ts  app.json  app.wxss  sitemap.json  project.config.json
│  ├─ core/index.js                # 构建产物（Task 8）
│  ├─ shared/{repo.ts,file.ts,ui.ts,store.ts}
│  ├─ components/{sheet,month-picker,record-card,summary-card,group-list}/
│  ├─ pages/{summary,records,courseTypes,settings}/
│  └─ packageImport/
│     ├─ core-workbook.js          # 构建产物（含 XLSX，Task 15）
│     └─ pages/{import,export,backup}/
└─ tests/                          # 83 个测试保留，import 路径调整
```

---

# 阶段一：core 抽取（目标：零行为变更）

> 本阶段的验收标准只有一个：**`npm test` 83 个测试全绿 + `npm run build` 成功，且 web 端行为与改动前完全一致**。不新增任何功能。

### Task 1: 建立目录骨架并迁移纯模块

**Files:**
- Create: `src/core/`（目录）
- Create: `src/web/`（目录）
- Move: `src/types.ts` → `src/core/types.ts`
- Move: `src/lib/{time,format,summary,calendar,dedup}.ts` → `src/core/`
- Move: `src/lib/{pin,installGuide}.ts` → `src/web/lib/`
- Move: `src/db/{db,repo}.ts` → `src/web/db/`
- Move: `src/{main.tsx,App.tsx,index.css}` → `src/web/`
- Move: `src/{hooks,components,pages}/` → `src/web/`
- Modify: `index.html`（入口指向 `/src/web/main.tsx`）
- Modify: 全部受影响文件的相对 import 路径
- Modify: `tests/time.test.ts` `tests/format.test.ts` `tests/summary.test.ts` `tests/calendar.test.ts` `tests/dedup.test.ts` `tests/repo.test.ts` `tests/pin.test.ts` `tests/usePin.test.ts` `tests/installGuide.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `src/core/` 与 `src/web/` 的目录边界；后续所有 Task 依赖该结构

- [ ] **Step 1: 用 `git mv` 移动文件，保留历史**

```powershell
cd E:\rio\code\self\lesson-salary
New-Item -ItemType Directory -Force src\core, src\web\lib, src\web\db | Out-Null

$G = @('-c', 'safe.directory=E:/rio/code/self/lesson-salary')
git @G mv src/types.ts src/core/types.ts
git @G mv src/lib/time.ts, src/lib/format.ts, src/lib/summary.ts, src/lib/calendar.ts, src/lib/dedup.ts src/core/
git @G mv src/lib/pin.ts, src/lib/installGuide.ts src/web/lib/
git @G mv src/db/db.ts, src/db/repo.ts src/web/db/
git @G mv src/main.tsx, src/App.tsx, src/index.css src/web/
git @G mv src/hooks src/web/hooks
git @G mv src/components src/web/components
git @G mv src/pages src/web/pages
```

> PowerShell 无法像 bash 那样用变量拼接整条命令，故拆成参数数组 `$G` + `git @G`。

`src/lib/` 此时应只剩 `parser.ts`、`export.ts`、`importService.ts`、`restoreService.ts`（Task 2/3 处理）。

- [ ] **Step 2: 修正 import 路径**

规则（按引用方所在位置）：

| 引用方 | 原写法 | 新写法 |
|---|---|---|
| `src/core/*` 之间 | `../types` | `../types`（不变） |
| `src/web/**` → core | `../types` / `../../types` | `../core/types` / `../../core/types` |
| `src/web/**` → web 内 | `./db/db` / `../db/repo` | 不变（相对位置未变） |
| `src/web/lib/pin.ts` → core | `../db/repo` | `../../db/repo`（pin 留在 web，引用 web 的 repo） |
| `tests/*` → core | `../src/lib/x` | `../src/core/x` |
| `tests/repo.test.ts` | `../src/db/repo` | `../src/web/db/repo` |
| `tests/pin.test.ts` | `../src/lib/pin` | `../src/web/lib/pin` |
| `tests/usePin.test.ts` | `../src/hooks/usePin` | `../src/web/hooks/usePin` |
| `tests/installGuide.test.ts` | `../src/lib/installGuide` | `../src/web/lib/installGuide` |

`index.html`：`<script type="module" src="/src/web/main.tsx"></script>`

- [ ] **Step 3: 验证 core 确实零平台依赖**

```bash
grep -rEn "window|document|navigator|localStorage|sessionStorage|wx\.|crypto\.subtle" src/core/
```

Expected: **无输出**（`src/core/` 此刻只含 6 个纯模块 + types，必然通过；此命令在 Task 2/3 后仍需通过）。

- [ ] **Step 4: 验证 web 端零回归**

```powershell
npm test       # Expected: 14 files / 83 tests 全部 PASS
npm run build  # Expected: 退出码 0，生成 dist/
```

> ⚠️ **环境已知问题（非代码问题）**：本机 esbuild 无法在 `%TEMP%`（`E:\Users\91149\AppData\Local\Temp`）创建/删除文件，报 `Access is denied`，导致 `npm run build` 失败。
> 该目录本身可写（手工建删文件正常），但 esbuild 的临时文件操作被拒。**与本次重构无关**（`tsc` 已通过）。
> 绕过方式：把 TEMP 指到工作区内再构建。
>
> ```powershell
> New-Item -ItemType Directory -Force .tmp-build | Out-Null
> $env:TEMP = "$PWD\.tmp-build"; $env:TMP = "$PWD\.tmp-build"
> npm run build
> Remove-Item .tmp-build -Recurse -Force
> ```
>
> 实测结果：**753.8 KB**，`index-*.js` 哈希 `index-B_O5EYC_.js`（703.8 KB）—— 与重构前基线 **754 KB / `index-B_O5EYC_.js` 完全相同**，证明零行为变更。

- [ ] **Step 5: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "refactor: 抽取 src/core 与 src/web 目录边界（零行为变更）"
```

---

### Task 2: 拆分 `parser.ts`

**Files:**
- Create: `src/core/parser.ts`（纯解析，无 XLSX）
- Create: `src/core/workbook.ts`（XLSX 相关）
- Delete: `src/lib/parser.ts`
- Modify: `tests/parser.test.ts`（import 分两处）
- Modify: `src/web/pages/ImportPage.tsx`（`parseWorkbook` 改从 core/workbook 引入）

**Interfaces:**
- Consumes: `core/types.ts`、`core/time.ts`
- Produces（签名与现有实现**完全一致**，仅文件位置变化）：
  - `core/parser.ts`：`ColumnKey`、`detectColumns(headers)`、`buildPreviewFromRows(rows, existing)`、`ParsedRow`、`ImportPreview`
  - `core/workbook.ts`：`parseWorkbook(buffer, fileName, existing): Promise<ImportPreview>`

- [ ] **Step 1: 拆分（纯搬移，不改逻辑）**

`core/parser.ts`：把现有 `parser.ts` 中 `ALIASES`、`ColumnKey`、`detectColumns`、`isBlank`、`parseRate`、`ParsedRow`、`buildPreviewFromRows`、`ImportPreview` 原样搬入；删除 `import * as XLSX from 'xlsx'`。

`core/workbook.ts`：搬入 `parseWorkbook`，改为：

```ts
import * as XLSX from 'xlsx'
import type { CourseType, LessonRecord } from './types'
import { detectColumns, buildPreviewFromRows, type ImportPreview } from './parser'
import { sha256Hex } from './sha256'   // Task 4 提供；本 Task 先临时保留 crypto.subtle，见 Step 2

export async function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  existing: { courseTypes: CourseType[]; records: LessonRecord[] }
): Promise<ImportPreview> {
  // ...原有逻辑不变...
}
```

> **注意顺序依赖**：`sha256.ts` 在 Task 4 才建立。本 Task 先保留 `crypto.subtle.digest`，Task 4 再替换。这样每个 Task 结束时测试都是绿的。

- [ ] **Step 2: 修正测试 import**

```ts
// tests/parser.test.ts
import { buildPreviewFromRows, detectColumns } from '../src/core/parser'
import { parseWorkbook } from '../src/core/workbook'
```

- [ ] **Step 3: 验证**

```bash
npm test -- tests/parser.test.ts   # Expected: 16 tests PASS
grep -rE "from 'xlsx'|\"xlsx\"" src/core/parser.ts   # Expected: 无输出
npm test && npm run build
```

- [ ] **Step 4: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "refactor: 拆分 parser 为纯解析(parser)与工作簿(workbook)"
```

---

### Task 3: 拆分 `export.ts` 并迁移 services

**Files:**
- Modify: `src/core/workbook.ts`（并入建表与备份解析函数）
- Create: `src/web/lib/export.ts`（仅保留 DOM 保存逻辑）
- Delete: `src/lib/export.ts`
- Move: `src/lib/importService.ts` → `src/core/services/importService.ts`
- Move: `src/lib/restoreService.ts` → `src/core/services/restoreService.ts`
- Modify: `tests/export.test.ts`、`tests/importService.test.ts`、`tests/restoreService.test.ts`

**Interfaces:**
- Produces：
  - `core/workbook.ts` 新增：`createImportTemplateWorkbook()`、`createExportAllWorkbook(records, courseTypes)`、`createMonthlyWorkbook(records, groups)`、`parseBackupWorkbook(buffer)`
  - `web/lib/export.ts` 保留：`SaveResult`、`saveWorkbook(wb, filename)`、`openLastExport()`、模块级 `lastExportUrl`（**这些是 DOM 专有，不进 core**）

- [ ] **Step 1: 搬移建表函数到 `core/workbook.ts`**

把 `export.ts` 中的 `createImportTemplateWorkbook`、`createExportAllWorkbook`、`createMonthlyWorkbook`、`parseBackupWorkbook` 原样搬入（它们只依赖 `xlsx` + `fmtMoney` + `computeHours` + `parseTimeRange`）。
把 `saveWorkbook`、`openLastExport`、`SaveResult`、`lastExportUrl` 留在 `src/web/lib/export.ts`。

- [ ] **Step 2: 迁移 services 到 `core/services/`**

先**只改路径不改逻辑**（注入 Repo 是 Task 6 的事）：

```ts
// src/core/services/importService.ts
import { db } from '../../web/db/db'                    // ← 临时，Task 6 改为注入 Repo
import { addBatch, listCourseTypes, saveCourseType, saveRecord } from '../../web/db/repo'
import type { ImportPreview } from '../parser'
```

> ⚠️ 这一步会**暂时违反"core 零平台依赖"约束**（core 反向引用 web）。这是刻意的过渡态：Task 6 用注入 Repo 消除它。**必须在 Task 6 的验收里重新跑约束检查**，不允许把违反状态留在阶段一之后。

> 备选：若不愿出现过渡态违反，可把 Task 6 与本 Task 合并执行。

- [ ] **Step 3: 修正测试 import**

```ts
// tests/export.test.ts
import { createExportAllWorkbook, createImportTemplateWorkbook, createMonthlyWorkbook, parseBackupWorkbook } from '../src/core/workbook'
// tests/importService.test.ts
import { applyImport } from '../src/core/services/importService'
// tests/restoreService.test.ts
import { restoreBackup } from '../src/core/services/restoreService'
```

- [ ] **Step 4: 验证与提交**

```bash
npm test      # Expected: 83 tests PASS
npm run build # Expected: 退出码 0
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "refactor: 拆分 export 为 workbook(纯)与 web 保存层，迁移 services 到 core"
```

---

# 阶段二：接口化与密码学

### Task 4: 纯 JS SHA-256（替换 `crypto.subtle.digest`）

**Files:**
- Create: `src/core/sha256.ts`
- Create: `tests/sha256.test.ts`
- Modify: `src/core/workbook.ts`（替换 hash 实现）

**Interfaces:**
- Produces: `sha256Hex(bytes: Uint8Array): string`、`fileHash(buffer: ArrayBuffer): string`
- 契约：输出必须与小写 hex 的 SHA-256 完全一致（`/^[0-9a-f]{64}$/`），因为 `tests/parser.test.ts` 已断言 `fileHash` 匹配该正则

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { sha256Hex, fileHash } from '../src/core/sha256'

const enc = new TextEncoder()

describe('sha256', () => {
  it('标准测试向量', () => {
    expect(sha256Hex(enc.encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex(enc.encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex(enc.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })
  it('跨块边界（55/56/64/65 字节）', () => {
    expect(sha256Hex(enc.encode('a'.repeat(55)))).toHaveLength(64)
    expect(sha256Hex(enc.encode('a'.repeat(56)))).toHaveLength(64)
    expect(sha256Hex(enc.encode('a'.repeat(64)))).toHaveLength(64)
    expect(sha256Hex(enc.encode('a'.repeat(65)))).toHaveLength(64)
  })
  it('百萬个 a 的标准向量', () => {
    expect(sha256Hex(enc.encode('a'.repeat(1000000))))
      .toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0')
  })
  it('fileHash 返回 64 位小写 hex', () => {
    expect(fileHash(new Uint8Array([1, 2, 3]).buffer)).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/sha256.test.ts   # Expected: FAIL（模块不存在）
```

- [ ] **Step 3: 实现 `src/core/sha256.ts`**

```ts
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

/** 纯 JS SHA-256，输出小写 hex。用于替代小程序缺失的 crypto.subtle.digest。 */
export function sha256Hex(bytes: Uint8Array): string {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])
  const bitLen = bytes.length * 8
  // padding: 0x80 + zeros + 64bit big-endian length
  const withOne = bytes.length + 1
  const paddedLen = (Math.ceil((withOne + 8) / 64)) * 64
  const msg = new Uint8Array(paddedLen)
  msg.set(bytes)
  msg[bytes.length] = 0x80
  // JS number 安全范围内，长度高 32 位用 Math.floor(bitLen / 2**32)
  const hi = Math.floor(bitLen / 4294967296)
  const lo = bitLen >>> 0
  const dv = new DataView(msg.buffer)
  dv.setUint32(paddedLen - 8, hi, false)
  dv.setUint32(paddedLen - 4, lo, false)

  const w = new Uint32Array(64)
  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g; g = f; f = e
      e = (d + t1) >>> 0
      d = c; c = b; b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0
  }
  let out = ''
  for (let i = 0; i < 8; i++) out += h[i].toString(16).padStart(8, '0')
  return out
}

export function fileHash(buffer: ArrayBuffer): string {
  return sha256Hex(new Uint8Array(buffer))
}
```

- [ ] **Step 4: 替换 `core/workbook.ts` 中的 hash**

```ts
// 删除：const hashBuf = await crypto.subtle.digest('SHA-256', buffer)
//       const fileHash = Array.from(new Uint8Array(hashBuf)).map(...).join('')
// 改为：
import { fileHash } from './sha256'
const hash = fileHash(buffer)
```

- [ ] **Step 5: 验证**

```bash
npm test -- tests/sha256.test.ts        # Expected: 4 tests PASS
npm test                                # Expected: 83 + 4 = 87 tests PASS
grep -n "crypto.subtle" src/core/       # Expected: 无输出
npm run build
```

- [ ] **Step 6: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: 纯 JS SHA-256 替代 crypto.subtle（小程序无 Web Crypto）"
```

---

### Task 5: `Repo` 接口 + 内存实现 + 契约测试

**Files:**
- Create: `src/core/repo.ts`
- Create: `src/core/memoryRepo.ts`
- Create: `tests/repo-contract.test.ts`

**Interfaces:**
- Consumes: `core/types.ts`
- Produces: `Repo` 接口（设计 §4.1 的 13 个方法）、`createMemoryRepo(): Repo`、`describeRepoContract(name, factory)`（供 Task 6 复用同一组断言）

- [ ] **Step 1: 写失败测试（契约，双实现共用）**

```ts
// tests/repo-contract.test.ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryRepo } from '../src/core/memoryRepo'
import type { Repo } from '../src/core/repo'
import type { CourseType, ImportBatch, LessonRecord } from '../src/core/types'

function ct(over: Partial<CourseType> = {}): CourseType {
  return { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: 'T', ...over }
}
function rec(over: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'import', batchId: null, note: '', createdAt: 'T', ...over
  }
}

/** 同一组契约断言，跑遍所有 Repo 实现 */
export function describeRepoContract(name: string, make: () => Promise<Repo> | Repo) {
  describe(`Repo 契约: ${name}`, () => {
    let repo: Repo
    beforeEach(async () => { repo = await make() })

    it('课程类型增删查（按名称排序）', async () => {
      await repo.saveCourseType(ct({ id: 'b', name: '乙' }))
      await repo.saveCourseType(ct({ id: 'a', name: '甲' }))
      expect((await repo.listCourseTypes()).map(c => c.id)).toEqual(['b', 'a'])
      await repo.deleteCourseType('b')
      expect(await repo.listCourseTypes()).toHaveLength(1)
    })

    it('listRecords 按日期倒序', async () => {
      await repo.saveRecord(rec({ id: 'a', date: '2026-08-10' }))
      await repo.saveRecord(rec({ id: 'b', date: '2026-09-01' }))
      await repo.saveRecord(rec({ id: 'c', date: '2026-08-20' }))
      expect((await repo.listRecords()).map(r => r.id)).toEqual(['b', 'c', 'a'])
    })

    it('listRecords(month) 只返回该月', async () => {
      await repo.saveRecord(rec({ id: 'a', date: '2026-08-10' }))
      await repo.saveRecord(rec({ id: 'b', date: '2026-09-01' }))
      expect((await repo.listRecords('2026-08')).map(r => r.id)).toEqual(['a'])
    })

    it('批次按 hash 查找与整批级联删除', async () => {
      const b: ImportBatch = { id: 'b1', filename: 'a.xlsx', fileHash: 'h1', importedAt: 'T', rowCount: 2 }
      await repo.addBatch(b)
      expect((await repo.getBatchByHash('h1'))?.id).toBe('b1')
      await repo.saveRecord(rec({ id: 'x', batchId: 'b1' }))
      await repo.saveRecord(rec({ id: 'y', batchId: null }))
      expect(await repo.deleteBatch('b1')).toBe(1)
      expect(await repo.getBatchByHash('h1')).toBeUndefined()
      expect((await repo.listRecords()).map(r => r.id)).toEqual(['y'])
    })

    it('设置读写与缺省', async () => {
      await repo.setSetting('k', 'v')
      expect(await repo.getSetting<string>('k')).toBe('v')
      expect(await repo.getSetting<string>('missing')).toBeUndefined()
    })

    it('listStudentNames 去重且按中文排序', async () => {
      await repo.saveRecord(rec({ id: 'a', student: '张三' }))
      await repo.saveRecord(rec({ id: 'b', student: '李四' }))
      await repo.saveRecord(rec({ id: 'c', student: '张三' }))
      expect(await repo.listStudentNames()).toEqual(['李四', '张三'])
    })

    it('transaction 成功提交', async () => {
      await repo.transaction(async () => {
        await repo.saveRecord(rec({ id: 'a' }))
        await repo.saveCourseType(ct())
      })
      expect(await repo.listRecords()).toHaveLength(1)
      expect(await repo.listCourseTypes()).toHaveLength(1)
    })

    it('transaction 失败回滚（不落半成品）', async () => {
      await repo.saveRecord(rec({ id: 'keep' }))
      await expect(repo.transaction(async () => {
        await repo.saveRecord(rec({ id: 'gone' }))
        throw new Error('boom')
      })).rejects.toThrow('boom')
      expect((await repo.listRecords()).map(r => r.id)).toEqual(['keep'])
    })
  })
}

describeRepoContract('memoryRepo', () => createMemoryRepo())
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/repo-contract.test.ts   # Expected: FAIL（模块不存在）
```

- [ ] **Step 3: 实现 `src/core/repo.ts`**

```ts
import type { CourseType, ImportBatch, LessonRecord } from './types'

export interface Repo {
  listCourseTypes(): Promise<CourseType[]>
  saveCourseType(ct: CourseType): Promise<void>
  deleteCourseType(id: string): Promise<void>
  listRecords(month?: string): Promise<LessonRecord[]>
  saveRecord(r: LessonRecord): Promise<void>
  deleteRecord(id: string): Promise<void>
  addBatch(b: ImportBatch): Promise<void>
  getBatchByHash(hash: string): Promise<ImportBatch | undefined>
  deleteBatch(batchId: string): Promise<number>
  getSetting<T>(key: string): Promise<T | undefined>
  setSetting(key: string, value: unknown): Promise<void>
  listStudentNames(): Promise<string[]>
  transaction<T>(fn: () => Promise<T>): Promise<T>
}
```

- [ ] **Step 4: 实现 `src/core/memoryRepo.ts`**

要点：内部持有四个数组/Map；`transaction` 用**整体快照 + 失败还原**实现；`listRecords` 按 `date` 倒序；`listStudentNames` 用 `localeCompare(b, 'zh-CN')`（与现有实现一致）。

- [ ] **Step 5: 验证与提交**

```bash
npm test -- tests/repo-contract.test.ts   # Expected: 8 tests PASS
npm test && npm run build
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: Repo 接口 + 内存实现 + 契约测试"
```

---

### Task 6: web 端实现 Repo，core 消除平台依赖

**Files:**
- Modify: `src/web/db/repo.ts`（导出 `createDexieRepo(): Repo`）
- Modify: `src/core/services/importService.ts`、`src/core/services/restoreService.ts`（改为注入 `Repo`）
- Modify: `tests/importService.test.ts`、`tests/restoreService.test.ts`（注入 memoryRepo）、`tests/repo.test.ts`
- Modify: `src/web/pages/*`、`src/web/hooks/*`（改用 repo 实例）

**Interfaces:**
- Consumes: `core/repo.ts`、`core/memoryRepo.ts`
- Produces：
  - `createDexieRepo(): Repo`（web）
  - `applyImport(preview: ImportPreview, repo: Repo): Promise<{ batchId: string; inserted: number }>`
  - `restoreBackup(backup, mode: 'merge' | 'overwrite', repo: Repo): Promise<{ records: number; courseTypes: number }>`

- [ ] **Step 1: 把 `describeRepoContract` 用到 Dexie 实现上**

在 `tests/repo-contract.test.ts` 末尾追加：

```ts
import { db } from '../src/web/db/db'
import { createDexieRepo } from '../src/web/db/repo'
describeRepoContract('dexieRepo', async () => {
  await db.delete(); await db.open()
  return createDexieRepo()
})
```

- [ ] **Step 2: 改造 services 签名**

```ts
// src/core/services/importService.ts
import type { Repo } from '../repo'
import type { ImportPreview } from '../parser'

export async function applyImport(preview: ImportPreview, repo: Repo) {
  // 原逻辑不变，把 db.transaction(...) → repo.transaction(...)
  // 把 listCourseTypes/addBatch/saveCourseType/saveRecord → repo.*
}
```

`restoreService.ts` 同样处理（`db.records.clear()` → 通过 `repo.transaction` + 逐条删除，或给 Repo 增加 `clearAll()`；**若采用后者需同步更新设计 §4.1 的接口清单**）。

> **待决点**：`restoreService` 的 `overwrite` 模式需要"清空全部"能力。现有 Repo 接口没有。两个选项：(a) 在 `Repo` 增加 `clearAll(): Promise<void>`；(b) 用 `listRecords()` + `deleteRecord()` 循环实现。**推荐 (a)**，实现更直接且契约可测。选定后回写设计文档 §4.1。

- [ ] **Step 3: 让 `src/core/` 重新变干净（关键验收）**

```bash
grep -rEn "window|document|navigator|localStorage|wx\.|crypto\.subtle|\.\./\.\./web" src/core/
```

Expected: **无输出**。这是 Global Constraint 3 的最终验收，也是 Task 3 过渡态的清账。

- [ ] **Step 4: web 端适配**

`src/web/db/repo.ts` 的 12 个具名导出改为 `createDexieRepo()` 返回的实例方法，同时**保留原有的具名导出**（`export const repo = createDexieRepo()` 再转发），把 web 页面/hooks 的改动面降到最小。

- [ ] **Step 5: 验证与提交**

```bash
npm test      # Expected: 全部 PASS（含契约测试跑两个实现）
npm run build
npm run test:e2e   # Playwright 回归
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "refactor: core services 注入 Repo，web 实现 Dexie Repo，core 恢复零平台依赖"
```

---

# 阶段三：小程序骨架

### Task 7: 小程序工程骨架

**Files:**
- Create: `miniprogram/app.json`、`app.ts`、`app.wxss`、`sitemap.json`、`project.config.json`
- Create: `miniprogram/tsconfig.json`
- Create: `miniprogram/pages/{summary,records,courseTypes,settings}/index.{ts,wxml,wxss,json}`（占位）

**Interfaces:**
- Produces: 可在微信开发者工具中打开并运行的 4 个 tab 占位页

- [ ] **Step 1: `app.json`**

```json
{
  "pages": [
    "pages/summary/index",
    "pages/records/index",
    "pages/courseTypes/index",
    "pages/settings/index"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#1f6feb",
    "navigationBarTitleText": "课时薪资",
    "navigationBarTextStyle": "white"
  },
  "tabBar": {
    "color": "#8a8f98",
    "selectedColor": "#1f6feb",
    "backgroundColor": "#ffffff",
    "list": [
      { "pagePath": "pages/summary/index", "text": "汇总" },
      { "pagePath": "pages/records/index", "text": "记录" },
      { "pagePath": "pages/courseTypes/index", "text": "课程" },
      { "pagePath": "pages/settings/index", "text": "设置" }
    ]
  },
  "darkmode": true,
  "sitemapLocation": "sitemap.json"
}
```

> `subpackages` 在 Task 15 追加。tabBar 图标（`iconPath`）在 Task 10 补，先留空以便跑通。

- [ ] **Step 2: `app.wxss` 移植现有全局样式**

把 `src/web/index.css` 的变量与基础样式移植为 WXSS：`rpx` 或 `px` 均可（**保持一致**），保留 `env(safe-area-inset-bottom)`，保留 `@media (prefers-color-scheme: dark)` 深色变量。

- [ ] **Step 3: 验证**

微信开发者工具导入 `miniprogram/` 目录 → 编译无报错，4 个 tab 可切换。
`npm test && npm run build` → 仍全绿（本 Task 不影响 web）。

- [ ] **Step 4: 提交**

---

### Task 8: core 构建脚本

**Files:**
- Create: `scripts/build-core.mjs`
- Create: `src/core/index.ts`
- Modify: `package.json`（新增 `build:core` 脚本）
- Modify: `.gitignore`（按 T3 结论决定是否忽略产物）

**Interfaces:**
- Produces：
  - `miniprogram/core/index.js` —— 主包用，**不含 XLSX**
  - `miniprogram/packageImport/core-workbook.js` —— 分包用，**含 XLSX 并 minify**

- [ ] **Step 1: 处理待决项 T3**

**T3：core 产物是否提交 git。** 决策依据：产物不提交更干净，但微信开发者工具打开项目时需要先跑 `npm run build:core`。**推荐：提交**（`project.config.json` 配好即可开箱运行，代价是每次改 core 要重新构建并提交）。选定后回写设计 §11。

- [ ] **Step 2: 写 `src/core/index.ts`**

```ts
/** 主包入口：只导出零平台依赖模块。
 *  禁止引入 workbook.ts —— 它依赖 XLSX，会把 424 KB 拖进主包（设计 §3.1）。
 *  也不导出 memoryRepo.ts —— 它只供测试使用，线上是死代码。 */
export * from './types'
export * from './time'
export * from './format'
export * from './summary'
export * from './calendar'
export * from './dedup'
export * from './parser'
export * from './repo'
export * from './sha256'
export * from './services/importService'
export * from './services/restoreService'
```

- [ ] **Step 3: 写 `scripts/build-core.mjs`**

```js
import { build } from 'esbuild'

const common = { bundle: true, format: 'cjs', target: 'es2018', logLevel: 'info' }

// 主包：不含 XLSX
await build({
  ...common,
  entryPoints: ['src/core/index.ts'],
  outfile: 'miniprogram/core/index.js',
  banner: { js: '/* 自动生成，请勿手改；源文件在 src/core/ */' }
})

// 分包：含 XLSX，必须 minify
await build({
  ...common,
  entryPoints: ['src/core/workbook.ts'],
  outfile: 'miniprogram/packageImport/core-workbook.js',
  minify: true,
  banner: { js: '/* 自动生成，请勿手改；源文件在 src/core/workbook.ts */' }
})
```

- [ ] **Step 4: 验证产物（R2 的实测验收）**

```bash
npm run build:core
```

Expected：
- `miniprogram/core/index.js` 存在，`grep -c "XLSX\|sheetjs" miniprogram/core/index.js` → **0**
- `miniprogram/packageImport/core-workbook.js` 存在，体积 **约 430~500 KB**（设计 §5.4 实测 XLSX 单独 minify 为 424 KB）
- 主包（除 `packageImport/` 外全部文件）合计 **< 2 MB**

- [ ] **Step 5: 提交**

---

### Task 9: wx storage Repo（按月分片 + 事务 + 容量守卫）

**Files:**
- Create: `miniprogram/shared/repo.ts`
- Create: `miniprogram/shared/store.ts`（key 常量与读写封装）

**Interfaces:**
- Consumes: `miniprogram/core/index.js` 的 `Repo` 类型
- Produces: `createWxRepo(): Repo`

**存储布局**（设计 §4.2）：

```
ls:records:index    → string[]         已存在的月份
ls:records:<YYYY-MM> → LessonRecord[]
ls:courseTypes      → CourseType[]
ls:batches          → ImportBatch[]
ls:settings         → Record<string, unknown>
```

- [ ] **Step 1: 实现 `store.ts`（含事务缓冲）**

```ts
let pending: Map<string, unknown> | null = null

export function load<T>(key: string, fallback: T): T {
  if (pending && pending.has(key)) return pending.get(key) as T
  try {
    const v = wx.getStorageSync(key)
    return v === '' || v === null || v === undefined ? fallback : (v as T)
  } catch {
    return fallback
  }
}

export function store(key: string, value: unknown): void {
  if (pending) pending.set(key, value)
  else wx.setStorageSync(key, value)
}

/** 小程序无事务：缓冲写入，成功一次性落盘，失败丢弃缓冲即回滚。不支持嵌套（内层会并入外层）。 */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const outer = pending === null
  if (outer) pending = new Map()
  try {
    const result = await fn()
    if (outer) {
      const buffered = pending!
      pending = null
      for (const [k, v] of buffered) wx.setStorageSync(k, v)
    }
    return result
  } catch (err) {
    if (outer) pending = null
    throw err
  }
}

export function remove(key: string): void {
  if (pending) pending.set(key, undefined)
  else wx.removeStorageSync(key)
}

/** 已用存储字节数（用于容量守卫） */
export function usedBytes(): number {
  try {
    const info = wx.getStorageInfoSync()
    return (info.currentSize ?? 0) * 1024
  } catch {
    return 0
  }
}
```

- [ ] **Step 2: 实现 `repo.ts`**

关键点：

- `listRecords(month?)`：有 month 读单片；无 month 读索引合并全部分片；**均按 `date` 倒序**（契约要求）
- `saveRecord(r)`：写入 `r.date.slice(0, 7)` 分片，并把该月加入 `ls:records:index`
- `deleteRecord(id)`：需先定位所在月份（遍历索引读分片查找）
- `deleteBatch(batchId)`：遍历全部分片删除匹配记录，返回删除数
- `listStudentNames()`：全量去重 + `localeCompare(b, 'zh-CN')`
- `transaction`：转发到 `store.transaction`

- [ ] **Step 3: 容量守卫**

写入前用 `JSON.stringify(...).length` 估算；`usedBytes() >= 8 MB` 时通过 `wx.showModal` 提示"本地存储接近上限，请先导出备份"。写入抛错时提示"本地存储已满，请先导出备份并清理数据"（设计 §4.4），**不得静默失败**。

- [ ] **Step 4: 验证**

开发者工具 Console 手动验证：写入记录 → 重新编译 → 数据仍在；`wx.getStorageInfoSync()` 的 key 列表符合布局。
（小程序端无自动化测试，见设计 §10.3；**此处的正确性由 Task 5 的契约测试 + 逻辑下沉保证**。）

- [ ] **Step 5: 提交**

---

# 阶段四：主包页面

> 阶段四与阶段五的页面层按 Global Constraint 7 只做薄适配：**所有计算调用 core**，页面不含业务规则。页面实现以现有 `src/web/pages/*` 与 `src/web/components/*` 为行为参照逐一对齐。

### Task 10: 公共组件与 tabBar 图标

**Files:** `miniprogram/components/{sheet,month-picker,record-card,summary-card,group-list}/`、`miniprogram/images/*`、`miniprogram/shared/ui.ts`

- [ ] **Step 1:** 实现 `sheet`（Bottom Sheet 自定义组件，对应 `src/web/components/Sheet.tsx`），WXSS 过渡动画 + 遮罩点击关闭
- [ ] **Step 2:** 实现 `month-picker`（对应 `MonthPicker.tsx`）：上下月箭头 + 月份选择
- [ ] **Step 3:** 实现 `record-card` / `summary-card` / `group-list`（对应同名组件）；金额与课时在 JS 层用 `core/format.ts` 预格式化后写入 `data`
- [ ] **Step 4:** `shared/ui.ts` 封装 `toast(msg)` / `confirm(msg)`（`wx.showToast` / `wx.showModal` 的 Promise 化）
- [ ] **Step 5:** 补 tabBar 图标到 `app.json` 的 `iconPath`/`selectedIconPath`
- [ ] **Step 6:** 验证：组件在开发者工具中单独预览正常；提交

---

### Task 11: 汇总页

**Files:** `miniprogram/pages/summary/index.{ts,wxml,wxss,json}`

**Interfaces:** Consumes `createWxRepo()`、`core/summary.ts` 的 `summarize()`、`core/format.ts`

- [ ] **Step 1:** 月份状态（默认当月）；`onShow` 时 `repo.listRecords(month)` → `summarize()`
- [ ] **Step 2:** 摘要卡：总收入、总课时、有效课次、取消课次（全部经 `fmtMoney` / `fmtHours` 预格式化）
- [ ] **Step 3:** 分组列表 Tab：按学生 / 按课程类型 / 按教学形式；每组显示课次、总课时、金额
- [ ] **Step 4:** 已取消区折叠展示
- [ ] **Step 5:** 底部按钮：「导出本月 Excel」→ `wx.navigateTo` 分包导出页（Task 17）；「导出备份」快捷入口（设计 §7 措施 4）
- [ ] **Step 6:** 空态：无记录时显示引导文案与「去导入」按钮
- [ ] **Step 7:** 验证：与 web 端同月数据核对数字一致；提交

---

### Task 12: 记录页（列表 + 日历双视图）

**Files:** `miniprogram/pages/records/index.*`、`miniprogram/components/day-detail-sheet/`

**Interfaces:** Consumes `core/calendar.ts`、`core/summary.ts`、`core/time.ts`

- [ ] **Step 1:** 列表视图（默认）：按月记录卡片，显示日期、时间段、学生、课程类型、时薪、金额、取消标记
- [ ] **Step 2:** 日历视图：调用 `core/calendar.ts` 生成月历数据（纯函数复用），有课日期加标记
- [ ] **Step 3:** 点日历某天 → 弹出当天明细 sheet
- [ ] **Step 4:** 补录/编辑表单 sheet：`<picker mode="date">` / `mode="time"`、学生、课程类型、时薪、状态、备注；课时由 `computeHours()` 自动算
- [ ] **Step 5:** 取消 / 恢复 / 删除记录（删除需二次确认）
- [ ] **Step 6:** 筛选：学生 / 课程类型 / 状态；分组显示（按天 / 课程 / 学生）与分组小计
- [ ] **Step 7:** 补录防重复确认（沿用现有 `dedup.ts` 逻辑）
- [ ] **Step 8:** 验证：与 web 端同月核对；提交

---

### Task 13: 课程类型页

**Files:** `miniprogram/pages/courseTypes/index.*`

- [ ] **Step 1:** 列表：启用 / 停用分组
- [ ] **Step 2:** 新增 / 编辑表单：名称、教学形式、状态、默认课时、默认时薪
- [ ] **Step 3:** 删除需二次确认（历史记录保留快照字段，不受影响）
- [ ] **Step 4:** 验证与提交

---

### Task 14: 设置页

**Files:** `miniprogram/pages/settings/index.*`

- [ ] **Step 1:** 入口：「导出全部数据（备份）」→ 分包备份页；「从备份恢复」→ 分包备份页
- [ ] **Step 2:** 备份提醒状态（设计 §7）：记录 `lastBackupAt` 到 `ls:settings`；超过 30 天未备份时在页面顶部显示提醒条，可关闭
- [ ] **Step 3:** 「清空所有数据」：`wx.showModal` 二次确认 → `repo` 清空 → 提示
- [ ] **Step 4:** 存储用量显示：`wx.getStorageInfoSync()` 的 `currentSize` / `limitSize`
- [ ] **Step 5:** 关于 / 版本 / 使用说明（含"数据仅存本机，请定期导出备份"）
- [ ] **Step 6:** 验证与提交

---

# 阶段五：分包功能（Excel）

### Task 15: 分包配置与 SheetJS 集成

**Files:**
- Modify: `miniprogram/app.json`（追加 `subpackages`）
- Create: `miniprogram/packageImport/pages/{import,export,backup}/index.*`
- Verify: `miniprogram/packageImport/core-workbook.js`（Task 8 产物）

- [ ] **Step 1: T1 已解决 —— SheetJS 已升级到 0.20.3**

原 `xlsx@0.18.5` 含 `CVE-2023-30533`（原型污染，0.19.3 修复）。已从官方 CDN 安装：

```bash
npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

验收结果：132 个测试全绿；`npm run build`（web）与 `npm run build:core`（小程序）均成功；
分包产物读写含中文 xlsx、SHA-256 指纹、备份往返全部验证正确；cpexcel 剔除与 Node 内置模块 stub 在 0.20.3 上依然生效。

- [ ] **Step 2: 追加分包配置**

```json
"subpackages": [
  {
    "root": "packageImport",
    "pages": ["pages/import/index", "pages/export/index", "pages/backup/index"]
  }
]
```

- [ ] **Step 3: 验证分包隔离**

```bash
grep -c "XLSX" miniprogram/core/index.js       # Expected: 0（主包不含 XLSX）
```

开发者工具 → 详情 → 本地代码：确认主包体积 < 2 MB，`packageImport` 单独计量。

- [ ] **Step 4:** 提交

---

### Task 16: 导入页

**Files:** `miniprogram/packageImport/pages/import/index.*`、`miniprogram/shared/file.ts`

**Interfaces:** Consumes `core-workbook.js` 的 `parseWorkbook`、`core` 的 `applyImport(preview, repo)`

- [ ] **Step 1:** 「下载导入模板」→ `createImportTemplateWorkbook()` → 写文件 → `wx.openDocument` / `wx.shareFileMessage`
- [ ] **Step 2:** 「选择 Excel 文件」→ `wx.chooseMessageFile({ count: 1, type: 'file', extension: ['xlsx','xls'] })`
- [ ] **Step 3:** `FileSystemManager.readFile({ filePath })` 取 `ArrayBuffer` → `parseWorkbook(buffer, name, { courseTypes, records })`
- [ ] **Step 4:** 预览表：列映射、总行数、异常行（红）、重复行（黄）、将新建课程类型（蓝），逐行勾选
- [ ] **Step 5:** 整文件重复提示（`getBatchByHash(fileHash)`）
- [ ] **Step 6:** 「确认导入」→ `applyImport(preview, repo)` → 提示已导入条数
- [ ] **Step 7:** 「撤销本批导入」→ `deleteBatch(batchId)`
- [ ] **Step 8:** 错误处理：用户取消选择 → 静默；解析失败 → `wx.showModal` 显示原因
- [ ] **Step 9:** 验证：用仓库里那份 `课时薪资-导入demo.xlsx` 真机验证；提交

---

### Task 17: 导出页（月报）

**Files:** `miniprogram/packageImport/pages/export/index.*`

- [ ] **Step 1:** 选择月份 → `repo.listRecords(month)` + `summarize()` → `createMonthlyWorkbook(records, groups)`
- [ ] **Step 2:** `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` → `ArrayBuffer`
- [ ] **Step 3:** `FileSystemManager.writeFile` 写到 `wx.env.USER_DATA_PATH/课时薪资-月报-YYYY-MM.xlsx`
- [ ] **Step 4:** 呈现：主按钮 `wx.openDocument({ filePath, showMenu: true })`；次按钮 `wx.shareFileMessage({ filePath })`
- [ ] **Step 5:** 失败兜底：`openDocument` 失败时自动降级到 `shareFileMessage` 并提示
- [ ] **Step 6:** 验证：导出文件用 Excel/WPS 打开，核对汇总与明细数字；提交

---

### Task 18: 备份恢复页

**Files:** `miniprogram/packageImport/pages/backup/index.*`

- [ ] **Step 1:** 「导出全部数据」→ `createExportAllWorkbook(records, courseTypes)` → 同 Task 17 的写/呈现路径，文件名 `课时薪资-备份-YYYY-MM-DD.xlsx`
- [ ] **Step 2:** 成功后写入 `ls:settings` 的 `lastBackupAt`（供 Task 14 的提醒使用）
- [ ] **Step 3:** 「从备份恢复」→ `chooseMessageFile` → `parseBackupWorkbook(buffer)` → 预览将恢复的记录数/课程类型数
- [ ] **Step 4:** 选择模式：**合并**（按记录 id 去重追加、课程类型按名称合并）/ **覆盖**（先清空）
- [ ] **Step 5:** 覆盖模式必须 `wx.showModal` 强确认（提示"当前数据将被清空"）
- [ ] **Step 6:** 执行 `restoreBackup(backup, mode, repo)` → 提示恢复结果
- [ ] **Step 7:** 验证：导出 → 清空 → 恢复，数据一致（含 `startTime`/`endTime`/`hours`）；提交

---

# 阶段六：收尾与上架

### Task 19: 空态、错误处理与体验收尾

- [ ] **Step 1:** 各页面空态（无记录 / 无课程类型 / 无筛选结果）
- [ ] **Step 2:** 全局加载态（导入解析、导出生成时的 `wx.showLoading`）
- [ ] **Step 3:** 触控目标 ≥ 44×44px、字号 ≥ 16px、安全区适配全量自查
- [ ] **Step 4:** 深色模式自查（`prefers-color-scheme`）
- [ ] **Step 5:** 真机验证（至少一台 iOS + 一台 Android）：导入、导出、备份恢复、日历、补录全流程
- [ ] **Step 6:** 提交

---

### Task 20: 上架材料与清单

- [ ] **Step 1: T2 已解决 —— 名称「三尺课时账」**（简称「课时账」），头像与介绍已上传生效。
  注册资料存档见 `docs/miniprogram-registration.md`。本步骤只需确认注册信息无误。
- [ ] **Step 2:** ICP 备案（个人主体）
- [ ] **Step 3:** 服务类目：工具 → 效率 / 工具 → 其他
- [ ] **Step 4:** 隐私协议配置：声明数据仅存用户设备本地、不收集不上传、零网络请求
- [ ] **Step 5:** 核对「清空所有数据」入口可用（用户数据可删除要求）
- [ ] **Step 6:** 上传代码 → 提交审核 → 审核问题跟踪
- [ ] **Step 7:** 全量回归：`npm test` + `npm run build` + `npm run test:e2e` 全绿（web 端未被小程序改动破坏）
- [ ] **Step 8:** 更新 `README.md`：新增小程序开发/构建/发布说明，说明 core 共享机制与 `npm run build:core` 的必要性

---

## 验收总表

| 阶段 | 验收标准 |
|---|---|
| 一 | `npm test` 83 全绿 + `npm run build` 成功 + web 行为无变化 |
| 二 | 87+ 全绿；契约测试同时覆盖 memoryRepo 与 Dexie；`grep` 确认 `src/core/` 零平台依赖 |
| 三 | `build:core` 产物正确（主包不含 XLSX）；主包 < 2 MB；小程序可在开发者工具运行 |
| 四 | 4 个主包页面功能与 web 端逐项对齐（同月数据数字一致） |
| 五 | 导入/导出/备份恢复真机跑通；`课时薪资-导入demo.xlsx` 可正确解析 |
| 六 | 备案与审核通过；`npm test` + `build` + `test:e2e` 全绿 |

## 待决项汇总（不得静默跳过）

| 编号 | 内容 | 处理位置 |
|---|---|---|
| T1 | ~~SheetJS 升级到 0.20.x（CVE-2023-30533）~~ **已解决：已升级 0.20.3** | Task 15 Step 1 |
| T2 | ~~小程序最终名称~~ **已解决：「三尺课时账」** | Task 20 Step 1（资料见 `docs/miniprogram-registration.md`） |
| T3 | `miniprogram/core/` 构建产物是否提交 git | Task 8 Step 1 |
| — | `Repo` 是否增加 `clearAll()`（`overwrite` 恢复需要） | Task 6 Step 2 |
