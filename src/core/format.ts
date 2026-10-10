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
