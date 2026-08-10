import { describe, expect, it } from 'vitest'
import { generateSalt, hashPin, verifyPin } from '../src/lib/pin'

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
})
