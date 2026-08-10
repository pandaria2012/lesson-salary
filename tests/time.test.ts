import { describe, expect, it } from 'vitest'
import { computeHours, parseExcelDate, parseTimeRange } from '../src/lib/time'

describe('parseExcelDate', () => {
  const now = new Date('2026-08-10T12:00:00+08:00')
  it('完整日期 yyyy-mm-dd / yyyy/m/d', () => {
    expect(parseExcelDate('2026-08-10', now)).toEqual({ date: '2026-08-10', ok: true })
    expect(parseExcelDate('2026/8/5', now)).toEqual({ date: '2026-08-05', ok: true })
  })
  it('缺年份 mm-dd 补当前年', () => {
    expect(parseExcelDate('08-10', now)).toEqual({ date: '2026-08-10', ok: true })
    expect(parseExcelDate('12-31', now)).toEqual({ date: '2026-12-31', ok: true })
    expect(parseExcelDate('08-30', now)).toEqual({ date: '2026-08-30', ok: true })
  })
  it('Date 对象', () => {
    expect(parseExcelDate(new Date(2026, 7, 3), now)).toEqual({ date: '2026-08-03', ok: true })
  })
  it('Excel 日期序列号', () => {
    expect(parseExcelDate(0, now)).toEqual({ date: '1899-12-30', ok: true })
    expect(parseExcelDate(45292, now)).toEqual({ date: '2024-01-01', ok: true })
  })
  it('不存在的日历日期 → ok=false', () => {
    expect(parseExcelDate('2026-02-30', now).ok).toBe(false)
    expect(parseExcelDate('2026-02-29', now).ok).toBe(false)
    expect(parseExcelDate('2026-04-31', now).ok).toBe(false)
    expect(parseExcelDate('02-30', now).ok).toBe(false)
  })
  it('闰年 2024-02-29 → ok', () => {
    expect(parseExcelDate('2024-02-29', now)).toEqual({ date: '2024-02-29', ok: true })
  })
  it('非法值返回 ok=false', () => {
    expect(parseExcelDate('abc', now).ok).toBe(false)
    expect(parseExcelDate('13-40', now).ok).toBe(false)
  })
})

describe('parseTimeRange', () => {
  it('13-15 → 13:00/15:00', () => {
    expect(parseTimeRange('13-15')).toEqual({ startTime: '13:00', endTime: '15:00', ok: true })
  })
  it('13:00-15:30 与 13:00~15 与 13:00至15:30', () => {
    expect(parseTimeRange('13:00-15:30').endTime).toBe('15:30')
    expect(parseTimeRange('13:00~15').endTime).toBe('15:00')
    expect(parseTimeRange('13:00至15:30').endTime).toBe('15:30')
  })
  it('只有开始时间 → endTime 为 null 且 ok', () => {
    expect(parseTimeRange('14:00')).toEqual({ startTime: '14:00', endTime: null, ok: true })
  })
  it('空值 → 全 null 且 ok', () => {
    expect(parseTimeRange('')).toEqual({ startTime: null, endTime: null, ok: true })
  })
  it('非法 → ok=false', () => {
    expect(parseTimeRange('25:99-26:00').ok).toBe(false)
  })
})

describe('computeHours', () => {
  it('常规区间', () => {
    expect(computeHours('13:00', '15:00')).toBe(2)
    expect(computeHours('13:00', '15:30')).toBe(2.5)
  })
  it('跨天 22:00-00:30 → 2.5', () => {
    expect(computeHours('22:00', '00:30')).toBe(2.5)
  })
  it('任一为空 → null', () => {
    expect(computeHours(null, '15:00')).toBeNull()
    expect(computeHours('13:00', null)).toBeNull()
  })
  it('越界时间 → null', () => {
    expect(computeHours('99:99', '99:99')).toBeNull()
    expect(computeHours('24:00', '01:00')).toBeNull()
    expect(computeHours('13:60', '15:00')).toBeNull()
  })
})
