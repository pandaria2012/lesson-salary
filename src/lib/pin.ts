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

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const h = await pbkdf2(pin, salt)
  return h === hash
}
