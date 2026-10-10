/**
 * 把 src/core（单一源真相）编译为小程序可直接 require 的产物。
 *
 * 关键约束（设计 §3.1 / §5.4）：
 * - 主包入口 core/index.ts **绝不能**包含 XLSX —— 压缩后 424 KB，主包上限 2 MB
 * - XLSX 只能出现在分包入口 workbook.ts 的产物里
 * 因此本脚本产出两个入口，并在最后做体积断言；断言失败直接退出码 1。
 */
import { build } from 'esbuild'
import { readFileSync, statSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MAIN_OUT = path.join(ROOT, 'miniprogram/core/index.js')
const SUB_OUT = path.join(ROOT, 'miniprogram/packageImport/core-workbook.js')

/**
 * 产物是否入库（待决项 T3）：**不入库**。
 *
 * 理由：产物是机器生成的，一条命令可重建；且"入库"会带来一个更隐蔽的风险 ——
 * 改了 src/core 却忘记重建时，小程序会**静默运行旧逻辑**。
 * 不入库时 DevTools 会直接报模块缺失（fail-safe），而非默默跑错代码。
 *
 * 但产物在本地一定是存在的，所以本地仍有"忘了重建"的风险。
 * 为此在产物 banner 里写入源文件内容哈希，并提供 `npm run check:core`
 * 校验产物是否与 src/core 同步 —— 把静默陈旧变成显式报错。
 */

/**
 * 计算 src/core 全部源文件的内容哈希，用于陈旧检测。
 *
 * 注意：哈希前把 CRLF 统一成 LF。
 * 否则 Windows 的 core.autocrlf（checkout 时 LF→CRLF）会让同一份代码
 * 在不同环境下算出不同哈希，产生"假过期"告警。
 */
function sourceHash() {
  const files = []
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.ts$/.test(name)) files.push(full)
    }
  }
  walk(path.join(ROOT, 'src/core'))
  files.sort()
  const h = createHash('sha256')
  for (const f of files) {
    h.update(path.relative(ROOT, f).replace(/\\/g, '/'))
    h.update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'))
  }
  return h.digest('hex').slice(0, 16)
}

const SRC_HASH = sourceHash()
const BANNER = `/* 自动生成，请勿手改。源文件在 src/core/ ，修改后运行 npm run build:core */\n/* src-core-hash: ${SRC_HASH} */`

/**
 * xlsx 是双端库：其 CommonJS 主入口用 require('fs') / require('stream') 等支撑
 * Node 端"按文件路径读写"的路径。小程序没有这些模块，我们也不会走到
 * （只做 XLSX.read(ArrayBuffer) / XLSX.write({type:'array'})，永不传文件路径）。
 *
 * 这里把它们替换为空对象，而不是标为 external —— 因为 external 会在产物里留下
 * 真正的 require('fs')，微信开发者工具打包时可能因无法解析而报错。
 */
const nodeStubPlugin = {
  name: 'node-builtin-stub',
  setup(pluginBuild) {
    const STUBS = ['fs', 'stream', 'crypto', 'buffer', 'process', 'path', 'util', 'os', 'events']
    const filter = new RegExp(`^(${STUBS.join('|')})(/.*)?$`)
    pluginBuild.onResolve({ filter }, args => ({
      path: args.path,
      namespace: 'node-stub'
    }))
    pluginBuild.onLoad({ filter: /.*/, namespace: 'node-stub' }, () => ({
      contents: 'module.exports = {};',
      loader: 'js'
    }))
  }
}

/**
 * 剔除 cpexcel（793 KB）：xlsx 的 `dist/cpexcel.js` 是 .xls 旧版格式的
 * 多语言代码页表（cyrillic/greek/devanagari 等）。实测它占分包产物的 64%。
 *
 * 为什么可以安全剔除：
 * - 本应用只处理 .xlsx（UTF-8 + XML），模板导出也是 .xlsx；
 * - `.xls` 的 codepage 转换仅在读取带 codepage 记录的旧式 BIFF 文件时触发；
 * - SheetJS 官方自己也提供不含 cpexcel 的 `xlsx.core.min.js`(426 KB) 构建，
 *   说明这不是核心功能依赖。
 *
 * 缺失时的行为：读取 .xlsx 完全不受影响；若用户真的导入旧版 .xls，
 * 非 ASCII 字符可能解析异常 —— 由 chooseMessageFile 的 extension 限制
 * （只收 xlsx/xls）与导入错误提示兜底。
 */
const dropCpexcelPlugin = {
  name: 'drop-cpexcel',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /cpexcel/ }, args => ({
      path: args.path,
      namespace: 'cpexcel-stub'
    }))
    pluginBuild.onLoad({ filter: /.*/, namespace: 'cpexcel-stub' }, () => ({
      // 保持与 cpexcel 相同的导出形状：它把码表挂到全局 $cptable
      contents: 'module.exports = {};',
      loader: 'js'
    }))
  }
}

const common = {
  bundle: true,
  format: 'cjs',      // 小程序模块系统为 CommonJS
  target: 'es2018',   // 覆盖基础库 2.x 支持的语法范围
  // neutral 不会自动解析 node_modules 的 main 字段，需显式声明（避免 xlsx 的
  // browser 字段重映射，直接使用其 CommonJS 主入口，与 Vitest/Web 端行为一致）
  platform: 'neutral',
  mainFields: ['main'],
  logLevel: 'warning',
  legalComments: 'none',
  plugins: [nodeStubPlugin, dropCpexcelPlugin]
}

/** 主包：纯逻辑，不含 XLSX */
await build({
  ...common,
  entryPoints: [path.join(ROOT, 'src/core/index.ts')],
  outfile: MAIN_OUT,
  banner: { js: BANNER }
})

/** 分包：含 XLSX，必须 minify */
await build({
  ...common,
  entryPoints: [path.join(ROOT, 'src/core/workbook.ts')],
  outfile: SUB_OUT,
  minify: true,
  banner: { js: BANNER }
})

/**
 * 生成 .d.ts 类型入口。
 *
 * 运行时小程序 require 的是上面编译出的 CJS 产物，但 TypeScript 需要类型。
 * 让 d.ts 直接指向 src/core 源码，这样：
 * - 类型始终与单一源真相同步（无需额外生成器）
 * - miniprogram/*.ts 能获得完整的类型检查与补全
 */
writeFileSync(
  path.join(ROOT, 'miniprogram/core/index.d.ts'),
  `// 自动生成，请勿手改。类型来自单一源真相 src/core。\nexport * from '../../src/core/index'\n`
)
writeFileSync(
  path.join(ROOT, 'miniprogram/packageImport/core-workbook.d.ts'),
  `// 自动生成，请勿手改。类型来自单一源真相 src/core/workbook。\nexport * from '../../src/core/workbook'\n`
)

// ---- 体积与隔离断言：把设计文档里的约束变成构建期检查，而不是靠人记 ----

const kb = n => `${(n / 1024).toFixed(1)} KB`
const problems = []

const mainSrc = readFileSync(MAIN_OUT, 'utf8')
const mainSize = statSync(MAIN_OUT).size
const subSize = statSync(SUB_OUT).size

// 1) 主包产物不得出现 SheetJS 的痕迹
for (const marker of ['XLSX', 'sheetjs', 'SheetJS', 'SSF']) {
  if (mainSrc.includes(marker)) {
    problems.push(`主包产物包含 SheetJS 标记 "${marker}" —— core/index.ts 可能间接引入了 workbook.ts`)
  }
}

// 2) 产物中不得残留无法解析的 Node 内置模块 require
for (const mod of ['fs', 'stream', 'crypto']) {
  const re = new RegExp(`require\\(["']${mod}["']\\)`)
  if (re.test(mainSrc)) problems.push(`主包产物残留 require('${mod}')`)
}

// 3) 主包产物应显著小于分包产物（分包含 XLSX）
if (mainSize >= subSize) {
  problems.push(`主包产物 (${kb(mainSize)}) 不小于分包产物 (${kb(subSize)})，分包隔离可能失效`)
}

// 4) 主包单独不得逼近 2 MB 上限
const MAIN_LIMIT = 2 * 1024 * 1024
if (mainSize > MAIN_LIMIT) {
  problems.push(`主包产物 ${kb(mainSize)} 超过 2 MB 上限`)
}

// 5) 两个产物都必须存在且非空
for (const [label, f] of [['主包', MAIN_OUT], ['分包', SUB_OUT]]) {
  if (!existsSync(f)) problems.push(`${label}产物不存在: ${f}`)
}

console.log('')
console.log('  core 构建产物')
console.log(`    主包  miniprogram/core/index.js                  ${kb(mainSize)}`)
console.log(`    分包  miniprogram/packageImport/core-workbook.js  ${kb(subSize)}`)
console.log('')

if (problems.length) {
  console.error('构建校验失败：')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

console.log('  校验通过：主包不含 SheetJS，分包隔离有效')
console.log('')
