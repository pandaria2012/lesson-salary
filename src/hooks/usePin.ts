import { useCallback, useEffect, useState } from 'react'
import { generateSalt, hashPin, verifyPin } from '../lib/pin'
import { getSetting, setSetting } from '../db/repo'
import { db } from '../db/db'

const SALT_KEY = 'pin_salt'
const HASH_KEY = 'pin_hash'
const PIN_PATTERN = /^[0-9]{4,6}$/

export function usePin() {
  const [enabled, setEnabled] = useState(false)
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = async () => {
      try {
        const hash = await getSetting<string>(HASH_KEY)
        setEnabled(!!hash)
        setLocked(!!hash)
      } catch (err) {
        console.warn('PIN: 读取设置失败', err)
      } finally {
        setReady(true)
      }
    }
    refresh()
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(async () => {
          try {
            const hash = await getSetting<string>(HASH_KEY)
            if (hash) setLocked(true)
          } catch (err) {
            console.warn('PIN: 后台锁定检查失败', err)
          }
        }, 60000)
      } else if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const setup = useCallback(async (pin: string) => {
    if (!PIN_PATTERN.test(pin)) throw new Error('PIN 必须为 4~6 位数字')
    const salt = generateSalt()
    const hash = await hashPin(pin, salt)
    await setSetting(SALT_KEY, salt)
    await setSetting(HASH_KEY, hash)
    setEnabled(true)
    setLocked(false)
  }, [])

  const unlock = useCallback(async (pin: string) => {
    const salt = await getSetting<string>(SALT_KEY)
    const hash = await getSetting<string>(HASH_KEY)
    if (!salt || !hash) return false
    const ok = await verifyPin(pin, salt, hash)
    if (ok) setLocked(false)
    return ok
  }, [])

  const change = useCallback(async (oldPin: string, newPin: string) => {
    if (!PIN_PATTERN.test(newPin)) return false
    const ok = await unlock(oldPin)
    if (!ok) return false
    await setup(newPin)
    return true
  }, [unlock, setup])

  const disable = useCallback(async (oldPin: string) => {
    const ok = await unlock(oldPin)
    if (!ok) return false
    await db.settings.bulkDelete([HASH_KEY, SALT_KEY])
    setEnabled(false)
    return true
  }, [unlock])

  return { enabled, locked, ready, setup, unlock, change, disable }
}
