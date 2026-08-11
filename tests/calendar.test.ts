import { describe, expect, it } from 'vitest'
import { buildDayMap, fmtDayLabel, monthGrid, todayStr } from '../src/lib/calendar'
import type { LessonRecord } from '../src/types'

function rec(over: Partial<LessonRecord> = {}): LessonRecord {
  return {
    id: 'r1', courseTypeId: 'ct1', courseTypeName: '数学', courseTypeKind: '一对一',
    rate: 200, student: '张三', date: '2026-08-10', startTime: '13:00', endTime: '15:00',
    hours: 2, status: 'normal', source: 'manual', batchId: null, note: '',
    createdAt: '2026-08-10T00:00:00.000Z', ...over
  }
}

describe('buildDayMap', () => {
  it('按日期聚合正常课收入与次数，取消课单独计数', () => {
    const map = buildDayMap([
      rec({ id: 'a' }),
      rec({ id: 'b', date: '2026-08-10', hours: 1, rate: 100 }),
      rec({ id: 'c', date: '2026-08-11', status: 'cancelled' }),
      rec({ id: 'd', date: '2026-08-11' })
    ])
    expect(map.get('2026-08-10')).toEqual({ count: 2, amount: 500, cancelledCount: 0 })
    expect(map.get('2026-08-11')).toEqual({ count: 1, amount: 400, cancelledCount: 1 })
  })
  it('空记录返回空 Map', () => {
    expect(buildDayMap([]).size).toBe(0)
  })
})

describe('monthGrid', () => {
  it('2026-08 共 31 天且为整 7 列', () => {
    const cells = monthGrid('2026-08')
    expect(cells.length % 7).toBe(0)
    expect(cells.filter(Boolean)).toHaveLength(31)
    expect(cells[0]).toBeNull() // 2026-08-01 是周六 → 周一起始前面 5 个占位
  })
  it('非法月份返回空数组', () => {
    expect(monthGrid('2026-13')).toEqual([])
    expect(monthGrid('abc')).toEqual([])
  })
})

describe('todayStr / fmtDayLabel', () => {
  it('fmtDayLabel 中文格式', () => {
    expect(fmtDayLabel('2026-08-10')).toBe('8月10日')
  })
  it('todayStr 格式 YYYY-MM-DD', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})