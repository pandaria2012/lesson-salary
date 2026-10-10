/**
 * 小程序自动化调试 / 冒烟测试。
 *
 * ## 前置条件（已从源码逆向确认）
 *
 * 1. **服务端口必须由 GUI 开启**
 *    微信开发者工具 → 设置 → 安全设置 → 服务端口
 *    原理：CLI 检查 `User Data/<hash>/Default/.ide-status` 是否为 "On"：
 *      const m = path.join(userDirPath, ".ide-status")
 *      if ("On" !== ("" + f).trim()) { error("IDE service port disabled...") }
 *    该文件只由 GUI 写入（app.asar 内 IdeService 写 "On" / _writeIdeStatusOff 写 "Off"）。
 *
 * 2. **必须开启 TypeScript 编译插件**
 *    project.config.json → setting.useCompilerPlugins = ["typescript"]
 *    原理：小程序代码包只接受 wxml/wxss/js/json/wxs。只写 .ts 时
 *    DevTools 报 `未找到 ["pages"][0] 对应的 pages/summary/index.js 文件`。
 *
 * ## 用法
 *
 *   node scripts/mp-automator.mjs --check    # 只自检前置条件
 *   node scripts/mp-automator.mjs            # 自检 → 确保 auto → 连接 → 冒烟
 *   node scripts/mp-automator.mjs --shot     # 额外对每个主包页面截图
 */
import { existsSync, readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLI = 'E:\\rio\\editor\\微信web开发者工具\\cli.bat'
const WS = 'ws://127.0.0.1:9420'
const SHOT = process.argv.includes('--shot')

function userDirs() {
  const base = path.join(os.homedir(), 'AppData', 'Local', '微信开发者工具', 'User Data')
  if (!existsSync(base)) return []
  return readdirSync(base).map(n => path.join(base, n)).filter(p => existsSync(path.join(p, 'Default')))
}

function preflight() {
  const checks = []

  checks.push({ name: 'cli.bat 存在', ok: existsSync(CLI), detail: CLI })

  let portOn = false, portDetail = '未找到 User Data 目录'
  for (const d of userDirs()) {
    const f = path.join(d, 'Default', '.ide-status')
    const raw = existsSync(f) ? readFileSync(f, 'utf8').trim() : '(不存在)'
    if (raw === 'On') { portOn = true; portDetail = `${raw}  (${f})` }
    else if (portDetail === '未找到 User Data 目录') portDetail = `${raw}  (${f})`
  }
  checks.push({ name: '服务端口已开启', ok: portOn, detail: portDetail })

  const pc = path.join(ROOT, 'project.config.json')
  let pcOk = false, pcDetail = '不存在'
  if (existsSync(pc)) {
    try {
      const j = JSON.parse(readFileSync(pc, 'utf8'))
      const plugins = j.setting?.useCompilerPlugins
      const hasTs = Array.isArray(plugins) && plugins.includes('typescript')
      pcOk = hasTs && !!j.appid && !!j.projectname && !!j.miniprogramRoot
      pcDetail = hasTs
        ? `appid=${j.appid} root=${j.miniprogramRoot} useCompilerPlugins=${JSON.stringify(plugins)}`
        : `useCompilerPlugins 未含 "typescript"（当前 ${JSON.stringify(plugins)}）→ DevTools 找不到 .js 文件`
    } catch (e) { pcDetail = `解析失败: ${e.message}` }
  }
  checks.push({ name: 'project.config.json 允许 TS 编译插件', ok: pcOk, detail: pcDetail })

  const coreOk = existsSync(path.join(ROOT, 'miniprogram/core/index.js'))
  checks.push({ name: 'core 产物已生成', ok: coreOk, detail: coreOk ? 'OK' : '请运行 npm run build:core' })

  return checks
}

function report(checks) {
  console.log('\n  小程序自动化前置条件\n')
  for (const c of checks) {
    console.log(`    ${c.ok ? '[✓]' : '[✗]'} ${c.name}`)
    console.log(`        ${c.detail}`)
  }
  const bad = checks.filter(c => !c.ok)
  console.log('')
  if (bad.length) {
    console.log('  未就绪：')
    for (const b of bad) console.log(`    - ${b.name}`)
    console.log('')
    if (bad.some(b => b.name.includes('服务端口'))) {
      console.log('  ⚠️ 服务端口只能由人在 GUI 开启（CLI 无法自行开启，已从源码确认）：')
      console.log('     微信开发者工具 → 设置 → 安全设置 → 服务端口\n')
    }
    return false
  }
  console.log('  全部就绪\n')
  return true
}

/** 确保 IDE 项目窗口已打开（cli open） */
function ensureOpen() {
  console.log('  打开项目窗口（cli open）…')
  const r = spawnSync(CLI, ['open', '--project', ROOT], {
    encoding: 'utf8', timeout: 120000
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  console.log(/√ open/.test(out) ? '  项目窗口已打开\n' : `  警告：cli open 输出异常\n${out.slice(0, 400)}\n`)
}

/** 确保自动化宿主就绪（cli auto 会在 DevTools 内开 9420 的自动化 socket） */
function ensureAuto() {
  console.log('  启动自动化宿主（cli auto）…')
  const r = spawnSync(CLI, ['auto', '--project', ROOT, '--auto-port', '9420'], {
    encoding: 'utf8', timeout: 120000
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  const ok = /√ auto/.test(out)
  if (ok) console.log('  自动化宿主已就绪\n')
  else console.log(`  注意：cli auto 未返回成功标记（可能已在运行）\n　　　${out.trim().split('\n').slice(-2).join(' / ')}\n`)
}

async function connectWithRetry(tries = 5) {
  const automator = (await import('miniprogram-automator')).default
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  for (let i = 1; i <= tries; i++) {
    try {
      const mp = await automator.connect({ wsEndpoint: WS })
      console.log(`  已连接（第 ${i} 次尝试）\n`)
      return mp
    } catch (e) {
      const msg = e.message.split('\n')[0]
      console.log(`    第 ${i} 次连接失败：${msg}`)
      if (i < tries) {
        // 自动化 socket 需要项目窗口完成编译后才就绪；
        // 每轮重试都重新触发一次 cli auto（幂等），提高成功率。
        await sleep(6000)
        if (i % 2 === 0) ensureAuto()
      }
    }
  }
  throw new Error('无法连接自动化端口。请确认：1) 服务端口已开 2) 项目窗口已打开 3) TS 编译插件已启用')
}

async function smoke(mp) {
  const results = []
  const check = async (name, fn) => {
    try {
      const v = await fn()
      results.push({ name, ok: true })
      console.log(`    [✓] ${name}${v !== undefined ? ` → ${v}` : ''}`)
    } catch (e) {
      results.push({ name, ok: false, err: e.message.split('\n')[0] })
      console.log(`    [✗] ${name} → ${e.message.split('\n')[0]}`)
    }
  }

  const sys = await mp.systemInfo().catch(() => null)
  if (sys) console.log(`  基础库 ${sys.SDKVersion}\n`)

  await check('冷启动落在汇总页', async () => (await mp.currentPage())?.path)

  // 主包四个页面
  for (const [label, url] of [
    ['记录', '/pages/records/index'],
    ['课程', '/pages/courses/index'],
    ['设置', '/pages/settings/index'],
    ['汇总', '/pages/summary/index']
  ]) {
    await check(`主包页面可打开：${label}`, async () => (await mp.switchTab(url))?.path)
  }

  // 分包三个页面（同时验证分包惰性加载）
  for (const [label, url] of [
    ['导入', '/packageImport/pages/import/index'],
    ['导出月报', '/packageImport/pages/export/index?month=2026-10'],
    ['备份恢复', '/packageImport/pages/backup/index']
  ]) {
    await check(`分包页面可打开：${label}`, async () => (await mp.navigateTo(url))?.path)
    await mp.navigateBack().catch(() => {})
  }

  // 真实 wx storage 读写（验证 wxRepo 在运行时可用）
  await check('wx storage 写入/读回一致', async () => {
    await mp.callWxMethod('setStorageSync', 'ls:__smoke', { v: 42 })
    const back = await mp.callWxMethod('getStorageSync', 'ls:__smoke')
    await mp.callWxMethod('removeStorageSync', 'ls:__smoke')
    if (back?.v !== 42) throw new Error(`读回 ${JSON.stringify(back)}`)
    return 'ok'
  })

  await check('存储信息可读（容量守卫依赖）', async () => {
    const info = await mp.callWxMethod('getStorageInfoSync')
    return `keys=${info.keys.length} current=${info.currentSize}KB limit=${info.limitSize}KB`
  })

  // 通过真实 UI 交互写入记录，验证 core → wxRepo → storage 全链路
  await check('补录一条记录（真实 UI 交互 + core + wxRepo）', async () => {
    await mp.switchTab('/pages/records/index')
    const page = await mp.currentPage()
    await page.waitFor(400)

    // 点「＋ 补录」打开表单（真实点击）
    const addBtn = await page.$('.fab')
    if (!addBtn) throw new Error('未找到补录按钮 .fab')
    await addBtn.tap()
    await page.waitFor(500)

    if (!(await page.data('formOpen'))) throw new Error('补录面板未打开')

    // 填表：直接 setData（等价用户手填，但比逐个 input 更稳定）
    await page.setData({
      'form.id': '',
      'form.date': '2026-10-05',
      'form.startTime': '13:00',
      'form.endTime': '15:00',
      'form.student': '自动化冒烟',
      'form.courseTypeId': '',
      'form.courseTypeName': '冒烟测试',
      'form.rate': '100',
      'form.hours': '2',
      'form.status': 'normal',
      'form.note': ''
    })
    await page.waitFor(200)

    // 点「保存」按钮（真实点击触发 onSave）
    // 注意：Sheet 是自定义组件，其 slot 内容不在 .sheet 选择器作用域内，
    // 因此这里用 `.btn` 并按文本匹配，而不是 `.sheet .btn`。
    const btns = await page.$$('.btn')
    let tapped = false
    for (const b of btns) {
      const t = (await b.text()).trim()
      if (t === '保存' || t.includes('保存')) { await b.tap(); tapped = true; break }
    }
    if (!tapped) throw new Error(`未找到「保存」按钮（现有：${(await Promise.all(btns.map(b => b.text()))).join('/')}）`)
    await page.waitFor(1000)

    const rows = await mp.callWxMethod('getStorageSync', 'ls:records:2026-10')
    if (!Array.isArray(rows) || rows.length === 0) {
      // 顺带把页面上的错误提示带出来，便于定位
      const msg = await page.data('formOpen')
      throw new Error(`storage 中未见该月分片（formOpen=${msg}）`)
    }
    const hit = rows.find(r => r.student === '自动化冒烟')
    if (!hit) throw new Error(`分片中未找到该记录：${JSON.stringify(rows).slice(0, 200)}`)
    return `已写入 ls:records:2026-10（${rows.length} 条）`
  })

  await check('汇总页读到新记录（本月收入）', async () => {
    await mp.switchTab('/pages/summary/index')
    const page = await mp.currentPage()
    await page.waitFor(900)
    const d = await page.data()
    // 100 元/时 × 2 小时 = 200
    if (d.totalAmount !== '200.00') {
      throw new Error(`预期 200.00，实际 ${d.totalAmount}（count=${d.totalCount}）`)
    }
    return `totalAmount=${d.totalAmount} totalCount=${d.totalCount}`
  })

  // 清理冒烟数据
  await check('清理冒烟数据', async () => {
    await mp.callWxMethod('removeStorageSync', 'ls:records:2026-10')
    await mp.callWxMethod('removeStorageSync', 'ls:records:index')
    await mp.callWxMethod('removeStorageSync', 'ls:courseTypes')
    return 'ok'
  })

  if (SHOT) {
    const dir = path.join(ROOT, 'test-results')
    mkdirSync(dir, { recursive: true })
    for (const [label, url] of [
      ['summary', '/pages/summary/index'],
      ['records', '/pages/records/index'],
      ['courses', '/pages/courses/index'],
      ['settings', '/pages/settings/index']
    ]) {
      await check(`截图 ${label}`, async () => {
        await mp.switchTab(url)
        const pg = await mp.currentPage()
        await pg.waitFor(700)
        const f = path.join(dir, `mp-${label}.png`)
        await mp.screenshot({ path: f })
        return f.replace(ROOT + path.sep, '')
      })
    }
  }

  await mp.disconnect()
  console.log('')
  const bad = results.filter(r => !r.ok)
  if (bad.length) {
    console.log(`  ${bad.length}/${results.length} 项失败\n`)
    process.exitCode = 1
  } else {
    console.log(`  冒烟全部通过（${results.length} 项）\n`)
  }
}

async function main() {
  const checks = preflight()
  if (!report(checks)) { process.exitCode = 1; return }
  if (process.argv.includes('--check')) return

  ensureOpen()
  ensureAuto()
  const mp = await connectWithRetry()
  await smoke(mp)
}

main().catch(err => {
  console.error(`\n  执行失败：${err?.message ?? err}\n`)
  console.error('  排查顺序：')
  console.error('    1. 服务端口是否开启（设置 → 安全设置）')
  console.error('    2. 项目窗口是否打开：cli open --project <路径>')
  console.error('    3. 是否开启了 TS 编译插件（useCompilerPlugins）\n')
  process.exitCode = 1
})
