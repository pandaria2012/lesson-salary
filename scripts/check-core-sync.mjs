/**
 * 校验 miniprogram/core 与 miniprogram/packageImport/core-workbook.js
 * 是否与 src/core 保持同步（待决项 T3 的配套措施）。
 *
 * 为什么需要：产物不入库，本地一旦改了 src/core 却忘记重建，
 * 小程序会静默运行旧逻辑。此脚本把"静默陈旧"变成显式报错。
 *
 * 用法: npm run check:core   （退出码非 0 表示产物已过期）
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = [
  'miniprogram/core/index.js',
  'miniprogram/packageImport/core-workbook.js'
]

/**
 * 计算 src/core 的哈希。CRLF 统一为 LF 后再算，
 * 避免 Windows autocrlf 导致跨环境"假过期"（与 build-core.mjs 保持一致）。
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

const expected = sourceHash()
const problems = []

for (const rel of TARGETS) {
  const full = path.join(ROOT, rel)
  if (!existsSync(full)) {
    problems.push(`${rel} 不存在 —— 请运行 npm run build:core`)
    continue
  }
  const head = readFileSync(full, 'utf8').slice(0, 400)
  const m = head.match(/src-core-hash:\s*([0-9a-f]+)/)
  if (!m) {
    problems.push(`${rel} 缺少 hash 标记 —— 请重新运行 npm run build:core`)
    continue
  }
  if (m[1] !== expected) {
    problems.push(`${rel} 已过期（产物 ${m[1]} ≠ 源码 ${expected}）—— 请运行 npm run build:core`)
  }
}

if (problems.length) {
  console.error('core 产物检查失败：')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

console.log(`core 产物与源码同步（src-core-hash: ${expected}）`)
