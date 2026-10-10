# 课时薪资 · 微信小程序版 设计文档

- 日期：2026-10-10
- 状态：待用户审阅
- 范围：将现有纯本地 PWA（`docs/superpowers/specs/2026-08-10-lesson-salary-design.md`）改造为**原生微信小程序**，并正式上架供其他老师使用
- 前置文档：`docs/superpowers/specs/2026-08-10-lesson-salary-design.md`（业务规则 R1~R10 继续有效，本文件只覆盖形态迁移）

---

## 1. 背景与目标

现有项目是一个已完成的移动端优先 PWA：Vite 5 + React 18 + TypeScript(strict) + Dexie 4 + SheetJS，数据全部存本地 IndexedDB，14 个测试文件 / 83 个测试全部通过。

目标是把它变成**微信小程序**并正式上架，让其他老师也能用。

核心诉求（按优先级）：

1. **数据纯本地** —— 不要后端、不要云端、不要账号体系。数据不出设备。
2. **正式上架** —— 个人主体，需要走完备案与审核。
3. **不浪费已有资产** —— 现有的 Excel 容错解析、去重、汇总、备份恢复逻辑与测试必须保住。

### 1.1 现有代码基线（迁移前实测）

| 项 | 值 |
|---|---|
| `src/` 文件数 | 40 |
| `tests/` 文件数 / 用例数 | 14 / 83（全通过，1.83s） |
| `npm run build` 产物 | 754 KB（`index-*.js` 704 KB，含 React + Dexie + xlsx） |
| `node_modules/xlsx/xlsx.js` | 816 KB |
| Node / npm | v22.20.0 / 10.9.9 |
| xlsx 版本 | 0.18.5（npm 最后一个版本，含已知 CVE，见 §11） |

---

## 2. 已确认的决策

| 编号 | 决策项 | 结论 |
|---|---|---|
| D1 | 发布形态 | 正式上架，面向其他老师 |
| D2 | 数据架构 | **纯本地，无云端**。无服务器、无账号、无网络请求 |
| D3 | 技术路线 | **原生小程序（TypeScript）+ 共享 core 层**；不用 Taro/uni-app |
| D4 | 仓库结构 | 单一 core 源（`src/core/`）+ 构建脚本产出到小程序 |
| D5 | 上架主体 | 个人主体 |
| D6 | v1 功能范围 | Excel 导入（预览/去重/撤销）、Excel 月报导出、Excel 全量备份 + 恢复、日历视图 |
| D7 | 明确不做 | **PIN 锁**（v1 砍掉）、任何云端/同步/多用户能力 |
| D8 | 备份提醒 | 首次引导提示 + 超过 30 天未导出时提醒一次 |

### 2.1 砍掉 PIN 的连带影响

PIN 原实现依赖 Web Crypto 的 `crypto.subtle` PBKDF2（10 万次迭代），小程序**完全没有这个 API**，纯 JS 实现会带来 1~2 秒的解锁卡顿。D7 砍掉后：

- `src/lib/pin.ts`、`src/hooks/usePin.ts`、`src/components/PinLock.tsx`、`tests/pin.test.ts`、`tests/usePin.test.ts` **全部只留在 web 端**，不进入 core。
- core 层唯一的密码学需求退化为**文件指纹 SHA-256**（用于重复导入检测）。
- `visibilitychange` 后台锁定逻辑随之取消。

---

## 3. 总体架构

**核心思想**：真正的可复用资产不是 React 组件，而是那层纯函数与它背后的 83 个测试。把纯逻辑抽成平台无关的 `core`，两端各自做薄适配。

```
lesson-salary/
├─ src/
│  ├─ core/                      ★ 单一源真相：纯函数，零平台依赖
│  │  ├─ types.ts                从 src/types.ts 移入
│  │  ├─ time.ts                 原样移入
│  │  ├─ format.ts               原样移入
│  │  ├─ summary.ts              原样移入
│  │  ├─ calendar.ts             原样移入
│  │  ├─ dedup.ts                原样移入
│  │  ├─ sha256.ts               ★ 新增：纯 JS SHA-256，替代 crypto.subtle.digest
│  │  ├─ parser.ts               ★ 拆分：仅保留纯解析（detectColumns / buildPreviewFromRows）
│  │  ├─ workbook.ts             ★ 拆分：XLSX 相关（parseWorkbook / 建 workbook / 解析备份）
│  │  ├─ repo.ts                 ★ 新增：Repo 接口定义
│  │  ├─ memoryRepo.ts           ★ 新增：内存实现（供测试与契约测试使用）
│  │  └─ services/
│  │     ├─ importService.ts     改为接收 Repo 参数
│  │     └─ restoreService.ts    改为接收 Repo 参数
│  └─ web/                       现有 PWA 适配层
│     ├─ db/                     Dexie 实现 Repo
│     ├─ lib/export.ts           保留 DOM 保存逻辑（saveWorkbook）
│     ├─ lib/pin.ts              保留，仅 web
│     ├─ components/ pages/ hooks/ App.tsx main.tsx index.css
├─ miniprogram/                  ★ 新增：原生小程序
│  ├─ app.ts / app.json / app.wxss / sitemap.json / project.config.json
│  ├─ core/index.js              ★ 构建产物（主包用，不含 XLSX）
│  ├─ shared/                    wx storage Repo、文件读写、Toast/Modal 封装
│  ├─ components/                sheet / month-picker / record-card / summary-card / group-list
│  ├─ pages/                     summary / records / courseTypes / settings
│  └─ packageImport/             ★ 分包
│     ├─ core-workbook.js        ★ 构建产物（含 XLSX，仅此包引用）
│     └─ pages/                  import / export / backup
├─ tests/                        83 个测试保留，仅改 import 路径
└─ scripts/build-core.mjs        ★ esbuild 构建 core
```

### 3.1 为什么 `parser.ts` 必须拆成两个文件

这是分包方案能否成立的关键，容易漏掉：

`parser.ts` 现在同时包含**纯行解析**（`detectColumns` / `buildPreviewFromRows`）和**工作簿读取**（`parseWorkbook`，`import * as XLSX`）。如果整体放进 core，那么主包的 `core/index.js` 会因 import XLSX 而把 SheetJS（未压缩 **816 KB** / 压缩后 424 KB）拖进主包，分包就白做了。

因此按依赖切分：

| 文件 | 内容 | XLSX 依赖 | 归属 |
|---|---|---|---|
| `core/parser.ts` | `detectColumns`、`buildPreviewFromRows`、`parseRate`、`ParsedRow`、`ImportPreview` | 否 | 主包 |
| `core/workbook.ts` | `parseWorkbook`、`createImportTemplateWorkbook`、`createExportAllWorkbook`、`createMonthlyWorkbook`、`parseBackupWorkbook` | **是** | 分包 |

`core/index.ts` 只导出 `parser.ts` 一侧；`workbook.ts` 单独作为第二个构建入口。

### 3.2 平台依赖审计（已实测）

整个 core 抽取方案成立的前提是"现有 lib 层确实是纯函数"。这一点已实际核查 `src/lib/*.ts` 的 import 与全局对象使用，**结论支持该前提**：

| 文件 | 现状 | 处置 |
|---|---|---|
| `format.ts` `time.ts` | 零 import、零全局对象 | 原样进 core |
| `summary.ts` `calendar.ts` `dedup.ts` | 只 `import type` 类型 | 原样进 core |
| `parser.ts` | `import XLSX`；第 170 行用 `crypto.subtle.digest` | 拆为 `core/parser.ts` + `core/workbook.ts`；SHA-256 换成 `core/sha256.ts` |
| `export.ts` | `import XLSX`；大量 `window` / `document` / `navigator` / `Blob` / `URL` / 模块级 `lastExportUrl` 状态 | 建 workbook 部分进 `core/workbook.ts`；`saveWorkbook` / `openLastExport` 留在 web |
| `importService.ts` `restoreService.ts` | 直接 `import { db }` | 改为注入 `Repo` 参数 |
| `pin.ts` | `crypto.subtle` PBKDF2 | 留在 web（D7 已砍） |
| `installGuide.ts` | `window` / `localStorage` | 留在 web（PWA 专用，删除） |

**平台依赖高度集中**：`src/lib/` 中 5 个纯函数模块（再加纯类型的 `types.ts`）已经零平台依赖，需要处置的只有 6 个文件，且每处的处置方式都是明确的机械改动 —— 没有需要重新设计的业务逻辑。这是本次迁移风险可控的主要依据。

---

## 4. 数据层

### 4.1 Repo 接口（依赖倒置）

`core/repo.ts` 定义接口。现有 `src/db/repo.ts` 的 **12 个函数签名 100% 保留**，只新增 `transaction`：

```ts
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

三个实现：

| 实现 | 位置 | 用途 |
|---|---|---|
| Dexie | `src/web/db/` | web PWA（行为与现在完全一致） |
| wx storage | `miniprogram/shared/repo.ts` | 小程序 |
| 内存 | `src/core/memoryRepo.ts` | 测试与契约测试 |

**注意**：之所以保留接口抽象，**不是为了"以后接云端"（D2 已排除），而是因为**：(a) 两端本来就需要两套实现；(b) core 层的 `importService` / `restoreService` 能注入内存实现，从而脱离 IndexedDB 被 Vitest 覆盖。

### 4.2 小程序存储方案：按月分片

小程序本地存储有两条硬限制：**单个 key 最大 1 MB，总量上限 10 MB**。一条 `LessonRecord` 的 JSON 约 200 字节，单 key 只够放约 5000 条，因此 `records` 必须分片：

```
ls:records:index      → string[]            # 已存在的月份，如 ["2026-07","2026-08"]
ls:records:2026-08    → LessonRecord[]      # 按月分片
ls:courseTypes        → CourseType[]
ls:batches            → ImportBatch[]
ls:settings           → Record<string, unknown>
```

- `listRecords('2026-08')` → 读单个分片
- `listRecords()`（导入去重需要全量）→ 读索引后合并所有分片
- `saveRecord` / `deleteRecord` → 只重写所属月份的分片
- 按月分片后，总量 10 MB 按 200 B/条估算可存约 5 万条，单 key 限制不再成为瓶颈

### 4.3 事务语义对齐

小程序存储**没有事务**。`transaction<T>(fn)` 在 wx 实现中为：

1. 快照当前内存模型（深拷贝受影响的分片）
2. 执行 `fn`
3. 成功 → 一次性把变更的分片落盘
4. 失败 → 丢弃内存变更并抛出，保证不落半成品

Dexie 实现直接映射到 `db.transaction('rw', ...)`。两者对外语义一致，由 `repo-contract.test.ts` 保证。

### 4.4 容量守卫

写入前估算序列化体积，超过阈值时：

- 接近 10 MB（如 ≥ 8 MB）→ 在设置页显示警示，引导导出备份
- 写入抛错 → `wx.showModal` 明确提示"本地存储已满，请先导出备份并清理数据"，不静默失败

---

## 5. Excel 导入 / 导出 / 备份恢复

### 5.1 导入

1. `wx.chooseMessageFile({ count: 1, type: 'file', extension: ['xlsx','xls'] })` → `tempFilePath`
   - **体验变化（已确认接受）**：小程序无法访问本地文件系统，用户必须**先把 xlsx 发到微信**（例如发给"文件传输助手"）才能选中
2. `wx.getFileSystemManager().readFile({ filePath })` → `ArrayBuffer`
3. `core/workbook.parseWorkbook(buffer, name, existing)` → 复用全部容错逻辑：表头别名识别、多 sheet 探测、日期/时间多格式、示例行识别、行级去重、未知课程类型标记
4. 预览页逐行勾选 → `core/services/importService.applyImport(preview, repo)`
5. 保留"撤销本批导入"（`deleteBatch`）

### 5.2 导出

1. `core/workbook.createMonthlyWorkbook(records, groups)` / `createExportAllWorkbook(...)` → workbook
2. `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` → `ArrayBuffer`
3. `FileSystemManager.writeFile` 写到 `wx.env.USER_DATA_PATH/课时薪资-月报-2026-08.xlsx`
4. 呈现方式二选一：`wx.openDocument({ filePath, showMenu: true })` 预览，或 `wx.shareFileMessage({ filePath })` 转发

### 5.3 备份与恢复

- 备份 = `createExportAllWorkbook` 全量导出（`上课记录` + `课程类型` 两个 sheet）
- 恢复 = 选文件 → `parseBackupWorkbook` → 选择**合并**或**覆盖** → `restoreService.restoreBackup(backup, mode, repo)`
- **恢复是换手机迁移的唯一手段**（见 §7），入口需显著

### 5.4 分包决策（基于实测）

`node_modules/xlsx/xlsx.js` 未压缩 **816 KB**，占主包 2 MB 上限的 40%。因此 SheetJS 及其消费方全部进分包：

```json
{
  "pages": ["pages/summary/index","pages/records/index","pages/courseTypes/index","pages/settings/index"],
  "subpackages": [
    { "root": "packageImport", "pages": ["pages/import/index","pages/export/index","pages/backup/index"] }
  ],
  "tabBar": { "...": "4 个 tab 页必须在主包" },
  "darkmode": true
}
```

构建脚本把 `core/workbook.ts` 连同 XLSX 一起 bundle、minify 成 `miniprogram/packageImport/core-workbook.js`，主包不含任何 XLSX 代码。

**实测体积**（`npx esbuild node_modules/xlsx/xlsx.js --minify --format=cjs --target=es2018`）：

| 形态 | 体积 | 占主包 2 MB |
|---|---|---|
| `xlsx.js` 未压缩 | 816 KB | 40% |
| minify 后 | **424 KB** | 21% |

即使压缩后，XLSX 仍会吃掉主包约五分之一，而导入/导出属于低频操作、不该进入首屏加载路径 —— 分包决策在压缩后依然成立。分包产物实际大小在实施阶段（集成 `core/workbook.ts` 后）复测。

---

## 6. 页面与平台差异适配

### 6.1 导航

tabBar 4 个：**汇总**（首页）· **记录** · **课程类型** · **设置**。导入 / 导出 / 备份恢复为分包页面，从设置页与汇总页 `wx.navigateTo` 进入。

| 页面 | 内容（沿用现有实现，仅重写视图层） |
|---|---|
| 汇总 | 月份选择器、摘要卡（总收入/总课时/有效课次/取消课次）、按学生/课程类型/教学形式分组、导出本月 Excel |
| 记录 | 列表视图 + 日历视图切换、点日期弹当天明细、卡片编辑 Bottom Sheet、手动补录、取消/删除 |
| 课程类型 | 启用/停用分组列表、新增/编辑表单（名称、教学形式、状态、默认课时、默认时薪） |
| 设置 | 导出全部（备份）、导入恢复、备份提醒、清空所有数据、关于/版本 |

### 6.2 差异映射

| Web 现有 | 小程序替换 |
|---|---|
| `input[type=date]` / `[type=time]` | `<picker mode="date">` / `<picker mode="time">` |
| 受控 `input` + `onChange` | `<input bindinput>` + `this.setData` |
| 自研 Bottom Sheet（`Sheet.tsx`） | 自定义组件 + WXSS 过渡动画 |
| `env(safe-area-inset-*)` | WXSS 同样支持，保留 |
| `prefers-color-scheme` | WXSS 支持 + `app.json` 开启 `darkmode` |
| `wx.showToast` 替代自研 Toast | `wx.showToast` |
| `window.confirm` | `wx.showModal` |
| `visibilitychange` 后台锁定 | 不需要（PIN 已砍） |
| PWA manifest / Service Worker / `InstallGuide` | 全部删除，小程序即入口 |
| `navigator.userAgent` 平台判断 | 删除 |

### 6.3 渲染注意

WXML 不能调用任意 JS 函数做展示层格式化，因此页面 `data` 需**预先格式化**（金额、小时数、日期显示值在 `setData` 前算好）。`core/format.ts` 与 `core/calendar.ts` 在页面逻辑层调用，不在模板层调用。

---

## 7. 备份与数据安全

D2 选择纯本地，代价是**数据只在这台手机上**。小程序本地存储会在以下情况丢失：

- 用户**删除小程序**（微信会清空其存储）
- 手机存储紧张时微信清理缓存
- **换手机**

因此 Excel 备份从"锦上添花"升级为**唯一的数据保全手段**。设计措施：

1. 设置页显著位置提供「导出全部数据（备份）」入口
2. 首次使用引导中含一句说明：数据仅存本机，请定期导出备份
3. 超过 **30 天**未导出时，进入设置页提醒一次（可关闭）
4. 汇总页「导出月报」旁提供「导出备份」快捷入口
5. 删除/清空数据的操作均需 `wx.showModal` 二次确认

**隐私结果**：数据不出设备、零网络请求，隐私协议中声明"数据仅存储于用户设备本地，不收集、不上传"即可，无需申报收集个人信息。

---

## 8. 上架前提（个人主体）

| 项 | 结论 |
|---|---|
| ICP 备案 | **必须**，否则无法发布（与有无后端无关） |
| 服务器 / 域名 / 业务域名备案 | **完全不需要** |
| 服务类目 | 工具 → 效率 / 工具 → 其他 |
| 微信支付 / 收费 | **不可用**（个人主体无法开通），v1 全功能免费 |
| 隐私协议 | 需配置，声明本地存储、不收集不上传 |
| 数据删除入口 | 设置页「清空所有数据」保留，满足用户数据可删除要求 |
| 小程序名称 | **已确定：三尺课时账**（简称「课时账」，10 字符）。已避开"薪资/工资"等金融类目联想词，见 `docs/miniprogram-registration.md` |

---

## 9. 构建流程

```
npm run build:core     # esbuild: src/core/index.ts  → miniprogram/core/index.js（不含 XLSX）
                       #          src/core/workbook.ts → miniprogram/packageImport/core-workbook.js（含 XLSX，minify）
npm test               # Vitest，83 个测试跑在 src/core + src/web
npm run build          # 现有 web 构建，保持不变
```

`scripts/build-core.mjs` 要点：

- esbuild `format: 'cjs'`（小程序模块系统为 CommonJS）、`target: 'es2018'`
- 主包入口**不** bundle XLSX；分包入口 bundle 并 minify
- 产物目录 `miniprogram/core/` 与 `miniprogram/packageImport/core-workbook.js` 是否提交进 git，见 §11 待决 T3
- `miniprogram/core/` 顶部加 `/* 自动生成，请勿手改；源文件在 src/core/ */`

---

## 10. 测试策略

### 10.1 测试归属划分

现有 83 个测试**全部保留**，按归属各就各位：

| 测试文件 | 迁移后归属 | 改动 |
|---|---|---|
| `time` `format` `summary` `calendar` `dedup` | core | 仅改 import 路径 → `../src/core/*` |
| `parser` | core | 一拆为二：`detectColumns` / `buildPreviewFromRows` 从 `core/parser` 引入，`parseWorkbook` 从 `core/workbook` 引入 |
| `export` | core | 改从 `../src/core/workbook` 引入。该文件只测 4 个建/解 workbook 的函数，不涉及留在 web 的 `saveWorkbook`（DOM） |
| `importService` `restoreService` | core | 改为注入 `memoryRepo`，**不再依赖 `fake-indexeddb`** |
| `repo` | **web** | 保留 `fake-indexeddb/auto`，作为 Dexie 实现那一侧的契约测试 |
| `smoke` | — | 无 import，不需改动 |
| `pin` `usePin` `installGuide` | **web** | 不迁移，原样保留 |

新增：

- `sha256.test.ts` —— 对标准测试向量（空串、`abc`、长输入）验证哈希，确保纯 JS 实现与 Web Crypto 结果一致（这是替换 `crypto.subtle.digest` 的正确性保障）
- `repo-contract.test.ts` —— 把 Repo 接口契约（日期倒序、按月筛选、批次级联删除、设置读写、事务失败回滚）写成一组共享断言，用同一组断言分别跑 `memoryRepo` 与 Dexie 实现

### 10.2 web 端（回归安全网）

`npm test` + `npm run build` + `npm run test:e2e`（Playwright）必须持续通过。**core 抽取过程中 web 端不许出现行为回归** —— 这是整个重构的安全网，也是本次改动最大风险的对照系。

### 10.3 小程序端（明确取舍）

小程序页面层**没有可用的自动化测试方案**（官方单测能力弱、无成熟 DOM 模拟）。因此架构上刻意把**全部业务逻辑下沉到 core**，页面层只做：

- `setData` 数据准备（调用 core 纯函数）
- 事件绑定转发
- 平台 API 调用（picker / chooseMessageFile / openDocument / showModal）

页面层不含任何可独立验证的业务规则。这样可测试面积最大化到 core，把"无法自动化测试"的影响面压到最小。**这一取舍已与用户确认。**

---

## 11. 风险与待决事项

| 编号 | 事项 | 说明与应对 |
|---|---|---|
| R1 | **SheetJS 0.18.5 存在已知 CVE** | `CVE-2023-30533`（原型污染，0.19.3 修复，[GHSA-4R6H-8V6P-XVW6](https://vulnerability.circl.lu/vuln/ghsa-4r6h-8v6p-xvw6)）。SheetJS 自 0.18.5 起不再发布到 npm，只在官方 CDN 分发 0.20.x（[SheetJS issue #2831](https://github.com/SheetJS/sheetjs/issues/2831)）。**上架应用带已知 CVE 不合适**，实施时升级到官方 CDN 的 0.20.x。注意这会同时影响 web 端 |
| R2 | 主包 2 MB 上限 | 已用分包化解（§5.4）。实施时需在微信开发者工具确认实际包体积；若仍超限，进一步把课程类型/设置页移入分包 |
| R3 | 本地存储 10 MB 上限 | 已按月分片 + 容量守卫化解（§4.2 / §4.4）。需在真机验证写入性能 |
| R4 | 记录列表性能 | 一个月记录量通常 < 300 条，`setData` 可承受。若真机出现卡顿，再引入虚拟列表 |
| R5 | 日历视图重写成本 | 现有 `MonthCalendar.tsx` 逻辑在 `core/calendar.ts`（纯函数，可复用），只有视图层需重写 |
| T1 | SheetJS 升级路径 | 待定：从官方 CDN 装 0.20.x 是否与现有 `xlsx` import 写法及 Vitest 环境兼容，实施阶段验证 |
| T2 | ~~小程序名称~~ **已解决** | **三尺课时账**（简称「课时账」）。首选名「课时记账本」已被占用，改用候选名单第 5 项。头像与介绍见 `docs/miniprogram-registration.md` |
| T3 | core 产物是否提交 | 待定：`miniprogram/core/` 提交进 git（开发者工具直接可跑）还是构建时生成（干净但多一步），实施阶段定 |

---

## 12. 范围外（YAGNI）

- 云端同步、账号体系、多设备同步、多老师分摊
- PIN 锁 / 生物识别锁（D7）
- 付费、会员、微信支付（个人主体不可用）
- 图表可视化、数据统计看板
- 打卡提醒、订阅消息
- H5 端继续维护为独立形态（web 仅作为回归安全网保留，不作为产品目标）

---

## 13. 后续步骤

1. 用户审阅本设计文档。
2. 编写实现计划（writing-plans 技能）。
3. 实施顺序建议（在实现计划中细化）：
   - 阶段一：抽取 `src/core/`，改造 web 端依赖，**确认 83 个测试与 web 构建仍通过**（不改任何行为）
   - 阶段二：新增 `sha256.ts`、拆 `parser.ts` / `workbook.ts`、引入 `Repo` 接口与 `memoryRepo`，补齐契约测试
   - 阶段三：搭建 `miniprogram/` 骨架、构建脚本、wx storage Repo、4 个主包页面
   - 阶段四：分包页面（导入 / 导出 / 备份恢复）+ SheetJS 分包集成
   - 阶段五：备份提醒、空态、错误处理、真机验证、备案与上架材料
