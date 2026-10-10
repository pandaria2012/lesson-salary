# 三尺课时账（课时记账）

移动端优先、**数据完全本地**的课时记录与课酬统计工具。同一套业务逻辑（`src/core`）驱动两个前端：

- **微信小程序**（`miniprogram/`）—— 已上架形态，见下方「小程序」
- **PWA 网页版**（`src/web/`）—— 同一功能的浏览器版本，离线可用、可添加到主屏幕

## 功能

- 上课记录：录入 / 编辑 / 补录 / 取消 / 删除，列表与日历双视图
- Excel 导入：预览 / 逐行勾选 / 去重标记 / 撤销整批
- 月度汇总：按学生 / 课程类型 / 教学形式分组，导出月报 Excel
- 备份与恢复：全量导出 Excel，合并或覆盖恢复
- 课程类型管理：名称、教学形式、默认课时、默认时薪

> **数据只在本机。** 无服务器、无账号、无网络请求。代价是删除小程序 / 换手机 / 清理微信缓存都会丢失数据，请定期导出备份。

## 架构：单一 core + 双端适配

```
src/core/      纯逻辑，零平台依赖（唯一源真相）
               types time format summary calendar dedup parser repo sha256
               workbook.ts  ← 依赖 SheetJS，仅分包引用
               services/    ← importService / restoreService（注入 Repo）
src/web/       PWA 适配层（Dexie Repo、DOM 导出、PIN 锁）
miniprogram/   小程序（wx storage Repo、微信文件 API）
tests/         129 个测试，覆盖 core 与两端 Repo
```

数据访问通过 `Repo` 接口倒置，三个实现行为一致，由 `tests/repo-contract.test.ts` 用**同一组断言**保证：

| 实现 | 位置 | 用途 |
|---|---|---|
| Dexie | `src/web/db/repo.ts` | PWA（IndexedDB） |
| wx storage | `miniprogram/shared/repo.ts` | 小程序（按月分片） |
| 内存 | `src/core/memoryRepo.ts` | 测试 |

## 开发（PWA）

```bash
npm install
npm run dev          # 本地开发
npm run build        # 构建到 dist/
npm test             # 129 个测试
```

### 已知环境问题：esbuild 无法写 `%TEMP%`

本机 `npm run build` 可能报 `Access is denied`（esbuild 临时文件），与代码无关。绕过方式：

```powershell
New-Item -ItemType Directory -Force .tmp-build | Out-Null
$env:TEMP = "$PWD\.tmp-build"; $env:TMP = "$PWD\.tmp-build"
npm run build
```

## 小程序

### 首次准备

```bash
npm install
npm run build:core   # 把 src/core 编译到 miniprogram/（产物不入库，必须执行）
```

然后用**微信开发者工具**打开**仓库根目录**（`project.config.json` 已配好 `miniprogramRoot: miniprogram/`，含 AppID）。

### 日常命令

```bash
npm run build:core   # 改过 src/core 后必须重新构建
npm run check:core   # 校验产物是否与 src/core 同步（防忘记重建）
npm run check:mp     # 校验小程序结构：页面四件套、tabBar 图标、WXML 事件绑定
npm run verify       # 全量：check:core + check:mp + 测试 + 两端类型检查
```

> **改了 `src/core` 却忘记 `build:core`** 是最容易犯的错：小程序会静默运行旧逻辑。
> `npm run check:core` 通过写入产物的 `src-core-hash` 检测这一点，`npm run verify` 已包含。

### 分包与体积

SheetJS 压缩后约 424 KB，为避免拖累主包（上限 2 MB），Excel 相关能力全部放在 `packageImport/` 分包：

| 包 | 内容 | 实测体积 |
|---|---|---|
| 主包 | 4 个 tab 页 + core（不含 XLSX） | ~20 KB |
| 分包 `packageImport` | 导入 / 导出月报 / 备份恢复 + SheetJS 0.20.3 | ~498 KB |

`scripts/build-core.mjs` 会**在构建期断言主包产物不含 SheetJS**，防止误引入。

SheetJS 使用官方 CDN 的 **0.20.3**（npm 上的 0.18.5 含 `CVE-2023-30533` 原型污染，0.19.3 才修复）：

```bash
npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

构建脚本还剔除了 `xlsx` 的 `dist/cpexcel.js`（793 KB，旧版 `.xls` 多语言码表）。
安全依据：本应用只处理 `.xlsx`（UTF-8 + XML）；SheetJS 官方同样提供不含 cpexcel 的 `xlsx.core.min.js`。
已实测验证：读写含中文 `.xlsx`、SHA-256 指纹、备份往返全部正确（0.18.5 与 0.20.3 均验证）。

### 数据存储

小程序本地存储有两处硬限制，实现时已规避：

- **单 key ≤ 1 MB** → 记录**按月分片**（`ls:records:2026-08`），配月份索引
- **总量 ≤ 10 MB** → 写入前估算体积，超 1 MB 分片抛明确错误；设置页显示用量，≥80% 提示导出备份

小程序存储**无事务**，`Repo.transaction` 用「内存缓冲写入 → 成功一次性落盘 → 失败丢弃缓冲」模拟。

### 上架

- 名称：**三尺课时账**（简称「课时账」），注册资料见 `docs/miniprogram-registration.md`
- 服务类目：工具 → 效率 / 工具 → 其他
- **需完成 ICP 备案**才能发布
- 个人主体无法开通微信支付，全功能免费
- 隐私协议：声明数据仅存用户设备本地、不收集不上传
- 用户数据删除入口：设置页「清空所有数据」

### 测试策略

小程序页面层**没有可用的自动化测试方案**，因此全部业务逻辑下沉到 `core`，页面只做 `setData` 准备、事件转发、平台 API 调用。可自动化验证的部分：

- `src/core` 与两个 Repo 实现 → Vitest（129 个测试）
- 小程序工程结构、WXML 事件绑定、产物同步 → `npm run check:mp` / `check:core`
- 页面交互与真机表现 → 需在微信开发者工具与真机上手测

## 设计文档

- 设计：`docs/superpowers/specs/2026-10-10-wechat-miniprogram-design.md`
- 实现计划：`docs/superpowers/plans/2026-10-10-wechat-miniprogram-plan.md`
- 注册资料：`docs/miniprogram-registration.md`
- PWA 原始设计：`docs/superpowers/specs/2026-08-10-lesson-salary-design.md`
