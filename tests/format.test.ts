import { describe, expect, it } from 'vitest'
import { fmtHours, fmtMoney } from '../src/lib/format'

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