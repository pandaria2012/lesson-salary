/**
 * 生成「提交审核」用的图片预览截图。
 *
 * 为什么要做：小程序是纯本地应用，审核员打开时本机没有任何数据，
 * 看到的是空态页面 —— 容易被判「功能过于简单」或「无法体验核心功能」。
 * 截图能直接展示真实使用效果，是提高审核通过率的主要手段。
 *
 * ⚠️ 关键坑：页面数据靠 onShow 刷新，而 switchTab 到**当前已活动**的 tab
 * 不会触发 onShow。所以每次截图前都要先跳到另一个 tab，再跳回来。
 * （第一版脚本踩了这个坑，汇总页截到了空态 ¥0.00）
 *
 * 用法：node scripts/mp-screenshots.mjs [输出目录]
 */
import automator from 'miniprogram-automator'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const OUT = process.argv[2] || path.join('assets', 'review-shots')
mkdirSync(OUT, { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function connect() {
  const ws = 'ws://127.0.0.1:9420'
  for (let i = 0; i < 3; i++) {
    try { return await automator.connect({ wsEndpoint: ws }) } catch { await sleep(1500) }
  }
  throw new Error('无法连接自动化宿主，请先运行 cli auto --auto-port 9420')
}
const mp = await connect()

/** 等到指定页面成为当前页 */
async function waitFor(route, tries = 10) {
  for (let i = 0; i < tries; i++) {
    await sleep(500)
    try {
      const p = await mp.currentPage()
      if (p && p.path === route) return p
    } catch { /* retry */ }
  }
  return await mp.currentPage()
}

/** 切 tab（会触发 onShow → 重新读库） */
async function tabTo(route) {
  try { await mp.switchTab(`/${route}`) } catch { /* 忽略 */ }
  return await waitFor(route)
}

async function navTo(route) {
  try { await mp.navigateTo(`/${route}`) } catch { /* 忽略 */ }
  return await waitFor(route)
}

/**
 * 强制刷新：先跳到一个**不同**的 tab，再跳到目标 tab。
 * 直接 switchTab 到当前 tab 不会触发 onShow，会截到陈旧数据。
 */
async function freshTab(route, other = 'pages/records/index') {
  if (route !== other) await tabTo(other)
  return await tabTo(route)
}

async function shot(name) {
  await sleep(700)
  const file = path.join(OUT, `${name}.png`)
  await mp.screenshot({ path: file })
  console.log(`  ✓ ${name}.png`)
}

// ---------------------------------------------------------------
// 1. 清库 + 写入贴近真实的示例数据
// ---------------------------------------------------------------
console.log('\n准备示例数据…')
const seeded = await mp.evaluate(() => {
  for (const k of wx.getStorageInfoSync().keys) {
    try { wx.removeStorageSync(k) } catch { /* ignore */ }
  }
  const C = require('core/index.js')
  const repo = require('shared/repo-singleton.js')

  const now = new Date()
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const dd = n => `${cur}-${String(n).padStart(2, '0')}`

  // 12 条正常 + 1 条取消，覆盖三种课程类型与四个学生
  const rows = [
    { n: 2,  t: '1对1 数学', r: 200, s: '李思远', a: '16:00', b: '18:00', h: 2 },
    { n: 3,  t: '小班英语',   r: 150, s: '王雨桐', a: '19:00', b: '21:00', h: 2 },
    { n: 4,  t: '1对1 数学', r: 200, s: '李思远', a: '16:00', b: '18:00', h: 2 },
    { n: 5,  t: '线上物理',   r: 300, s: '张一鸣', a: '09:00', b: '10:30', h: 1.5 },
    { n: 6,  t: '小班英语',   r: 150, s: '王雨桐', a: '19:00', b: '21:00', h: 2 },
    { n: 8,  t: '线上物理',   r: 300, s: '张一鸣', a: '09:00', b: '10:30', h: 1.5 },
    { n: 9,  t: '1对1 数学', r: 200, s: '李思远', a: '16:00', b: '18:00', h: 2 },
    { n: 10, t: '小班英语',   r: 150, s: '王雨桐', a: '19:00', b: '20:30', h: 1.5 },
    { n: 11, t: '暑期集训',   r: 180, s: '赵梓涵', a: '10:00', b: '12:00', h: 2 },
    { n: 12, t: '线上物理',   r: 300, s: '张一鸣', a: '09:00', b: '11:00', h: 2 },
    { n: 13, t: '1对1 数学', r: 200, s: '李思远', a: '16:00', b: '18:00', h: 2 },
    { n: 15, t: '暑期集训',   r: 180, s: '赵梓涵', a: '10:00', b: '12:00', h: 2 }
  ]

  return C.applyImport({
    fileName: '示例课程表.xlsx', fileHash: 'review-shots', sheetName: '上课记录',
    columnMap: {},
    rows: rows.map((x, i) => ({
      rowNumber: i + 2,
      courseTypeName: x.t, rate: x.r, student: x.s,
      date: dd(x.n), startTime: x.a, endTime: x.b, hours: x.h,
      issues: [], isDuplicate: false, isSample: false, selected: true,
      isNewCourseType: true, courseTypeId: null
    }))
  }, repo.repo).then(r => r.inserted)
})
console.log(`  已写入 ${seeded} 条记录`)

// 补一条"已取消"，展示状态标签
await mp.evaluate(() => {
  const repo = require('shared/repo-singleton.js')
  const now = new Date()
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return repo.repo.saveRecord({
    id: 'review-cancelled', courseTypeId: null, courseTypeName: '小班英语',
    courseTypeKind: '小班', rate: 150, student: '王雨桐', date: `${cur}-14`,
    startTime: '19:00', endTime: '21:00', hours: 2, status: 'cancelled',
    source: 'manual', batchId: null, note: '学生请假', createdAt: new Date().toISOString()
  })
})

// 核对底层数据确实就绪，避免又截到空态
const check = await mp.evaluate(async () => {
  const C = require('core/index.js')
  const repo = require('shared/repo-singleton.js')
  const now = new Date()
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const rs = await repo.repo.listRecords(cur)
  const s = C.summarize(rs)
  return { count: rs.length, amount: s.totalAmount, hours: s.totalHours }
})
console.log(`  底层核对：${check.count} 条 / 金额 ${check.amount} / 课时 ${check.hours}`)
if (check.count === 0) throw new Error('数据未就绪，中止截图')

// ---------------------------------------------------------------
// 2. 逐页截图
// ---------------------------------------------------------------
console.log('\n开始截图…')

// 汇总页 · 日历视图（默认视图，能看到每日收入）
let pg = await freshTab('pages/summary/index')
await pg.setData({ view: 'calendar' })
await sleep(600)
await shot('01-月度汇总-日历')

// 汇总页 · 列表视图（按学生分组，最能体现统计价值）
pg = await mp.currentPage()
await pg.setData({ view: 'list', tab: 'student' })
await sleep(600)
await shot('02-月度汇总-按学生')

// 记录页 · 列表（信息最丰富）
pg = await freshTab('pages/records/index')
await pg.setData({ view: 'list' })
await sleep(600)
await shot('03-上课记录-列表')

// 记录页 · 日历（每日课次与金额）
pg = await mp.currentPage()
await pg.setData({ view: 'calendar' })
await sleep(600)
await shot('04-上课记录-日历')

// 课程类型
await freshTab('pages/courses/index')
await shot('05-课程类型')

// 设置（含备份提醒、存储用量）
await freshTab('pages/settings/index')
await shot('06-设置')

// 备份与恢复（分包）
await navTo('packageImport/pages/backup/index')
await shot('07-备份与恢复')

// Excel 导入（分包）· 入口
await navTo('packageImport/pages/import/index')
await shot('08-Excel导入-入口')

// Excel 导入（分包）· 解析预览
// 这是最能体现导入能力的一屏：列自动识别、逐行勾选、重复标记、课时计算。
// 系统文件选择框无法自动化点击，故 mock 掉（其余全是产品真实代码）。
await navTo('packageImport/pages/import/index')
const previewOk = await (async () => {
  try {
    // 生成一份待导入的 xlsx 并落到用户目录
    const filePath = await mp.evaluate(() => {
      const W = require('packageImport/core-workbook.js')
      const wb = W.createImportTemplateWorkbook()
      const buf = W.workbookToArrayBuffer(wb)
      const p = `${wx.env.USER_DATA_PATH}/待导入课程表.xlsx`
      wx.getFileSystemManager().writeFileSync(p, buf)
      return p
    })

    await mp.mockWxMethod('chooseMessageFile', {
      tempFiles: [{ path: filePath, name: '待导入课程表.xlsx', size: 18000 }],
      errMsg: 'chooseMessageFile:ok'
    })

    const pg = await mp.currentPage()
    const btns = await pg.$$('.btn')
    for (const b of btns) {
      if ((await b.text()).includes('从聊天记录选择')) { await b.tap(); break }
    }
    await sleep(2500)
    await shot('09-Excel导入-预览')
    return true
  } catch (e) {
    console.log('  (导入预览截图失败:', e.message, ')')
    return false
  } finally {
    try { await mp.restoreWxMethod('chooseMessageFile') } catch { /* ignore */ }
  }
})()
if (!previewOk) console.log('  跳过导入预览')

// 月报导出（分包）
await navTo('packageImport/pages/export/index')
await shot('10-月报导出')

console.log(`\n截图完成：${OUT}`)
await mp.disconnect()
