import type { LessonRecord } from '../types'

export interface DayInfo {
  /** 正常课次数 */
  count: number
  /** 正常课收入 */
  amount: number
  /** 已取消课次数 */
  cancelledCount: number
}

/** 由当月记录构建「日期 → 当日统计」 */
export function buildDayMap(records: LessonRecord[]): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>()
  for (const r of records) {
    const d = map.get(r.date) ?? { count: 0, amount: 0, cancelledCount: 0 }
    if (r.status === 'cancelled') {
      d.cancelledCount += 1
    } else {
      d.count += 1
      d.amount += r.rate !== null && r.hours !== null ? r.rate * r.hours : 0
    }
    map.set(r.date, d)
  }
  return map
}

/** 生成某月的日历格子（周一起始，7 列），null 表示非本月占位 */
export function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return []
  const first = new Date(y, m - 1, 1)
  const offset = (first.getDay() + 6) % 7 // 周一 = 0
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 今天的日期字符串 YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 8月10日 */
export function fmtDayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}月${Number(d)}日`
}