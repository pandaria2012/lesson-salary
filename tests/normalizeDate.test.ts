import { describe, expect, it } from 'vitest'
import { normalizeDate } from '../src/core/time'

describe('normalizeDate（存储层守门）', () => {
  it('标准格式原样返回', () => {
    expect(normalizeDate('2026-08-12')).toBe('2026-08-12')
    expect(normalizeDate('2026-12-31')).toBe('2026-12-31')
  })

  it('补齐非补零的月/日（关键：否则 slice(0,7) 会产生畸形分片）', () => {
    expect(normalizeDate('2026/8/12')).toBe('2026-08-12')
    expect(normalizeDate('2026-8-1')).toBe('2026-08-01')
    expect(normalizeDate('2026.8.12')).toBe('2026-08-12')
    expect(normalizeDate('2026年8月12日')).toBe('2026-08-12')
  })

  it('带时间的写法只取日期', () => {
    expect(normalizeDate('2026-08-12 13:00')).toBe('2026-08-12')
    expect(normalizeDate('2026-08-12T13:00:00')).toBe('2026-08-12')
    expect(normalizeDate('2026/8/12 13:00:00')).toBe('2026-08-12')
  })

  it('Date 对象与 Excel 序列号', () => {
    expect(normalizeDate(new Date(2026, 7, 12))).toBe('2026-08-12')
    // Excel 序列号以 1899-12-30 起算：46238 → 2026-08-04
    expect(normalizeDate(46238)).toBe('2026-08-04')
    expect(normalizeDate(46246)).toBe('2026-08-12')
  })

  it('无法识别返回 null，绝不返回半成品字符串', () => {
    for (const bad of ['', '   ', 'abc', '08-14', '13-40', '2026-13-01', '2026-08-40', null, undefined, {}, [], NaN]) {
      expect(normalizeDate(bad as unknown)).toBeNull()
    }
  })

  it('⚠️ 所有输出都必须是 YYYY-MM-DD，保证 slice(0,7) 得到合法月份', () => {
    const inputs = [
      '2026-08-12', '2026/8/12', '2026.8.12', '2026年8月12日',
      '2026-08-12 13:00', '2026-8-1', new Date(2026, 0, 5), 46238
    ]
    for (const v of inputs) {
      const out = normalizeDate(v)
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(out!.slice(0, 7)).toMatch(/^\d{4}-\d{2}$/)
    }
  })
})
