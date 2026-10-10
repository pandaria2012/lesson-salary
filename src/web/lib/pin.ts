const enc = new TextEncoder()

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function pbkdf2(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function hashPin(pin: string, salt: string): Promise<string> {
  return pbkdf2(pin, salt)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** 恒定时间比较两个 hex 字符串（长度/格式不一致直接 false）。 */
export function constantTimeEqual(hexA: string, hexB: string): boolean {
  if (hexA.length !== hexB.length || hexA.length % 2 !== 0) return false
  if (!/^[0-9a-f]+$/i.test(hexA) || !/^[0-9a-f]+$/i.test(hexB)) return false
  const a = hexToBytes(hexA)
  const b = hexToBytes(hexB)
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const h = await pbkdf2(pin, salt)
  return constantTimeEqual(h, hash)
}
