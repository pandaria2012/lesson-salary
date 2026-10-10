import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtFileStamp, fmtHours, fmtMoney } from '../src/core/format'

describe('format', () => {
  it('金额保留两位', () => {
    expect(fmtMoney(500)).toBe('500.00')
    expect(fmtMoney(400.5)).toBe('400.50')
  })

  it('小时去尾零', () => {
    expect(fmtHours(2.5)).toBe('2.5')
    expect(fmtHours(2.75)).toBe('2.75')
    expect(fmtHours(2)).toBe('2')
  })
})

describe('fmtDateTime（本地时区 YYYY-MM-DD HH:mm:ss）', () => {
  it('格式化本地时间，各分量补零', () => {
    // 用本地分量构造，避免受运行环境时区影响
    expect(fmtDateTime(new Date(2026, 7, 10, 13, 5, 9))).toBe('2026-08-10 13:05:09')
    expect(fmtDateTime(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01 00:00:00')
    expect(fmtDateTime(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31 23:59:59')
  })

  it('接受 ISO 字符串与时间戳', () => {
    const d = new Date(2026, 7, 10, 9, 30, 0)
    expect(fmtDateTime(d.toISOString())).toBe('2026-08-10 09:30:00')
    expect(fmtDateTime(d.getTime())).toBe('2026-08-10 09:30:00')
  })

  it('非法输入返回空串，不抛异常', () => {
    expect(fmtDateTime('')).toBe('')
    expect(fmtDateTime('not-a-date')).toBe('')
    expect(fmtDateTime(new Date('invalid'))).toBe('')
  })

  it('⚠️ 本地午夜前不使用 UTC 日期（toISOString 会算成前一天）', () => {
    // 这是原实现 "new Date().toISOString().slice(0,10)" 的真实缺陷：
    // 在 UTC+8 下，本地 2026-08-10 00:30 的 UTC 日期是 2026-08-09。
    const localEarly = new Date(2026, 7, 10, 0, 30, 0)
    expect(fmtDateTime(localEarly)).toMatch(/^2026-08-10 /)
    expect(fmtDate(localEarly)).toBe('2026-08-10')
    expect(fmtFileStamp(localEarly)).toBe('2026-08-10_003000')

    // 本地 23:30 同理：UTC 可能已跨到次日
    const localLate = new Date(2026, 7, 10, 23, 30, 0)
    expect(fmtDate(localLate)).toBe('2026-08-10')
    expect(fmtDateTime(localLate)).toMatch(/^2026-08-10 /)
  })
})

describe('fmtDate', () => {
  it('只输出日期', () => {
    expect(fmtDate(new Date(2026, 7, 5, 15, 0, 0))).toBe('2026-08-05')
  })
})

describe('fmtFileStamp（文件名安全，精确到秒）', () => {
  it('不含冒号等非法字符', () => {
    const s = fmtFileStamp(new Date(2026, 7, 10, 13, 5, 9))
    expect(s).toBe('2026-08-10_130509')
    expect(s).not.toMatch(/[:/\\*?"<>|]/)
  })

  it('同一天不同时刻不冲突（避免备份互相覆盖）', () => {
    const a = fmtFileStamp(new Date(2026, 7, 10, 9, 0, 0))
    const b = fmtFileStamp(new Date(2026, 7, 10, 9, 0, 1))
    expect(a).not.toBe(b)
  })
})
