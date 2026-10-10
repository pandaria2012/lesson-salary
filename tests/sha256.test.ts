import { describe, expect, it } from 'vitest'
import { fileHash, sha256Hex } from '../src/core/sha256'

const enc = new TextEncoder()

describe('sha256', () => {
  it('标准测试向量', () => {
    expect(sha256Hex(enc.encode(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    expect(sha256Hex(enc.encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(sha256Hex(enc.encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    )
  })

  it('跨块边界（55/56/63/64/65 字节）', () => {
    // 这组长度覆盖 padding 恰好塞满一块、以及需要补第二块的分界
    expect(sha256Hex(enc.encode('a'.repeat(55)))).toBe(
      '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'
    )
    expect(sha256Hex(enc.encode('a'.repeat(56)))).toBe(
      'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'
    )
    expect(sha256Hex(enc.encode('a'.repeat(63)))).toBe(
      '7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34'
    )
    expect(sha256Hex(enc.encode('a'.repeat(64)))).toBe(
      'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'
    )
    expect(sha256Hex(enc.encode('a'.repeat(65)))).toBe(
      '635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0'
    )
  })

  it('一百万个 a 的标准向量', () => {
    expect(sha256Hex(enc.encode('a'.repeat(1000000)))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
    )
  })

  it('fileHash 返回 64 位小写 hex，且与 Web Crypto 一致', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const mine = fileHash(bytes.buffer)
    expect(mine).toMatch(/^[0-9a-f]{64}$/)

    // 与浏览器/Node 的 crypto.subtle 交叉验证（Node 18+ 提供全局 crypto.subtle）
    const ref = await crypto.subtle.digest('SHA-256', bytes)
    const expected = Array.from(new Uint8Array(ref)).map(b => b.toString(16).padStart(2, '0')).join('')
    expect(mine).toBe(expected)
  })
})
