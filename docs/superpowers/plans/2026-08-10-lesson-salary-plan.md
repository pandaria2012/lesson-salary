# 课时薪资 PWA 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个移动端优先、数据完全本地（IndexedDB）、可安装为 PWA 的课时薪资计算应用：Excel 课程表导入 → 编辑/取消 → 按月汇总 → Excel 导出/备份恢复，带 PIN 锁。

**Architecture:** 纯前端单页应用（无后端、无网络请求）。Dexie.js 封装 IndexedDB 作为唯一数据源；SheetJS 负责 Excel 读/写；纯函数（时间解析、导入解析、汇总、PIN 哈希）与 UI 分离，纯函数用 Vitest 做 TDD；UI 用移动端优先的底部 Tab 单页切换。vite-plugin-pwa 提供离线缓存与安装能力，部署到免费静态托管（GitHub Pages/Cloudflare Pages）。

**Tech Stack:** Vite 5 + React 18 + TypeScript(strict) + Dexie 4 + SheetJS(xlsx 0.18.5) + vite-plugin-pwa(Workbox) + Vitest + fake-indexeddb。Node >= 18（本机 v22.20.0）。

## Global Constraints

- 全部界面文案为简体中文。
- 运行时不得发起任何网络请求；数据只存 IndexedDB 数据库 `lesson-salary`。
- 数据库 schema 版本固定为 v1（字段见 Task 2），后续如需变更必须新建版本迁移。
- 金额显示保留 2 位小数；小时数保留 2 位小数（如 2.5、1.75）。
- PIN：PBKDF2-SHA256、100000 次迭代、16 字节随机盐、hex 存储于 settings 表，绝不存明文。
- 移动端优先：可点元素 ≥ 44×44px；`viewport-fit=cover` 并适配 `env(safe-area-inset-*)`；字号 ≥ 16px。
- Excel 导入列别名与解析规则以设计文档 `docs/superpowers/specs/2026-08-10-lesson-salary-design.md` 第 6 节为准。
- 每条记录金额不落库，始终由 `rate × hours` 计算。
- 本仓库 `.git` 目录由 Administrators 所有，沙盒内 git 写入会失败；所有 git 命令必须用提权 shell 执行，并带 `-c safe.directory=E:/rio/code/self/lesson-salary`。
- npm 安装/构建需要网络或写缓存时，使用提权 shell。

## File Structure

```
lesson-salary/
├─ index.html                     # 入口 HTML（viewport-fit=cover、lang=zh-CN）
├─ package.json                   # 依赖与脚本
├─ vite.config.ts                 # Vite + React 插件
├─ vitest.config.ts               # 测试配置（node 环境，tests/**）
├─ tsconfig.json                  # strict TS
├─ public/icons/icon-192.png      # PWA 图标（Task 12 生成）
├─ public/icons/icon-512.png
├─ scripts/gen-icons.py           # 生成图标的 Python 脚本（Task 12）
├─ src/
│  ├─ main.tsx                    # 挂载入口
│  ├─ App.tsx                     # PIN 门禁 + 底部 Tab 路由
│  ├─ index.css                   # 全局样式/安全区/触控规范
│  ├─ types.ts                    # 全部共享类型
│  ├─ db/
│  │  ├─ db.ts                    # Dexie schema（唯一数据库入口）
│  │  └─ repo.ts                  # 所有 CRUD/查询函数（唯一数据访问层）
│  ├─ lib/
│  │  ├─ time.ts                  # 日期/时间段解析、小时计算（纯函数）
│  │  ├─ format.ts                # 金额/小时格式化（纯函数）
│  │  ├─ parser.ts                # Excel 行解析 → 预览（纯函数 + SheetJS 读）
│  │  ├─ importService.ts         # 预览确认后写库（含新建课程类型/批次）
│  │  ├─ export.ts                # 模板下载、全量导出、月报导出、备份解析（SheetJS 写/读）
│  │  ├─ restoreService.ts        # 备份恢复（合并/覆盖）
│  │  ├─ summary.ts               # 月度汇总纯函数
│  │  └─ pin.ts                   # PIN 哈希/校验（纯函数，Web Crypto）
│  ├─ hooks/
│  │  ├─ useMonth.ts              # 'YYYY-MM' 月份状态
│  │  ├─ useRecords.ts            # 按月记录加载/增删改
│  │  ├─ useCourseTypes.ts        # 课程类型加载/增删改
│  │  └─ usePin.ts                # PIN 状态/解锁/设置/后台锁定
│  ├─ components/
│  │  ├─ TabBar.tsx               # 底部 Tab（汇总/记录/导入/课程/设置）
│  │  ├─ MonthPicker.tsx          # 月份切换器
│  │  ├─ SummaryCard.tsx          # 摘要卡
│  │  ├─ GroupList.tsx            # 分组统计列表
│  │  ├─ RecordCard.tsx           # 记录卡片
│  │  ├─ RecordFormSheet.tsx      # 记录编辑 Bottom Sheet
│  │  ├─ CourseTypeFormSheet.tsx  # 课程类型编辑 Bottom Sheet
│  │  ├─ ImportPreview.tsx        # 导入预览表
│  │  ├─ PinLock.tsx              # PIN 解锁界面
│  │  ├─ Sheet.tsx                # 通用 Bottom Sheet 容器
│  │  └─ Toast.tsx                # 轻提示
│  └─ pages/
│     ├─ SummaryPage.tsx
│     ├─ RecordsPage.tsx
│     ├─ ImportPage.tsx
│     ├─ CourseTypesPage.tsx
│     └─ SettingsPage.tsx
└─ tests/
   ├─ smoke.test.ts
   ├─ repo.test.ts
   ├─ time.test.ts
   ├─ format.test.ts
   ├─ parser.test.ts
   ├─ importService.test.ts
   ├─ export.test.ts
   ├─ restoreService.test.ts
   ├─ summary.test.ts
   └─ pin.test.ts
```

---
### Task 1: 项目脚手架与构建配置

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `tests/smoke.test.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: 无（首任务）
- Produces: 可构建、可测试的空壳应用；npm 脚本 `dev/build/test/preview`；Vite 入口 `/src/main.tsx`。

- [ ] **Step 1: 写入 package.json**

```json
{
  "name": "lesson-salary",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "dexie": "^4.0.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "fake-indexeddb": "^6.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.8",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: 安装依赖（提权，需网络）**

Run: `npm install`
Expected: `node_modules` 生成，无致命错误。

- [ ] **Step 3: 写入 tsconfig.json / vite.config.ts / vitest.config.ts / index.html / .gitignore**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()]
})
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

`index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#1f6feb" />
    <title>课时薪资</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:

```
node_modules/
dist/
*.local
```

- [ ] **Step 4: 写入最小可运行应用**

`src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/App.tsx`:

```tsx
export default function App() {
  return <main className="app"><h1>课时薪资</h1></main>
}
```

`src/index.css`（移动端基础样式，后续任务复用）:

```css
:root {
  --bg: #f5f6f8;
  --card: #ffffff;
  --text: #1a1a1a;
  --muted: #8a8f98;
  --primary: #1f6feb;
  --danger: #d93025;
  --warn: #f9ab00;
  --border: #e3e6ea;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --tab-height: 56px;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body, #root { margin: 0; padding: 0; min-height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.5;
}
button { font: inherit; min-height: 44px; border: none; border-radius: 10px; background: var(--primary); color: #fff; padding: 0 16px; cursor: pointer; }
button:active { opacity: .8; }
input, select, textarea { font: inherit; font-size: 16px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); color: var(--text); width: 100%; }
.card { background: var(--card); border-radius: 14px; padding: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
@media (prefers-color-scheme: dark) {
  :root { --bg: #111315; --card: #1c1f23; --text: #eceff2; --muted: #9aa1aa; --border: #2a2f35; }
}
```

`tests/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('测试环境可用', () => {
    expect(1 + 1).toBe(2)
  })
})
```

`README.md`：项目名 + 一句话说明 + `npm install / npm run dev / npm run build / npm test`。

- [ ] **Step 5: 验证构建与测试**

Run: `npm run build`
Expected: 退出码 0，生成 `dist/`。

Run: `npm test`
Expected: 1 个测试通过。

- [ ] **Step 6: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "chore: 项目脚手架（Vite+React+TS+Vitest）"
```

---

### Task 2: 数据层（types + Dexie + repo）

**Files:**
- Create: `src/types.ts`
- Create: `src/db/db.ts`
- Create: `src/db/repo.ts`
- Test: `tests/repo.test.ts`

**Interfaces:**
- Consumes: 无（依赖 Dexie，Task 1 已装）
- Produces（后续任务全部依赖，签名必须一致）:
  - `types.ts` 导出：`CourseTypeStatus`、`CourseType`、`RecordStatus`、`RecordSource`、`LessonRecord`、`ImportBatch`、`AppSettings`
  - `db/db.ts` 导出：`db`（Dexie 实例，数据库名 `lesson-salary`，version(1)）
  - `db/repo.ts` 导出：
    - `listCourseTypes(): Promise<CourseType[]>`
    - `saveCourseType(ct: CourseType): Promise<void>`
    - `deleteCourseType(id: string): Promise<void>`
    - `listRecords(month?: string): Promise<LessonRecord[]>`（month 形如 `2026-08`，按日期倒序）
    - `saveRecord(r: LessonRecord): Promise<void>`
    - `deleteRecord(id: string): Promise<void>`
    - `addBatch(b: ImportBatch): Promise<void>`
    - `getBatchByHash(hash: string): Promise<ImportBatch | undefined>`
    - `deleteBatch(batchId: string): Promise<number>`（删除该批次全部记录，返回删除数）
    - `getSetting<T>(key: string): Promise<T | undefined>`
    - `setSetting(key: string, value: unknown): Promise<void>`

- [ ] **Step 1: 写失败测试 `tests/repo.test.ts`**

```ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import {
  addBatch, deleteBatch, deleteCourseType, deleteRecord,
  getBatchByHash, getSetting, listCourseTypes, listRecords,
  saveCourseType, saveRecord, setSetting
} from '../src/db/repo'
import type { CourseType, ImportBatch, LessonRecord } from '../src/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

function ct(over: Partial<CourseType> = {}): CourseType {
  return { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: '2026-08-10T00:00:00.000Z', ...over }
}

function rec(over: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'import', batchId: null, note: '',
    createdAt: '2026-08-10T00:00:00.000Z', ...over
  }
}

describe('repo', () => {
  it('课程类型增删查', async () => {
    await saveCourseType(ct())
    expect((await listCourseTypes()).map(c => c.id)).toEqual(['ct1'])
    await deleteCourseType('ct1')
    expect(await listCourseTypes()).toHaveLength(0)
  })

  it('按月份筛选记录（倒序）', async () => {
    await saveRecord(rec({ id: 'a', date: '2026-08-10' }))
    await saveRecord(rec({ id: 'b', date: '2026-09-01' }))
    await saveRecord(rec({ id: 'c', date: '2026-08-20' }))
    const rows = await listRecords('2026-08')
    expect(rows.map(r => r.id)).toEqual(['c', 'a'])
  })

  it('记录删除', async () => {
    await saveRecord(rec())
    await deleteRecord('r1')
    expect(await listRecords()).toHaveLength(0)
  })

  it('批次按 hash 查找与整批删除', async () => {
    const b: ImportBatch = { id: 'b1', filename: 'a.xlsx', fileHash: 'h1', importedAt: '2026-08-10T00:00:00.000Z', rowCount: 2 }
    await addBatch(b)
    expect((await getBatchByHash('h1'))?.id).toBe('b1')
    await saveRecord(rec({ id: 'x', batchId: 'b1' }))
    expect(await deleteBatch('b1')).toBe(1)
    expect(await getBatchByHash('h1')).toBeUndefined()
    expect(await listRecords()).toHaveLength(0)
  })

  it('设置读写', async () => {
    await setSetting('pin_hash', 'abc123')
    expect(await getSetting<string>('pin_hash')).toBe('abc123')
    expect(await getSetting<string>('missing')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/repo.test.ts`
Expected: FAIL（`Cannot find module '../src/db/db'` 或类型错误）。

- [ ] **Step 3: 实现 `src/types.ts`**

```ts
export type CourseTypeStatus = 'enabled' | 'disabled'
export type RecordStatus = 'normal' | 'cancelled'
export type RecordSource = 'import' | 'manual'

export interface CourseType {
  id: string
  name: string
  type: string
  status: CourseTypeStatus
  defaultHours: number | null
  defaultRate: number | null
  createdAt: string
}

export interface LessonRecord {
  id: string
  courseTypeId: string | null
  courseTypeName: string
  courseTypeKind: string
  rate: number | null
  student: string
  date: string
  startTime: string | null
  endTime: string | null
  hours: number | null
  status: RecordStatus
  source: RecordSource
  batchId: string | null
  note: string
  createdAt: string
}

export interface ImportBatch {
  id: string
  filename: string
  fileHash: string
  importedAt: string
  rowCount: number
}

export interface AppSettings {
  key: string
  value: unknown
}
```

- [ ] **Step 4: 实现 `src/db/db.ts`**

```ts
import Dexie, { type Table } from 'dexie'
import type { AppSettings, CourseType, ImportBatch, LessonRecord } from '../types'

export class SalaryDB extends Dexie {
  courseTypes!: Table<CourseType, string>
  records!: Table<LessonRecord, string>
  batches!: Table<ImportBatch, string>
  settings!: Table<AppSettings, string>

  constructor() {
    super('lesson-salary')
    this.version(1).stores({
      courseTypes: 'id, name, type, status',
      records: 'id, courseTypeId, student, date, status, batchId, source',
      batches: 'id, fileHash',
      settings: 'key'
    })
  }
}

export const db = new SalaryDB()
```

- [ ] **Step 5: 实现 `src/db/repo.ts`**

```ts
import { db } from './db'
import type { CourseType, ImportBatch, LessonRecord } from '../types'

export async function listCourseTypes(): Promise<CourseType[]> {
  return db.courseTypes.orderBy('name').toArray()
}

export async function saveCourseType(ct: CourseType): Promise<void> {
  await db.courseTypes.put(ct)
}

export async function deleteCourseType(id: string): Promise<void> {
  await db.courseTypes.delete(id)
}

export async function listRecords(month?: string): Promise<LessonRecord[]> {
  let coll = db.records.orderBy('date').reverse()
  if (month) coll = coll.filter(r => r.date.startsWith(month))
  return coll.toArray()
}

export async function saveRecord(r: LessonRecord): Promise<void> {
  await db.records.put(r)
}

export async function deleteRecord(id: string): Promise<void> {
  await db.records.delete(id)
}

export async function addBatch(b: ImportBatch): Promise<void> {
  await db.batches.put(b)
}

export async function getBatchByHash(hash: string): Promise<ImportBatch | undefined> {
  return db.batches.where('fileHash').equals(hash).first()
}

export async function deleteBatch(batchId: string): Promise<number> {
  const rows = await db.records.where('batchId').equals(batchId).toArray()
  await db.records.bulkDelete(rows.map(r => r.id))
  await db.batches.delete(batchId)
  return rows.length
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test -- tests/repo.test.ts`
Expected: 5 个测试全部 PASS。

- [ ] **Step 7: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: 数据层（types/Dexie/repo）"
```

---
### Task 3: 时间/日期解析与格式化（纯函数）

**Files:**
- Create: `src/lib/time.ts`
- Create: `src/lib/format.ts`
- Test: `tests/time.test.ts`
- Test: `tests/format.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `time.ts`:
    - `parseExcelDate(value: unknown, now?: Date): { date: string | null; ok: boolean; message?: string }`
    - `parseTimeRange(value: unknown): { startTime: string | null; endTime: string | null; ok: boolean; message?: string }`
    - `computeHours(startTime: string | null, endTime: string | null): number | null`
  - `format.ts`:
    - `fmtMoney(n: number): string`（如 500 → `500.00`）
    - `fmtHours(n: number): string`（如 2.5 → `2.5`，2.75 → `2.75`）

- [ ] **Step 1: 写失败测试 `tests/time.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { computeHours, parseExcelDate, parseTimeRange } from '../src/lib/time'

describe('parseExcelDate', () => {
  const now = new Date('2026-08-10T12:00:00+08:00')
  it('完整日期 yyyy-mm-dd / yyyy/m/d', () => {
    expect(parseExcelDate('2026-08-10', now)).toEqual({ date: '2026-08-10', ok: true })
    expect(parseExcelDate('2026/8/5', now)).toEqual({ date: '2026-08-05', ok: true })
  })
  it('缺年份 mm-dd 补当前年', () => {
    expect(parseExcelDate('08-10', now)).toEqual({ date: '2026-08-10', ok: true })
    expect(parseExcelDate('12-31', now)).toEqual({ date: '2026-12-31', ok: true })
  })
  it('Date 对象', () => {
    expect(parseExcelDate(new Date(2026, 7, 3), now)).toEqual({ date: '2026-08-03', ok: true })
  })
  it('非法值返回 ok=false', () => {
    expect(parseExcelDate('abc', now).ok).toBe(false)
    expect(parseExcelDate('13-40', now).ok).toBe(false)
  })
})

describe('parseTimeRange', () => {
  it('13-15 → 13:00/15:00', () => {
    expect(parseTimeRange('13-15')).toEqual({ startTime: '13:00', endTime: '15:00', ok: true })
  })
  it('13:00-15:30 与 13:00~15 与 13:00至15:30', () => {
    expect(parseTimeRange('13:00-15:30').endTime).toBe('15:30')
    expect(parseTimeRange('13:00~15').endTime).toBe('15:00')
    expect(parseTimeRange('13:00至15:30').endTime).toBe('15:30')
  })
  it('只有开始时间 → endTime 为 null 且 ok', () => {
    expect(parseTimeRange('14:00')).toEqual({ startTime: '14:00', endTime: null, ok: true })
  })
  it('空值 → 全 null 且 ok', () => {
    expect(parseTimeRange('')).toEqual({ startTime: null, endTime: null, ok: true })
  })
  it('非法 → ok=false', () => {
    expect(parseTimeRange('25:99-26:00').ok).toBe(false)
  })
})

describe('computeHours', () => {
  it('常规区间', () => {
    expect(computeHours('13:00', '15:00')).toBe(2)
    expect(computeHours('13:00', '15:30')).toBe(2.5)
  })
  it('跨天 22:00-00:30 → 2.5', () => {
    expect(computeHours('22:00', '00:30')).toBe(2.5)
  })
  it('任一为空 → null', () => {
    expect(computeHours(null, '15:00')).toBeNull()
    expect(computeHours('13:00', null)).toBeNull()
  })
})
```

- [ ] **Step 2: 写失败测试 `tests/format.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { fmtHours, fmtMoney } from '../src/lib/format'

describe('format', () => {
  it('金额保留两位', () => {
    expect(fmtMoney(500)).toBe('500.00')
    expect(fmtMoney(400.5)).toBe('400.50')
  })
  it('小时去尾零', () => {
    expect(fmtHours(2.5)).toBe('2.5')
    expect(fmtHours(2.75)).toBe('2.75')
    expect(fmtHours(2)).toBe('2')
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- tests/time.test.ts tests/format.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现 `src/lib/time.ts`**

```ts
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function parseExcelDate(value: unknown, now = new Date()): { date: string | null; ok: boolean; message?: string } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: toDateStr(value.getFullYear(), value.getMonth() + 1, value.getDate()), ok: true }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel 日期序列号：1899-12-30 起算
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    return { date: toDateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), ok: true }
  }
  if (typeof value !== 'string') return { date: null, ok: false, message: '日期格式无法识别' }
  const s = value.trim()
  let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/)
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return { date: null, ok: false, message: '日期数值越界' }
    return { date: toDateStr(y, mo, d), ok: true }
  }
  m = s.match(/^(\d{1,2})[-/.月](\d{1,2})日?$/)
  if (m) {
    const mo = Number(m[1]), d = Number(m[2])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return { date: null, ok: false, message: '日期数值越界' }
    return { date: toDateStr(now.getFullYear(), mo, d), ok: true }
  }
  return { date: null, ok: false, message: '日期格式无法识别' }
}

function normTime(token: string): string | null {
  const m = token.trim().match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1]), min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return null
  return `${pad2(h)}:${pad2(min)}`
}

export function parseTimeRange(value: unknown): { startTime: string | null; endTime: string | null; ok: boolean; message?: string } {
  if (value === null || value === undefined || value === '') {
    return { startTime: null, endTime: null, ok: true }
  }
  if (typeof value !== 'string') return { startTime: null, endTime: null, ok: false, message: '时间格式无法识别' }
  let s = value.trim().replace(/[～~—–至到]/g, '-')
  s = s.replace(/\s+/g, '')
  if (!s) return { startTime: null, endTime: null, ok: true }
  const parts = s.split('-').filter(Boolean)
  if (parts.length === 1) {
    const st = normTime(parts[0])
    if (!st) return { startTime: null, endTime: null, ok: false, message: '时间格式无法识别' }
    return { startTime: st, endTime: null, ok: true }
  }
  if (parts.length === 2) {
    const st = normTime(parts[0]), et = normTime(parts[1])
    if (!st || !et) return { startTime: null, endTime: null, ok: false, message: '时间格式无法识别' }
    return { startTime: st, endTime: et, ok: true }
  }
  return { startTime: null, endTime: null, ok: false, message: '时间段格式无法识别' }
}

export function computeHours(startTime: string | null, endTime: string | null): number | null {
  if (!startTime || !endTime) return null
  const sm = startTime.match(/^(\d{2}):(\d{2})$/)
  const em = endTime.match(/^(\d{2}):(\d{2})$/)
  if (!sm || !em) return null
  let s = Number(sm[1]) * 60 + Number(sm[2])
  let e = Number(em[1]) * 60 + Number(em[2])
  if (e < s) e += 24 * 60
  const h = (e - s) / 60
  return Math.round(h * 100) / 100
}
```

- [ ] **Step 5: 实现 `src/lib/format.ts`**

```ts
export function fmtMoney(n: number): string {
  return n.toFixed(2)
}

export function fmtHours(n: number): string {
  return String(Math.round(n * 100) / 100)
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test -- tests/time.test.ts tests/format.test.ts`
Expected: 全部 PASS。

- [ ] **Step 7: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: 日期/时间解析与格式化纯函数"
```

---

### Task 4: Excel 导入解析（预览）

**Files:**
- Create: `src/lib/parser.ts`
- Test: `tests/parser.test.ts`

**Interfaces:**
- Consumes: `types.ts`（CourseType/LessonRecord）、`time.ts`（parseExcelDate/parseTimeRange/computeHours）
- Produces:
  - `type ParsedRow = { rowNumber: number; courseTypeName: string; rate: number | null; student: string; date: string | null; startTime: string | null; endTime: string | null; hours: number | null; issues: string[]; isDuplicate: boolean; isSample: boolean; selected: boolean; isNewCourseType: boolean; courseTypeId: string | null }`
  - `type ImportPreview = { fileName: string; fileHash: string; sheetName: string; columnMap: Partial<Record<'courseTypeName' | 'rate' | 'student' | 'date' | 'time', number | null>>; rows: ParsedRow[] }`
  - `detectColumns(headers: string[]): Partial<Record<'courseTypeName' | 'rate' | 'student' | 'date' | 'time', number | null>>`
  - `buildPreviewFromRows(rows: unknown[][], existing: { courseTypes: CourseType[]; records: LessonRecord[] }): ParsedRow[]`
  - `parseWorkbook(buffer: ArrayBuffer, fileName: string, existing: { courseTypes: CourseType[]; records: LessonRecord[] }): Promise<ImportPreview>`

解析规则以设计文档第 6 节为准：别名识别、忽略空行、示例行（学生名以「示例」开头）默认不勾选、重复行（同日期+学生+时间段+课程类型）标记、未知课程类型标记、异常行给 issues 且默认不勾选。

- [ ] **Step 1: 写失败测试 `tests/parser.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildPreviewFromRows, detectColumns, parseWorkbook } from '../src/lib/parser'
import type { CourseType, LessonRecord } from '../src/types'

const courseTypes: CourseType[] = [
  { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: 't' }
]

const records: LessonRecord[] = [{
  id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
  rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
  hours: 2, status: 'normal', source: 'import', batchId: null, note: '', createdAt: 't'
}]

describe('detectColumns', () => {
  it('按别名识别且顺序无关', () => {
    const map = detectColumns(['学生名称', '上课时间', '课程单价', '课程类型', '上课日期'])
    expect(map).toEqual({ courseTypeName: 3, rate: 2, student: 0, date: 4, time: 1 })
  })
  it('未知列返回 null', () => {
    const map = detectColumns(['随便', '课程类型'])
    expect(map.courseTypeName).toBe(1)
    expect(map.rate).toBeNull()
  })
})

describe('buildPreviewFromRows', () => {
  const header = ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间']
  it('正常行：小时=区间差、金额字段、已勾选', () => {
    const rows = [header, ['1对1', 200, '张三', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.hours).toBe(2)
    expect(parsed.rate).toBe(200)
    expect(parsed.isDuplicate).toBe(false)
    expect(parsed.selected).toBe(true)
  })
  it('重复行被标记且不勾选', () => {
    const rows = [header, ['1对1', 200, '张三', '2026-08-10', '13:00-15:00']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.isDuplicate).toBe(true)
    expect(parsed.selected).toBe(false)
  })
  it('示例行默认不勾选', () => {
    const rows = [header, ['1对1', 200, '示例学生', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.isSample).toBe(true)
    expect(parsed.selected).toBe(false)
  })
  it('未知课程类型标记 isNewCourseType', () => {
    const rows = [header, ['小班英语', 150, '李四', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.isNewCourseType).toBe(true)
  })
  it('时间缺失时用课程类型默认课时', () => {
    const rows = [header, ['1对1', 200, '张三', '2026-08-11', '']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.hours).toBe(2)
    expect(parsed.startTime).toBeNull()
  })
  it('单价缺失用默认时薪；两者皆无 → issues', () => {
    const rows = [header, ['1对1', '', '张三', '2026-08-11', '13-15']]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })[0]
    expect(parsed.rate).toBe(200)
    const rows2 = [header, ['新类型', '', '王五', '2026-08-11', '13-15']]
    const parsed2 = buildPreviewFromRows(rows2, { courseTypes, records })[0]
    expect(parsed2.rate).toBeNull()
    expect(parsed2.issues).toContain('缺少时薪')
    expect(parsed2.selected).toBe(false)
  })
  it('空行忽略、列顺序无关', () => {
    const rows = [
      ['学生名称', '上课时间', '课程单价', '课程类型', '上课日期'],
      ['张三', '13-15', 200, '1对1', '2026-08-11'],
      ['', '', '', '', '']
    ]
    const parsed = buildPreviewFromRows(rows, { courseTypes, records })
    expect(parsed).toHaveLength(1)
  })
})

describe('parseWorkbook', () => {
  it('读取真实 xlsx 并返回预览', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间'],
      ['1对1', 200, '张三', '2026-08-11', '13-15']
    ]), '课程表')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const preview = await parseWorkbook(buf, '课程表.xlsx', { courseTypes, records })
    expect(preview.sheetName).toBe('课程表')
    expect(preview.rows).toHaveLength(1)
    expect(preview.fileHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/parser.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/parser.ts`**

```ts
import * as XLSX from 'xlsx'
import type { CourseType, LessonRecord } from '../types'
import { computeHours, parseExcelDate, parseTimeRange } from './time'

const ALIASES: Record<'courseTypeName' | 'rate' | 'student' | 'date' | 'time', string[]> = {
  courseTypeName: ['课程类型', '课程', '科目', '类型'],
  rate: ['课程单价', '单价', '时薪', '价格', '课时费'],
  student: ['学生名称', '学生', '姓名'],
  date: ['上课日期', '日期'],
  time: ['上课时间', '时间', '时间段']
}

export type ColumnKey = 'courseTypeName' | 'rate' | 'student' | 'date' | 'time'

export function detectColumns(headers: string[]): Partial<Record<ColumnKey, number | null>> {
  const map: Partial<Record<ColumnKey, number | null>> = {}
  for (const key of Object.keys(ALIASES) as ColumnKey[]) {
    map[key] = null
  }
  headers.forEach((h, i) => {
    const cell = String(h ?? '').trim().replace(/\s/g, '')
    for (const key of Object.keys(ALIASES) as ColumnKey[]) {
      if (map[key] === null && ALIASES[key].some(a => cell === a || cell.includes(a))) {
        map[key] = i
      }
    }
  })
  return map
}

function parseRate(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/[¥￥元,\s]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export interface ParsedRow {
  rowNumber: number
  courseTypeName: string
  rate: number | null
  student: string
  date: string | null
  startTime: string | null
  endTime: string | null
  hours: number | null
  issues: string[]
  isDuplicate: boolean
  isSample: boolean
  selected: boolean
  isNewCourseType: boolean
  courseTypeId: string | null
}

export function buildPreviewFromRows(
  rows: unknown[][],
  existing: { courseTypes: CourseType[]; records: LessonRecord[] }
): ParsedRow[] {
  const headers = (rows[0] ?? []).map(h => String(h ?? ''))
  const col = detectColumns(headers)
  const out: ParsedRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue
    const get = (key: ColumnKey): unknown => (col[key] === null ? undefined : row[col[key] as number])
    const courseTypeName = String(get('courseTypeName') ?? '').trim()
    const student = String(get('student') ?? '').trim()
    const rate = parseRate(get('rate'))
    const dateRes = parseExcelDate(get('date'))
    const timeRes = parseTimeRange(get('time'))
    const matched = existing.courseTypes.find(c => c.name === courseTypeName)
    const hours = computeHours(timeRes.startTime, timeRes.endTime) ?? matched?.defaultHours ?? null

    const issues: string[] = []
    if (!courseTypeName) issues.push('缺少课程类型')
    if (!student) issues.push('缺少学生')
    if (!dateRes.ok || !dateRes.date) issues.push(dateRes.message ?? '日期无效')
    if (!timeRes.ok) issues.push(timeRes.message ?? '时间无效')
    if (hours === null) issues.push('无法确定课时')
    if (rate === null) issues.push('缺少时薪')

    const isDuplicate = dateRes.date !== null && existing.records.some(r =>
      r.date === dateRes.date && r.student === student &&
      r.startTime === timeRes.startTime && r.endTime === timeRes.endTime &&
      r.courseTypeName === courseTypeName && r.status === 'normal'
    )
    const isSample = student.startsWith('示例')
    const isNewCourseType = courseTypeName !== '' && !matched

    out.push({
      rowNumber: i + 1,
      courseTypeName,
      rate,
      student,
      date: dateRes.date,
      startTime: timeRes.startTime,
      endTime: timeRes.endTime,
      hours,
      issues,
      isDuplicate,
      isSample,
      isNewCourseType,
      selected: issues.length === 0 && !isDuplicate && !isSample,
      courseTypeId: matched?.id ?? null
    })
  }
  return out
}

export interface ImportPreview {
  fileName: string
  fileHash: string
  sheetName: string
  columnMap: Partial<Record<ColumnKey, number | null>>
  rows: ParsedRow[]
}

export async function parseWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  existing: { courseTypes: CourseType[]; records: LessonRecord[] }
): Promise<ImportPreview> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  let sheetName = wb.SheetNames[0]
  let best: unknown[][] = []
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
    const headers = (rows[0] ?? []).map(h => String(h ?? '').trim())
    const col = detectColumns(headers)
    const hasHeader = col.courseTypeName !== null || col.student !== null || col.date !== null
    if (hasHeader && rows.length > best.length) {
      best = rows
      sheetName = name
    }
  }
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer)
  const fileHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return {
    fileName,
    fileHash,
    sheetName,
    columnMap: detectColumns((best[0] ?? []).map(h => String(h ?? ''))),
    rows: buildPreviewFromRows(best, existing)
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/parser.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: Excel 导入解析与预览"
```

---
### Task 5: Excel 导出与模板下载

**Files:**
- Create: `src/lib/export.ts`
- Test: `tests/export.test.ts`

**Interfaces:**
- Consumes: `types.ts`、`format.ts`（fmtMoney/fmtHours）、`parser.ts`（detectColumns，备份读取时复用）
- Produces:
  - `createImportTemplateWorkbook(): XLSX.WorkBook`（sheet「上课记录」：表头 + 2 行示例数据）
  - `downloadWorkbook(wb: XLSX.WorkBook, filename: string): void`（Blob + a.click 下载）
  - `createExportAllWorkbook(records: LessonRecord[], courseTypes: CourseType[]): XLSX.WorkBook`（sheets「上课记录」「课程类型」；「上课记录」含额外列：状态/备注/创建时间/id，用于完整备份）
  - `createMonthlyWorkbook(records: LessonRecord[], groups: { label: string; hours: number; amount: number; count: number }[]): XLSX.WorkBook`（sheets「汇总」「明细」）
  - `parseBackupWorkbook(buffer: ArrayBuffer): Promise<{ records: LessonRecord[]; courseTypes: CourseType[] }>`

- [ ] **Step 1: 写失败测试 `tests/export.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { createExportAllWorkbook, createImportTemplateWorkbook, createMonthlyWorkbook, parseBackupWorkbook } from '../src/lib/export'
import type { CourseType, LessonRecord } from '../src/types'

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
}

const ct: CourseType = { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: '2026-08-10T00:00:00.000Z' }
const rec: LessonRecord = {
  id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
  rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
  hours: 2, status: 'normal', source: 'import', batchId: null, note: '备注A', createdAt: '2026-08-10T00:00:00.000Z'
}

describe('createImportTemplateWorkbook', () => {
  it('表头 + 2 行示例', () => {
    const rows = sheetRows(createImportTemplateWorkbook(), '上课记录')
    expect(rows[0]).toEqual(['课程类型', '课程单价', '学生名称', '上课日期', '上课时间'])
    expect(rows.length).toBe(3)
    expect(String(rows[1][2])).toContain('示例')
  })
})

describe('createExportAllWorkbook / parseBackupWorkbook', () => {
  it('导出再解析可还原记录与课程类型', async () => {
    const wb = createExportAllWorkbook([rec], [ct])
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const back = await parseBackupWorkbook(buf)
    expect(back.courseTypes).toHaveLength(1)
    expect(back.records[0]).toMatchObject({ id: 'r1', student: '张三', rate: 200, hours: 2, note: '备注A', status: 'normal' })
  })
})

describe('createMonthlyWorkbook', () => {
  it('含汇总与明细两个 sheet', () => {
    const wb = createMonthlyWorkbook([rec], [{ label: '张三', hours: 2, amount: 400, count: 1 }])
    expect(wb.SheetNames).toEqual(['汇总', '明细'])
    const rows = sheetRows(wb, '汇总')
    expect(rows[0]).toEqual(['分组', '课次', '课时', '金额'])
    expect(rows[1]).toEqual(['张三', 1, 2, 400])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/export.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/export.ts`**

```ts
import * as XLSX from 'xlsx'
import type { CourseType, LessonRecord } from '../types'
import { fmtHours, fmtMoney } from './format'

export function createImportTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间'],
    ['1对1', 200, '示例学生', '2026-08-10', '13:00-15:00'],
    ['小班英语', 150, '示例学生', '2026-08-12', '18:30-20:30']
  ]), '上课记录')
  return wb
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function createExportAllWorkbook(records: LessonRecord[], courseTypes: CourseType[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const recRows = [
    ['课程类型', '课程单价', '学生名称', '上课日期', '上课时间', '状态', '备注', '创建时间', 'id'],
    ...records.map(r => [r.courseTypeName, r.rate, r.student, r.date, r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '', r.status, r.note, r.createdAt, r.id])
  ]
  const typeRows = [
    ['名称', '教学形式', '状态', '默认课时', '默认时薪', '创建时间'],
    ...courseTypes.map(c => [c.name, c.type, c.status, c.defaultHours, c.defaultRate, c.createdAt])
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recRows), '上课记录')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(typeRows), '课程类型')
  return wb
}

export function createMonthlyWorkbook(
  records: LessonRecord[],
  groups: { label: string; hours: number; amount: number; count: number }[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const sumRows = [
    ['分组', '课次', '课时', '金额'],
    ...groups.map(g => [g.label, g.count, g.hours, g.amount])
  ]
  const detailRows = [
    ['日期', '课程类型', '学生', '时间', '时薪', '课时', '金额', '状态'],
    ...records.map(r => [
      r.date, r.courseTypeName, r.student,
      r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '',
      r.rate, r.hours,
      r.rate !== null && r.hours !== null ? Number(fmtMoney(r.rate * r.hours)) : 0,
      r.status === 'normal' ? '正常' : '已取消'
    ])
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), '汇总')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), '明细')
  return wb
}

export async function parseBackupWorkbook(buffer: ArrayBuffer): Promise<{ records: LessonRecord[]; courseTypes: CourseType[] }> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const recRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['上课记录'], { header: 1, defval: '' })
  const typeRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['课程类型'], { header: 1, defval: '' })
  const recHeader = (recRows[0] ?? []).map(h => String(h ?? ''))
  const typeHeader = (typeRows[0] ?? []).map(h => String(h ?? ''))
  const idx = (arr: string[], name: string) => {
    const i = arr.findIndex(h => h === name)
    return i === -1 ? null : i
  }
  const records: LessonRecord[] = []
  for (let i = 1; i < recRows.length; i++) {
    const r = recRows[i]
    if (!r || r.every(c => c === null || c === undefined || String(c).trim() === '')) continue
    const g = (name: string) => {
      const k = idx(recHeader, name)
      return k === null ? undefined : r[k]
    }
    records.push({
      id: String(g('id') ?? `bk-${i}-${Date.now()}`),
      courseTypeId: null,
      courseTypeName: String(g('课程类型') ?? ''),
      courseTypeKind: '',
      rate: g('课程单价') === undefined || g('课程单价') === '' ? null : Number(g('课程单价')),
      student: String(g('学生名称') ?? ''),
      date: String(g('上课日期') ?? ''),
      startTime: null,
      endTime: null,
      hours: null,
      status: String(g('状态') ?? 'normal') === 'cancelled' ? 'cancelled' : 'normal',
      source: 'import',
      batchId: null,
      note: String(g('备注') ?? ''),
      createdAt: String(g('创建时间') ?? new Date().toISOString())
    })
  }
  const courseTypes: CourseType[] = []
  for (let i = 1; i < typeRows.length; i++) {
    const r = typeRows[i]
    if (!r || r.every(c => c === null || c === undefined || String(c).trim() === '')) continue
    const g = (name: string) => {
      const k = idx(typeHeader, name)
      return k === null ? undefined : r[k]
    }
    courseTypes.push({
      id: `ct-${Date.now()}-${i}`,
      name: String(g('名称') ?? ''),
      type: String(g('教学形式') ?? ''),
      status: String(g('状态') ?? 'enabled') === 'disabled' ? 'disabled' : 'enabled',
      defaultHours: g('默认课时') === undefined || g('默认课时') === '' ? null : Number(g('默认课时')),
      defaultRate: g('默认时薪') === undefined || g('默认时薪') === '' ? null : Number(g('默认时薪')),
      createdAt: String(g('创建时间') ?? new Date().toISOString())
    })
  }
  return { records, courseTypes }
}
```

> 说明：备份里的「上课记录」时间列只导出展示文本，恢复时若需精确开始/结束可后续增强；当前版本恢复的 records 不含 startTime/endTime/hours，导入回「上课记录」后再用默认课时补齐（见 Task 9 的兼容处理）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/export.test.ts`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: Excel 模板/全量导出/月报/备份解析"
```

---

### Task 6: PIN 锁（哈希与校验 + 解锁界面）

**Files:**
- Create: `src/lib/pin.ts`
- Create: `src/hooks/usePin.ts`
- Create: `src/components/PinLock.tsx`
- Modify: `src/App.tsx`
- Test: `tests/pin.test.ts`

**Interfaces:**
- Consumes: `db/repo.ts`（getSetting/setSetting）、`types.ts`
- Produces:
  - `pin.ts`：`generateSalt(): string`、`hashPin(pin: string, salt: string): Promise<string>`、`verifyPin(pin: string, salt: string, hash: string): Promise<boolean>`
  - `usePin()` 返回：`{ enabled: boolean; locked: boolean; setup(pin: string): Promise<void>; unlock(pin: string): Promise<boolean>; change(oldPin: string, newPin: string): Promise<boolean>; disable(oldPin: string): Promise<boolean> }`
  - `PinLock` 组件：`{ onUnlock: (pin: string) => Promise<boolean> }`

- [ ] **Step 1: 写失败测试 `tests/pin.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { generateSalt, hashPin, verifyPin } from '../src/lib/pin'

describe('pin', () => {
  it('相同 pin+盐 哈希一致，verify 通过', async () => {
    const salt = generateSalt()
    const h = await hashPin('1234', salt)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifyPin('1234', salt, h)).toBe(true)
  })
  it('错误 pin 校验失败', async () => {
    const salt = generateSalt()
    const h = await hashPin('1234', salt)
    expect(await verifyPin('9999', salt, h)).toBe(false)
  })
  it('不同盐生成不同哈希', async () => {
    const h1 = await hashPin('1234', generateSalt())
    const h2 = await hashPin('1234', generateSalt())
    expect(h1).not.toBe(h2)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/pin.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/pin.ts`**

```ts
const enc = new TextEncoder()

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function pbkdf2(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function hashPin(pin: string, salt: string): Promise<string> {
  return pbkdf2(pin, salt)
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const h = await pbkdf2(pin, salt)
  return h === hash
}
```

- [ ] **Step 4: 实现 `src/hooks/usePin.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { generateSalt, hashPin, verifyPin } from '../lib/pin'
import { getSetting, setSetting } from '../db/repo'

const SALT_KEY = 'pin_salt'
const HASH_KEY = 'pin_hash'

export function usePin() {
  const [enabled, setEnabled] = useState(false)
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = async () => {
      const hash = await getSetting<string>(HASH_KEY)
      setEnabled(!!hash)
      setLocked(!!hash)
      setReady(true)
    }
    refresh()
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(async () => {
          const hash = await getSetting<string>(HASH_KEY)
          if (hash) setLocked(true)
        }, 60000)
      } else if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const setup = useCallback(async (pin: string) => {
    const salt = generateSalt()
    const hash = await hashPin(pin, salt)
    await setSetting(SALT_KEY, salt)
    await setSetting(HASH_KEY, hash)
    setEnabled(true)
    setLocked(false)
  }, [])

  const unlock = useCallback(async (pin: string) => {
    const salt = await getSetting<string>(SALT_KEY)
    const hash = await getSetting<string>(HASH_KEY)
    if (!salt || !hash) return false
    const ok = await verifyPin(pin, salt, hash)
    if (ok) setLocked(false)
    return ok
  }, [])

  const change = useCallback(async (oldPin: string, newPin: string) => {
    const ok = await unlock(oldPin)
    if (!ok) return false
    await setup(newPin)
    return true
  }, [unlock, setup])

  const disable = useCallback(async (oldPin: string) => {
    const ok = await unlock(oldPin)
    if (!ok) return false
    await setSetting(HASH_KEY, undefined)
    await setSetting(SALT_KEY, undefined)
    setEnabled(false)
    return true
  }, [unlock])

  return { enabled, locked, ready, setup, unlock, change, disable }
}
```

- [ ] **Step 5: 实现 `src/components/PinLock.tsx`**

```tsx
import { useState } from 'react'

export default function PinLock({ onUnlock }: { onUnlock: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    if (pin.length < 4) { setError('请输入至少 4 位 PIN'); return }
    const ok = await onUnlock(pin)
    if (!ok) { setError('PIN 错误，请重试'); setPin('') }
  }

  return (
    <div className="pin-lock">
      <h1>课时薪资</h1>
      <p>请输入 PIN 解锁</p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        placeholder="PIN"
        value={pin}
        onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
      />
      {error && <p className="error">{error}</p>}
      <button onClick={submit}>解锁</button>
    </div>
  )
}
```

- [ ] **Step 6: 改造 `src/App.tsx` 接入门禁与 Tab 骨架**

```tsx
import { usePin } from './hooks/usePin'
import PinLock from './components/PinLock'

export default function App() {
  const pin = usePin()
  if (!pin.ready) return <main className="app" />
  if (pin.enabled && pin.locked) {
    return <main className="app"><PinLock onUnlock={pin.unlock} /></main>
  }
  return <main className="app"><h1>课时薪资（后续任务接入页面）</h1></main>
}
```

- [ ] **Step 7: 运行测试与构建**

Run: `npm test`
Expected: 全部 PASS。

Run: `npm run build`
Expected: 退出码 0。

- [ ] **Step 8: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: PIN 锁（PBKDF2 哈希 + 解锁门禁）"
```

---
### Task 7: 课程类型管理页

**Files:**
- Create: `src/hooks/useCourseTypes.ts`
- Create: `src/components/Sheet.tsx`
- Create: `src/components/CourseTypeFormSheet.tsx`
- Create: `src/pages/CourseTypesPage.tsx`
- Modify: `src/App.tsx`（接入 Tab 骨架与页面切换）

**Interfaces:**
- Consumes: `db/repo.ts`（listCourseTypes/saveCourseType/deleteCourseType）、`types.ts`
- Produces:
  - `useCourseTypes()` 返回 `{ items: CourseType[]; reload(): Promise<void>; save(ct: CourseType): Promise<void>; remove(id: string): Promise<void> }`
  - `CourseTypeFormSheet`：`{ open: boolean; initial: CourseType | null; onClose(): void; onSaved(ct: CourseType): void }`
  - `Sheet`：`{ open: boolean; title: string; onClose(): void; children: ReactNode }`
  - `CourseTypesPage`：`{ }`（内部使用 hooks）

- [ ] **Step 1: 实现 `src/hooks/useCourseTypes.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { deleteCourseType, listCourseTypes, saveCourseType } from '../db/repo'
import type { CourseType } from '../types'

export function useCourseTypes() {
  const [items, setItems] = useState<CourseType[]>([])

  const reload = useCallback(async () => {
    setItems(await listCourseTypes())
  }, [])

  useEffect(() => { void reload() }, [reload])

  const save = useCallback(async (ct: CourseType) => {
    await saveCourseType(ct)
    await reload()
  }, [reload])

  const remove = useCallback(async (id: string) => {
    await deleteCourseType(id)
    await reload()
  }, [reload])

  return { items, reload, save, remove }
}
```

- [ ] **Step 2: 实现通用 `Sheet.tsx`（Bottom Sheet 容器）**

```tsx
import type { ReactNode } from 'react'

export default function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="sheet-mask" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn-close" onClick={onClose}>关闭</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
```

配套 CSS（追加到 `src/index.css`）：

```css
.sheet-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 50; display: flex; align-items: flex-end; }
.sheet { background: var(--card); width: 100%; max-width: 480px; margin: 0 auto; border-radius: 16px 16px 0 0; padding: 16px calc(16px + env(safe-area-inset-right)) calc(16px + var(--safe-bottom)) calc(16px + env(safe-area-inset-left)); max-height: 85vh; overflow-y: auto; }
.sheet-head { display: flex; justify-content: space-between; align-items: center; }
.sheet-head h2 { margin: 0 0 12px; font-size: 18px; }
.btn-close { background: var(--muted); min-height: 40px; padding: 0 14px; }
.sheet-body .field { margin-bottom: 14px; }
.sheet-body label { display: block; margin-bottom: 6px; color: var(--muted); font-size: 14px; }
.sheet-body .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.error { color: var(--danger); font-size: 14px; }
```

- [ ] **Step 3: 实现 `CourseTypeFormSheet.tsx`**

```tsx
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import type { CourseType, CourseTypeStatus } from '../types'

export default function CourseTypeFormSheet({ open, initial, onClose, onSaved }: {
  open: boolean
  initial: CourseType | null
  onClose: () => void
  onSaved: (ct: CourseType) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('一对一')
  const [status, setStatus] = useState<CourseTypeStatus>('enabled')
  const [defaultHours, setDefaultHours] = useState('')
  const [defaultRate, setDefaultRate] = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setType(initial?.type ?? '一对一')
      setStatus(initial?.status ?? 'enabled')
      setDefaultHours(initial?.defaultHours === null ? '' : String(initial?.defaultHours ?? ''))
      setDefaultRate(initial?.defaultRate === null ? '' : String(initial?.defaultRate ?? ''))
    }
  }, [open, initial])

  const submit = () => {
    if (!name.trim()) return
    onSaved({
      id: initial?.id ?? `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      type: type.trim(),
      status,
      defaultHours: defaultHours === '' ? null : Number(defaultHours),
      defaultRate: defaultRate === '' ? null : Number(defaultRate),
      createdAt: initial?.createdAt ?? new Date().toISOString()
    })
  }

  return (
    <Sheet open={open} title={initial ? '编辑课程类型' : '新增课程类型'} onClose={onClose}>
      <div className="field"><label>名称 *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="如：初三数学1对1" /></div>
      <div className="field"><label>教学形式</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option>一对一</option><option>小班</option><option>线上</option><option>其他</option>
        </select>
      </div>
      <div className="field"><label>状态</label>
        <select value={status} onChange={e => setStatus(e.target.value as CourseTypeStatus)}>
          <option value="enabled">启用</option><option value="disabled">停用</option>
        </select>
      </div>
      <div className="row2">
        <div className="field"><label>默认课时（小时）</label><input inputMode="decimal" value={defaultHours} onChange={e => setDefaultHours(e.target.value)} placeholder="如 2" /></div>
        <div className="field"><label>默认时薪（元/小时）</label><input inputMode="decimal" value={defaultRate} onChange={e => setDefaultRate(e.target.value)} placeholder="如 200" /></div>
      </div>
      <button style={{ width: '100%' }} onClick={submit}>保存</button>
    </Sheet>
  )
}
```

- [ ] **Step 4: 实现 `CourseTypesPage.tsx`**

```tsx
import { useState } from 'react'
import CourseTypeFormSheet from '../components/CourseTypeFormSheet'
import { useCourseTypes } from '../hooks/useCourseTypes'
import type { CourseType } from '../types'

export default function CourseTypesPage() {
  const { items, save, remove } = useCourseTypes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CourseType | null>(null)

  const del = (ct: CourseType) => {
    if (confirm(`删除课程类型「${ct.name}」？历史记录不受影响。`)) void remove(ct.id)
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>课程类型</h1>
        <button onClick={() => { setEditing(null); setOpen(true) }}>新增</button>
      </header>
      {items.map(ct => (
        <div className="card course-type" key={ct.id}>
          <div>
            <strong>{ct.name}</strong>
            <span className="tag">{ct.type}</span>
            <span className={ct.status === 'enabled' ? 'tag ok' : 'tag off'}>{ct.status === 'enabled' ? '启用' : '停用'}</span>
          </div>
          <div className="muted">默认 {ct.defaultHours ?? '—'} 小时 · {ct.defaultRate ?? '—'} 元/小时</div>
          <div className="row-actions">
            <button onClick={() => { setEditing(ct); setOpen(true) }}>编辑</button>
            <button className="btn-danger" onClick={() => del(ct)}>删除</button>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="empty">还没有课程类型，点右上角"新增"创建。</p>}
      <CourseTypeFormSheet open={open} initial={editing} onClose={() => setOpen(false)} onSaved={async ct => { await save(ct); setOpen(false) }} />
    </section>
  )
}
```

配套 CSS（追加）：

```css
.page { max-width: 480px; margin: 0 auto; padding: 12px 12px calc(var(--tab-height) + var(--safe-bottom) + 24px); }
.page-head { display: flex; justify-content: space-between; align-items: center; }
.page-head h1 { font-size: 22px; }
.tag { display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: var(--border); font-size: 13px; }
.tag.ok { background: #e6f4ea; color: #137333; }
.tag.off { background: #fce8e6; color: #c5221f; }
.muted { color: var(--muted); font-size: 14px; }
.row-actions { display: flex; gap: 8px; margin-top: 10px; }
.btn-danger { background: var(--danger); }
.empty { color: var(--muted); text-align: center; margin-top: 40px; }
.course-type { margin-bottom: 10px; }
```

- [ ] **Step 5: 改造 `src/App.tsx` 为底部 Tab 骨架**

```tsx
import { useState } from 'react'
import TabBar from './components/TabBar'
import { usePin } from './hooks/usePin'
import PinLock from './components/PinLock'
import CourseTypesPage from './pages/CourseTypesPage'

export type TabKey = 'summary' | 'records' | 'import' | 'courseTypes' | 'settings'

export default function App() {
  const pin = usePin()
  const [tab, setTab] = useState<TabKey>('summary')
  if (!pin.ready) return <main className="app" />
  if (pin.enabled && pin.locked) {
    return <main className="app"><PinLock onUnlock={pin.unlock} /></main>
  }
  return (
    <div className="app">
      {tab === 'courseTypes' && <CourseTypesPage />}
      {tab === 'summary' && <div className="page"><h1>汇总（后续任务）</h1></div>}
      {tab === 'records' && <div className="page"><h1>上课记录（后续任务）</h1></div>}
      {tab === 'import' && <div className="page"><h1>导入（后续任务）</h1></div>}
      {tab === 'settings' && <div className="page"><h1>设置（后续任务）</h1></div>}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
```

`src/components/TabBar.tsx`：

```tsx
import type { TabKey } from '../App'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'summary', label: '汇总' },
  { key: 'records', label: '记录' },
  { key: 'import', label: '导入' },
  { key: 'courseTypes', label: '课程' },
  { key: 'settings', label: '设置' }
]

export default function TabBar({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map(t => (
        <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>{t.label}</button>
      ))}
    </nav>
  )
}
```

CSS：

```css
.tabbar { position: fixed; left: 0; right: 0; bottom: 0; height: calc(var(--tab-height) + var(--safe-bottom)); padding-bottom: var(--safe-bottom); background: var(--card); border-top: 1px solid var(--border); display: flex; max-width: 480px; margin: 0 auto; z-index: 40; }
.tabbar button { flex: 1; background: none; color: var(--muted); min-height: 44px; border-radius: 0; }
.tabbar button.active { color: var(--primary); font-weight: 600; }
```

- [ ] **Step 6: 验证**

Run: `npm run build` → 退出码 0。
Run: `npm run dev` 手动检查（浏览器移动端模拟）：5 个 Tab 可切换；课程类型可新增/编辑/删除。

- [ ] **Step 7: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: Tab 骨架与课程类型管理页"
```

---

### Task 8: 上课记录页（列表/编辑/补录/取消）

**Files:**
- Create: `src/hooks/useMonth.ts`
- Create: `src/hooks/useRecords.ts`
- Create: `src/components/MonthPicker.tsx`
- Create: `src/components/RecordCard.tsx`
- Create: `src/components/RecordFormSheet.tsx`
- Create: `src/pages/RecordsPage.tsx`
- Modify: `src/App.tsx`（records tab 接入）

**Interfaces:**
- Consumes: `db/repo.ts`、`types.ts`、`time.ts`（computeHours）、`format.ts`（fmtMoney/fmtHours）
- Produces:
  - `useMonth()` 返回 `{ month: string; setMonth(m: string): void; prev(): void; next(): void }`（month = `YYYY-MM`，默认当前月）
  - `useRecords(month: string)` 返回 `{ items: LessonRecord[]; reload(): Promise<void>; save(r: LessonRecord): Promise<void>; remove(id: string): Promise<void> }`
  - `RecordCard`：`{ record: LessonRecord; onEdit(): void; onToggleCancel(): void; onDelete(): void }`
  - `RecordFormSheet`：`{ open: boolean; initial: LessonRecord | null; courseTypes: CourseType[]; onClose(): void; onSaved(r: LessonRecord): void }`

- [ ] **Step 1: 实现 hooks 与 MonthPicker**

`useMonth.ts`：

```ts
import { useState } from 'react'

function nowMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useMonth() {
  const [month, setMonth] = useState(nowMonth())
  const shift = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return { month, setMonth, prev: () => shift(-1), next: () => shift(1) }
}
```

`useRecords.ts`：

```ts
import { useCallback, useEffect, useState } from 'react'
import { deleteRecord, listRecords, saveRecord } from '../db/repo'
import type { LessonRecord } from '../types'

export function useRecords(month: string) {
  const [items, setItems] = useState<LessonRecord[]>([])
  const reload = useCallback(async () => {
    setItems(await listRecords(month))
  }, [month])
  useEffect(() => { void reload() }, [reload])
  const save = useCallback(async (r: LessonRecord) => { await saveRecord(r); await reload() }, [reload])
  const remove = useCallback(async (id: string) => { await deleteRecord(id); await reload() }, [reload])
  return { items, reload, save, remove }
}
```

`MonthPicker.tsx`：

```tsx
import { useMonth } from '../hooks/useMonth'

export default function MonthPicker({ month, onPrev, onNext, onChange }: {
  month: string
  onPrev: () => void
  onNext: () => void
  onChange: (m: string) => void
}) {
  return (
    <div className="month-picker">
      <button onClick={onPrev}>‹</button>
      <input type="month" value={month} onChange={e => e.target.value && onChange(e.target.value)} />
      <button onClick={onNext}>›</button>
    </div>
  )
}
```

CSS：

```css
.month-picker { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 8px 0 16px; }
.month-picker input[type=month] { width: 160px; text-align: center; }
.month-picker button { background: var(--card); color: var(--text); border: 1px solid var(--border); min-width: 44px; }
```

- [ ] **Step 2: 实现 `RecordCard.tsx`**

```tsx
import { fmtHours, fmtMoney } from '../lib/format'
import type { LessonRecord } from '../types'

export default function RecordCard({ record, onEdit, onToggleCancel, onDelete }: {
  record: LessonRecord
  onEdit: () => void
  onToggleCancel: () => void
  onDelete: () => void
}) {
  const amount = record.rate !== null && record.hours !== null ? record.rate * record.hours : null
  const time = record.startTime && record.endTime ? `${record.startTime}-${record.endTime}` : '时间待定'
  return (
    <div className={`card record ${record.status === 'cancelled' ? 'cancelled' : ''}`} onClick={onEdit}>
      <div className="rec-top">
        <strong>{record.date}</strong>
        <span className="rec-time">{time}</span>
        <span className="rec-amount">{amount === null ? '—' : `¥${fmtMoney(amount)}`}</span>
      </div>
      <div className="rec-sub">{record.student} · {record.courseTypeName}{record.hours !== null ? ` · ${fmtHours(record.hours)}小时` : ''}</div>
      {record.status === 'cancelled' && <div className="rec-cancel">已取消（不计薪）</div>}
      <div className="row-actions" onClick={e => e.stopPropagation()}>
        <button onClick={onToggleCancel}>{record.status === 'normal' ? '取消' : '恢复'}</button>
        <button className="btn-danger" onClick={onDelete}>删除</button>
      </div>
    </div>
  )
}
```

CSS：

```css
.record { margin-bottom: 10px; }
.record.cancelled { opacity: .6; }
.rec-top { display: flex; align-items: center; gap: 10px; }
.rec-time { color: var(--muted); font-size: 14px; }
.rec-amount { margin-left: auto; font-weight: 600; }
.rec-sub { color: var(--muted); font-size: 14px; margin-top: 4px; }
.rec-cancel { color: var(--danger); font-size: 13px; margin-top: 4px; }
```

- [ ] **Step 3: 实现 `RecordFormSheet.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet'
import { computeHours } from '../lib/time'
import type { CourseType, LessonRecord } from '../types'

export default function RecordFormSheet({ open, initial, courseTypes, onClose, onSaved }: {
  open: boolean
  initial: LessonRecord | null
  courseTypes: CourseType[]
  onClose: () => void
  onSaved: (r: LessonRecord) => void
}) {
  const [courseTypeId, setCourseTypeId] = useState('')
  const [student, setStudent] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rate, setRate] = useState('')
  const [status, setStatus] = useState<'normal' | 'cancelled'>('normal')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCourseTypeId(initial?.courseTypeId ?? courseTypes[0]?.id ?? '')
      setStudent(initial?.student ?? '')
      setDate(initial?.date ?? '')
      setStart(initial?.startTime ?? '')
      setEnd(initial?.endTime ?? '')
      setRate(initial?.rate === null ? '' : String(initial?.rate ?? ''))
      setStatus(initial?.status ?? 'normal')
      setNote(initial?.note ?? '')
      setError('')
    }
  }, [open, initial, courseTypes])

  const ct = useMemo(() => courseTypes.find(c => c.id === courseTypeId) ?? null, [courseTypeId, courseTypes])

  const computedHours = useMemo(
    () => computeHours(start || null, end || null) ?? (start && !end ? ct?.defaultHours ?? null : null),
    [start, end, ct]
  )

  const submit = () => {
    if (!student.trim()) { setError('请填写学生名称'); return }
    if (!date) { setError('请选择日期'); return }
    if (!ct) { setError('请选择课程类型'); return }
    const hours = computedHours
    if (hours === null) { setError('无法确定课时：请填写时间段或设置课程默认课时'); return }
    const r = Number(rate)
    if (rate === '' || Number.isNaN(r) || r < 0) { setError('请填写有效时薪'); return }
    onSaved({
      id: initial?.id ?? `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      courseTypeId: ct.id,
      courseTypeName: ct.name,
      courseTypeKind: ct.type,
      rate: r,
      student: student.trim(),
      date,
      startTime: start || null,
      endTime: end || null,
      hours,
      status,
      source: initial?.source ?? 'manual',
      batchId: initial?.batchId ?? null,
      note: note.trim(),
      createdAt: initial?.createdAt ?? new Date().toISOString()
    })
  }

  return (
    <Sheet open={open} title={initial ? '编辑上课记录' : '补录上课记录'} onClose={onClose}>
      <div className="field"><label>课程类型 *</label>
        <select value={courseTypeId} onChange={e => setCourseTypeId(e.target.value)}>
          {courseTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="field"><label>学生名称 *</label><input value={student} onChange={e => setStudent(e.target.value)} placeholder="如：张三" /></div>
      <div className="field"><label>日期 *</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="row2">
        <div className="field"><label>开始时间</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className="field"><label>结束时间</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
      </div>
      <p className="muted">课时：{computedHours === null ? '待定' : `${computedHours} 小时`}（结束早于开始按跨天计算；只填开始时间用默认课时）</p>
      <div className="field"><label>时薪（元/小时）*</label><input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder={ct?.defaultRate ? `默认 ${ct.defaultRate}` : '如 200'} /></div>
      <div className="field"><label>状态</label>
        <select value={status} onChange={e => setStatus(e.target.value as 'normal' | 'cancelled')}>
          <option value="normal">正常</option><option value="cancelled">已取消（不计薪）</option>
        </select>
      </div>
      <div className="field"><label>备注</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="选填" /></div>
      {error && <p className="error">{error}</p>}
      <button style={{ width: '100%' }} onClick={submit}>保存</button>
    </Sheet>
  )
}
```

- [ ] **Step 4: 实现 `RecordsPage.tsx`**

```tsx
import { useState } from 'react'
import MonthPicker from '../components/MonthPicker'
import RecordCard from '../components/RecordCard'
import RecordFormSheet from '../components/RecordFormSheet'
import { useCourseTypes } from '../hooks/useCourseTypes'
import { useMonth } from '../hooks/useMonth'
import { useRecords } from '../hooks/useRecords'
import type { LessonRecord } from '../types'

export default function RecordsPage() {
  const { month, setMonth, prev, next } = useMonth()
  const { items, save, remove } = useRecords(month)
  const { items: courseTypes } = useCourseTypes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LessonRecord | null>(null)

  return (
    <section className="page">
      <header className="page-head"><h1>上课记录</h1></header>
      <MonthPicker month={month} onPrev={prev} onNext={next} onChange={setMonth} />
      {items.map(r => (
        <RecordCard
          key={r.id}
          record={r}
          onEdit={() => { setEditing(r); setOpen(true) }}
          onToggleCancel={() => void save({ ...r, status: r.status === 'normal' ? 'cancelled' : 'normal' })}
          onDelete={() => { if (confirm('删除这条记录？')) void remove(r.id) }}
        />
      ))}
      {items.length === 0 && <p className="empty">本月暂无记录，可导入课程表或手动补录。</p>}
      <button className="fab" onClick={() => { setEditing(null); setOpen(true) }}>＋ 补录</button>
      <RecordFormSheet open={open} initial={editing} courseTypes={courseTypes} onClose={() => setOpen(false)} onSaved={async r => { await save(r); setOpen(false) }} />
    </section>
  )
}
```

CSS：

```css
.fab { position: fixed; right: 20px; bottom: calc(var(--tab-height) + var(--safe-bottom) + 16px); width: 56px; height: 56px; border-radius: 50%; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
```

- [ ] **Step 5: 接入 `App.tsx`**

将 `records` tab 渲染替换为 `<RecordsPage />`。

- [ ] **Step 6: 验证**

Run: `npm run build` → 退出码 0。
手动（`npm run dev` 移动端模拟）：切换月份；补录一条（时间段 13:00-15:00、时薪 200）→ 卡片金额 ¥400.00；只填开始时间 → 课时用默认课时；取消/恢复/删除；编辑保存。

- [ ] **Step 7: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: 上课记录页（列表/编辑/补录/取消）"
```

---
### Task 9: 导入页（文件选择/预览/确认/撤销）

**Files:**
- Create: `src/lib/importService.ts`
- Create: `src/components/ImportPreview.tsx`
- Create: `src/pages/ImportPage.tsx`
- Modify: `src/App.tsx`（import tab 接入）
- Test: `tests/importService.test.ts`

**Interfaces:**
- Consumes: `parser.ts`（parseWorkbook/ImportPreview）、`db/repo.ts`（addBatch/getBatchByHash/deleteBatch/saveCourseType/saveRecord）、`types.ts`
- Produces:
  - `applyImport(preview: ImportPreview): Promise<{ batchId: string; inserted: number }>`
    - 行为：为预览中 `selected=true` 的行写入记录；对 `isNewCourseType && selected` 的课程类型自动创建（名称=行课程类型，教学形式留空，状态启用，默认课时/时薪取该行值，若已有同名则复用）；生成批次记录 `rowCount=inserted`。
  - `ImportPage`：包含文件选择、预览、确认、撤销上一批。

- [ ] **Step 1: 写失败测试 `tests/importService.test.ts`**

```ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { getBatchByHash, listCourseTypes, listRecords } from '../src/db/repo'
import { applyImport } from '../src/lib/importService'
import type { ImportPreview } from '../src/lib/parser'

beforeEach(async () => { await db.delete(); await db.open() })

const preview: ImportPreview = {
  fileName: '课程表.xlsx',
  fileHash: 'abc123',
  sheetName: 'Sheet1',
  columnMap: { courseTypeName: 0, rate: 1, student: 2, date: 3, time: 4 },
  rows: [
    {
      rowNumber: 2, courseTypeName: '1对1', rate: 200, student: '张三',
      date: '2026-08-11', startTime: '13:00', endTime: '15:00', hours: 2,
      issues: [], isDuplicate: false, isSample: false, selected: true,
      isNewCourseType: true, courseTypeId: null
    },
    {
      rowNumber: 3, courseTypeName: '1对1', rate: 200, student: '示例学生',
      date: '2026-08-12', startTime: '13:00', endTime: '15:00', hours: 2,
      issues: [], isDuplicate: false, isSample: true, selected: false,
      isNewCourseType: false, courseTypeId: null
    }
  ]
}

describe('applyImport', () => {
  it('只导入勾选行，自动创建课程类型与批次', async () => {
    const { batchId, inserted } = await applyImport(preview)
    expect(inserted).toBe(1)
    expect(batchId).toBeTruthy()
    expect((await getBatchByHash('abc123'))?.rowCount).toBe(1)
    const types = await listCourseTypes()
    expect(types).toHaveLength(1)
    expect(types[0]).toMatchObject({ name: '1对1', defaultHours: 2, defaultRate: 200 })
    const recs = await listRecords('2026-08')
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ student: '张三', status: 'normal', source: 'import', batchId })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/importService.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/importService.ts`**

```ts
import { addBatch, getBatchByHash, listCourseTypes, saveCourseType, saveRecord } from '../db/repo'
import type { ImportPreview } from './parser'

export async function applyImport(preview: ImportPreview): Promise<{ batchId: string; inserted: number }> {
  const existingTypes = await listCourseTypes()
  const batchId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  for (const row of preview.rows) {
    if (!row.selected) continue
    if (row.isNewCourseType && row.courseTypeName) {
      const found = existingTypes.find(t => t.name === row.courseTypeName)
      if (!found) {
        const ct = {
          id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: row.courseTypeName,
          type: '',
          status: 'enabled' as const,
          defaultHours: row.hours,
          defaultRate: row.rate,
          createdAt: new Date().toISOString()
        }
        await saveCourseType(ct)
        existingTypes.push(ct)
      }
    }
    const ct = existingTypes.find(t => t.name === row.courseTypeName)
    await saveRecord({
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${row.rowNumber}`,
      courseTypeId: ct?.id ?? null,
      courseTypeName: row.courseTypeName,
      courseTypeKind: ct?.type ?? '',
      rate: row.rate,
      student: row.student,
      date: row.date ?? '',
      startTime: row.startTime,
      endTime: row.endTime,
      hours: row.hours,
      status: 'normal',
      source: 'import',
      batchId,
      note: '',
      createdAt: new Date().toISOString()
    })
  }

  const inserted = preview.rows.filter(r => r.selected).length
  await addBatch({ id: batchId, filename: preview.fileName, fileHash: preview.fileHash, importedAt: new Date().toISOString(), rowCount: inserted })
  return { batchId, inserted }
}
```

> 说明：同一文件允许重复导入（例如用户主动想再导一次）；预览阶段已对重复行做过标记，此处不额外拦截。

- [ ] **Step 4: 实现 `ImportPreview.tsx`**

```tsx
import type { ParsedRow } from '../lib/parser'
import { fmtHours } from '../lib/format'

export default function ImportPreview({ rows, onToggle }: { rows: ParsedRow[]; onToggle: (i: number) => void }) {
  const selectedCount = rows.filter(r => r.selected).length
  return (
    <div>
      <p className="muted">共 {rows.length} 行，将导入 {selectedCount} 行；异常/重复/示例行默认不勾选。</p>
      {rows.map((r, i) => (
        <label className="card preview-row" key={i}>
          <input type="checkbox" checked={r.selected} onChange={() => onToggle(i)} />
          <div className="preview-body">
            <div>
              <strong>{r.student || '（无学生）'}</strong>
              <span className="tag">{r.courseTypeName || '（无课程类型）'}</span>
              {r.isNewCourseType && <span className="tag new">新类型</span>}
              {r.isSample && <span className="tag sample">示例</span>}
              {r.isDuplicate && <span className="tag dup">重复</span>}
            </div>
            <div className="muted">
              {r.date ?? '日期无效'} · {r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '时间待定'}
              {r.hours !== null ? ` · ${fmtHours(r.hours)}小时` : ''}
              {r.rate !== null ? ` · ¥${r.rate}/时` : ' · 时薪待定'}
            </div>
            {r.issues.length > 0 && <div className="issues">{r.issues.join('；')}</div>}
          </div>
        </label>
      ))}
    </div>
  )
}
```

CSS：

```css
.preview-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
.preview-row input[type=checkbox] { width: 22px; height: 22px; margin-top: 4px; }
.preview-body { flex: 1; }
.tag.new { background: #e8f0fe; color: #1a73e8; }
.tag.sample { background: #fef7e0; color: #b06000; }
.tag.dup { background: #fce8e6; color: #c5221f; }
.issues { color: var(--danger); font-size: 13px; margin-top: 4px; }
```

- [ ] **Step 5: 实现 `ImportPage.tsx`**

```tsx
import { useRef, useState } from 'react'
import ImportPreview from '../components/ImportPreview'
import { deleteBatch, getBatchByHash, listCourseTypes, listRecords } from '../db/repo'
import { applyImport } from '../lib/importService'
import { createImportTemplateWorkbook, downloadWorkbook } from '../lib/export'
import { parseWorkbook, type ImportPreview as Preview } from '../lib/parser'

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [sameFile, setSameFile] = useState(false)
  const [lastBatch, setLastBatch] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const pickFile = async (file: File) => {
    setMsg('')
    const buffer = await file.arrayBuffer()
    const [courseTypes, records] = await Promise.all([listCourseTypes(), listRecords()])
    const p = await parseWorkbook(buffer, file.name, { courseTypes, records })
    setSameFile(!!(await getBatchByHash(p.fileHash)))
    setPreview(p)
    setLastBatch(null)
  }

  const confirm = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const res = await applyImport(preview)
      setLastBatch(res.batchId)
      setMsg(`已导入 ${res.inserted} 条记录`)
      setPreview(null)
    } finally {
      setBusy(false)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const undo = async () => {
    if (!lastBatch) return
    const n = await deleteBatch(lastBatch)
    setLastBatch(null)
    setMsg(`已撤销导入，删除 ${n} 条记录`)
  }

  return (
    <section className="page">
      <header className="page-head"><h1>导入课程表</h1></header>
      <button className="btn-ghost" onClick={() => downloadWorkbook(createImportTemplateWorkbook(), '课时薪资-导入模板.xlsx')}>下载导入模板</button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void pickFile(f) }} />
      <button onClick={() => inputRef.current?.click()} disabled={busy}>选择 Excel 文件</button>
      {sameFile && preview && <p className="warn">该文件之前导入过，请检查下方重复标记。</p>}
      {preview && (
        <>
          <ImportPreview rows={preview.rows} onToggle={i => {
            const rows = [...preview.rows]
            rows[i] = { ...rows[i], selected: !rows[i].selected }
            setPreview({ ...preview, rows })
          }} />
          <button style={{ width: '100%', marginTop: 12 }} onClick={confirm} disabled={busy || preview.rows.every(r => !r.selected)}>
            {busy ? '导入中…' : '确认导入'}
          </button>
        </>
      )}
      {lastBatch && <button className="btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={undo}>撤销上一批导入</button>}
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}
```

CSS：

```css
.btn-ghost { background: var(--card); color: var(--primary); border: 1px solid var(--primary); width: 100%; margin-bottom: 12px; }
.warn { color: #b06000; font-size: 14px; }
.ok { color: #137333; font-size: 14px; }
```

- [ ] **Step 6: 接入 `App.tsx`**：`import` tab 渲染 `<ImportPage />`。

- [ ] **Step 7: 验证**

Run: `npm test -- tests/importService.test.ts` → PASS；`npm run build` → 0。
手动：下载模板 → 填一行 → 导入 → 预览勾选 → 确认 → 记录页出现；再次导入同一文件 → 显示重复警告；点撤销 → 记录消失。

- [ ] **Step 8: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: Excel 导入页（预览/确认/撤销）"
```

---

### Task 10: 月度汇总页（含导出月报）

**Files:**
- Create: `src/lib/summary.ts`
- Create: `src/components/SummaryCard.tsx`
- Create: `src/components/GroupList.tsx`
- Create: `src/pages/SummaryPage.tsx`
- Modify: `src/App.tsx`（summary tab 接入）
- Test: `tests/summary.test.ts`

**Interfaces:**
- Consumes: `db/repo.ts`（listRecords）、`types.ts`、`export.ts`（createMonthlyWorkbook/downloadWorkbook）、`format.ts`
- Produces:
  - `type GroupStats = { label: string; count: number; hours: number; amount: number }`
  - `type Summary = { totalHours: number; totalAmount: number; totalCount: number; cancelledHours: number; cancelledAmount: number; cancelledCount: number; byStudent: GroupStats[]; byCourseType: GroupStats[]; byKind: GroupStats[] }`
  - `summarize(records: LessonRecord[]): Summary`（cancelled 不计入 total 与分组，单独统计）
  - `SummaryPage`：月份选择、摘要卡、分组 Tab（学生/课程类型/教学形式）、已取消折叠区、导出月报按钮

- [ ] **Step 1: 写失败测试 `tests/summary.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { summarize } from '../src/lib/summary'
import type { LessonRecord } from '../src/types'

function rec(over: Partial<LessonRecord>): LessonRecord {
  return {
    id: 'r', courseTypeId: 'ct', courseTypeName: '1对1', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'manual', batchId: null, note: '', createdAt: 't', ...over
  }
}

describe('summarize', () => {
  const rows = [
    rec({ id: 'a', student: '张三', rate: 200, hours: 2, courseTypeName: '1对1', courseTypeKind: '一对一' }),
    rec({ id: 'b', student: '张三', rate: 200, hours: 1, courseTypeName: '1对1', courseTypeKind: '一对一' }),
    rec({ id: 'c', student: '李四', rate: 150, hours: 2, courseTypeName: '小班英语', courseTypeKind: '小班' }),
    rec({ id: 'd', student: '张三', rate: 200, hours: 2, status: 'cancelled' })
  ]
  it('总收入=正常记录合计，取消课单列', () => {
    const s = summarize(rows)
    expect(s.totalAmount).toBe(200 * 2 + 200 * 1 + 150 * 2)
    expect(s.totalHours).toBe(5)
    expect(s.totalCount).toBe(3)
    expect(s.cancelledCount).toBe(1)
    expect(s.cancelledAmount).toBe(400)
  })
  it('按学生/课程类型/教学形式分组', () => {
    const s = summarize(rows)
    expect(s.byStudent.find(g => g.label === '张三')?.amount).toBe(600)
    expect(s.byStudent.find(g => g.label === '李四')?.amount).toBe(300)
    expect(s.byCourseType.find(g => g.label === '小班英语')?.count).toBe(1)
    expect(s.byKind.find(g => g.label === '小班')?.amount).toBe(300)
  })
  it('空列表返回全零', () => {
    const s = summarize([])
    expect(s.totalAmount).toBe(0)
    expect(s.byStudent).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/summary.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/summary.ts`**

```ts
import type { LessonRecord } from '../types'

export interface GroupStats { label: string; count: number; hours: number; amount: number }
export interface Summary {
  totalHours: number
  totalAmount: number
  totalCount: number
  cancelledHours: number
  cancelledAmount: number
  cancelledCount: number
  byStudent: GroupStats[]
  byCourseType: GroupStats[]
  byKind: GroupStats[]
}

function amountOf(r: LessonRecord): number {
  return r.rate !== null && r.hours !== null ? r.rate * r.hours : 0
}

function group(rows: LessonRecord[], key: (r: LessonRecord) => string): GroupStats[] {
  const map = new Map<string, GroupStats>()
  for (const r of rows) {
    const label = key(r) || '（未分类）'
    const g = map.get(label) ?? { label, count: 0, hours: 0, amount: 0 }
    g.count += 1
    g.hours += r.hours ?? 0
    g.amount += amountOf(r)
    map.set(label, g)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

export function summarize(records: LessonRecord[]): Summary {
  const normal = records.filter(r => r.status === 'normal')
  const cancelled = records.filter(r => r.status === 'cancelled')
  return {
    totalHours: normal.reduce((s, r) => s + (r.hours ?? 0), 0),
    totalAmount: normal.reduce((s, r) => s + amountOf(r), 0),
    totalCount: normal.length,
    cancelledHours: cancelled.reduce((s, r) => s + (r.hours ?? 0), 0),
    cancelledAmount: cancelled.reduce((s, r) => s + amountOf(r), 0),
    cancelledCount: cancelled.length,
    byStudent: group(normal, r => r.student),
    byCourseType: group(normal, r => r.courseTypeName),
    byKind: group(normal, r => r.courseTypeKind || '（未分类）')
  }
}
```

- [ ] **Step 4: 实现 `SummaryCard.tsx` 与 `GroupList.tsx`**

`SummaryCard.tsx`：

```tsx
import { fmtHours, fmtMoney } from '../lib/format'
import type { Summary } from '../lib/summary'

export default function SummaryCard({ s }: { s: Summary }) {
  return (
    <div className="card summary-card">
      <div className="sum-main">总收入 <strong>¥{fmtMoney(s.totalAmount)}</strong></div>
      <div className="sum-sub">
        <span>{s.totalCount} 课次</span>
        <span>{fmtHours(s.totalHours)} 小时</span>
        <span>取消 {s.cancelledCount} 课 / ¥{fmtMoney(s.cancelledAmount)}</span>
      </div>
    </div>
  )
}
```

`GroupList.tsx`：

```tsx
import { fmtHours, fmtMoney } from '../lib/format'
import type { GroupStats } from '../lib/summary'

export default function GroupList({ groups }: { groups: GroupStats[] }) {
  if (groups.length === 0) return <p className="empty">暂无数据</p>
  return (
    <div>
      {groups.map(g => (
        <div className="card group-row" key={g.label}>
          <div className="g-left"><strong>{g.label}</strong><span className="muted">{g.count} 课次 · {fmtHours(g.hours)} 小时</span></div>
          <div className="g-right">¥{fmtMoney(g.amount)}</div>
        </div>
      ))}
    </div>
  )
}
```

CSS：

```css
.summary-card { text-align: center; margin-bottom: 12px; }
.sum-main { font-size: 15px; }
.sum-main strong { display: block; font-size: 30px; color: var(--primary); margin-top: 4px; }
.sum-sub { display: flex; justify-content: center; gap: 14px; color: var(--muted); font-size: 13px; margin-top: 8px; }
.group-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.g-left { display: flex; flex-direction: column; }
.g-right { font-weight: 600; }
.group-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
.group-tabs button { flex: 1; background: var(--card); color: var(--text); border: 1px solid var(--border); }
.group-tabs button.active { border-color: var(--primary); color: var(--primary); }
```

- [ ] **Step 5: 实现 `SummaryPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import GroupList from '../components/GroupList'
import MonthPicker from '../components/MonthPicker'
import SummaryCard from '../components/SummaryCard'
import { listRecords } from '../db/repo'
import { createMonthlyWorkbook, downloadWorkbook } from '../lib/export'
import { summarize } from '../lib/summary'
import { useMonth } from '../hooks/useMonth'
import { useEffect } from 'react'

export default function SummaryPage() {
  const { month, setMonth, prev, next } = useMonth()
  const [records, setRecords] = useState<Awaited<ReturnType<typeof listRecords>>>([])
  const [tab, setTab] = useState<'student' | 'courseType' | 'kind'>('student')

  useEffect(() => {
    let alive = true
    void listRecords(month).then(r => { if (alive) setRecords(r) })
    return () => { alive = false }
  }, [month])

  const s = useMemo(() => summarize(records), [records])
  const groups = tab === 'student' ? s.byStudent : tab === 'courseType' ? s.byCourseType : s.byKind
  const cancelled = records.filter(r => r.status === 'cancelled')

  const exportMonth = () => {
    downloadWorkbook(createMonthlyWorkbook(records, groups), `课时薪资-${month}.xlsx`)
  }

  return (
    <section className="page">
      <header className="page-head"><h1>月度汇总</h1></header>
      <MonthPicker month={month} onPrev={prev} onNext={next} onChange={setMonth} />
      <SummaryCard s={s} />
      <div className="group-tabs">
        <button className={tab === 'student' ? 'active' : ''} onClick={() => setTab('student')}>按学生</button>
        <button className={tab === 'courseType' ? 'active' : ''} onClick={() => setTab('courseType')}>按课程类型</button>
        <button className={tab === 'kind' ? 'active' : ''} onClick={() => setTab('kind')}>按教学形式</button>
      </div>
      <GroupList groups={groups} />
      <button style={{ width: '100%', marginTop: 12 }} onClick={exportMonth}>导出本月 Excel</button>
      {cancelled.length > 0 && (
        <details className="card" style={{ marginTop: 12 }}>
          <summary>已取消（{cancelled.length} 课）</summary>
          {cancelled.map(r => (
            <div key={r.id} className="muted" style={{ margin: '6px 0' }}>
              {r.date} {r.student} {r.courseTypeName}（{r.hours ?? '?'}小时 × ¥{r.rate ?? '?'}）
            </div>
          ))}
        </details>
      )}
    </section>
  )
}
```

- [ ] **Step 6: 接入 `App.tsx`**：`summary` tab 渲染 `<SummaryPage />`。

- [ ] **Step 7: 验证**

Run: `npm test -- tests/summary.test.ts` → PASS；`npm run build` → 0。
手动：造几条数据（含取消）→ 汇总金额/课时正确；三个分组 Tab 正确；导出 Excel 打开含「汇总」「明细」两 sheet。

- [ ] **Step 8: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: 月度汇总与月报导出"
```

---
### Task 11: 设置页（备份恢复 / PIN 管理 / 关于）

**Files:**
- Create: `src/lib/restoreService.ts`
- Create: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`（settings tab 接入）
- Test: `tests/restoreService.test.ts`

**Interfaces:**
- Consumes: `export.ts`（createExportAllWorkbook/downloadWorkbook/parseBackupWorkbook）、`db/repo.ts`、`hooks/usePin.ts`
- Produces:
  - `restoreBackup(backup: { records: LessonRecord[]; courseTypes: CourseType[] }, mode: 'merge' | 'overwrite'): Promise<{ records: number; courseTypes: number }>`
    - `merge`：课程类型按名称合并（同名更新默认值，不同名新增）；记录按 id 去重（已存在跳过），缺失 startTime/endTime/hours 的记录用对应课程类型默认课时补齐，仍无课时则跳过并计数为 0（不导入）。
    - `overwrite`：清空 records/courseTypes 后导入全部。
  - `SettingsPage`：全部数据导出 Excel、从备份文件恢复（弹模式选择）、PIN 设置/修改/关闭、关于信息。

- [ ] **Step 1: 写失败测试 `tests/restoreService.test.ts`**

```ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { listCourseTypes, listRecords } from '../src/db/repo'
import { restoreBackup } from '../src/lib/restoreService'
import type { CourseType, LessonRecord } from '../src/types'

beforeEach(async () => { await db.delete(); await db.open() })

const ct: CourseType = { id: 'ct1', name: '1对1', type: '一对一', status: 'enabled', defaultHours: 2, defaultRate: 200, createdAt: 't' }
const rec: LessonRecord = {
  id: 'r1', courseTypeId: 'ct1', courseTypeName: '1对1', courseTypeKind: '一对一',
  rate: 200, student: '张三', date: '2026-08-10', startTime: null, endTime: null,
  hours: null, status: 'normal', source: 'import', batchId: null, note: '', createdAt: 't'
}

describe('restoreBackup', () => {
  it('merge：缺课时用默认课时补齐，重复 id 跳过', async () => {
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge')
    const recs = await listRecords()
    expect(recs).toHaveLength(1)
    expect(recs[0].hours).toBe(2)
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge')
    expect(await listRecords()).toHaveLength(1)
  })
  it('overwrite：先清空再导入', async () => {
    await restoreBackup({ records: [rec], courseTypes: [ct] }, 'merge')
    await restoreBackup({ records: [], courseTypes: [] }, 'overwrite')
    expect(await listRecords()).toHaveLength(0)
    expect(await listCourseTypes()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/restoreService.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/restoreService.ts`**

```ts
import { db } from '../db/db'
import type { CourseType, LessonRecord } from '../types'

export async function restoreBackup(
  backup: { records: LessonRecord[]; courseTypes: CourseType[] },
  mode: 'merge' | 'overwrite'
): Promise<{ records: number; courseTypes: number }> {
  if (mode === 'overwrite') {
    await db.transaction('rw', db.records, db.courseTypes, db.batches, async () => {
      await db.records.clear()
      await db.courseTypes.clear()
      await db.batches.clear()
    })
  }

  let ctCount = 0
  const existingTypes = await db.courseTypes.toArray()
  for (const ct of backup.courseTypes) {
    if (!ct.name) continue
    const found = existingTypes.find(t => t.name === ct.name)
    if (found) {
      if (mode === 'merge') {
        await db.courseTypes.put({ ...found, ...ct, id: found.id, createdAt: found.createdAt })
        existingTypes[existingTypes.indexOf(found)] = { ...found, ...ct, id: found.id, createdAt: found.createdAt }
      }
    } else {
      await db.courseTypes.put(ct)
      existingTypes.push(ct)
      ctCount += 1
    }
  }

  let recCount = 0
  const existingRecs = await db.records.toArray()
  const seenIds = new Set(existingRecs.map(x => x.id))
  for (const r of backup.records) {
    if (mode === 'merge' && seenIds.has(r.id)) continue
    if (mode === 'merge') seenIds.add(r.id)
    if (!r.date || !r.student) continue
    let hours = r.hours
    if (hours === null) {
      const ct = existingTypes.find(t => t.name === r.courseTypeName)
      hours = ct?.defaultHours ?? null
    }
    if (hours === null) continue
    const ct = existingTypes.find(t => t.name === r.courseTypeName)
    const row: LessonRecord = {
      ...r,
      id: mode === 'merge' ? r.id : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      courseTypeId: ct?.id ?? null,
      courseTypeKind: ct?.type ?? '',
      hours,
      status: r.status === 'cancelled' ? 'cancelled' : 'normal',
      source: 'import',
      batchId: null
    }
    await db.records.put(row)
    recCount += 1
  }

  return { records: recCount, courseTypes: ctCount }
}
```

- [ ] **Step 4: 实现 `SettingsPage.tsx`**

```tsx
import { useRef, useState } from 'react'
import { usePin } from '../hooks/usePin'
import { listCourseTypes, listRecords } from '../db/repo'
import { createExportAllWorkbook, downloadWorkbook, parseBackupWorkbook } from '../lib/export'
import { restoreBackup } from '../lib/restoreService'

export default function SettingsPage() {
  const pin = usePin()
  const restoreRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')

  const exportAll = async () => {
    const [records, courseTypes] = await Promise.all([listRecords(), listCourseTypes()])
    downloadWorkbook(createExportAllWorkbook(records, courseTypes), `课时薪资-全部数据-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const onRestoreFile = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const backup = await parseBackupWorkbook(buffer)
    const mode = confirm('覆盖会先清空本地数据，合并则保留并去重。点击"确定"= 合并；"取消"= 覆盖') ? 'merge' : 'overwrite'
    const res = await restoreBackup(backup, mode)
    setMsg(`恢复完成：记录 ${res.records} 条，课程类型 ${res.courseTypes} 个（${mode === 'merge' ? '合并' : '覆盖'}）`)
    if (restoreRef.current) restoreRef.current.value = ''
  }

  const savePin = async () => {
    if (pin.enabled) {
      if (newPin.length < 4) { setMsg('新 PIN 至少 4 位'); return }
      const ok = await pin.change(oldPin, newPin)
      setMsg(ok ? 'PIN 已修改' : '原 PIN 错误')
    } else {
      if (newPin.length < 4) { setMsg('PIN 至少 4 位'); return }
      await pin.setup(newPin)
      setMsg('PIN 已开启')
    }
    setOldPin(''); setNewPin('')
  }

  const disablePin = async () => {
    if (await pin.disable(oldPin)) setMsg('PIN 已关闭')
    else setMsg('PIN 错误')
    setOldPin(''); setNewPin('')
  }

  return (
    <section className="page">
      <header className="page-head"><h1>设置</h1></header>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2>备份</h2>
        <p className="muted">导出全部数据（含课程类型与记录），换手机/重装后可恢复。</p>
        <button style={{ width: '100%' }} onClick={exportAll}>导出全部数据 Excel</button>
        <input ref={restoreRef} type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void onRestoreFile(f) }} />
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => restoreRef.current?.click()}>从备份文件恢复</button>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2>PIN 锁</h2>
        <div className="field"><label>原 PIN（修改/关闭时填写）</label><input type="password" inputMode="numeric" value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
        <div className="field"><label>新 PIN（4~6 位数字）</label><input type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
        <button style={{ width: '100%' }} onClick={savePin}>{pin.enabled ? '修改 PIN' : '开启 PIN 锁'}</button>
        {pin.enabled && <button className="btn-danger" style={{ width: '100%', marginTop: 8 }} onClick={disablePin}>关闭 PIN 锁</button>}
      </div>
      <div className="card">
        <h2>关于</h2>
        <p className="muted">课时薪资 v0.1 · 数据仅存储在本机浏览器（IndexedDB），不联网不上传。备份文件请自行妥善保管。</p>
      </div>
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}
```

CSS：

```css
.settings h2 { font-size: 16px; margin: 0 0 8px; }
```

- [ ] **Step 5: 接入 `App.tsx`**：`settings` tab 渲染 `<SettingsPage />`。

- [ ] **Step 6: 验证**

Run: `npm test -- tests/restoreService.test.ts` → PASS；`npm run build` → 0。
手动：导出全部 → 清空数据 → 从备份恢复（合并）→ 数据回来；开启 PIN → 刷新页面要求解锁；切后台 1 分钟回来要求解锁。

- [ ] **Step 7: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: 设置页（备份恢复/PIN 管理）"
```

---

### Task 12: PWA 化与部署（收尾）

**Files:**
- Create: `scripts/gen-icons.py`
- Create: `public/icons/icon-192.png`、`public/icons/icon-512.png`（由脚本生成）
- Modify: `vite.config.ts`（接入 vite-plugin-pwa）
- Modify: `README.md`（部署与手机安装说明）
- Modify: `src/index.html`（meta theme-color 已有，补充 apple-touch-icon）

**Interfaces:**
- Consumes: 全部已完成功能
- Produces: 可部署的 `dist/`；安装后离线可用；README 部署指引。

- [ ] **Step 1: 生成图标（Python 标准库 PNG）**

`scripts/gen-icons.py`：

```python
import struct, zlib, os

def chunk(tag, data):
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

def solid_png(path, size, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * size for _ in range(size))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)

os.makedirs('public/icons', exist_ok=True)
solid_png('public/icons/icon-192.png', 192, (31, 111, 235))
solid_png('public/icons/icon-512.png', 512, (31, 111, 235))
print('icons generated')
```

Run: `python scripts/gen-icons.py`
Expected: 两个 PNG 文件生成（后续可替换为正式图标设计）。

- [ ] **Step 2: 修改 `vite.config.ts` 启用 PWA**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '课时薪资',
        short_name: '课时薪资',
        description: '本地离线课时薪资计算器',
        lang: 'zh-CN',
        theme_color: '#1f6feb',
        background_color: '#f5f6f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,ico}']
      }
    })
  ]
})
```

`index.html` `<head>` 内补充：

```html
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 退出码 0；`dist/` 含 `sw.js`、`manifest.webmanifest`、图标。

Run: `npm run preview` 后浏览器打开 `http://localhost:4173`（开发者工具切移动端）：
- Application → Manifest 正常；Service Worker 已注册（`sw.js` 激活）；
- 各页功能回归：导入/记录/汇总/导出/备份/PIN 均正常。

- [ ] **Step 4: 更新 README 部署说明**

内容要点：
1. `npm run build` 产出 `dist/`。
2. GitHub Pages：建仓库 → Settings → Pages → Deploy from branch → 选 main + `/docs` 或推送 dist 到 `gh-pages` 分支（或 GitHub Actions 自动部署）。
   - 若部署到子路径（如 `https://<user>.github.io/<repo>/`），需把 `vite.config.ts` 加 `base: '/<repo>/'` 并重新构建。
3. Cloudflare Pages：登录 → Create project → 上传 `dist/` 目录 → 自动获得 HTTPS 域名。
4. 手机安装：Android Chrome 打开网址 → 菜单"添加到主屏幕"；iPhone Safari 打开 → 分享 → "添加到主屏幕"。
5. 安全说明：安装后离线可用；数据仅存手机浏览器本地；定期在"设置 → 导出全部数据"备份。

- [ ] **Step 5: 提交**

```bash
git -c safe.directory=E:/rio/code/self/lesson-salary add -A
git -c safe.directory=E:/rio/code/self/lesson-salary commit -m "feat: PWA 离线安装与部署文档"
```

---

## 收尾核对清单

- [ ] 全部 12 个任务完成，每次提交信息与任务一致。
- [ ] `npm test` 全绿；`npm run build` 退出码 0。
- [ ] 设计文档 R1–R10 逐条对照实现（见各任务标题）。
- [ ] 手机实测：Android Chrome / iPhone Safari 安装、离线打开、导入真实 Excel、导出月报与备份恢复、PIN 锁。
