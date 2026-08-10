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
