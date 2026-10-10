export function fmtMoney(n: number): string {
  return n.toFixed(2)
}

export function fmtHours(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 'YYYY-MM-DD HH:mm:ss'，**本地时区**。
 *
 * ⚠️ 不要用 `toISOString().slice(...)` 代替：`toISOString()` 返回 UTC，
 * 在 UTC+8 下会把本地 00:00~07:59 的时间算成前一天。
 * 本函数一律取本地分量（getFullYear/getMonth/...），与用户看到的日期一致。
 *
 * 非法输入返回空串（调用方负责兜底显示）。
 */
export function fmtDateTime(value: Date | string | number): string {
  const d = toDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** 'YYYY-MM-DD'，本地时区。用于只需要日期的场景（如导出文件名前缀）。 */
export function fmtDate(value: Date | string | number): string {
  const d = toDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * 文件名安全的时间戳 'YYYY-MM-DD_HHmmss'，本地时区。
 *
 * 为什么不直接用 fmtDateTime：文件名里的冒号在 Windows / 微信文件分享
 * 传输链路上是非法或易出错的字符，因此改用下划线并去掉秒内分隔。
 * 保留到秒，避免同一天多次备份互相覆盖。
 */
export function fmtFileStamp(value: Date | string | number): string {
  const d = toDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_` +
    `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

/**
 * 由记录日期算出覆盖范围标签，用作备份文件名的核心部分。
 *
 * 语义：文件名描述的是**数据内容覆盖的日期范围**，不是导出时刻 ——
 * 这样文件名本身就是"这份备份装了什么"的说明，且重复导出同一批数据
 * 会得到同样的名字（可覆盖，不会堆积文件）。
 *
 * 同时给出**月首与月末**：范围两端各取所在月的第一天与最后一天，
 * 让"跨月备份"的边界一眼可见。
 *
 *   单月      2026-08-10 .. 2026-08-31   → '2026-08-01_2026-08-31'
 *   跨月      2026-08-10 .. 2026-09-05   → '2026-08-01_2026-09-30'
 *   同年单月  同上                        → '2026-08-01_2026-08-31'
 *   跨年      2025-12-20 .. 2026-01-05   → '2025-12-01_2026-01-31'
 *   空集合（无记录）                      → '空'
 *
 * 说明：两端都取"整月边界"而不是记录的真实首末日，
 * 是为了让名字稳定（同一批月份的数据改名后仍是同一个名字）
 * 且不泄露具体上课日期这类更细的个人信息。
 */
export function fmtMonthRange(dates: Array<string | null | undefined>): string {
  const months = dates
    .map(d => (typeof d === 'string' ? d.trim().slice(0, 7) : ''))
    .filter(m => /^\d{4}-\d{2}$/.test(m))
    .sort()

  if (months.length === 0) return '空'

  const first = months[0]
  const last = months[months.length - 1]
  return `${first}-01_${monthEnd(last)}`
}

/** 某月最后一天，'YYYY-MM-DD'。'2026-02' → '2026-02-28'（自动处理闰年） */
function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return ''
  // 下月第 0 天 = 本月最后一天
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
