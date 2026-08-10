import { describe, expect, it } from 'vitest'

describe('smoke', () => {
  it('测试环境可用', () => {
    expect(1 + 1).toBe(2)
  })
})