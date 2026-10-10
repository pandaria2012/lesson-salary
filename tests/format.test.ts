import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtFileStamp, fmtHours, fmtMoney, fmtMonthRange } from '../src/core/format'

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

describe('fmtMonthRange（备份文件名：数据覆盖的月份范围）', () => {
  it('单月：月首到月末', () => {
    expect(fmtMonthRange(['2026-08-10', '2026-08-11', '2026-08-16'])).toBe('2026-08-01_2026-08-31')
  })

  it('跨月：首月月初到末月月末', () => {
    expect(fmtMonthRange(['2026-08-10', '2026-09-05'])).toBe('2026-08-01_2026-09-30')
    expect(fmtMonthRange(['2026-01-31', '2026-03-01'])).toBe('2026-01-01_2026-03-31')
  })

  it('跨年', () => {
    expect(fmtMonthRange(['2025-12-20', '2026-01-05'])).toBe('2025-12-01_2026-01-31')
  })

  it('忽略顺序，取真实最小/最大月份', () => {
    expect(fmtMonthRange(['2026-09-01', '2026-07-15', '2026-08-20'])).toBe('2026-07-01_2026-09-30')
  })

  it('月末天数正确（含闰年 2 月）', () => {
    expect(fmtMonthRange(['2026-02-10'])).toBe('2026-02-01_2026-02-28')
    expect(fmtMonthRange(['2024-02-10'])).toBe('2024-02-01_2024-02-29')  // 闰年
    expect(fmtMonthRange(['2026-04-10'])).toBe('2026-04-01_2026-04-30')  // 小月
    expect(fmtMonthRange(['2026-12-10'])).toBe('2026-12-01_2026-12-31')
  })

  it('无记录返回「空」', () => {
    expect(fmtMonthRange([])).toBe('空')
    expect(fmtMonthRange([null, undefined, ''])).toBe('空')
    expect(fmtMonthRange(['abc', '2026'])).toBe('空')
  })

  it('忽略异常日期，只用合法月份', () => {
    expect(fmtMonthRange(['bad', '2026-08-10', null, '2026/9/1'])).toBe('2026-08-01_2026-08-31')
  })

  it('输出可安全用作文件名（无非法字符）', () => {
    const s = fmtMonthRange(['2025-12-20', '2026-01-05'])
    expect(s).not.toMatch(/[:/\\*?"<>|]/)
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/)
  })

  it('同一批数据重复调用结果稳定（保证备份可覆盖、不堆积）', () => {
    const a = fmtMonthRange(['2026-08-10', '2026-08-11'])
    const b = fmtMonthRange(['2026-08-11', '2026-08-10'])
    expect(a).toBe(b)
  })
})
