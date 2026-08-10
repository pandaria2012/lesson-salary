import { describe, expect, it } from 'vitest'
import { constantTimeEqual, generateSalt, hashPin, verifyPin } from '../src/lib/pin'

describe('pin', () => {
  it('相同 pin+盐 哈希一致，verify 通过', async () => {
    const salt = generateSalt()
    const h = await hashPin('1234', salt)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifyPin('1234', salt, h)).toBe(true)
  })
  it('错误 pin 校验失败', async () => {
    const salt = generateSalt()
    const h = await hashPin('1234', salt)
    expect(await verifyPin('9999', salt, h)).toBe(false)
  })
  it('不同盐生成不同哈希', async () => {
    const h1 = await hashPin('1234', generateSalt())
    const h2 = await hashPin('1234', generateSalt())
    expect(h1).not.toBe(h2)
  })
  it('verifyPin 对篡改后的存储哈希返回 false', async () => {
    const salt = generateSalt()
    const h = await hashPin('1234', salt)
    const tampered = h.slice(0, -1) + (h.endsWith('0') ? '1' : '0')
    expect(await verifyPin('1234', salt, tampered)).toBe(false)
  })
})

describe('constantTimeEqual', () => {
  it('相同 hex 返回 true', () => {
    const h = 'a'.repeat(64)
    expect(constantTimeEqual(h, h)).toBe(true)
  })
  it('同长度不同 hex 返回 false', () => {
    expect(constantTimeEqual('a'.repeat(64), 'a'.repeat(63) + 'b')).toBe(false)
  })
  it('长度不一致直接 false', () => {
    expect(constantTimeEqual('ab', 'abcd')).toBe(false)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
  })
})
